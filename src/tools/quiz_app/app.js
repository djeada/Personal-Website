(function() {
    'use strict';

    const CONFIG = {
        DEFAULT_QUESTIONS: 10,
        MAX_QUESTIONS: 100,
        TIMER_SECONDS_PER_QUESTION: 75,
        TIMER_WARNING_SECONDS: 60,
        TIMER_CRITICAL_SECONDS: 15,
        PROGRESS_CIRCUMFERENCE: 2 * Math.PI * 45,
        MAX_OPTION_KEYS: 9
    };

    const MODE_HINTS = {
        practice: 'Practice mode: each answer is checked as soon as you pick it. Keys: 1–5 answer the current question, ↑/↓ move between questions, Enter shows results.',
        exam: 'Exam mode: answers stay hidden until you submit. Keys: 1–5 answer the current question, ↑/↓ move between questions, Enter submits.'
    };

    const progressStore = Learning.store('quiz');
    const categoryCache = new Map();

    const state = {
        categories: [],
        data: null,
        topics: new Set(),
        mode: 'practice',
        onlyMissed: false,
        items: [],
        submitted: false,
        active: 0,
        observer: null,
        timer: null,
        secondsLeft: 0,
        startedAt: 0,
        lastFocus: null
    };

    const $ = (id) => document.getElementById(id);
    let elements = {};

    function cacheElements() {
        elements = {
            settings: $('quizSettings'),
            categorySelect: $('categorySelect'),
            maxQuestions: $('maxQuestionsInput'),
            timerToggle: $('timerToggle'),
            timerDisplay: $('timerDisplay'),
            categoryMeta: $('categoryMeta'),
            topicFilter: $('topicFilter'),
            missedToggle: $('missedToggle'),
            missedToggleLabel: $('missedToggleLabel'),
            missedToggleText: $('missedToggleText'),
            modeHint: $('modeHint'),
            tallyValue: $('tallyValue'),
            questionNav: $('questionNav'),
            progressText: $('progressText'),
            progressPercentage: $('progressPercentage'),
            progressBar: $('progressBar'),
            progressBarContainer: $('progressBarContainer'),
            container: $('quizContainer'),
            submit: $('submitButton'),
            modal: $('resultsModal'),
            resultsProgress: $('resultsProgress'),
            resultsScore: $('resultsScore'),
            correctCount: $('correctCount'),
            incorrectCount: $('incorrectCount'),
            unansweredCount: $('unansweredCount'),
            resultsMessage: $('resultsMessage'),
            breakdown: $('topicBreakdown'),
            review: $('reviewAnswersButton'),
            retryMissed: $('retryMissedButton'),
            tryAgain: $('tryAgainButton')
        };
    }

    // ---------------------------------------------------------------------
    // Persistence: which questions were missed, best score per subject
    // ---------------------------------------------------------------------

    function categoryProgress(slug) {
        return progressStore.get(slug || state.data.category.slug, {
            missed: [],
            best: null,
            attempts: 0
        });
    }

    function saveProgress(results) {
        const slug = state.data.category.slug;
        const progress = categoryProgress(slug);
        const missed = new Set(progress.missed);
        state.items.forEach((item) => {
            if (item.answer === item.question.correctOptionIndex) {
                missed.delete(item.question.id);
            } else if (item.answer !== undefined) {
                missed.add(item.question.id);
            }
        });
        progress.missed = Array.from(missed);
        progress.attempts += 1;
        progress.best = Math.max(progress.best || 0, results.percentage);
        progressStore.set(slug, progress);
        updateMissedToggle();
    }

    // ---------------------------------------------------------------------
    // Loading subjects
    // ---------------------------------------------------------------------

    async function loadIndex() {
        try {
            const index = await Learning.fetchJson('categories.json');
            state.categories = index.categories || [];
        } catch (error) {
            console.error(error);
            showMessage('The quiz index could not be loaded. Please refresh the page.');
            return;
        }
        if (!state.categories.length) {
            showMessage('No quizzes are available yet.');
            return;
        }

        elements.categorySelect.innerHTML = '';
        state.categories.forEach((category) => {
            const option = document.createElement('option');
            option.value = category.slug;
            option.textContent = `${category.name} (${category.questionCount})`;
            elements.categorySelect.appendChild(option);
        });

        const params = Learning.readParams();
        const requested = params.get('category');
        const slug = state.categories.some((c) => c.slug === requested) ? requested : state.categories[0].slug;
        elements.categorySelect.value = slug;

        const mode = params.get('mode');
        if (mode === 'exam' || mode === 'practice') setMode(mode);
        const count = parseInt(params.get('n'), 10);
        if (count > 0) elements.maxQuestions.value = Math.min(count, CONFIG.MAX_QUESTIONS);

        const topics = (params.get('topics') || '').split(',').filter(Boolean);
        await loadCategory(slug, topics);
    }

    async function loadCategory(slug, topics) {
        showMessage('Loading questions…');
        try {
            if (!categoryCache.has(slug)) {
                categoryCache.set(slug, await Learning.fetchJson(`${slug}.json`));
            }
        } catch (error) {
            console.error(error);
            showMessage('These questions could not be loaded. Please try another subject or refresh.');
            return;
        }
        state.data = categoryCache.get(slug);
        const known = new Set(state.data.topics.map((t) => t.slug));
        state.topics = new Set((topics || []).filter((t) => known.has(t)));
        state.onlyMissed = false;
        elements.missedToggle.checked = false;
        renderCategoryMeta();
        renderTopicFilter();
        updateMissedToggle();
        startQuiz();
    }

    function renderCategoryMeta() {
        const meta = elements.categoryMeta;
        const category = state.data.category;
        meta.innerHTML = '';
        meta.appendChild(document.createTextNode(`${category.description} `));
        const progress = categoryProgress();
        const facts = [`${category.questionCount} questions`, `${category.topicCount} topics`];
        if (progress.best !== null) facts.push(`your best: ${progress.best}%`);
        meta.appendChild(Learning.el('span', 'meta-facts', facts.join(' · ')));
        (category.repositories || []).forEach((url) => {
            meta.appendChild(document.createTextNode(' · '));
            meta.appendChild(Learning.link(url, 'Source notes'));
        });
    }

    function renderTopicFilter() {
        const filter = elements.topicFilter;
        filter.innerHTML = '';
        const chip = (label, slug, count) => {
            const button = Learning.el('button', 'topic-chip');
            button.type = 'button';
            button.dataset.topic = slug;
            button.appendChild(document.createTextNode(label));
            if (count !== undefined) button.appendChild(Learning.el('span', 'chip-count', String(count)));
            filter.appendChild(button);
        };
        chip('All topics', '', state.data.category.questionCount);
        state.data.topics.forEach((topic) => chip(topic.name, topic.slug, topic.questionCount));
        syncTopicChips();
    }

    function syncTopicChips() {
        elements.topicFilter.querySelectorAll('.topic-chip').forEach((button) => {
            const slug = button.dataset.topic;
            const pressed = slug ? state.topics.has(slug) : state.topics.size === 0;
            button.setAttribute('aria-pressed', String(pressed));
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
        updateMissedToggle();
        startQuiz();
    }

    function updateMissedToggle() {
        if (!state.data) return;
        const missed = missedPool().length;
        elements.missedToggleLabel.hidden = missed === 0;
        elements.missedToggleText.textContent = `Only questions I missed (${missed})`;
        if (missed === 0 && state.onlyMissed) {
            state.onlyMissed = false;
            elements.missedToggle.checked = false;
        }
    }

    // ---------------------------------------------------------------------
    // Building a quiz
    // ---------------------------------------------------------------------

    function topicPool() {
        const questions = state.data.questions;
        return state.topics.size ? questions.filter((q) => state.topics.has(q.topic)) : questions;
    }

    function missedPool() {
        const missed = new Set(categoryProgress().missed);
        return topicPool().filter((q) => missed.has(q.id));
    }

    function questionCount() {
        const value = parseInt(elements.maxQuestions.value, 10);
        if (!value || value < 1) return CONFIG.DEFAULT_QUESTIONS;
        return Math.min(value, CONFIG.MAX_QUESTIONS);
    }

    function startQuiz(questions) {
        if (!state.data) return;
        hideResults();
        const pool = questions || (state.onlyMissed ? missedPool() : topicPool());
        const picked = questions ? Learning.shuffle(questions) : Learning.shuffle(pool).slice(0, questionCount());

        state.items = picked.map((question) => ({
            question,
            order: question.fixedOrder ? question.options.map((_, i) => i) : Learning.shuffle(question.options.map((_, i) => i)),
            answer: undefined,
            revealed: false
        }));
        state.submitted = false;
        state.active = 0;

        renderQuiz();
        resetTimer();
        if (elements.timerToggle.checked) startTimer();
        syncUrl();
    }

    function syncUrl() {
        Learning.writeParams({
            category: state.data.category.slug,
            topics: Array.from(state.topics).join(','),
            mode: state.mode === 'practice' ? '' : state.mode,
            n: questionCount() === CONFIG.DEFAULT_QUESTIONS ? '' : questionCount()
        });
    }

    function topicFor(slug) {
        return state.data.topics.find((t) => t.slug === slug);
    }

    // ---------------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------------

    function showMessage(text) {
        elements.container.innerHTML = '';
        const box = Learning.el('div', 'empty-state');
        box.appendChild(Learning.el('p', 'empty-state-text', text));
        elements.container.appendChild(box);
        elements.questionNav.innerHTML = '';
        elements.submit.disabled = true;
    }

    function renderQuiz() {
        if (!state.items.length) {
            showMessage(state.onlyMissed ? 'No missed questions left in these topics. Nice work.' : 'No questions match these topics.');
            updateProgress();
            return;
        }
        elements.container.innerHTML = '';
        state.items.forEach((item, index) => elements.container.appendChild(renderCard(item, index)));
        renderNav();
        observeCards();
        updateProgress();
        updateSubmitButton();
        if (state.data.category.math) Learning.typeset(elements.container);
    }

    function renderCard(item, index) {
        const question = item.question;
        const card = Learning.el('article', 'question-card');
        card.dataset.index = index;
        card.tabIndex = -1;

        const header = Learning.el('div', 'question-header');
        header.appendChild(Learning.el('span', 'question-number', String(index + 1)));
        const topic = topicFor(question.topic);
        header.appendChild(Learning.el('span', 'question-topic', topic ? topic.name : ''));
        card.appendChild(header);

        const text = Learning.el('div', 'question-content');
        text.id = `q${index}-text`;
        text.innerHTML = question.text;
        card.appendChild(text);

        const list = Learning.el('ul', 'options-list');
        list.setAttribute('role', 'radiogroup');
        list.setAttribute('aria-labelledby', text.id);
        item.order.forEach((optionIndex, position) => {
            const li = Learning.el('li', 'option-item');
            li.dataset.option = optionIndex;
            const id = `q${index}-opt${optionIndex}`;
            const input = document.createElement('input');
            input.type = 'radio';
            input.className = 'option-input';
            input.name = `q${index}`;
            input.id = id;
            input.value = optionIndex;
            input.addEventListener('change', () => selectAnswer(index, optionIndex));
            const label = document.createElement('label');
            label.className = 'option-label';
            label.htmlFor = id;
            label.appendChild(Learning.el('span', 'option-key', position < CONFIG.MAX_OPTION_KEYS ? String(position + 1) : ''));
            const optionText = Learning.el('span', 'option-text');
            optionText.innerHTML = question.options[optionIndex];
            label.appendChild(optionText);
            li.appendChild(input);
            li.appendChild(label);
            list.appendChild(li);
        });
        card.appendChild(list);

        const feedback = Learning.el('div', 'question-feedback');
        feedback.hidden = true;
        feedback.setAttribute('aria-live', 'polite');
        feedback.appendChild(Learning.el('p', 'feedback-verdict'));
        if (question.explanation) {
            const explanation = Learning.el('div', 'feedback-explanation');
            explanation.innerHTML = question.explanation;
            feedback.appendChild(explanation);
        }
        const links = Learning.el('p', 'feedback-links');
        ((topic && topic.notes) || []).forEach((note) => {
            links.appendChild(Learning.link(note.url, `Notes: ${note.title}`));
        });
        links.appendChild(Learning.link(question.source, 'Question source'));
        feedback.appendChild(links);
        card.appendChild(feedback);
        return card;
    }

    function cardAt(index) {
        return elements.container.querySelector(`.question-card[data-index="${index}"]`);
    }

    function renderNav() {
        const nav = elements.questionNav;
        nav.innerHTML = '';
        state.items.forEach((_, index) => {
            const button = Learning.el('button', 'question-nav-btn', String(index + 1));
            button.type = 'button';
            button.setAttribute('aria-label', `Question ${index + 1}`);
            button.addEventListener('click', () => focusQuestion(index));
            nav.appendChild(button);
        });
        updateNav();
    }

    function updateNav() {
        const buttons = elements.questionNav.querySelectorAll('.question-nav-btn');
        state.items.forEach((item, index) => {
            const button = buttons[index];
            if (!button) return;
            const shown = item.revealed;
            button.classList.toggle('active', index === state.active);
            button.classList.toggle('answered', item.answer !== undefined && !shown);
            button.classList.toggle('correct', shown && item.answer === item.question.correctOptionIndex);
            button.classList.toggle('incorrect', shown && item.answer !== item.question.correctOptionIndex);
            if (index === state.active) button.setAttribute('aria-current', 'step');
            else button.removeAttribute('aria-current');
        });
    }

    function observeCards() {
        if (state.observer) state.observer.disconnect();
        if (typeof IntersectionObserver === 'undefined') return;
        state.observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    state.active = Number(entry.target.dataset.index);
                    updateNav();
                }
            });
        }, {
            rootMargin: '-40% 0px -50% 0px'
        });
        elements.container.querySelectorAll('.question-card').forEach((card) => state.observer.observe(card));
    }

    function focusQuestion(index) {
        const card = cardAt(index);
        if (!card) return;
        state.active = index;
        updateNav();
        card.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
        card.focus({
            preventScroll: true
        });
    }

    function updateProgress() {
        const total = state.items.length;
        const answered = state.items.filter((item) => item.answer !== undefined).length;
        const percentage = total ? Math.round((answered / total) * 100) : 0;
        elements.progressText.textContent = `${answered} of ${total} answered`;
        elements.progressPercentage.textContent = `${percentage}%`;
        elements.progressBar.style.width = `${percentage}%`;
        elements.progressBarContainer.setAttribute('aria-valuenow', String(percentage));

        const revealed = state.items.filter((item) => item.revealed);
        const correct = revealed.filter((item) => item.answer === item.question.correctOptionIndex).length;
        elements.tallyValue.textContent = `${correct} / ${revealed.length}`;
        updateNav();
    }

    function updateSubmitButton() {
        const button = elements.submit;
        button.disabled = !state.items.length;
        if (state.submitted) {
            button.textContent = 'Show results';
        } else {
            button.textContent = state.mode === 'practice' ? 'Finish and see results' : 'Submit answers';
        }
    }

    // ---------------------------------------------------------------------
    // Answering
    // ---------------------------------------------------------------------

    function selectAnswer(index, optionIndex) {
        const item = state.items[index];
        if (!item || item.revealed || state.submitted) return;
        item.answer = optionIndex;
        const card = cardAt(index);
        card.classList.add('answered');
        const input = card.querySelector(`#q${index}-opt${optionIndex}`);
        if (input) input.checked = true;
        if (state.mode === 'practice') reveal(index);
        updateProgress();
    }

    function reveal(index) {
        const item = state.items[index];
        const card = cardAt(index);
        if (!item || !card) return;
        item.revealed = true;
        const correctIndex = item.question.correctOptionIndex;
        const isCorrect = item.answer === correctIndex;

        card.querySelectorAll('.option-item').forEach((li) => {
            const optionIndex = Number(li.dataset.option);
            li.classList.toggle('correct', optionIndex === correctIndex);
            li.classList.toggle('incorrect', optionIndex === item.answer && !isCorrect);
            li.querySelector('input').disabled = true;
        });
        card.classList.add('revealed', item.answer === undefined ? 'skipped' : isCorrect ? 'correct-answer' : 'incorrect-answer');

        const feedback = card.querySelector('.question-feedback');
        const verdict = feedback.querySelector('.feedback-verdict');
        verdict.textContent = item.answer === undefined ? 'Not answered.' : isCorrect ? 'Correct.' : 'Not quite.';
        feedback.hidden = false;
    }

    function finish() {
        if (!state.items.length) return;
        if (!state.submitted) {
            state.submitted = true;
            stopTimer();
            state.items.forEach((item, index) => {
                if (!item.revealed) reveal(index);
            });
            updateProgress();
            updateSubmitButton();
            const results = computeResults();
            saveProgress(results);
            renderCategoryMeta();
            state.lastResults = results;
        }
        showResults(state.lastResults);
    }

    function computeResults() {
        const byTopic = new Map();
        let correct = 0;
        let incorrect = 0;
        let unanswered = 0;
        state.items.forEach((item) => {
            const topic = item.question.topic;
            if (!byTopic.has(topic)) byTopic.set(topic, {
                correct: 0,
                total: 0
            });
            const entry = byTopic.get(topic);
            entry.total += 1;
            if (item.answer === undefined) {
                unanswered += 1;
            } else if (item.answer === item.question.correctOptionIndex) {
                correct += 1;
                entry.correct += 1;
            } else {
                incorrect += 1;
            }
        });
        const total = state.items.length;
        return {
            correct,
            incorrect,
            unanswered,
            total,
            percentage: total ? Math.round((correct / total) * 100) : 0,
            byTopic,
            seconds: state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : null
        };
    }

    function resultsMessage(percentage) {
        if (percentage === 100) return 'Full marks. Try exam mode or a larger set next.';
        if (percentage >= 85) return 'Excellent. You know this material well.';
        if (percentage >= 70) return 'Solid result. Read the explanations for the questions you missed.';
        if (percentage >= 50) return 'Getting there. The linked notes cover the topics that went wrong.';
        return 'Start with the notes for the topics below, then retry your mistakes.';
    }

    // ---------------------------------------------------------------------
    // Results dialog
    // ---------------------------------------------------------------------

    function showResults(results) {
        elements.correctCount.textContent = results.correct;
        elements.incorrectCount.textContent = results.incorrect;
        elements.unansweredCount.textContent = results.unanswered;
        let message = resultsMessage(results.percentage);
        if (results.seconds !== null && elements.timerToggle.checked) message += ` Time: ${formatTime(results.seconds)}.`;
        elements.resultsMessage.textContent = message;

        const body = elements.breakdown.querySelector('tbody');
        body.innerHTML = '';
        results.byTopic.forEach((entry, slug) => {
            const topic = topicFor(slug);
            const row = document.createElement('tr');
            row.appendChild(Learning.el('td', '', topic ? topic.name : slug));
            row.appendChild(Learning.el('td', 'numeric', `${entry.correct} / ${entry.total}`));
            const notes = Learning.el('td');
            if (entry.correct < entry.total && topic && topic.notes && topic.notes[0]) {
                notes.appendChild(Learning.link(topic.notes[0].url, 'Read the notes'));
            } else {
                notes.textContent = entry.correct === entry.total ? 'All correct' : '';
            }
            row.appendChild(notes);
            body.appendChild(row);
        });
        elements.breakdown.hidden = results.byTopic.size < 2 && results.correct === results.total;

        const mistakes = results.incorrect + results.unanswered;
        elements.retryMissed.hidden = mistakes === 0;
        elements.retryMissed.textContent = `Retry mistakes (${mistakes})`;

        state.lastFocus = document.activeElement;
        elements.modal.hidden = false;
        document.body.classList.add('modal-open');
        animateScore(results.percentage);
        elements.modal.querySelector('.modal-close').focus();
    }

    function hideResults() {
        if (elements.modal.hidden) return;
        elements.modal.hidden = true;
        document.body.classList.remove('modal-open');
        if (state.lastFocus && document.contains(state.lastFocus)) state.lastFocus.focus();
    }

    function animateScore(target) {
        const circumference = CONFIG.PROGRESS_CIRCUMFERENCE;
        elements.resultsProgress.style.strokeDasharray = String(circumference);
        const draw = (value) => {
            elements.resultsScore.textContent = `${value}%`;
            elements.resultsProgress.style.strokeDashoffset = String(circumference - (value / 100) * circumference);
        };
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            draw(target);
            return;
        }
        const started = performance.now();
        const step = (now) => {
            const t = Math.min((now - started) / 700, 1);
            draw(Math.round(target * (1 - Math.pow(1 - t, 3))));
            if (t < 1) requestAnimationFrame(step);
        };
        draw(0);
        requestAnimationFrame(step);
    }

    function reviewAnswers() {
        hideResults();
        const first = state.items.findIndex((item) => item.answer !== item.question.correctOptionIndex);
        focusQuestion(first === -1 ? 0 : first);
    }

    function retryMistakes() {
        const questions = state.items
            .filter((item) => item.answer !== item.question.correctOptionIndex)
            .map((item) => item.question);
        if (questions.length) startQuiz(questions);
        window.scrollTo({
            top: elements.settings.offsetTop,
            behavior: 'smooth'
        });
    }

    // ---------------------------------------------------------------------
    // Timer
    // ---------------------------------------------------------------------

    function formatTime(total) {
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function startTimer() {
        stopTimer();
        if (!state.items.length || state.submitted) return;
        state.secondsLeft = state.items.length * CONFIG.TIMER_SECONDS_PER_QUESTION;
        state.startedAt = Date.now();
        renderTimer();
        state.timer = window.setInterval(() => {
            state.secondsLeft -= 1;
            renderTimer();
            if (state.secondsLeft <= 0) {
                stopTimer();
                finish();
            }
        }, 1000);
    }

    function stopTimer() {
        if (state.timer) window.clearInterval(state.timer);
        state.timer = null;
    }

    function resetTimer() {
        stopTimer();
        state.startedAt = Date.now();
        elements.timerDisplay.textContent = '--:--';
        elements.timerDisplay.classList.remove('warning', 'critical');
    }

    function renderTimer() {
        const display = elements.timerDisplay;
        display.textContent = formatTime(Math.max(state.secondsLeft, 0));
        display.classList.toggle('critical', state.secondsLeft <= CONFIG.TIMER_CRITICAL_SECONDS);
        display.classList.toggle('warning', state.secondsLeft > CONFIG.TIMER_CRITICAL_SECONDS && state.secondsLeft <= CONFIG.TIMER_WARNING_SECONDS);
    }

    // ---------------------------------------------------------------------
    // Settings and keyboard
    // ---------------------------------------------------------------------

    function setMode(mode) {
        state.mode = mode;
        const radio = elements.settings.querySelector(`input[name="mode"][value="${mode}"]`);
        if (radio) radio.checked = true;
        elements.modeHint.textContent = MODE_HINTS[mode];
    }

    function isTyping(target) {
        return target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && target.type !== 'radio');
    }

    function handleKeydown(event) {
        if (!elements.modal.hidden) {
            if (event.key === 'Escape') hideResults();
            return;
        }
        if (event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) return;

        const item = state.items[state.active];
        if (/^[1-9]$/.test(event.key) && item) {
            const optionIndex = item.order[Number(event.key) - 1];
            if (optionIndex !== undefined) {
                selectAnswer(state.active, optionIndex);
                event.preventDefault();
            }
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'j') {
            focusQuestion(Math.min(state.active + 1, state.items.length - 1));
            event.preventDefault();
        } else if (event.key === 'ArrowUp' || event.key === 'k') {
            focusQuestion(Math.max(state.active - 1, 0));
            event.preventDefault();
        } else if (event.key === 'Enter' && (event.target === document.body || event.target.classList.contains('question-card'))) {
            finish();
            event.preventDefault();
        }
    }

    function attachEvents() {
        elements.settings.addEventListener('submit', (event) => {
            event.preventDefault();
            startQuiz();
        });
        elements.categorySelect.addEventListener('change', (event) => loadCategory(event.target.value, []));
        elements.maxQuestions.addEventListener('change', () => startQuiz());
        elements.settings.querySelectorAll('input[name="mode"]').forEach((radio) => {
            radio.addEventListener('change', () => {
                setMode(radio.value);
                startQuiz();
            });
        });
        elements.timerToggle.addEventListener('change', () => {
            if (elements.timerToggle.checked) startTimer();
            else resetTimer();
        });
        elements.topicFilter.addEventListener('click', (event) => {
            const chip = event.target.closest('.topic-chip');
            if (chip) toggleTopic(chip.dataset.topic);
        });
        elements.missedToggle.addEventListener('change', () => {
            state.onlyMissed = elements.missedToggle.checked;
            startQuiz();
        });
        elements.submit.addEventListener('click', finish);
        elements.modal.querySelectorAll('[data-close]').forEach((node) => node.addEventListener('click', hideResults));
        elements.review.addEventListener('click', reviewAnswers);
        elements.retryMissed.addEventListener('click', retryMistakes);
        elements.tryAgain.addEventListener('click', () => startQuiz());
        document.addEventListener('keydown', handleKeydown);
    }

    function init() {
        cacheElements();
        setMode('practice');
        attachEvents();
        loadIndex();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();