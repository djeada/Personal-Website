(function() {
    'use strict';

    // Leitner-style schedule: each box is the number of days until the next review.
    const INTERVALS = [0, 1, 3, 7, 16, 35, 90];
    const MASTERED_BOX = 4;
    const REQUEUE_GAP = 3;
    const SIZES = [10, 20, 50];
    const DAY = 86400000;

    const store = Learning.store('flashcards');
    const cache = new Map();
    const {
        el,
        link
    } = Learning;

    const state = {
        decks: [],
        data: null,
        srs: {},
        topics: new Set(),
        scope: 'due',
        size: 20,
        order: 'notes',
        session: null,
        picker: null,
        browseStatus: 'all',
        browseQuery: ''
    };

    const ui = {};

    function cache$() {
        [
            'cardsApp', 'setupScreen', 'studyScreen', 'summaryScreen', 'browseScreen', 'deckList', 'topicPicker',
            'topicSummary', 'topicList', 'scopeControl', 'scopeHint', 'sizeControl', 'orderControl', 'startSummary',
            'browseButton', 'startButton', 'studyCrumb', 'undoButton', 'studyCount', 'endButton', 'track', 'card',
            'cardTopic', 'cardTag', 'cardFront', 'cardBack', 'cardAnswer', 'cardSource', 'revealActions', 'revealButton',
            'rateActions', 'hintAgain', 'hintGood', 'hintEasy', 'keyHints', 'summaryScore', 'summaryTitle', 'summaryText',
            'summaryStats', 'moreButton', 'decksButton', 'summaryBrowseButton', 'againHeading', 'againList',
            'browseCrumb', 'browseBack', 'searchInput', 'browseCount', 'statusTabs', 'browseList', 'resetButton'
        ].forEach((id) => {
            ui[id] = document.getElementById(id);
        });
    }

    // ---------------------------------------------------------------------
    // Scheduling
    // ---------------------------------------------------------------------

    function today() {
        const now = new Date();
        return Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / DAY);
    }

    function loadSrs(slug) {
        const srs = store.get(`srs:${slug}`, null);
        if (srs) return srs;
        // Earlier versions only remembered which cards were "known".
        const legacy = store.get(slug, null);
        const migrated = {};
        if (legacy && Array.isArray(legacy.known)) {
            legacy.known.forEach((id) => {
                migrated[id] = {
                    box: 3,
                    due: today(),
                    reps: 1,
                    lapses: 0
                };
            });
        }
        return migrated;
    }

    function saveSrs() {
        store.set(`srs:${state.data.category.slug}`, state.srs);
    }

    function statusOf(card) {
        const record = state.srs[card.id];
        if (!record) return 'new';
        if (record.due <= today()) return 'due';
        return record.box >= MASTERED_BOX ? 'mastered' : 'learning';
    }

    function nextBox(record, rating) {
        const box = record ? record.box : 0;
        if (rating === 'again') return 0;
        return Math.min(box + (rating === 'easy' ? 2 : 1), INTERVALS.length - 1);
    }

    function formatInterval(days) {
        if (days <= 0) return 'today';
        if (days === 1) return '1 day';
        if (days < 14) return `${days} days`;
        if (days < 60) return `${Math.round(days / 7)} weeks`;
        return `${Math.round(days / 30)} months`;
    }

    function dueLabel(record) {
        const days = record.due - today();
        if (days <= 0) return 'Due';
        return days === 1 ? 'Tomorrow' : `In ${formatInterval(days)}`;
    }

    // ---------------------------------------------------------------------
    // Screens
    // ---------------------------------------------------------------------

    function show(screen) {
        ['setup', 'study', 'summary', 'browse'].forEach((name) => {
            ui[`${name}Screen`].hidden = name !== screen;
        });
        document.body.classList.toggle('la-focus', screen !== 'setup');
        Learning.scrollIntoFocus(ui.cardsApp);
    }

    // ---------------------------------------------------------------------
    // Setup
    // ---------------------------------------------------------------------

    async function init() {
        cache$();
        Learning.startDock(ui.setupScreen);
        attachEvents();
        try {
            state.decks = (await Learning.fetchJson('categories.json')).categories || [];
        } catch (error) {
            console.error(error);
            ui.deckList.innerHTML = '<p class="la-empty">The flashcards could not be loaded. Please refresh the page.</p>';
            return;
        }
        const params = Learning.readParams();
        const prefs = store.get('prefs', {});
        state.scope = prefs.scope || 'due';
        state.size = prefs.size || 20;
        state.order = prefs.order || 'notes';
        const slug = [params.get('category'), prefs.slug, state.decks[0].slug].find((s) => state.decks.some((d) => d.slug === s));
        const topics = params.has('topics') ? params.get('topics').split(',').filter(Boolean) : (prefs.topics || {})[slug];
        renderDecks(slug);
        await selectDeck(slug, topics || []);
        if (params.get('view') === 'browse') openBrowse();
    }

    async function loadDeck(slug) {
        if (!cache.has(slug)) cache.set(slug, await Learning.fetchJson(`${slug}.json`));
        return cache.get(slug);
    }

    function renderDecks(selected) {
        ui.deckList.innerHTML = '';
        Learning.balanceTiles(ui.deckList, state.decks.length);
        state.decks.forEach((deck) => {
            const tile = el('label', 'la-tile');
            tile.dataset.slug = deck.slug;
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'deck';
            input.value = deck.slug;
            input.checked = deck.slug === selected;
            input.addEventListener('change', () => selectDeck(deck.slug));
            tile.appendChild(input);
            if (deck.glyph) tile.appendChild(Learning.glyph(deck.glyph));
            tile.appendChild(el('span', 'la-tile-name', deck.name));
            tile.appendChild(el('span', 'la-tile-desc', deck.description));
            tile.appendChild(el('span', 'la-tile-facts'));
            const meter = el('span', 'la-tile-meter');
            meter.appendChild(el('span'));
            tile.appendChild(meter);
            ui.deckList.appendChild(tile);
            paintDeckTile(deck);
        });
    }

    function paintDeckTile(deck) {
        const tile = ui.deckList.querySelector(`[data-slug="${deck.slug}"]`);
        if (!tile) return;
        const current = state.data && state.data.category.slug === deck.slug;
        const records = Object.values(current ? state.srs : loadSrs(deck.slug));
        const due = records.filter((r) => r.due <= today()).length;
        const mastered = records.filter((r) => r.box >= MASTERED_BOX && r.due > today()).length;
        const facts = tile.querySelector('.la-tile-facts');
        facts.innerHTML = '';
        facts.appendChild(el('span', '', `${deck.cardCount} cards`));
        if (due) facts.appendChild(el('span', 'is-strong', `${due} due`));
        facts.appendChild(el('span', '', `${Math.max(deck.cardCount - records.length, 0)} new`));
        if (mastered) facts.appendChild(el('span', '', `${mastered} mastered`));
        tile.querySelector('.la-tile-meter span').style.width = `${(mastered / deck.cardCount) * 100}%`;
    }

    async function selectDeck(slug, topics) {
        ui.startButton.disabled = true;
        try {
            state.data = await loadDeck(slug);
        } catch (error) {
            console.error(error);
            ui.startSummary.textContent = 'This deck could not be loaded. Try another one.';
            return;
        }
        state.srs = loadSrs(slug);
        const known = new Set(state.data.topics.map((t) => t.slug));
        const remembered = topics || (store.get('prefs', {}).topics || {})[slug] || [];
        state.topics = new Set(remembered.filter((t) => known.has(t)));
        state.picker = Learning.topicPicker(ui.topicList, state.data.topics, state.topics, (t) => t.cardCount, (slugs) => {
            state.topics = new Set(slugs);
            refreshSetup();
        });
        paintDeckTile(state.data.category);
        refreshSetup();
    }

    function selectedCards() {
        const cards = state.data.cards;
        return state.topics.size ? cards.filter((card) => state.topics.has(card.topic)) : cards;
    }

    function plan() {
        const cards = selectedCards();
        const due = cards.filter((card) => statusOf(card) === 'due').sort((a, b) => state.srs[a.id].due - state.srs[b.id].due);
        const fresh = cards.filter((card) => statusOf(card) === 'new');
        const order = (list) => (state.order === 'shuffle' ? Learning.shuffle(list) : list);
        const limit = state.size === 'all' ? Infinity : state.size;
        const queue = (state.scope === 'due' ? order(due).concat(order(fresh)) : order(cards.slice())).slice(0, limit);
        return {
            cards,
            due,
            fresh,
            queue
        };
    }

    function refreshSetup() {
        ui.topicSummary.textContent = Learning.topicSummary(state.data.topics, state.topics);
        const {
            cards,
            due,
            fresh,
            queue
        } = plan();

        Learning.segmented(ui.scopeControl, 'scope', [{
            value: 'due',
            label: `Due and new · ${due.length + fresh.length}`
        }, {
            value: 'all',
            label: `Every card · ${cards.length}`
        }], state.scope, (value) => {
            state.scope = value;
            refreshSetup();
        });
        ui.scopeHint.textContent = state.scope === 'due' ?
            'Cards return on a schedule: soon when you struggle, weeks later once you know them.' :
            'Study every card in the selection whatever its schedule. Your ratings still update it.';
        Learning.segmented(ui.sizeControl, 'size', SIZES.map((n) => ({
            value: n,
            label: String(n)
        })).concat([{
            value: 'all',
            label: 'All'
        }]), state.size, (value) => {
            state.size = value;
            refreshSetup();
        });
        Learning.segmented(ui.orderControl, 'order', [{
            value: 'notes',
            label: 'As in the notes'
        }, {
            value: 'shuffle',
            label: 'Shuffled'
        }], state.order, (value) => {
            state.order = value;
            refreshSetup();
        });

        ui.startSummary.innerHTML = '';
        if (!cards.length) {
            ui.startSummary.textContent = 'No cards match these topics.';
        } else if (!queue.length) {
            const next = cards.map((c) => state.srs[c.id]).filter(Boolean).map((r) => r.due).sort((a, b) => a - b)[0];
            ui.startSummary.appendChild(el('strong', '', 'Nothing is due right now.'));
            const when = next - today() === 1 ? 'tomorrow' : `in ${formatInterval(next - today())}`;
            ui.startSummary.appendChild(document.createTextNode(` Next review ${when}. Choose "Every card" to study anyway.`));
        } else {
            ui.startSummary.appendChild(el('strong', '', `${queue.length} card${queue.length === 1 ? '' : 's'}`));
            let detail;
            if (state.scope === 'due') {
                const reviews = queue.filter((c) => statusOf(c) === 'due').length;
                detail = [reviews && `${reviews} to review`, queue.length - reviews && `${queue.length - reviews} new`].filter(Boolean).join(', ');
            } else {
                detail = state.order === 'shuffle' ? 'shuffled' : 'in the order of the notes';
            }
            ui.startSummary.appendChild(document.createTextNode(` from ${state.data.category.name}, ${detail}`));
        }
        ui.startButton.disabled = !queue.length;
        savePrefs();
    }

    function savePrefs() {
        const prefs = store.get('prefs', {});
        prefs.slug = state.data.category.slug;
        prefs.scope = state.scope;
        prefs.size = state.size;
        prefs.order = state.order;
        prefs.topics = prefs.topics || {};
        prefs.topics[prefs.slug] = Array.from(state.topics);
        store.set('prefs', prefs);
        Learning.writeParams({
            category: prefs.slug,
            topics: prefs.topics[prefs.slug].join(',')
        });
    }

    // ---------------------------------------------------------------------
    // Study session
    // ---------------------------------------------------------------------

    function start() {
        const {
            queue
        } = plan();
        if (!queue.length) return;
        state.session = {
            queue: queue.slice(),
            total: queue.length,
            done: 0,
            again: new Set(),
            ratings: {
                again: 0,
                good: 0,
                easy: 0
            },
            learned: 0,
            history: [],
            revealed: false
        };
        ui.studyCrumb.innerHTML = '';
        ui.studyCrumb.appendChild(el('b', '', state.data.category.name));
        renderKeys();
        show('study');
        renderCard();
        ui.card.focus({
            preventScroll: true
        });
    }

    function renderKeys() {
        ui.keyHints.innerHTML = '';
        [
            ['Space', 'show answer'],
            ['1', 'again'],
            ['2', 'good'],
            ['3', 'easy'],
            ['U', 'undo']
        ].forEach(([key, label]) => {
            const span = el('span');
            span.appendChild(el('kbd', '', key));
            span.appendChild(document.createTextNode(label));
            ui.keyHints.appendChild(span);
        });
    }

    function currentCard() {
        return state.session.queue[0];
    }

    function renderCard() {
        const s = state.session;
        const card = currentCard();
        if (!card) {
            finish();
            return;
        }
        s.revealed = false;
        const topic = state.data.topics.find((t) => t.slug === card.topic);
        const multiGroup = new Set(state.data.topics.map((t) => t.group)).size > 1;
        ui.cardTopic.textContent = topic ? (multiGroup ? `${topic.group} · ${topic.name}` : topic.name) : '';
        const tag = s.again.has(card.id) ? ['Again', 'is-bad'] : statusOf(card) === 'new' ? ['New', 'is-new'] : ['Review', ''];
        ui.cardTag.textContent = tag[0];
        ui.cardTag.className = `fc-tag ${tag[1]}`;
        ui.cardFront.innerHTML = card.front;
        ui.cardAnswer.innerHTML = card.back;
        ui.cardSource.innerHTML = '';
        ui.cardSource.appendChild(link(card.source, 'View in the notes'));
        ui.cardBack.hidden = true;
        ui.card.classList.remove('is-revealed');
        ui.revealActions.hidden = false;
        ui.rateActions.hidden = true;
        ui.undoButton.hidden = !s.history.length;
        ui.studyCount.textContent = `${s.queue.length} left`;
        ui.track.firstChild.style.width = `${(s.done / s.total) * 100}%`;

        const record = state.srs[card.id];
        ui.hintAgain.textContent = 'in a few cards';
        ui.hintGood.textContent = formatInterval(INTERVALS[nextBox(record, 'good')]);
        ui.hintEasy.textContent = formatInterval(INTERVALS[nextBox(record, 'easy')]);
        Learning.enhance([ui.cardFront, ui.cardAnswer], state.data.category.math);
    }

    function reveal() {
        const s = state.session;
        if (!s || s.revealed || !currentCard()) return;
        s.revealed = true;
        ui.cardBack.hidden = false;
        ui.cardBack.classList.remove('la-reveal');
        void ui.cardBack.offsetWidth;
        ui.cardBack.classList.add('la-reveal');
        ui.card.classList.add('is-revealed');
        ui.revealActions.hidden = true;
        ui.rateActions.hidden = false;
        ui.rateActions.querySelector('.fc-good').focus({
            preventScroll: true
        });
    }

    function rate(rating) {
        const s = state.session;
        const card = s && currentCard();
        if (!card || !s.revealed) return;
        const before = state.srs[card.id] ? {
            ...state.srs[card.id]
        } : null;
        s.history.push({
            card,
            before,
            queue: s.queue.slice(),
            done: s.done,
            again: new Set(s.again),
            ratings: {
                ...s.ratings
            },
            learned: s.learned
        });

        const box = nextBox(before, rating);
        state.srs[card.id] = {
            box,
            due: today() + INTERVALS[box],
            reps: (before ? before.reps : 0) + 1,
            lapses: (before ? before.lapses : 0) + (rating === 'again' && before ? 1 : 0)
        };
        saveSrs();
        s.ratings[rating] += 1;
        s.queue.shift();
        if (rating === 'again') {
            s.again.add(card.id);
            s.queue.splice(Math.min(REQUEUE_GAP, s.queue.length), 0, card);
        } else {
            s.done += 1;
            if (!before) s.learned += 1;
        }
        renderCard();
        if (state.session) {
            ui.card.focus({
                preventScroll: true
            });
            Learning.scrollIntoFocus(ui.cardsApp);
        }
    }

    function undo() {
        const s = state.session;
        const last = s && s.history.pop();
        if (!last) return;
        if (last.before) state.srs[last.card.id] = last.before;
        else delete state.srs[last.card.id];
        saveSrs();
        Object.assign(s, {
            queue: last.queue,
            done: last.done,
            again: last.again,
            ratings: last.ratings,
            learned: last.learned
        });
        renderCard();
        reveal();
    }

    function finish() {
        const s = state.session;
        const reviewed = s.ratings.good + s.ratings.easy;
        const tomorrow = selectedCards().filter((c) => state.srs[c.id] && state.srs[c.id].due === today() + 1).length;
        state.session = null;
        const remaining = plan().queue.length;

        ui.summaryScore.innerHTML = '';
        ui.summaryScore.appendChild(document.createTextNode(String(reviewed)));
        ui.summaryScore.appendChild(el('small', '', reviewed === 1 ? ' card' : ' cards'));
        ui.summaryTitle.textContent = s.done === s.total ? 'Session complete' : 'Session ended';
        const sentences = [s.again.size ? `${s.again.size} card${s.again.size === 1 ? '' : 's'} needed another pass.` : 'You knew every card on the first try.'];
        if (tomorrow) sentences.push(`${tomorrow} ${tomorrow === 1 ? 'card is' : 'cards are'} due again tomorrow.`);
        if (remaining) sentences.push(`${remaining} more ${remaining === 1 ? 'is' : 'are'} ready if you want to keep going.`);
        ui.summaryText.textContent = sentences.join(' ');
        ui.summaryStats.innerHTML = '';
        [
            [`${s.learned} new learned`, 'is-good'],
            [`${s.ratings.good} good`, ''],
            [`${s.ratings.easy} easy`, ''],
            [`${s.ratings.again} again`, s.ratings.again ? 'is-warn' : '']
        ].forEach(([label, cls]) => ui.summaryStats.appendChild(el('span', cls, label)));
        ui.moreButton.hidden = !remaining;

        ui.againList.innerHTML = '';
        const again = state.data.cards.filter((card) => s.again.has(card.id));
        ui.againHeading.hidden = !again.length;
        again.forEach((card, index) => ui.againList.appendChild(cardRow(card, index)));
        paintDeckTile(state.data.category);
        show('summary');
        ui.summaryTitle.focus({
            preventScroll: true
        });
    }

    function endEarly() {
        const s = state.session;
        if (s && (s.done || s.ratings.again)) {
            finish();
        } else {
            state.session = null;
            backToDecks();
        }
    }

    function backToDecks() {
        refreshSetup();
        show('setup');
    }

    // ---------------------------------------------------------------------
    // Browse
    // ---------------------------------------------------------------------

    function cardRow(card, index) {
        const li = el('li');
        const details = el('details', 'la-row');
        const summary = el('summary');
        summary.appendChild(el('span', 'la-row-index', String(index + 1).padStart(2, '0')));
        const title = el('span', 'la-row-title');
        title.innerHTML = card.front;
        summary.appendChild(title);
        const status = statusOf(card);
        const tag = status === 'new' ? ['New', ''] : status === 'mastered' ? ['Mastered', 'is-good'] : status === 'due' ? ['Due', 'is-warn'] : [dueLabel(state.srs[card.id]), ''];
        summary.appendChild(el('span', `la-row-tag ${tag[1]}`, tag[0]));
        details.appendChild(summary);
        const body = el('div', 'la-row-body');
        const answer = el('div', 'la-prose');
        answer.innerHTML = card.back;
        body.appendChild(answer);
        const source = el('p', 'fc-source');
        source.appendChild(link(card.source, 'View in the notes'));
        body.appendChild(source);
        details.appendChild(body);
        details.addEventListener('toggle', () => {
            if (details.open) Learning.enhance(body, state.data.category.math);
        });
        li.appendChild(details);
        Learning.enhance(title, state.data.category.math);
        return li;
    }

    function openBrowse() {
        ui.browseCrumb.innerHTML = '';
        ui.browseCrumb.appendChild(el('b', '', state.data.category.name));
        ui.browseCrumb.appendChild(document.createTextNode(' · All cards'));
        renderBrowse();
        show('browse');
    }

    function renderBrowse() {
        const query = state.browseQuery.trim().toLowerCase();
        const text = (html) => html.replace(/<[^>]+>/g, ' ').toLowerCase();
        const pool = selectedCards();
        const cards = pool.filter((card) => {
            const status = statusOf(card);
            const wanted = state.browseStatus;
            const matchesStatus = wanted === 'all' || (wanted === 'learning' ? status === 'learning' || status === 'due' : status === wanted);
            return matchesStatus && (!query || text(card.front).includes(query) || text(card.back).includes(query));
        });
        ui.statusTabs.querySelectorAll('.la-tab').forEach((tab) => {
            tab.setAttribute('aria-selected', String(tab.dataset.status === state.browseStatus));
        });
        ui.browseCount.textContent = `${cards.length} of ${pool.length}`;
        ui.browseList.innerHTML = '';
        if (!cards.length) {
            const li = el('li');
            li.appendChild(el('p', 'la-empty', 'No cards match.'));
            ui.browseList.appendChild(li);
            return;
        }
        let lastTopic = null;
        cards.forEach((card, index) => {
            if (card.topic !== lastTopic) {
                const topic = state.data.topics.find((t) => t.slug === card.topic);
                ui.browseList.appendChild(el('li', 'fc-browse-topic', topic ? topic.name : ''));
                lastTopic = card.topic;
            }
            ui.browseList.appendChild(cardRow(card, index));
        });
    }

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    function onKeydown(event) {
        if (ui.studyScreen.hidden || !state.session || event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.target;
        if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
        if (target && target.tagName === 'BUTTON' && ui.studyScreen.contains(target) && (event.key === ' ' || event.key === 'Enter')) return;
        const actions = {
            ' ': reveal,
            Enter: reveal,
            1: () => rate('again'),
            2: () => rate('good'),
            3: () => rate('easy'),
            u: undo,
            U: undo
        };
        const action = actions[event.key];
        if (!action) return;
        action();
        event.preventDefault();
    }

    function attachEvents() {
        ui.topicPicker.addEventListener('click', (event) => {
            const button = event.target.closest('[data-topics]');
            if (button && state.picker) state.picker.setAll(button.dataset.topics === 'all');
        });
        ui.startButton.addEventListener('click', start);
        ui.browseButton.addEventListener('click', openBrowse);
        ui.summaryBrowseButton.addEventListener('click', openBrowse);
        ui.browseBack.addEventListener('click', backToDecks);
        ui.decksButton.addEventListener('click', backToDecks);
        ui.moreButton.addEventListener('click', start);
        ui.endButton.addEventListener('click', endEarly);
        ui.undoButton.addEventListener('click', undo);
        ui.revealButton.addEventListener('click', reveal);
        ui.card.addEventListener('click', (event) => {
            if (!event.target.closest('a')) reveal();
        });
        ui.rateActions.addEventListener('click', (event) => {
            const button = event.target.closest('[data-rating]');
            if (button) rate(button.dataset.rating);
        });
        ui.searchInput.addEventListener('input', () => {
            state.browseQuery = ui.searchInput.value;
            renderBrowse();
        });
        ui.statusTabs.addEventListener('click', (event) => {
            const tab = event.target.closest('[data-status]');
            if (!tab) return;
            state.browseStatus = tab.dataset.status;
            renderBrowse();
        });
        ui.resetButton.addEventListener('click', () => {
            if (!window.confirm(`Forget your progress in the ${state.data.category.name} deck? Every card becomes new again.`)) return;
            state.srs = {};
            saveSrs();
            paintDeckTile(state.data.category);
            renderBrowse();
        });
        document.addEventListener('keydown', onKeydown);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();