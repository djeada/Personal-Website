(function() {
    'use strict';

    // A card rated "Still learning" comes back after this many other cards.
    const REQUEUE_GAP = 4;

    const progressStore = Learning.store('flashcards');
    const categoryCache = new Map();

    const state = {
        categories: [],
        data: null,
        topics: new Set(),
        hideKnown: true,
        shuffled: false,
        known: new Set(),
        deck: [],
        queue: [],
        history: [],
        learning: new Set(),
        revealed: false,
        sessionSize: 0
    };

    const $ = (id) => document.getElementById(id);
    let elements = {};

    function cacheElements() {
        elements = {
            settings: $('deckSettings'),
            categorySelect: $('categorySelect'),
            shuffle: $('shuffleButton'),
            hideKnown: $('hideKnownToggle'),
            categoryMeta: $('categoryMeta'),
            topicFilter: $('topicFilter'),
            statRemaining: $('statRemaining'),
            statLearning: $('statLearning'),
            statKnown: $('statKnown'),
            progressBar: $('progressBar'),
            progressBarContainer: $('progressBarContainer'),
            card: $('studyCard'),
            cardTopic: $('cardTopic'),
            cardPosition: $('cardPosition'),
            cardFront: $('cardFront'),
            cardBack: $('cardBack'),
            cardAnswer: $('cardAnswer'),
            cardLinks: $('cardLinks'),
            back: $('backButton'),
            reveal: $('revealButton'),
            learningButton: $('learningButton'),
            knownButton: $('knownButton'),
            skip: $('skipButton'),
            browser: $('cardBrowser'),
            browseCount: $('browseCount'),
            list: $('cardList'),
            reset: $('resetProgressButton')
        };
    }

    // ---------------------------------------------------------------------
    // Persistence
    // ---------------------------------------------------------------------

    function loadKnown() {
        state.known = new Set(progressStore.get(state.data.category.slug, {
            known: []
        }).known);
    }

    function saveKnown() {
        progressStore.set(state.data.category.slug, {
            known: Array.from(state.known)
        });
    }

    // ---------------------------------------------------------------------
    // Loading decks
    // ---------------------------------------------------------------------

    async function loadIndex() {
        try {
            state.categories = (await Learning.fetchJson('categories.json')).categories || [];
        } catch (error) {
            console.error(error);
            showEmpty('The flashcard index could not be loaded. Please refresh the page.');
            return;
        }
        if (!state.categories.length) {
            showEmpty('No flashcards are available yet.');
            return;
        }
        elements.categorySelect.innerHTML = '';
        state.categories.forEach((category) => {
            const option = document.createElement('option');
            option.value = category.slug;
            option.textContent = `${category.name} (${category.cardCount})`;
            elements.categorySelect.appendChild(option);
        });
        const params = Learning.readParams();
        const requested = params.get('category');
        const slug = state.categories.some((c) => c.slug === requested) ? requested : state.categories[0].slug;
        elements.categorySelect.value = slug;
        await loadCategory(slug, (params.get('topics') || '').split(',').filter(Boolean));
    }

    async function loadCategory(slug, topics) {
        showEmpty('Loading cards…');
        try {
            if (!categoryCache.has(slug)) categoryCache.set(slug, await Learning.fetchJson(`${slug}.json`));
        } catch (error) {
            console.error(error);
            showEmpty('These cards could not be loaded. Please try another subject or refresh.');
            return;
        }
        state.data = categoryCache.get(slug);
        const known = new Set(state.data.topics.map((t) => t.slug));
        state.topics = new Set((topics || []).filter((t) => known.has(t)));
        loadKnown();
        renderTopicFilter();
        buildDeck();
    }

    function topicFor(slug) {
        return state.data.topics.find((t) => t.slug === slug);
    }

    function renderMeta() {
        const meta = elements.categoryMeta;
        const category = state.data.category;
        meta.innerHTML = '';
        meta.appendChild(document.createTextNode(`${category.description} `));
        const known = state.data.cards.filter((card) => state.known.has(card.id)).length;
        meta.appendChild(Learning.el('span', 'meta-facts', `${category.cardCount} cards · ${category.topicCount} topics · ${known} known`));
        (category.repositories || []).forEach((url) => {
            meta.appendChild(document.createTextNode(' · '));
            meta.appendChild(Learning.link(url, 'Source notes'));
        });
    }

    function renderTopicFilter() {
        const filter = elements.topicFilter;
        filter.innerHTML = '';
        const chip = (parent, label, slug, count) => {
            const button = Learning.el('button', 'topic-chip');
            button.type = 'button';
            button.dataset.topic = slug;
            button.appendChild(document.createTextNode(label));
            button.appendChild(Learning.el('span', 'chip-count', String(count)));
            parent.appendChild(button);
        };
        chip(filter, 'All topics', '', state.data.category.cardCount);

        const groups = new Map();
        state.data.topics.forEach((topic) => {
            if (!groups.has(topic.group)) groups.set(topic.group, []);
            groups.get(topic.group).push(topic);
        });
        groups.forEach((topics, group) => {
            const row = groups.size > 1 ? Learning.el('div', 'topic-group') : filter;
            if (groups.size > 1) {
                row.appendChild(Learning.el('span', 'topic-group-name', group));
                filter.appendChild(row);
            }
            topics.forEach((topic) => chip(row, topic.name, topic.slug, topic.cardCount));
        });
        syncTopicChips();
    }

    function syncTopicChips() {
        elements.topicFilter.querySelectorAll('.topic-chip').forEach((button) => {
            const slug = button.dataset.topic;
            button.setAttribute('aria-pressed', String(slug ? state.topics.has(slug) : state.topics.size === 0));
        });
    }

    function toggleTopic(slug) {
        if (!slug) {
            state.topics.clear();
        } else if (state.topics.has(slug)) {
            state.topics.delete(slug);
        } else {
            state.topics.add(slug);
            if (state.topics.size === state.data.topics.length) state.topics.clear();
        }
        syncTopicChips();
        buildDeck();
    }

    // ---------------------------------------------------------------------
    // Session
    // ---------------------------------------------------------------------

    function selectedCards() {
        const cards = state.data.cards;
        return state.topics.size ? cards.filter((card) => state.topics.has(card.topic)) : cards;
    }

    function buildDeck() {
        state.deck = selectedCards();
        const pending = state.deck.filter((card) => !(state.hideKnown && state.known.has(card.id)));
        state.queue = state.shuffled ? Learning.shuffle(pending) : pending.slice();
        state.sessionSize = state.queue.length;
        state.history = [];
        state.learning = new Set();
        Learning.writeParams({
            category: state.data.category.slug,
            topics: Array.from(state.topics).join(',')
        });
        renderMeta();
        renderList();
        showCard();
    }

    function current() {
        return state.queue[0];
    }

    function rate(known) {
        const card = current();
        if (!card || !state.revealed) return;
        if (known) {
            state.known.add(card.id);
            state.learning.delete(card.id);
            state.queue.shift();
        } else {
            state.known.delete(card.id);
            state.learning.add(card.id);
            state.queue.shift();
            state.queue.splice(Math.min(REQUEUE_GAP, state.queue.length), 0, card);
        }
        state.history.push(card);
        saveKnown();
        renderMeta();
        updateListItem(card);
        showCard();
    }

    function skip() {
        const card = state.queue.shift();
        if (!card) return;
        state.queue.push(card);
        state.history.push(card);
        showCard();
    }

    function back() {
        const card = state.history.pop();
        if (!card) return;
        const index = state.queue.indexOf(card);
        if (index !== -1) state.queue.splice(index, 1);
        state.queue.unshift(card);
        showCard();
    }

    function jumpTo(card) {
        const index = state.queue.indexOf(card);
        if (index !== -1) state.queue.splice(index, 1);
        if (current()) state.history.push(current());
        state.queue.unshift(card);
        showCard();
        elements.card.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }

    function shuffleQueue() {
        state.shuffled = true;
        elements.shuffle.textContent = 'Reshuffle';
        state.queue = Learning.shuffle(state.queue);
        state.history = [];
        showCard();
    }

    // ---------------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------------

    function showEmpty(text, actions) {
        elements.cardTopic.textContent = '';
        elements.cardPosition.textContent = '';
        elements.cardFront.innerHTML = '';
        elements.cardFront.appendChild(Learning.el('p', 'card-empty', text));
        if (actions) elements.cardFront.appendChild(actions);
        elements.cardBack.hidden = true;
        [elements.reveal, elements.learningButton, elements.knownButton].forEach((b) => {
            b.hidden = true;
        });
        elements.back.disabled = !state.history.length;
        elements.skip.disabled = true;
    }

    function finishedActions() {
        const box = Learning.el('div', 'card-empty-actions');
        const again = Learning.el('button', 'btn primary', 'Review every card again');
        again.type = 'button';
        again.addEventListener('click', () => {
            state.hideKnown = false;
            elements.hideKnown.checked = false;
            buildDeck();
        });
        box.appendChild(again);
        return box;
    }

    function showCard() {
        updateStats();
        const card = current();
        state.revealed = false;
        if (!state.data) return;
        if (!state.deck.length) {
            showEmpty('No cards in this selection.');
            return;
        }
        if (!card) {
            const message = state.hideKnown ?
                'You know every card in this selection. Pick other topics, or review them all again.' :
                'Session complete.';
            showEmpty(message, finishedActions());
            return;
        }

        const topic = topicFor(card.topic);
        elements.cardTopic.textContent = topic ? (topic.group && state.data.topics.some((t) => t.group !== topic.group) ? `${topic.group} · ${topic.name}` : topic.name) : '';
        const done = state.sessionSize - state.queue.length;
        elements.cardPosition.textContent = state.learning.has(card.id) ? 'Again' : `${done + 1} / ${state.sessionSize}`;
        elements.cardFront.innerHTML = `<p class="card-question">${card.front}</p>`;
        elements.cardAnswer.innerHTML = card.back;
        elements.cardLinks.innerHTML = '';
        elements.cardLinks.appendChild(Learning.link(card.source, 'Source'));
        if (topic && topic.source) elements.cardLinks.appendChild(Learning.link(topic.source, `All ${topic.group} cards`));
        elements.cardBack.hidden = true;
        elements.card.classList.remove('revealed');

        elements.reveal.hidden = false;
        elements.learningButton.hidden = true;
        elements.knownButton.hidden = true;
        elements.back.disabled = !state.history.length;
        elements.skip.disabled = state.queue.length < 2;
        markCurrentInList(card);

        if (state.data.category.math) Learning.typeset([elements.cardFront, elements.cardAnswer]);
    }

    function revealAnswer() {
        if (!current() || state.revealed) return;
        state.revealed = true;
        elements.cardBack.hidden = false;
        elements.card.classList.add('revealed');
        elements.reveal.hidden = true;
        elements.learningButton.hidden = false;
        elements.knownButton.hidden = false;
        elements.knownButton.focus({
            preventScroll: true
        });
    }

    function updateStats() {
        const total = state.deck.length;
        const knownInDeck = state.deck.filter((card) => state.known.has(card.id)).length;
        elements.statRemaining.textContent = state.queue.length;
        elements.statLearning.textContent = state.learning.size;
        elements.statKnown.textContent = `${knownInDeck} / ${total}`;
        const percentage = total ? Math.round((knownInDeck / total) * 100) : 0;
        elements.progressBar.style.width = `${percentage}%`;
        elements.progressBarContainer.setAttribute('aria-valuenow', String(percentage));
    }

    function renderList() {
        elements.list.innerHTML = '';
        elements.browseCount.textContent = state.deck.length;
        state.deck.forEach((card) => {
            const item = Learning.el('li', 'card-list-item');
            item.dataset.id = card.id;
            const button = Learning.el('button', 'card-list-button');
            button.type = 'button';
            button.innerHTML = card.front;
            button.addEventListener('click', () => jumpTo(card));
            item.appendChild(button);
            item.appendChild(Learning.el('span', 'card-list-status'));
            elements.list.appendChild(item);
            updateListItem(card);
        });
        if (state.data.category.math && elements.browser.open) Learning.typeset(elements.list);
    }

    function updateListItem(card) {
        const item = elements.list.querySelector(`[data-id="${card.id}"]`);
        if (!item) return;
        const known = state.known.has(card.id);
        item.classList.toggle('known', known);
        item.querySelector('.card-list-status').textContent = known ? 'Known' : state.learning.has(card.id) ? 'Learning' : '';
    }

    function markCurrentInList(card) {
        elements.list.querySelectorAll('.card-list-item').forEach((item) => {
            item.classList.toggle('current', item.dataset.id === card.id);
        });
    }

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    function handleKeydown(event) {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.target;
        if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
        if (target && target.tagName === 'BUTTON' && (event.key === ' ' || event.key === 'Enter')) return;
        if (target && target.tagName === 'SUMMARY') return;

        const key = event.key;
        if (key === ' ' || key === 'Enter') {
            revealAnswer();
        } else if (key === '1') {
            rate(false);
        } else if (key === '2') {
            rate(true);
        } else if (key === 'ArrowRight') {
            skip();
        } else if (key === 'ArrowLeft') {
            back();
        } else if (key === 's' || key === 'S') {
            shuffleQueue();
        } else {
            return;
        }
        event.preventDefault();
    }

    function attachEvents() {
        elements.settings.addEventListener('submit', (event) => event.preventDefault());
        elements.categorySelect.addEventListener('change', (event) => loadCategory(event.target.value, []));
        elements.shuffle.addEventListener('click', shuffleQueue);
        elements.hideKnown.addEventListener('change', () => {
            state.hideKnown = elements.hideKnown.checked;
            buildDeck();
        });
        elements.topicFilter.addEventListener('click', (event) => {
            const chip = event.target.closest('.topic-chip');
            if (chip) toggleTopic(chip.dataset.topic);
        });
        elements.card.addEventListener('click', (event) => {
            if (!event.target.closest('a') && !state.revealed) revealAnswer();
        });
        elements.reveal.addEventListener('click', revealAnswer);
        elements.learningButton.addEventListener('click', () => rate(false));
        elements.knownButton.addEventListener('click', () => rate(true));
        elements.skip.addEventListener('click', skip);
        elements.back.addEventListener('click', back);
        elements.browser.addEventListener('toggle', () => {
            if (elements.browser.open && state.data && state.data.category.math) Learning.typeset(elements.list);
        });
        elements.reset.addEventListener('click', () => {
            if (!window.confirm(`Forget which ${state.data.category.name} cards you know?`)) return;
            state.known.clear();
            saveKnown();
            buildDeck();
        });
        document.addEventListener('keydown', handleKeydown);
    }

    function init() {
        cacheElements();
        attachEvents();
        loadIndex();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();