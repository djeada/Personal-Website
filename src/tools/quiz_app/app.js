(function() {
    'use strict';

    const SECONDS_PER_QUESTION = 75;
    const LENGTHS = [5, 10, 20, 50];
    const SEGMENTED_TRACK_LIMIT = 60;
    const KEYS = 'ABCDEFGHI';

    const MODE_HINTS = {
        practice: 'Pick an answer, check it, and read the explanation before moving on.',
        exam: 'Answers and explanations stay hidden until you submit. You can go back, change answers and flag questions.'
    };

    const store = Learning.store('quiz');
    const cache = new Map();
    const {
        el,
        link
    } = Learning;

    const state = {
        categories: [],
        data: null,
        topics: new Set(),
        length: 10,
        mode: 'practice',
        timed: false,
        onlyMissed: false,
        session: null,
        timer: null,
        reviewFilter: 'mistakes'
    };

    const ui = {};

    function cache$() {
        [
            'quizApp', 'setupScreen', 'playScreen', 'resultsScreen', 'resumeBanner', 'resumeText', 'resumeButton',
            'discardButton', 'subjectList', 'topicPicker', 'topicSummary', 'topicList', 'lengthControl', 'modeHint',
            'timerToggle', 'missedOption', 'missedToggle', 'missedText', 'startSummary', 'startButton', 'playCrumb',
            'playTimer', 'playCount', 'endButton', 'track', 'questionView', 'questionMeta', 'questionText', 'optionList',
            'feedback', 'verdict', 'explanation', 'sources', 'prevButton', 'flagButton', 'skipButton', 'primaryButton',
            'submitConfirm', 'confirmText', 'confirmReview', 'confirmSubmit', 'keyHints', 'resultScore', 'resultTitle',
            'resultText', 'resultStats', 'retryButton', 'againButton', 'setupButton', 'topicsHeading', 'topicBars',
            'reviewList'
        ].forEach((id) => {
            ui[id] = document.getElementById(id);
        });
    }

    // ---------------------------------------------------------------------
    // Data and persistence
    // ---------------------------------------------------------------------

    async function loadCategory(slug) {
        if (!cache.has(slug)) cache.set(slug, await Learning.fetchJson(`${slug}.json`));
        return cache.get(slug);
    }

    function progressFor(slug) {
        return store.get(`progress:${slug}`, {
            missed: [],
            best: null,
            attempts: 0
        });
    }

    function savePrefs() {
        const prefs = store.get('prefs', {
            topics: {}
        });
        prefs.slug = state.data.category.slug;
        prefs.length = state.length;
        prefs.mode = state.mode;
        prefs.timed = state.timed;
        prefs.topics = prefs.topics || {};
        prefs.topics[prefs.slug] = Array.from(state.topics);
        store.set('prefs', prefs);
        Learning.writeParams({
            category: prefs.slug,
            topics: prefs.topics[prefs.slug].join(','),
            mode: state.mode === 'exam' ? 'exam' : '',
            n: state.length === 10 ? '' : state.length
        });
    }

    function saveSession() {
        const s = state.session;
        if (!s || s.finished) {
            store.set('session', null);
            return;
        }
        store.set('session', {
            slug: s.slug,
            mode: s.mode,
            timed: s.timed,
            index: s.index,
            secondsLeft: s.secondsLeft,
            elapsed: elapsed(),
            items: s.items.map((item) => ({
                id: item.question.id,
                order: item.order,
                answer: item.answer,
                checked: item.checked,
                flagged: item.flagged
            }))
        });
    }

    function questionById(data) {
        return new Map(data.questions.map((q) => [q.id, q]));
    }

    function topicOf(slug) {
        return state.data.topics.find((t) => t.slug === slug);
    }

    // ---------------------------------------------------------------------
    // Screens
    // ---------------------------------------------------------------------

    function show(screen) {
        ['setup', 'play', 'results'].forEach((name) => {
            ui[`${name}Screen`].hidden = name !== screen;
        });
        document.body.classList.toggle('la-focus', screen !== 'setup');
        if (screen !== 'play') stopTimer();
        Learning.scrollIntoFocus(ui.quizApp);
    }

    // ---------------------------------------------------------------------
    // Setup
    // ---------------------------------------------------------------------

    async function init() {
        cache$();
        attachEvents();
        try {
            state.categories = (await Learning.fetchJson('categories.json')).categories || [];
        } catch (error) {
            console.error(error);
            ui.subjectList.innerHTML = '<p class="la-empty">The quizzes could not be loaded. Please refresh the page.</p>';
            return;
        }

        const params = Learning.readParams();
        const prefs = store.get('prefs', {});
        state.length = Number(params.get('n')) || prefs.length || 10;
        if (params.get('n') === 'all' || prefs.length === 'all') state.length = 'all';
        state.mode = params.get('mode') === 'exam' ? 'exam' : params.get('mode') ? 'practice' : prefs.mode || 'practice';
        state.timed = Boolean(prefs.timed);
        ui.timerToggle.checked = state.timed;
        setMode(state.mode);

        const requested = params.get('category');
        const slug = [requested, prefs.slug, state.categories[0].slug].find((s) => state.categories.some((c) => c.slug === s));
        renderSubjects(slug);
        const topics = params.has('topics') ? params.get('topics').split(',').filter(Boolean) : (prefs.topics || {})[slug];
        await selectSubject(slug, topics || []);
        renderResume();
    }

    function renderSubjects(selected) {
        ui.subjectList.innerHTML = '';
        Learning.balanceTiles(ui.subjectList, state.categories.length);
        state.categories.forEach((category) => {
            const progress = progressFor(category.slug);
            const tile = el('label', 'la-tile');
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'subject';
            input.value = category.slug;
            input.checked = category.slug === selected;
            input.addEventListener('change', () => selectSubject(category.slug));
            tile.appendChild(input);
            tile.appendChild(el('span', 'la-tile-name', category.name));
            tile.appendChild(el('span', 'la-tile-desc', category.description));
            const facts = el('span', 'la-tile-facts');
            facts.appendChild(el('span', '', `${category.questionCount} questions`));
            facts.appendChild(el('span', '', `${category.topicCount} topics`));
            if (progress.best !== null) facts.appendChild(el('span', 'is-strong', `Best ${progress.best}%`));
            tile.appendChild(facts);
            ui.subjectList.appendChild(tile);
        });
    }

    async function selectSubject(slug, topics) {
        ui.startButton.disabled = true;
        try {
            state.data = await loadCategory(slug);
        } catch (error) {
            console.error(error);
            ui.startSummary.textContent = 'These questions could not be loaded. Try another subject.';
            return;
        }
        const known = new Set(state.data.topics.map((t) => t.slug));
        const remembered = topics || (store.get('prefs', {}).topics || {})[slug] || [];
        state.topics = new Set(remembered.filter((t) => known.has(t)));
        state.onlyMissed = false;
        ui.missedToggle.checked = false;
        renderTopics();
        refreshSetup();
    }

    function renderTopics() {
        state.picker = Learning.topicPicker(ui.topicList, state.data.topics, state.topics, (t) => t.questionCount, (slugs) => {
            state.topics = new Set(slugs);
            refreshSetup();
        });
    }

    function pool() {
        const questions = state.data.questions;
        let selected = state.topics.size ? questions.filter((q) => state.topics.has(q.topic)) : questions;
        if (state.onlyMissed) {
            const missed = new Set(progressFor(state.data.category.slug).missed);
            selected = selected.filter((q) => missed.has(q.id));
        }
        return selected;
    }

    function sessionSize(available) {
        return state.length === 'all' ? available : Math.min(state.length, available);
    }

    function refreshSetup() {
        const topics = state.data.topics;
        const chosen = state.topics.size ? topics.filter((t) => state.topics.has(t.slug)) : topics;
        ui.topicSummary.textContent = Learning.topicSummary(topics, state.topics);

        const missed = (() => {
            const ids = new Set(progressFor(state.data.category.slug).missed);
            const base = state.topics.size ? state.data.questions.filter((q) => state.topics.has(q.topic)) : state.data.questions;
            return base.filter((q) => ids.has(q.id)).length;
        })();
        ui.missedOption.hidden = missed === 0;
        ui.missedText.textContent = `Only the ${missed} question${missed === 1 ? '' : 's'} I got wrong before`;
        if (!missed && state.onlyMissed) {
            state.onlyMissed = false;
            ui.missedToggle.checked = false;
        }

        const available = pool().length;
        renderLengths(available);
        const count = sessionSize(available);
        ui.startButton.disabled = count === 0;
        ui.startSummary.innerHTML = '';
        if (!count) {
            ui.startSummary.textContent = 'No questions match these settings.';
        } else {
            ui.startSummary.appendChild(el('strong', '', `${count} question${count === 1 ? '' : 's'}`));
            const scope = state.topics.size ? `${chosen.length} topic${chosen.length === 1 ? '' : 's'}` : 'all topics';
            const extras = [state.mode === 'exam' ? 'Exam' : 'Practice', state.timed ? `${Math.ceil((count * SECONDS_PER_QUESTION) / 60)} min limit` : ''];
            ui.startSummary.appendChild(document.createTextNode(` from ${state.data.category.name}, ${scope} · ${extras.filter(Boolean).join(' · ')}`));
        }
        savePrefs();
    }

    function renderLengths(available) {
        const values = LENGTHS.filter((n) => n < available).concat(['all']);
        if (state.length !== 'all' && !values.includes(state.length)) {
            // The pool shrank below the chosen length: use the largest option that still fits.
            const fitting = values.filter((v) => v !== 'all' && v <= state.length);
            state.length = fitting.length ? fitting[fitting.length - 1] : 'all';
        }
        const options = values.map((value) => ({
            value,
            label: value === 'all' ? `All ${available}` : String(value)
        }));
        Learning.segmented(ui.lengthControl, 'length', options, state.length, (value) => {
            state.length = value;
            refreshSetup();
        });
    }

    function setMode(mode) {
        state.mode = mode;
        const radio = document.querySelector(`input[name="mode"][value="${mode}"]`);
        if (radio) radio.checked = true;
        ui.modeHint.textContent = MODE_HINTS[mode];
    }

    function renderResume() {
        const saved = store.get('session', null);
        const category = saved && state.categories.find((c) => c.slug === saved.slug);
        if (!category || !saved.items || !saved.items.length) {
            ui.resumeBanner.hidden = true;
            return;
        }
        const done = saved.items.filter((item) => item.checked || item.answer !== null).length;
        ui.resumeText.innerHTML = '';
        ui.resumeText.appendChild(el('strong', '', `Unfinished ${category.name} quiz`));
        ui.resumeText.appendChild(document.createTextNode(` · ${done} of ${saved.items.length} answered · ${saved.mode === 'exam' ? 'Exam' : 'Practice'}`));
        ui.resumeBanner.hidden = false;
    }

    async function resume() {
        const saved = store.get('session', null);
        if (!saved) return;
        const data = await loadCategory(saved.slug);
        const byId = questionById(data);
        const items = saved.items
            .filter((item) => byId.has(item.id))
            .map((item) => ({
                question: byId.get(item.id),
                order: item.order,
                answer: item.answer,
                checked: item.checked,
                flagged: item.flagged
            }));
        if (!items.length) {
            discard();
            return;
        }
        state.data = data;
        state.session = {
            slug: saved.slug,
            mode: saved.mode,
            timed: saved.timed,
            items,
            index: Math.min(saved.index, items.length - 1),
            secondsLeft: saved.secondsLeft,
            startedAt: Date.now() - (saved.elapsed || 0),
            finished: false
        };
        ui.resumeBanner.hidden = true;
        enterPlay();
    }

    function discard() {
        store.set('session', null);
        ui.resumeBanner.hidden = true;
    }

    // ---------------------------------------------------------------------
    // Session
    // ---------------------------------------------------------------------

    function startSession(questions) {
        const picked = questions ? Learning.shuffle(questions) : Learning.shuffle(pool()).slice(0, sessionSize(pool().length));
        if (!picked.length) return;
        state.session = {
            slug: state.data.category.slug,
            mode: state.mode,
            timed: state.timed,
            items: picked.map((question) => ({
                question,
                order: question.fixedOrder ? question.options.map((_, i) => i) : Learning.shuffle(question.options.map((_, i) => i)),
                answer: null,
                checked: false,
                flagged: false
            })),
            index: 0,
            secondsLeft: state.timed ? picked.length * SECONDS_PER_QUESTION : null,
            startedAt: Date.now(),
            finished: false
        };
        ui.resumeBanner.hidden = true;
        enterPlay();
    }

    function enterPlay() {
        const s = state.session;
        ui.playCrumb.innerHTML = '';
        ui.playCrumb.appendChild(el('b', '', state.data.category.name));
        ui.playCrumb.appendChild(document.createTextNode(` · ${s.mode === 'exam' ? 'Exam' : 'Practice'}`));
        ui.flagButton.hidden = s.mode !== 'exam';
        ui.skipButton.hidden = s.mode === 'exam';
        renderKeyHints();
        renderTrack();
        show('play');
        renderQuestion();
        ui.questionView.focus({
            preventScroll: true
        });
        if (s.timed) startTimer();
        else ui.playTimer.hidden = true;
        saveSession();
    }

    function elapsed() {
        return state.session ? Date.now() - state.session.startedAt : 0;
    }

    function current() {
        return state.session.items[state.session.index];
    }

    function isRevealed(item) {
        return state.session.finished || (state.session.mode === 'practice' && item.checked);
    }

    function isCorrect(item) {
        return item.answer === item.question.correctOptionIndex;
    }

    function renderKeyHints() {
        const exam = state.session.mode === 'exam';
        const hints = [
            ['A–E', 'choose'],
            ['Enter', exam ? 'next' : 'check, then next'],
            ['←', 'back'],
            exam ? ['F', 'flag'] : ['S', 'skip']
        ];
        ui.keyHints.innerHTML = '';
        hints.forEach(([key, label]) => {
            const span = el('span');
            span.appendChild(el('kbd', '', key));
            span.appendChild(document.createTextNode(label));
            ui.keyHints.appendChild(span);
        });
    }

    function renderTrack() {
        const s = state.session;
        ui.track.innerHTML = '';
        if (s.items.length > SEGMENTED_TRACK_LIMIT) {
            ui.track.className = 'la-track is-bar';
            ui.track.appendChild(el('span'));
        } else {
            ui.track.className = 'la-track';
            s.items.forEach((_, index) => {
                const seg = el('button', 'la-seg');
                seg.type = 'button';
                seg.addEventListener('click', () => goTo(index));
                ui.track.appendChild(seg);
            });
        }
        updateTrack();
    }

    function updateTrack() {
        const s = state.session;
        if (ui.track.classList.contains('is-bar')) {
            const done = s.items.filter((item) => item.checked || item.answer !== null).length;
            ui.track.firstChild.style.width = `${(done / s.items.length) * 100}%`;
            return;
        }
        Array.from(ui.track.children).forEach((seg, index) => {
            const item = s.items[index];
            const revealed = isRevealed(item);
            const reachable = s.mode === 'exam' || s.finished || item.checked || index <= furthest();
            seg.className = 'la-seg';
            if (reachable) seg.classList.add('is-clickable');
            seg.disabled = !reachable;
            if (revealed && item.answer !== null) seg.classList.add(isCorrect(item) ? 'is-correct' : 'is-wrong');
            else if (item.flagged) seg.classList.add('is-flagged');
            else if (item.answer !== null || item.checked) seg.classList.add('is-answered');
            if (index === s.index) seg.classList.add('is-current');
            const status = revealed ? (item.answer === null ? 'skipped' : isCorrect(item) ? 'correct' : 'wrong') : item.answer !== null ? 'answered' : 'not answered';
            seg.setAttribute('aria-label', `Question ${index + 1}, ${status}${item.flagged ? ', flagged' : ''}`);
            if (index === s.index) seg.setAttribute('aria-current', 'step');
            else seg.removeAttribute('aria-current');
        });
    }

    function furthest() {
        const items = state.session.items;
        let last = 0;
        items.forEach((item, index) => {
            if (item.checked || item.answer !== null) last = index + 1;
        });
        return Math.max(last, state.session.index);
    }

    function renderQuestion() {
        const s = state.session;
        const item = current();
        const question = item.question;
        const topic = topicOf(question.topic);
        const revealed = isRevealed(item);

        ui.submitConfirm.hidden = true;
        ui.playCount.textContent = `${s.index + 1} / ${s.items.length}`;
        ui.questionMeta.innerHTML = '';
        ui.questionMeta.appendChild(el('span', 'qz-qnum', `Question ${s.index + 1}`));
        if (topic) ui.questionMeta.appendChild(el('span', 'qz-qtopic', topic.name));
        if (item.flagged) ui.questionMeta.appendChild(el('span', 'qz-qflag', 'Flagged'));
        ui.questionText.innerHTML = question.text;

        ui.optionList.querySelectorAll('.qz-option').forEach((node) => node.remove());
        item.order.forEach((optionIndex, position) => {
            const label = el('label', 'qz-option');
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'answer';
            input.value = optionIndex;
            input.checked = item.answer === optionIndex;
            input.disabled = revealed;
            input.addEventListener('change', () => choose(optionIndex));
            label.appendChild(input);
            label.appendChild(el('span', 'qz-key', KEYS[position] || ''));
            const text = el('span', 'la-option-text qz-option-text');
            text.innerHTML = question.options[optionIndex];
            label.appendChild(text);
            label.appendChild(el('span', 'qz-mark'));
            ui.optionList.appendChild(label);
        });

        if (revealed) paintReveal(item);
        else ui.feedback.hidden = true;
        ui.questionView.classList.toggle('is-revealed', revealed);
        updateActions();
        updateTrack();
        if (state.data.category.math) Learning.typeset([ui.questionText, ui.optionList, ui.explanation]);
    }

    function paintReveal(item) {
        const question = item.question;
        ui.optionList.querySelectorAll('.qz-option').forEach((label) => {
            const optionIndex = Number(label.querySelector('input').value);
            const mark = label.querySelector('.qz-mark');
            label.classList.remove('is-correct', 'is-wrong');
            mark.textContent = '';
            if (optionIndex === question.correctOptionIndex) {
                label.classList.add('is-correct');
                mark.textContent = optionIndex === item.answer ? 'Your answer' : 'Correct answer';
            } else if (optionIndex === item.answer) {
                label.classList.add('is-wrong');
                mark.textContent = 'Your answer';
            }
        });

        const correct = isCorrect(item);
        ui.verdict.className = 'qz-verdict';
        if (item.answer === null) {
            ui.verdict.classList.add('is-skipped');
            ui.verdict.textContent = 'Skipped';
        } else {
            ui.verdict.classList.add(correct ? 'is-correct' : 'is-wrong');
            ui.verdict.textContent = correct ? 'Correct' : 'Not quite';
        }
        ui.explanation.innerHTML = question.explanation || '';
        ui.explanation.hidden = !question.explanation;
        renderSources(ui.sources, question);
        ui.feedback.hidden = false;
        ui.feedback.classList.remove('la-reveal');
        void ui.feedback.offsetWidth;
        ui.feedback.classList.add('la-reveal');
    }

    function renderSources(container, question) {
        container.innerHTML = '';
        const topic = topicOf(question.topic);
        ((topic && topic.notes) || []).slice(0, 3).forEach((note) => container.appendChild(link(note.url, note.title)));
        container.appendChild(link(question.source, 'View source'));
    }

    function updateActions() {
        const s = state.session;
        const item = current();
        const last = s.index === s.items.length - 1;
        const revealed = isRevealed(item);
        ui.prevButton.disabled = s.index === 0;
        ui.flagButton.setAttribute('aria-pressed', String(item.flagged));
        ui.flagButton.textContent = item.flagged ? 'Unflag' : 'Flag';
        ui.skipButton.hidden = s.mode === 'exam' || revealed;

        let label;
        let enabled = true;
        if (s.finished) {
            label = last ? 'Back to results' : 'Next question';
        } else if (s.mode === 'practice') {
            if (!item.checked) {
                label = 'Check answer';
                enabled = item.answer !== null;
            } else {
                label = last ? 'See results' : 'Next question';
            }
        } else {
            label = last ? 'Finish quiz' : 'Next question';
        }
        ui.primaryButton.textContent = label;
        ui.primaryButton.disabled = !enabled;
    }

    function choose(optionIndex) {
        const item = current();
        if (isRevealed(item)) return;
        item.answer = optionIndex;
        const input = ui.optionList.querySelector(`input[value="${optionIndex}"]`);
        if (input) input.checked = true;
        updateActions();
        updateTrack();
        saveSession();
    }

    function primary() {
        const s = state.session;
        const item = current();
        if (s.finished) {
            if (s.index === s.items.length - 1) show('results');
            else goTo(s.index + 1);
            return;
        }
        if (s.mode === 'practice' && !item.checked) {
            if (item.answer === null) return;
            item.checked = true;
            renderQuestion();
            saveSession();
            ui.primaryButton.focus({
                preventScroll: true
            });
            return;
        }
        if (s.index < s.items.length - 1) {
            goTo(s.index + 1);
        } else if (s.mode === 'exam') {
            confirmSubmit();
        } else {
            finish();
        }
    }

    function skip() {
        const s = state.session;
        if (s.mode !== 'practice' || current().checked) return;
        current().answer = null;
        current().checked = true;
        if (s.index < s.items.length - 1) goTo(s.index + 1);
        else finish();
    }

    function goTo(index) {
        const s = state.session;
        if (index < 0 || index >= s.items.length) return;
        s.index = index;
        renderQuestion();
        saveSession();
        Learning.scrollIntoFocus(ui.quizApp);
        ui.questionView.focus({
            preventScroll: true
        });
    }

    function toggleFlag() {
        if (state.session.mode !== 'exam' || state.session.finished) return;
        const item = current();
        item.flagged = !item.flagged;
        renderQuestion();
        saveSession();
    }

    function confirmSubmit() {
        const items = state.session.items;
        const open = items.filter((item) => item.answer === null).length;
        const flagged = items.filter((item) => item.flagged).length;
        if (!open && !flagged) {
            finish();
            return;
        }
        const parts = [];
        if (open) parts.push(`${open} question${open === 1 ? ' is' : 's are'} unanswered`);
        if (flagged) parts.push(`${flagged} ${flagged === 1 ? 'is' : 'are'} flagged`);
        ui.confirmText.textContent = `${parts.join(' and ')}. Unanswered questions count as skipped.`;
        ui.submitConfirm.hidden = false;
        ui.confirmSubmit.focus();
    }

    function reviewOpen() {
        const index = state.session.items.findIndex((item) => item.answer === null || item.flagged);
        goTo(index === -1 ? 0 : index);
    }

    function endEarly() {
        const s = state.session;
        if (!s) return;
        const answered = s.items.filter((item) => item.answer !== null).length;
        if (answered && !window.confirm('End the quiz now? Questions you have not answered count as skipped.')) return;
        if (!answered) {
            state.session = null;
            store.set('session', null);
            show('setup');
            return;
        }
        finish();
    }

    // ---------------------------------------------------------------------
    // Timer
    // ---------------------------------------------------------------------

    function startTimer() {
        stopTimer();
        ui.playTimer.hidden = false;
        paintTimer();
        state.timer = window.setInterval(() => {
            const s = state.session;
            s.secondsLeft -= 1;
            paintTimer();
            if (s.secondsLeft % 5 === 0) saveSession();
            if (s.secondsLeft <= 0) {
                stopTimer();
                finish();
            }
        }, 1000);
    }

    function stopTimer() {
        if (state.timer) window.clearInterval(state.timer);
        state.timer = null;
    }

    function paintTimer() {
        const left = Math.max(state.session.secondsLeft, 0);
        ui.playTimer.textContent = formatTime(left);
        ui.playTimer.classList.toggle('is-critical', left <= 30);
        ui.playTimer.classList.toggle('is-warning', left > 30 && left <= 120);
    }

    function formatTime(total) {
        const minutes = Math.floor(total / 60);
        return `${minutes}:${String(total % 60).padStart(2, '0')}`;
    }

    // ---------------------------------------------------------------------
    // Results
    // ---------------------------------------------------------------------

    function finish() {
        const s = state.session;
        s.finished = true;
        s.duration = Math.round(elapsed() / 1000);
        stopTimer();
        store.set('session', null);

        const results = summarise();
        const progress = progressFor(s.slug);
        const missed = new Set(progress.missed);
        s.items.forEach((item) => {
            if (isCorrect(item)) missed.delete(item.question.id);
            else if (item.answer !== null) missed.add(item.question.id);
        });
        progress.missed = Array.from(missed);
        progress.previousBest = progress.best;
        progress.best = Math.max(progress.best || 0, results.percentage);
        progress.attempts += 1;
        store.set(`progress:${s.slug}`, progress);

        renderResults(results, progress);
        show('results');
        ui.resultTitle.focus({
            preventScroll: true
        });
    }

    function summarise() {
        const items = state.session.items;
        const byTopic = new Map();
        const counts = {
            correct: 0,
            wrong: 0,
            skipped: 0
        };
        items.forEach((item) => {
            const key = item.question.topic;
            if (!byTopic.has(key)) byTopic.set(key, {
                correct: 0,
                total: 0
            });
            const entry = byTopic.get(key);
            entry.total += 1;
            if (item.answer === null) counts.skipped += 1;
            else if (isCorrect(item)) {
                counts.correct += 1;
                entry.correct += 1;
            } else counts.wrong += 1;
        });
        return {
            ...counts,
            total: items.length,
            percentage: Math.round((counts.correct / items.length) * 100),
            byTopic
        };
    }

    function verdictFor(percentage) {
        if (percentage === 100) return ['Full marks', 'Every answer was right. Try exam mode or a longer set next.'];
        if (percentage >= 85) return ['Excellent', 'You know this material well. Skim the explanations for anything you guessed.'];
        if (percentage >= 70) return ['Solid result', 'Review the mistakes below; each one links to the notes it comes from.'];
        if (percentage >= 50) return ['Getting there', 'Read the notes for your weakest topics, then retry your mistakes.'];
        return ['Keep going', 'Start with the notes for the topics below, then retry the questions you missed.'];
    }

    function renderResults(results, progress) {
        const s = state.session;
        ui.resultScore.innerHTML = '';
        ui.resultScore.appendChild(document.createTextNode(String(results.correct)));
        ui.resultScore.appendChild(el('small', '', ` / ${results.total}`));
        const [title, text] = verdictFor(results.percentage);
        ui.resultTitle.textContent = `${title} · ${results.percentage}%`;
        const best = progress.previousBest !== null && progress.previousBest !== undefined && results.percentage > progress.previousBest ? ` New personal best (previous ${progress.previousBest}%).` : '';
        ui.resultText.textContent = text + best;

        ui.resultStats.innerHTML = '';
        [
            [`${results.correct} correct`, 'is-good'],
            [`${results.wrong} wrong`, results.wrong ? 'is-bad' : ''],
            [`${results.skipped} skipped`, results.skipped ? 'is-warn' : ''],
            [`${formatTime(s.duration)} taken`, ''],
            [s.mode === 'exam' ? 'Exam' : 'Practice', '']
        ].forEach(([label, cls]) => ui.resultStats.appendChild(el('span', cls, label)));

        const mistakes = results.wrong + results.skipped;
        ui.retryButton.hidden = mistakes === 0;
        ui.retryButton.textContent = `Retry ${mistakes} mistake${mistakes === 1 ? '' : 's'}`;

        ui.topicBars.innerHTML = '';
        const rows = Array.from(results.byTopic.entries()).sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total);
        rows.forEach(([slug, entry]) => {
            const topic = topicOf(slug);
            const ratio = entry.correct / entry.total;
            const row = el('div', 'la-bar-row');
            const name = el('div', 'la-bar-name', topic ? topic.name : slug);
            if (ratio < 1 && topic && topic.notes && topic.notes[0]) name.appendChild(link(topic.notes[0].url, `Read: ${topic.notes[0].title}`));
            row.appendChild(name);
            const bar = el('div', `la-bar${ratio < 0.5 ? ' is-low' : ratio < 0.8 ? ' is-mid' : ''}`);
            const fill = el('span');
            fill.style.width = `${Math.max(ratio * 100, 2)}%`;
            bar.appendChild(fill);
            row.appendChild(bar);
            row.appendChild(el('div', 'la-bar-value', `${entry.correct} / ${entry.total}`));
            ui.topicBars.appendChild(row);
        });
        const multiTopic = rows.length > 1;
        ui.topicsHeading.hidden = !multiTopic;
        ui.topicBars.hidden = !multiTopic;

        state.reviewFilter = mistakes ? 'mistakes' : 'all';
        renderReview();
    }

    function renderReview() {
        document.querySelectorAll('.la-tab').forEach((tab) => {
            tab.setAttribute('aria-selected', String(tab.dataset.filter === state.reviewFilter));
        });
        ui.reviewList.innerHTML = '';
        const items = state.session.items
            .map((item, index) => ({
                item,
                index
            }))
            .filter(({
                item
            }) => state.reviewFilter === 'all' || !isCorrect(item));
        if (!items.length) {
            const li = el('li');
            li.appendChild(el('p', 'la-empty', 'No mistakes to review. Nicely done.'));
            ui.reviewList.appendChild(li);
            return;
        }
        items.forEach(({
            item,
            index
        }) => {
            const question = item.question;
            const li = el('li');
            const details = el('details', 'la-row');
            const summary = el('summary');
            summary.appendChild(el('span', 'la-row-index', String(index + 1).padStart(2, '0')));
            const title = el('span', 'la-row-title');
            title.innerHTML = firstParagraph(question.text);
            summary.appendChild(title);
            const status = item.answer === null ? ['Skipped', 'is-warn'] : isCorrect(item) ? ['Correct', 'is-good'] : ['Wrong', 'is-bad'];
            summary.appendChild(el('span', `la-row-tag ${status[1]}`, status[0]));
            details.appendChild(summary);

            const body = el('div', 'la-row-body');
            if (question.text.includes('<pre')) {
                const full = el('div', 'la-question-text qz-review-text');
                full.innerHTML = question.text;
                body.appendChild(full);
            }
            const answers = el('ul', 'qz-review-options');
            item.order.forEach((optionIndex, position) => {
                const row = el('li', 'qz-review-option');
                if (optionIndex === question.correctOptionIndex) row.classList.add('is-correct');
                else if (optionIndex === item.answer) row.classList.add('is-wrong');
                row.appendChild(el('span', 'qz-key', KEYS[position]));
                const text = el('span', 'la-option-text');
                text.innerHTML = question.options[optionIndex];
                row.appendChild(text);
                const mark = optionIndex === question.correctOptionIndex ? (optionIndex === item.answer ? 'Your answer' : 'Correct answer') : optionIndex === item.answer ? 'Your answer' : '';
                row.appendChild(el('span', 'qz-mark', mark));
                answers.appendChild(row);
            });
            body.appendChild(answers);
            if (question.explanation) {
                const explanation = el('div', 'la-prose qz-explanation');
                explanation.innerHTML = question.explanation;
                body.appendChild(explanation);
            }
            const sources = el('p', 'qz-sources');
            renderSources(sources, question);
            body.appendChild(sources);
            details.appendChild(body);
            details.addEventListener('toggle', () => {
                if (details.open && state.data.category.math) Learning.typeset(body);
            }, {
                once: true
            });
            li.appendChild(details);
            ui.reviewList.appendChild(li);
        });
        if (state.data.category.math) Learning.typeset(ui.reviewList);
    }

    function firstParagraph(html) {
        const match = html.match(/<p>([\s\S]*?)<\/p>/);
        return match ? match[1] : html;
    }

    function retryMistakes() {
        const questions = state.session.items.filter((item) => !isCorrect(item)).map((item) => item.question);
        state.mode = state.session.mode;
        startSession(questions);
    }

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    function onKeydown(event) {
        if (ui.playScreen.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.target;
        if (target && (target.isContentEditable || target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && target.type !== 'radio'))) return;
        const key = event.key;
        const onRadio = target && target.type === 'radio';

        if (/^[1-9]$/.test(key) || /^[a-iA-I]$/.test(key) && key.toLowerCase() !== 'f') {
            const position = /^[1-9]$/.test(key) ? Number(key) - 1 : KEYS.indexOf(key.toUpperCase());
            const optionIndex = current().order[position];
            if (optionIndex !== undefined && !isRevealed(current())) {
                choose(optionIndex);
                event.preventDefault();
            }
            return;
        }
        // Buttons and links inside the session handle Enter natively.
        const nativeEnter = ['BUTTON', 'A', 'SUMMARY'].includes(target.tagName) && ui.playScreen.contains(target);
        if (key === 'Enter' && !nativeEnter) {
            if (!ui.submitConfirm.hidden) finish();
            else primary();
            event.preventDefault();
        } else if (key === 'ArrowLeft' && !onRadio) {
            goTo(state.session.index - 1);
            event.preventDefault();
        } else if (key === 'ArrowRight' && !onRadio && (state.session.mode === 'exam' || state.session.finished || current().checked)) {
            goTo(state.session.index + 1);
            event.preventDefault();
        } else if ((key === 'f' || key === 'F') && state.session.mode === 'exam') {
            toggleFlag();
            event.preventDefault();
        } else if ((key === 's' || key === 'S') && state.session.mode === 'practice') {
            skip();
            event.preventDefault();
        } else if (key === 'Escape' && !ui.submitConfirm.hidden) {
            ui.submitConfirm.hidden = true;
        }
    }

    function attachEvents() {
        document.querySelectorAll('input[name="mode"]').forEach((radio) => {
            radio.addEventListener('change', () => {
                setMode(radio.value);
                refreshSetup();
            });
        });
        ui.timerToggle.addEventListener('change', () => {
            state.timed = ui.timerToggle.checked;
            refreshSetup();
        });
        ui.missedToggle.addEventListener('change', () => {
            state.onlyMissed = ui.missedToggle.checked;
            refreshSetup();
        });
        ui.topicPicker.addEventListener('click', (event) => {
            const button = event.target.closest('[data-topics]');
            if (button && state.picker) state.picker.setAll(button.dataset.topics === 'all');
        });
        ui.startButton.addEventListener('click', () => startSession());
        ui.resumeButton.addEventListener('click', resume);
        ui.discardButton.addEventListener('click', discard);
        ui.primaryButton.addEventListener('click', primary);
        ui.prevButton.addEventListener('click', () => goTo(state.session.index - 1));
        ui.skipButton.addEventListener('click', skip);
        ui.flagButton.addEventListener('click', toggleFlag);
        ui.endButton.addEventListener('click', () => (state.session.finished ? show('results') : endEarly()));
        ui.confirmReview.addEventListener('click', reviewOpen);
        ui.confirmSubmit.addEventListener('click', finish);
        ui.retryButton.addEventListener('click', retryMistakes);
        ui.againButton.addEventListener('click', () => {
            state.mode = state.session.mode;
            startSession();
        });
        ui.setupButton.addEventListener('click', () => {
            renderSubjects(state.data.category.slug);
            refreshSetup();
            show('setup');
        });
        document.querySelectorAll('.la-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                state.reviewFilter = tab.dataset.filter;
                renderReview();
            });
        });
        ui.questionView.tabIndex = -1;
        document.addEventListener('keydown', onKeydown);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();