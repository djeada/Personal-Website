(function () {
    'use strict';

    // =========================================================================
    // Configuration
    // =========================================================================

    const CONFIG = {
        categoriesUrl: 'categories.json',
        categoryDataUrl: (category) => `${category}.json`,
        animationDuration: 300,
        autoFlipDelay: 0,
        timerSecondsPerCard: 90,
        timerWarningThreshold: 60,
        timerCriticalThreshold: 15,
        timerEmoji: '\u23F1\uFE0F',
    };

    // =========================================================================
    // Application State
    // =========================================================================

    const state = {
        currentCategory: null,
        currentSubcategories: new Set(),
        cards: [],
        currentCardIndex: 0,
        cardStatus: [],
        isFlipped: false,
        isLoading: false,
        // Timer state
        timerInterval: null,
        timerSecondsLeft: 0,
        // Streak state
        currentStreak: 0,
    };

    // =========================================================================
    // DOM Element References
    // =========================================================================

    const elements = {
        categorySelect: null,
        subcategoriesDiv: null,
        flashcard: null,
        flashcardFront: null,
        flashcardBack: null,
        flipButton: null,
        knowButton: null,
        nextButton: null,
        shuffleAllButton: null,
        resetButton: null,
        questionsTableBody: null,
        loadingSpinner: null,
        progressBar: null,
        progressStats: null,
        totalCards: null,
        remainingCards: null,
        completedCards: null,
        errorDiv: null,
        // New elements
        timerDisplay: null,
        timerToggle: null,
        cardNav: null,
        streakBadge: null,
        streakText: null,
    };

    // =========================================================================
    // Utility Functions
    // =========================================================================

    function displayError(msg) {
        if (!elements.errorDiv) {
            elements.errorDiv = document.createElement('div');
            elements.errorDiv.id = 'errorMessage';
            elements.errorDiv.setAttribute('role', 'alert');
            elements.errorDiv.setAttribute('aria-live', 'assertive');
            Object.assign(elements.errorDiv.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                right: '0',
                color: 'white',
                backgroundColor: '#ef4444',
                padding: '1rem',
                textAlign: 'center',
                zIndex: '9999',
                display: 'none',
                fontWeight: '500'
            });
            document.body.prepend(elements.errorDiv);
        }
        elements.errorDiv.textContent = msg;
        elements.errorDiv.style.display = 'block';

        setTimeout(() => {
            elements.errorDiv.style.display = 'none';
        }, 5000);
    }

    function clearError() {
        if (elements.errorDiv) {
            elements.errorDiv.style.display = 'none';
        }
    }

    function setLoading(isLoading) {
        state.isLoading = isLoading;
        if (elements.loadingSpinner) {
            elements.loadingSpinner.style.display = isLoading ? 'flex' : 'none';
        }
    }

    function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    function formatCategoryName(name) {
        return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    function formatTime(totalSeconds) {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }

    function resizeText(elementId) {
        const container = document.getElementById(elementId);
        if (!container) return;

        const textElements = container.querySelectorAll('p');
        if (textElements.length === 0) return;

        textElements.forEach(el => el.style.fontSize = '');

        let fontSize = parseFloat(window.getComputedStyle(textElements[0]).fontSize);
        const minFontSize = 12;

        const checkOverflow = () => {
            const totalHeight = Array.from(textElements).reduce((sum, el) => sum + el.scrollHeight, 0);
            return totalHeight > container.clientHeight * 0.85;
        };

        while (checkOverflow() && fontSize > minFontSize) {
            fontSize -= 1;
            textElements.forEach(el => el.style.fontSize = `${fontSize}px`);
        }
    }

    // =========================================================================
    // Data Loading
    // =========================================================================

    async function fetchJson(url) {
        clearError();
        setLoading(true);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (err) {
            console.error('Error fetching JSON:', err);
            displayError(`Failed to load data: ${err.message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }

    async function loadCategories() {
        const categories = await fetchJson(CONFIG.categoriesUrl);

        if (categories && Array.isArray(categories) && categories.length > 0) {
            elements.categorySelect.innerHTML = '';

            categories.forEach((cat, i) => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = formatCategoryName(cat);
                elements.categorySelect.appendChild(opt);
                if (i === 0) opt.selected = true;
            });

            await loadCategoryData(elements.categorySelect.value);
        } else {
            displayError('No categories available. Please check your data files.');
        }
    }

    async function loadCategoryData(category) {
        const data = await fetchJson(CONFIG.categoryDataUrl(category));

        if (data && data.subcategories) {
            state.currentCategory = data;
            populateSubcategories();
            selectAllSubcategories();
            filterCards();
        } else {
            displayError('Failed to load category data.');
        }
    }

    // =========================================================================
    // Subcategory Management
    // =========================================================================

    function populateSubcategories() {
        elements.subcategoriesDiv.innerHTML = '';
        state.currentSubcategories.clear();

        state.currentCategory.subcategories.forEach(sc => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');

            checkbox.type = 'checkbox';
            checkbox.value = sc.name;
            checkbox.checked = true;
            checkbox.id = `subcategory-${sc.name.replace(/\s+/g, '-').toLowerCase()}`;
            checkbox.addEventListener('change', handleSubcategoryChange);

            label.htmlFor = checkbox.id;
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(sc.name));

            elements.subcategoriesDiv.appendChild(label);
            state.currentSubcategories.add(sc.name);
        });
    }

    function selectAllSubcategories() {
        state.currentSubcategories = new Set(
            state.currentCategory.subcategories.map(sc => sc.name)
        );
        elements.subcategoriesDiv.querySelectorAll('input').forEach(cb => {
            cb.checked = true;
        });
    }

    function filterCards() {
        state.cards = [];

        state.currentCategory.subcategories.forEach(sc => {
            if (state.currentSubcategories.has(sc.name)) {
                state.cards.push(...sc.cards.map(card => ({
                    ...card,
                    subcategory: sc.name
                })));
            }
        });

        state.cardStatus = Array(state.cards.length).fill(true);
        state.currentCardIndex = 0;
        state.isFlipped = false;

        resetStreak();
        showCard();
        populateQuestionsTable();
        buildCardNav();
        updateProgress();
        restartTimerIfEnabled();
    }

    // =========================================================================
    // Questions Table
    // =========================================================================

    function populateQuestionsTable() {
        elements.questionsTableBody.innerHTML = '';

        state.cards.forEach((card, idx) => {
            const row = document.createElement('tr');
            row.id = `question-row-${idx}`;

            const idxCell = document.createElement('td');
            idxCell.textContent = idx + 1;

            const questionCell = document.createElement('td');
            questionCell.innerHTML = card.front;

            const subcategoryCell = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = 'subcategory-badge';
            badge.textContent = card.subcategory;
            subcategoryCell.appendChild(badge);

            const statusCell = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'status-checkbox';
            checkbox.checked = state.cardStatus[idx];
            checkbox.setAttribute('aria-label', `Mark question ${idx + 1} as ${state.cardStatus[idx] ? 'known' : 'unknown'}`);
            checkbox.addEventListener('change', () => {
                state.cardStatus[idx] = checkbox.checked;
                row.classList.toggle('completed', !checkbox.checked);
                updateProgress();
                updateCardNavStates();

                if (idx === state.currentCardIndex && !checkbox.checked) {
                    showCard();
                }
            });
            statusCell.appendChild(checkbox);

            row.appendChild(idxCell);
            row.appendChild(questionCell);
            row.appendChild(subcategoryCell);
            row.appendChild(statusCell);

            if (!state.cardStatus[idx]) {
                row.classList.add('completed');
            }

            elements.questionsTableBody.appendChild(row);
        });
    }

    // =========================================================================
    // Card Display
    // =========================================================================

    function showCard() {
        if (state.cards.length === 0) {
            elements.flashcardFront.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p class="empty-state-title">No cards available</p>
                    <p class="empty-state-description">Select subcategories to begin studying</p>
                </div>
            `;
            elements.flashcardBack.innerHTML = '';
            updateCardNavStates();
            return;
        }

        let start = state.currentCardIndex;
        let found = false;

        do {
            if (state.cardStatus[state.currentCardIndex]) {
                found = true;
                break;
            }
            state.currentCardIndex = (state.currentCardIndex + 1) % state.cards.length;
        } while (state.currentCardIndex !== start);

        if (!found) {
            elements.flashcardFront.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="empty-state-title">Congratulations! 🎉</p>
                    <p class="empty-state-description">You've completed all flashcards. Click Reset to study again.</p>
                </div>
            `;
            elements.flashcardBack.innerHTML = '';
            stopTimer();
        } else {
            const card = state.cards[state.currentCardIndex];
            elements.flashcardFront.innerHTML = `
                <p>${card.front}</p>
                <span class="card-indicator">Question ${state.currentCardIndex + 1} of ${state.cards.length}</span>
            `;
            elements.flashcardBack.innerHTML = `
                <p>${card.back}</p>
                <span class="card-indicator">Answer</span>
            `;
        }

        elements.flashcard.classList.remove('flipped');
        state.isFlipped = false;

        requestAnimationFrame(() => {
            resizeText('flashcardFront');
            resizeText('flashcardBack');

            if (window.MathJax && window.MathJax.typesetPromise) {
                MathJax.typesetPromise().catch(err => {
                    console.error('MathJax error:', err);
                });
            }
        });

        highlightCurrentRow();
        updateCardNavStates();
    }

    function highlightCurrentRow() {
        const rows = elements.questionsTableBody.querySelectorAll('tr');
        rows.forEach((row, idx) => {
            row.classList.toggle('current-card-row', idx === state.currentCardIndex);
        });
    }

    function updateProgress() {
        const total = state.cards.length;
        const completed = state.cardStatus.filter(s => !s).length;
        const remaining = total - completed;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        if (elements.totalCards) elements.totalCards.textContent = total;
        if (elements.remainingCards) elements.remainingCards.textContent = remaining;
        if (elements.completedCards) elements.completedCards.textContent = completed;

        if (elements.progressBar) {
            elements.progressBar.style.width = `${percentage}%`;
        }
        if (elements.progressStats) {
            elements.progressStats.textContent = `${percentage}% complete`;
        }
    }

    // =========================================================================
    // Timer System
    // =========================================================================

    function startTimer() {
        stopTimer();
        const remaining = state.cardStatus.filter(s => s).length;
        if (remaining === 0) return;

        state.timerSecondsLeft = remaining * CONFIG.timerSecondsPerCard;
        updateTimerDisplay();

        state.timerInterval = setInterval(() => {
            state.timerSecondsLeft--;
            if (state.timerSecondsLeft <= 0) {
                state.timerSecondsLeft = 0;
                updateTimerDisplay();
                stopTimer();
                handleReset();
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
        if (elements.timerDisplay) {
            elements.timerDisplay.textContent = CONFIG.timerEmoji + ' --:--';
            elements.timerDisplay.classList.remove('warning', 'critical');
        }
    }

    function updateTimerDisplay() {
        if (!elements.timerDisplay) return;

        elements.timerDisplay.textContent = CONFIG.timerEmoji + ' ' + formatTime(state.timerSecondsLeft);
        elements.timerDisplay.classList.remove('warning', 'critical');

        if (state.timerSecondsLeft <= CONFIG.timerCriticalThreshold) {
            elements.timerDisplay.classList.add('critical');
        } else if (state.timerSecondsLeft <= CONFIG.timerWarningThreshold) {
            elements.timerDisplay.classList.add('warning');
        }
    }

    function restartTimerIfEnabled() {
        if (elements.timerToggle && elements.timerToggle.checked) {
            startTimer();
        } else {
            resetTimerDisplay();
        }
    }

    // =========================================================================
    // Card Navigation Sidebar
    // =========================================================================

    function buildCardNav() {
        if (!elements.cardNav) return;
        elements.cardNav.innerHTML = '';

        state.cards.forEach((_card, index) => {
            const btn = document.createElement('button');
            btn.className = 'card-nav-btn';
            btn.textContent = index + 1;
            btn.setAttribute('aria-label', 'Go to card ' + (index + 1));
            btn.addEventListener('click', () => {
                navigateToCard(index);
            });
            elements.cardNav.appendChild(btn);
        });

        updateCardNavStates();
    }

    function navigateToCard(index) {
        if (index < 0 || index >= state.cards.length) return;
        state.currentCardIndex = index;
        showCard();
    }

    function updateCardNavStates() {
        if (!elements.cardNav) return;
        const buttons = elements.cardNav.querySelectorAll('.card-nav-btn');
        buttons.forEach((btn, i) => {
            btn.classList.toggle('current', i === state.currentCardIndex);
            btn.classList.toggle('known', !state.cardStatus[i]);
        });
    }

    // =========================================================================
    // Streak Tracking
    // =========================================================================

    function incrementStreak() {
        state.currentStreak++;
        updateStreakDisplay();
    }

    function resetStreak() {
        state.currentStreak = 0;
        updateStreakDisplay();
    }

    function updateStreakDisplay() {
        if (!elements.streakBadge) return;

        if (state.currentStreak >= 2) {
            elements.streakBadge.style.display = '';
            if (elements.streakText) {
                elements.streakText.textContent = state.currentStreak + ' streak';
            }
        } else {
            elements.streakBadge.style.display = 'none';
        }
    }

    // =========================================================================
    // Event Handlers
    // =========================================================================

    function handleSubcategoryChange(e) {
        if (e.target.checked) {
            state.currentSubcategories.add(e.target.value);
        } else {
            state.currentSubcategories.delete(e.target.value);
        }
        filterCards();
    }

    function handleCategoryChange(e) {
        loadCategoryData(e.target.value);
    }

    function handleFlip() {
        elements.flashcard.classList.toggle('flipped');
        state.isFlipped = !state.isFlipped;

        requestAnimationFrame(() => {
            resizeText('flashcardFront');
            resizeText('flashcardBack');
        });
    }

    function handleKnowIt() {
        if (state.cards.length === 0) return;

        state.cardStatus[state.currentCardIndex] = false;

        const row = document.getElementById(`question-row-${state.currentCardIndex}`);
        if (row) {
            const checkbox = row.querySelector('.status-checkbox');
            if (checkbox) checkbox.checked = false;
            row.classList.add('completed');
        }

        incrementStreak();
        updateProgress();
        updateCardNavStates();
        moveToNextCard();
    }

    function handleNext() {
        if (state.cards.length === 0) return;
        resetStreak();
        moveToNextCard();
    }

    function handlePrevious() {
        if (state.cards.length === 0) return;
        moveToPreviousCard();
    }

    function moveToNextCard() {
        const start = state.currentCardIndex;

        do {
            state.currentCardIndex = (state.currentCardIndex + 1) % state.cards.length;
        } while (!state.cardStatus[state.currentCardIndex] && state.currentCardIndex !== start);

        showCard();
    }

    function moveToPreviousCard() {
        const start = state.currentCardIndex;

        do {
            state.currentCardIndex = (state.currentCardIndex - 1 + state.cards.length) % state.cards.length;
        } while (!state.cardStatus[state.currentCardIndex] && state.currentCardIndex !== start);

        showCard();
    }

    function handleShuffle() {
        state.currentCategory.subcategories.forEach(sc => {
            if (state.currentSubcategories.has(sc.name)) {
                sc.cards = shuffleArray(sc.cards);
            }
        });
        resetStreak();
        filterCards();
    }

    function handleReset() {
        state.cardStatus = Array(state.cards.length).fill(true);
        state.currentCardIndex = 0;
        resetStreak();
        showCard();
        populateQuestionsTable();
        buildCardNav();
        updateProgress();
        restartTimerIfEnabled();
    }

    function handleTimerToggle() {
        if (elements.timerToggle.checked) {
            startTimer();
        } else {
            resetTimerDisplay();
        }
    }

    function handleKeydown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        // Number keys 1-9: jump to that card
        if (e.key >= '1' && e.key <= '9') {
            const cardIndex = parseInt(e.key, 10) - 1;
            if (cardIndex < state.cards.length) {
                e.preventDefault();
                navigateToCard(cardIndex);
            }
            return;
        }

        switch (e.key) {
            case ' ':
            case 'f':
            case 'F':
                e.preventDefault();
                handleFlip();
                break;
            case 'ArrowRight':
            case 'n':
            case 'N':
                e.preventDefault();
                handleNext();
                break;
            case 'ArrowLeft':
            case 'p':
            case 'P':
                e.preventDefault();
                handlePrevious();
                break;
            case 'Enter':
            case 'k':
            case 'K':
                e.preventDefault();
                handleKnowIt();
                break;
            case 'r':
            case 'R':
                e.preventDefault();
                handleReset();
                break;
            case 's':
            case 'S':
                e.preventDefault();
                handleShuffle();
                break;
        }
    }

    function handleFlashcardClick() {
        handleFlip();
    }

    // =========================================================================
    // Initialization
    // =========================================================================

    function cacheElements() {
        elements.categorySelect = document.getElementById('categorySelect');
        elements.subcategoriesDiv = document.getElementById('subcategories');
        elements.flashcard = document.getElementById('flashcard');
        elements.flashcardFront = document.getElementById('flashcardFront');
        elements.flashcardBack = document.getElementById('flashcardBack');
        elements.flipButton = document.getElementById('flipButton');
        elements.knowButton = document.getElementById('knowButton');
        elements.nextButton = document.getElementById('nextButton');
        elements.shuffleAllButton = document.getElementById('shuffleAllButton');
        elements.resetButton = document.getElementById('resetButton');
        elements.questionsTableBody = document.getElementById('questionsTable')?.querySelector('tbody');
        elements.loadingSpinner = document.getElementById('loadingSpinner');
        elements.progressBar = document.getElementById('progressBar');
        elements.progressStats = document.getElementById('progressStats');
        elements.totalCards = document.getElementById('totalCards');
        elements.remainingCards = document.getElementById('remainingCards');
        elements.completedCards = document.getElementById('completedCards');
        // New elements
        elements.timerDisplay = document.getElementById('timerDisplay');
        elements.timerToggle = document.getElementById('timerToggle');
        elements.cardNav = document.getElementById('cardNav');
        elements.streakBadge = document.getElementById('streakBadge');
        elements.streakText = elements.streakBadge?.querySelector('.streak-text');
    }

    function attachEventListeners() {
        elements.categorySelect?.addEventListener('change', handleCategoryChange);

        elements.flipButton?.addEventListener('click', handleFlip);
        elements.knowButton?.addEventListener('click', handleKnowIt);
        elements.nextButton?.addEventListener('click', handleNext);
        elements.shuffleAllButton?.addEventListener('click', handleShuffle);
        elements.resetButton?.addEventListener('click', handleReset);

        elements.flashcard?.addEventListener('click', handleFlashcardClick);

        elements.timerToggle?.addEventListener('change', handleTimerToggle);

        document.addEventListener('keydown', handleKeydown);

        elements.flashcard?.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                handleFlip();
            }
        });
    }

    function init() {
        cacheElements();
        attachEventListeners();
        loadCategories();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();