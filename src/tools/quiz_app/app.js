(function () {
    'use strict';

    // =========================================================================
    // Configuration
    // =========================================================================

    const CONFIG = {
        PROXY_URL: 'https://api.allorigins.win/get?url=',
        BASE_URL: 'https://adamdjellouli.com/tools/quiz_app',
        DEFAULT_MAX_QUESTIONS: 12,
        ANIMATION_DURATION: 300,
        PROGRESS_CIRCLE_CIRCUMFERENCE: 283,
        TIMER_SECONDS_PER_QUESTION: 120,
        TIMER_WARNING_THRESHOLD: 60,
        TIMER_CRITICAL_THRESHOLD: 15,
        STAGGER_DELAY_MS: 60,
        SCORE_ANIMATION_DURATION: 1200,
        INTERSECTION_THRESHOLD: 0.5
    };

    // =========================================================================
    // Application State
    // =========================================================================

    const state = {
        categories: [],
        currentCategoryData: null,
        displayedQuestions: [],
        userAnswers: new Map(),
        categoryCache: new Map(),
        isSubmitted: false,
        // Timer state
        timerInterval: null,
        timerSecondsLeft: 0,
        quizStartTime: null,
        quizEndTime: null,
        // Navigation state
        activeQuestionIndex: 0,
        questionObserver: null,
        // Streak state
        currentStreak: 0,
        bestStreak: 0
    };

    // =========================================================================
    // DOM Elements
    // =========================================================================

    let elements = {};

    function initializeElements() {
        elements = {
            // Controls
            categorySelect: document.getElementById('categorySelect'),
            maxQuestionsInput: document.getElementById('maxQuestionsInput'),
            reloadBtn: document.getElementById('reloadQuestionsButton'),
            submitBtn: document.getElementById('submitButton'),
            // Quiz container
            quizContainer: document.getElementById('quizContainer'),
            // Progress
            progressText: document.getElementById('progressText'),
            progressPercentage: document.getElementById('progressPercentage'),
            progressBar: document.getElementById('progressBar'),
            // Loading
            loadingOverlay: document.getElementById('loadingOverlay'),
            // Results modal
            resultsModal: document.getElementById('resultsModal'),
            modalBackdrop: document.getElementById('modalBackdrop'),
            modalClose: document.getElementById('modalClose'),
            resultsProgress: document.getElementById('resultsProgress'),
            resultsScore: document.getElementById('resultsScore'),
            correctCount: document.getElementById('correctCount'),
            incorrectCount: document.getElementById('incorrectCount'),
            unansweredCount: document.getElementById('unansweredCount'),
            resultsMessage: document.getElementById('resultsMessage'),
            reviewAnswersButton: document.getElementById('reviewAnswersButton'),
            tryAgainButton: document.getElementById('tryAgainButton'),
            // Timer
            timerDisplay: document.getElementById('timerDisplay'),
            timerToggle: document.getElementById('timerToggle'),
            // Navigation sidebar
            questionNav: document.getElementById('questionNav'),
            // Streak
            streakBadge: document.getElementById('streakBadge')
        };
    }

    // =========================================================================
    // Utility Functions
    // =========================================================================

    async function fetchJson(url) {
        try {
            const response = await fetch(CONFIG.PROXY_URL + encodeURIComponent(url));
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const { contents } = await response.json();
            return JSON.parse(contents);
        } catch (proxyError) {
            console.warn('Proxy fetch failed, trying local fallback:', proxyError.message);
        }

        try {
            const filename = url.split('/').pop();
            const response = await fetch(filename);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (localError) {
            console.error('Both proxy and local fetch failed:', localError);
            return null;
        }
    }

    function toSlug(str) {
        return str.trim().toLowerCase().replace(/\W+/g, '_');
    }

    function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    function pickRandom(array, n) {
        return shuffleArray(array).slice(0, Math.min(n, array.length));
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function parseMarkdown(text) {
        let result = escapeHtml(text);
        result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
        result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        return result;
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function formatTime(totalSeconds) {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }

    // =========================================================================
    // Loading State Management
    // =========================================================================

    function showLoading() {
        elements.loadingOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function hideLoading() {
        elements.loadingOverlay.style.display = 'none';
        document.body.style.overflow = '';
    }

    // =========================================================================
    // Timer System
    // =========================================================================

    function startTimer() {
        stopTimer();
        const totalQuestions = state.displayedQuestions.length;
        state.timerSecondsLeft = totalQuestions * CONFIG.TIMER_SECONDS_PER_QUESTION;
        state.quizStartTime = Date.now();
        state.quizEndTime = null;
        updateTimerDisplay();

        state.timerInterval = setInterval(function () {
            state.timerSecondsLeft--;
            if (state.timerSecondsLeft <= 0) {
                state.timerSecondsLeft = 0;
                updateTimerDisplay();
                stopTimer();
                submitQuiz();
            } else {
                updateTimerDisplay();
            }
        }, 1000);
    }

    function stopTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
    }

    function resetTimerDisplay() {
        stopTimer();
        state.timerSecondsLeft = 0;
        state.quizStartTime = null;
        state.quizEndTime = null;
        if (elements.timerDisplay) {
            elements.timerDisplay.textContent = '\u23F1\uFE0F --:--';
            elements.timerDisplay.classList.remove('warning', 'critical');
        }
    }

    function updateTimerDisplay() {
        if (!elements.timerDisplay) return;

        elements.timerDisplay.textContent = '\u23F1\uFE0F ' + formatTime(state.timerSecondsLeft);
        elements.timerDisplay.classList.remove('warning', 'critical');

        if (state.timerSecondsLeft <= CONFIG.TIMER_CRITICAL_THRESHOLD) {
            elements.timerDisplay.classList.add('critical');
        } else if (state.timerSecondsLeft <= CONFIG.TIMER_WARNING_THRESHOLD) {
            elements.timerDisplay.classList.add('warning');
        }
    }

    function getTimeTaken() {
        if (!state.quizStartTime) return null;
        const end = state.quizEndTime || Date.now();
        return Math.round((end - state.quizStartTime) / 1000);
    }

    // =========================================================================
    // Question Navigation Sidebar
    // =========================================================================

    function buildQuestionNav() {
        if (!elements.questionNav) return;
        elements.questionNav.innerHTML = '';

        state.displayedQuestions.forEach(function (_question, index) {
            var btn = document.createElement('button');
            btn.className = 'question-nav-btn';
            btn.textContent = index + 1;
            btn.setAttribute('aria-label', 'Go to question ' + (index + 1));
            btn.addEventListener('click', function () {
                scrollToQuestion(index);
            });
            elements.questionNav.appendChild(btn);
        });
    }

    function scrollToQuestion(index) {
        var card = elements.quizContainer.querySelector('[data-question-index="' + index + '"]');
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function setActiveNavButton(index) {
        if (!elements.questionNav) return;
        state.activeQuestionIndex = index;
        var buttons = elements.questionNav.querySelectorAll('.question-nav-btn');
        buttons.forEach(function (btn, i) {
            btn.classList.toggle('active', i === index);
        });
    }

    function updateNavAnsweredState() {
        if (!elements.questionNav) return;
        var buttons = elements.questionNav.querySelectorAll('.question-nav-btn');
        buttons.forEach(function (btn, i) {
            btn.classList.toggle('answered', state.userAnswers.has(i));
        });
    }

    function updateNavResultStates() {
        if (!elements.questionNav) return;
        var buttons = elements.questionNav.querySelectorAll('.question-nav-btn');
        state.displayedQuestions.forEach(function (question, index) {
            var btn = buttons[index];
            if (!btn) return;
            var userAnswer = state.userAnswers.get(index);
            if (userAnswer === undefined) return;
            if (userAnswer === question.correctOptionIndex) {
                btn.classList.add('correct');
            } else {
                btn.classList.add('incorrect');
            }
        });
    }

    function setupIntersectionObserver() {
        if (state.questionObserver) {
            state.questionObserver.disconnect();
        }

        if (typeof IntersectionObserver === 'undefined') return;

        state.questionObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    var index = parseInt(entry.target.getAttribute('data-question-index'), 10);
                    if (!isNaN(index)) {
                        setActiveNavButton(index);
                    }
                }
            });
        }, { threshold: CONFIG.INTERSECTION_THRESHOLD });

        var cards = elements.quizContainer.querySelectorAll('.question-card');
        cards.forEach(function (card) {
            state.questionObserver.observe(card);
        });
    }

    // =========================================================================
    // Streak Tracking
    // =========================================================================

    function calculateStreak() {
        var streak = 0;
        var best = 0;

        for (var i = 0; i < state.displayedQuestions.length; i++) {
            var question = state.displayedQuestions[i];
            var userAnswer = state.userAnswers.get(i);
            if (userAnswer !== undefined && userAnswer === question.correctOptionIndex) {
                streak++;
                if (streak > best) best = streak;
            } else {
                streak = 0;
            }
        }

        state.currentStreak = streak;
        state.bestStreak = best;
    }

    function updateStreakDisplay() {
        if (!elements.streakBadge) return;

        calculateStreak();

        if (state.bestStreak >= 2) {
            elements.streakBadge.style.display = '';
            var textEl = elements.streakBadge.querySelector('.streak-text');
            if (textEl) {
                textEl.textContent = state.bestStreak + ' streak';
            }
        } else {
            elements.streakBadge.style.display = 'none';
        }
    }

    // =========================================================================
    // Modal Management
    // =========================================================================

    function animateScoreCounter(targetPercentage) {
        var start = 0;
        var duration = CONFIG.SCORE_ANIMATION_DURATION;
        var startTime = null;

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            var elapsed = timestamp - startTime;
            var progress = Math.min(elapsed / duration, 1);
            // Ease-out curve
            var eased = 1 - Math.pow(1 - progress, 3);
            var current = Math.round(eased * targetPercentage);
            elements.resultsScore.textContent = current + '%';

            // Also animate the circle
            var offset = CONFIG.PROGRESS_CIRCLE_CIRCUMFERENCE -
                (current / 100) * CONFIG.PROGRESS_CIRCLE_CIRCUMFERENCE;
            elements.resultsProgress.style.strokeDashoffset = offset;

            if (progress < 1) {
                requestAnimationFrame(step);
            }
        }

        elements.resultsScore.textContent = '0%';
        elements.resultsProgress.style.strokeDashoffset = CONFIG.PROGRESS_CIRCLE_CIRCUMFERENCE;
        requestAnimationFrame(step);
    }

    function getResultsMessage(percentage) {
        if (percentage === 100) return '\uD83C\uDFC6 Perfect score! Absolutely flawless!';
        if (percentage >= 90) return '\uD83C\uDF89 Outstanding! You\u2019ve mastered this topic!';
        if (percentage >= 80) return '\uD83C\uDF1F Excellent work! You really know your stuff!';
        if (percentage >= 70) return '\uD83D\uDC4F Great job! Keep up the excellent work!';
        if (percentage >= 60) return '\uD83D\uDCAA Good effort! You\u2019re getting there!';
        if (percentage >= 50) return '\uD83D\uDE80 Halfway there! A bit more practice will help.';
        if (percentage >= 30) return '\uD83D\uDCD6 Keep studying! You\u2019re building a foundation.';
        return '\uD83D\uDCDA Keep learning! Review the material and try again.';
    }

    function showResultsModal(results) {
        var correct = results.correct;
        var incorrect = results.incorrect;
        var unanswered = results.unanswered;
        var percentage = results.percentage;

        // Update stats
        elements.correctCount.textContent = correct;
        elements.incorrectCount.textContent = incorrect;
        elements.unansweredCount.textContent = unanswered;

        // Build message with time taken
        var message = getResultsMessage(percentage);
        var timeTaken = getTimeTaken();
        if (timeTaken !== null) {
            message += ' \u23F1\uFE0F Time: ' + formatTime(timeTaken);
        }
        elements.resultsMessage.textContent = message;

        // Show modal first, then animate
        elements.resultsModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Animate score counter from 0 to final percentage
        animateScoreCounter(percentage);

        // Focus management for accessibility
        elements.modalClose.focus();
    }

    function hideResultsModal() {
        elements.resultsModal.style.display = 'none';
        document.body.style.overflow = '';

        // Reset progress circle for next time
        elements.resultsProgress.style.strokeDashoffset = CONFIG.PROGRESS_CIRCLE_CIRCUMFERENCE;
    }

    // =========================================================================
    // Progress Tracking
    // =========================================================================

    function updateProgress() {
        var total = state.displayedQuestions.length;
        var answered = state.userAnswers.size;
        var percentage = total > 0 ? Math.round((answered / total) * 100) : 0;

        elements.progressText.textContent = 'Question ' + answered + ' of ' + total;
        elements.progressPercentage.textContent = percentage + '%';
        elements.progressBar.style.width = percentage + '%';

        // Update progressbar ARIA attributes
        var progressBarContainer = elements.progressBar.parentElement;
        progressBarContainer.setAttribute('aria-valuenow', percentage);

        // Keep nav sidebar in sync
        updateNavAnsweredState();
    }

    // =========================================================================
    // Category Management
    // =========================================================================

    async function loadCategories() {
        showLoading();

        var categories = await fetchJson(CONFIG.BASE_URL + '/categories.json');

        if (!Array.isArray(categories)) {
            hideLoading();
            showEmptyState('Unable to load categories. Please try again later.');
            return;
        }

        state.categories = categories;

        // Populate category dropdown
        elements.categorySelect.innerHTML = '';
        categories.forEach(function (cat) {
            var option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            elements.categorySelect.appendChild(option);
        });

        // Try to match URL slug to category
        var slug = window.location.pathname.split('/').pop().replace(/\.[^/.]+$/, '');
        var matchedCategory = categories.find(function (c) {
            return toSlug(c.name) === toSlug(slug);
        });

        if (matchedCategory) {
            elements.categorySelect.value = matchedCategory.name;
        } else if (categories.length > 0) {
            elements.categorySelect.value = categories[0].name;
        }

        await loadCategoryData(elements.categorySelect.value);
        hideLoading();
    }

    async function loadCategoryData(categoryName) {
        showLoading();

        // Allow the browser to paint the loading state
        await new Promise(function (resolve) { requestAnimationFrame(resolve); });

        // Check cache first
        if (!state.categoryCache.has(categoryName)) {
            var slug = toSlug(categoryName);
            var data = await fetchJson(CONFIG.BASE_URL + '/' + slug + '.json');

            if (data) {
                state.categoryCache.set(categoryName, data);
            }
        }

        state.currentCategoryData = state.categoryCache.get(categoryName) || { questions: [] };
        setupQuiz();
        hideLoading();
    }

    // =========================================================================
    // Quiz Setup and Rendering
    // =========================================================================

    function setupQuiz() {
        var maxQuestions = parseInt(elements.maxQuestionsInput.value, 10) || CONFIG.DEFAULT_MAX_QUESTIONS;
        var allQuestions = state.currentCategoryData.questions || [];

        state.displayedQuestions = pickRandom(allQuestions, maxQuestions);
        state.userAnswers.clear();
        state.isSubmitted = false;
        state.currentStreak = 0;
        state.bestStreak = 0;

        renderQuestions();
        buildQuestionNav();
        setupIntersectionObserver();
        updateProgress();
        hideStreakBadge();

        // Timer handling
        resetTimerDisplay();
        if (elements.timerToggle && elements.timerToggle.checked) {
            startTimer();
        }
    }

    function hideStreakBadge() {
        if (elements.streakBadge) {
            elements.streakBadge.style.display = 'none';
        }
    }

    function renderQuestions() {
        var container = elements.quizContainer;
        container.innerHTML = '';

        if (state.displayedQuestions.length === 0) {
            showEmptyState('No questions available for this category.');
            return;
        }

        state.displayedQuestions.forEach(function (question, index) {
            var questionCard = createQuestionCard(question, index);
            // Stagger entrance animation
            questionCard.style.animationDelay = (index * CONFIG.STAGGER_DELAY_MS) + 'ms';
            container.appendChild(questionCard);
        });
    }

    function createQuestionCard(question, index) {
        var card = document.createElement('article');
        card.className = 'question-card';
        card.setAttribute('data-question-index', index);

        // Question header
        var header = document.createElement('div');
        header.className = 'question-header';

        var numberBadge = document.createElement('span');
        numberBadge.className = 'question-number';
        numberBadge.textContent = index + 1;
        numberBadge.setAttribute('aria-hidden', 'true');

        header.appendChild(numberBadge);

        // Parse and render question text
        var questionContent = renderQuestionContent(question.text, index);
        header.appendChild(questionContent);

        card.appendChild(header);

        // Options
        var optionsList = createOptionsList(question, index);
        card.appendChild(optionsList);

        return card;
    }

    function renderQuestionContent(text, questionIndex) {
        var container = document.createElement('div');
        container.className = 'question-content';

        // Support multi-line code blocks with triple backticks
        var tripleMatch = text.match(/```([\s\S]*?)```/);
        // Single backtick inline code
        var singleMatch = text.match(/`([^`]+)`/);

        var codeBlockMatch = tripleMatch || singleMatch;

        if (codeBlockMatch) {
            var beforeCode = text.substring(0, codeBlockMatch.index);
            var codeContent = codeBlockMatch[1];
            var afterCode = text.substring(codeBlockMatch.index + codeBlockMatch[0].length);

            if (beforeCode.trim()) {
                var beforeP = document.createElement('p');
                beforeP.className = 'question-text';
                beforeP.id = 'question-' + questionIndex + '-text';
                beforeP.innerHTML = parseMarkdown(beforeCode.trim());
                container.appendChild(beforeP);
            }

            var pre = document.createElement('pre');
            pre.className = 'question-code';
            var code = document.createElement('code');
            code.textContent = codeContent;
            pre.appendChild(code);
            container.appendChild(pre);

            if (afterCode.trim()) {
                var afterP = document.createElement('p');
                afterP.innerHTML = parseMarkdown(afterCode.trim());
                container.appendChild(afterP);
            }
        } else {
            var p = document.createElement('p');
            p.className = 'question-text';
            p.id = 'question-' + questionIndex + '-text';
            p.innerHTML = parseMarkdown(text);
            container.appendChild(p);
        }

        return container;
    }

    function createOptionsList(question, questionIndex) {
        var list = document.createElement('ul');
        list.className = 'options-list';
        list.setAttribute('role', 'radiogroup');
        list.setAttribute('aria-labelledby', 'question-' + questionIndex + '-text');

        question.options.forEach(function (option, optionIndex) {
            var listItem = document.createElement('li');
            listItem.className = 'option-item';
            listItem.setAttribute('data-option-index', optionIndex);

            var inputId = 'q' + questionIndex + '-opt' + optionIndex;

            var input = document.createElement('input');
            input.type = 'radio';
            input.name = 'question-' + questionIndex;
            input.id = inputId;
            input.value = optionIndex;
            input.className = 'option-input';
            input.addEventListener('change', function () {
                handleOptionSelect(questionIndex, optionIndex);
            });

            var label = document.createElement('label');
            label.className = 'option-label';
            label.setAttribute('for', inputId);

            var radioIndicator = document.createElement('span');
            radioIndicator.className = 'option-radio';
            radioIndicator.setAttribute('aria-hidden', 'true');

            var optionText = document.createElement('span');
            optionText.className = 'option-text';
            optionText.innerHTML = parseMarkdown(option);

            label.appendChild(radioIndicator);
            label.appendChild(optionText);

            listItem.appendChild(input);
            listItem.appendChild(label);
            list.appendChild(listItem);
        });

        return list;
    }

    function handleOptionSelect(questionIndex, optionIndex) {
        if (state.isSubmitted) return;

        state.userAnswers.set(questionIndex, optionIndex);

        var card = elements.quizContainer.querySelector('[data-question-index="' + questionIndex + '"]');
        if (card) {
            card.classList.add('answered');
        }

        updateProgress();
    }

    // =========================================================================
    // Quiz Submission
    // =========================================================================

    function submitQuiz() {
        if (state.isSubmitted) return;

        state.isSubmitted = true;
        state.quizEndTime = Date.now();
        stopTimer();

        var correct = 0;
        var incorrect = 0;
        var unanswered = 0;

        state.displayedQuestions.forEach(function (question, index) {
            var correctIndex = question.correctOptionIndex;
            var userAnswer = state.userAnswers.get(index);
            var card = elements.quizContainer.querySelector('[data-question-index="' + index + '"]');
            var optionItems = card.querySelectorAll('.option-item');

            optionItems.forEach(function (item) {
                item.classList.remove('correct', 'incorrect');
            });
            card.classList.remove('correct-answer', 'incorrect-answer');

            // Mark correct option
            optionItems[correctIndex].classList.add('correct');

            if (userAnswer === undefined) {
                unanswered++;
            } else if (userAnswer === correctIndex) {
                correct++;
                card.classList.add('correct-answer');
            } else {
                incorrect++;
                card.classList.add('incorrect-answer');
                optionItems[userAnswer].classList.add('incorrect');
            }

            // Disable all inputs
            card.querySelectorAll('.option-input').forEach(function (input) {
                input.disabled = true;
            });
        });

        var total = state.displayedQuestions.length;
        var percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

        // Update navigation buttons with result states
        updateNavResultStates();

        // Update streak
        updateStreakDisplay();

        showResultsModal({
            correct: correct,
            incorrect: incorrect,
            unanswered: unanswered,
            total: total,
            percentage: percentage
        });
    }

    function reviewAnswers() {
        hideResultsModal();

        var firstIncorrect = elements.quizContainer.querySelector('.incorrect-answer, .question-card:not(.correct-answer)');
        if (firstIncorrect) {
            firstIncorrect.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // =========================================================================
    // Empty State
    // =========================================================================

    function showEmptyState(message) {
        elements.quizContainer.innerHTML =
            '<div class="empty-state">' +
            '<div class="empty-state-icon" aria-hidden="true">\uD83D\uDCED</div>' +
            '<p class="empty-state-text">' + escapeHtml(message) + '</p>' +
            '</div>';
    }

    // =========================================================================
    // Keyboard Shortcuts
    // =========================================================================

    function isInputFocused() {
        var tag = document.activeElement && document.activeElement.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }

    function handleKeyboardNavigation(event) {
        // Escape closes modal
        if (event.key === 'Escape' && elements.resultsModal.style.display === 'flex') {
            hideResultsModal();
            return;
        }

        // Don't intercept when typing in form fields
        if (isInputFocused()) return;

        // Don't process shortcuts after submission (except Escape handled above)
        if (state.isSubmitted) return;

        var key = event.key;

        // 1-5 keys to select options for currently visible question
        if (key >= '1' && key <= '5') {
            var optIndex = parseInt(key, 10) - 1;
            var activeQ = state.activeQuestionIndex;
            if (activeQ < 0 || activeQ >= state.displayedQuestions.length) return;
            var question = state.displayedQuestions[activeQ];
            if (question && optIndex < question.options.length) {
                var radio = document.getElementById('q' + activeQ + '-opt' + optIndex);
                if (radio && !radio.disabled) {
                    radio.checked = true;
                    handleOptionSelect(activeQ, optIndex);
                }
            }
            event.preventDefault();
            return;
        }

        // Enter to submit
        if (key === 'Enter') {
            submitQuiz();
            event.preventDefault();
            return;
        }

        // N or ArrowRight — next question
        if (key === 'n' || key === 'N' || key === 'ArrowRight') {
            var next = Math.min(state.activeQuestionIndex + 1, state.displayedQuestions.length - 1);
            scrollToQuestion(next);
            event.preventDefault();
            return;
        }

        // P or ArrowLeft — previous question
        if (key === 'p' || key === 'P' || key === 'ArrowLeft') {
            var prev = Math.max(state.activeQuestionIndex - 1, 0);
            scrollToQuestion(prev);
            event.preventDefault();
            return;
        }
    }

    // =========================================================================
    // Event Listeners
    // =========================================================================

    function attachEventListeners() {
        // Category change
        elements.categorySelect.addEventListener('change', function (e) {
            loadCategoryData(e.target.value);
        });

        // Debounced question count
        var debouncedSetup = debounce(setupQuiz, 300);
        elements.maxQuestionsInput.addEventListener('input', debouncedSetup);

        // Reload / shuffle
        elements.reloadBtn.addEventListener('click', setupQuiz);

        // Submit
        elements.submitBtn.addEventListener('click', submitQuiz);

        // Modal controls
        elements.modalClose.addEventListener('click', hideResultsModal);
        elements.modalBackdrop.addEventListener('click', hideResultsModal);

        // Review answers
        elements.reviewAnswersButton.addEventListener('click', reviewAnswers);

        // Try again
        elements.tryAgainButton.addEventListener('click', function () {
            hideResultsModal();
            setupQuiz();
            elements.quizContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        // Timer toggle
        if (elements.timerToggle) {
            elements.timerToggle.addEventListener('change', function () {
                if (elements.timerToggle.checked && !state.isSubmitted) {
                    startTimer();
                } else {
                    resetTimerDisplay();
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardNavigation);
    }

    // =========================================================================
    // Initialization
    // =========================================================================

    function initialize() {
        initializeElements();
        elements.maxQuestionsInput.value = CONFIG.DEFAULT_MAX_QUESTIONS;
        attachEventListeners();
        loadCategories();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();