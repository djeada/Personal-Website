/**
 * Ultimate Quiz Challenge - Interactive Quiz Application
 * A modern, accessible quiz application with progress tracking and visual feedback.
 */

(function() {
    'use strict';

    // =========================================================================
    // Configuration
    // =========================================================================
    
    const CONFIG = {
        PROXY_URL: 'https://api.allorigins.win/get?url=',
        BASE_URL: 'https://adamdjellouli.com/tools/quiz_app',
        DEFAULT_MAX_QUESTIONS: 12,
        ANIMATION_DURATION: 300,
        PROGRESS_CIRCLE_CIRCUMFERENCE: 283
    };

    // =========================================================================
    // State Management
    // =========================================================================
    
    const state = {
        categories: [],
        currentCategoryData: null,
        displayedQuestions: [],
        userAnswers: new Map(),
        categoryCache: new Map(),
        isSubmitted: false
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
            
            // Containers
            quizContainer: document.getElementById('quizContainer'),
            
            // Progress
            progressText: document.getElementById('progressText'),
            progressPercentage: document.getElementById('progressPercentage'),
            progressBar: document.getElementById('progressBar'),
            
            // Loading
            loadingOverlay: document.getElementById('loadingOverlay'),
            
            // Results Modal
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
            tryAgainButton: document.getElementById('tryAgainButton')
        };
    }

    // =========================================================================
    // Utility Functions
    // =========================================================================
    
    /**
     * Fetches JSON from a URL using the proxy service.
     * @param {string} url - The URL to fetch
     * @returns {Promise<Object|null>} - The parsed JSON or null on error
     */
    async function fetchJson(url) {
        try {
            const response = await fetch(CONFIG.PROXY_URL + encodeURIComponent(url));
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const { contents } = await response.json();
            return JSON.parse(contents);
        } catch (error) {
            console.error('Fetch error:', error);
            return null;
        }
    }

    /**
     * Converts a string to a URL-safe slug.
     * @param {string} str - The string to convert
     * @returns {string} - The slugified string
     */
    function toSlug(str) {
        return str.trim().toLowerCase().replace(/\W+/g, '_');
    }

    /**
     * Shuffles an array using Fisher-Yates algorithm.
     * @param {Array} array - The array to shuffle
     * @returns {Array} - A new shuffled array
     */
    function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Picks n random elements from an array.
     * @param {Array} array - The source array
     * @param {number} n - The number of elements to pick
     * @returns {Array} - Array of picked elements
     */
    function pickRandom(array, n) {
        return shuffleArray(array).slice(0, Math.min(n, array.length));
    }

    /**
     * Escapes HTML special characters to prevent XSS.
     * @param {string} str - The string to escape
     * @returns {string} - The escaped string
     */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Parses markdown-like syntax in text.
     * @param {string} text - The text to parse
     * @returns {string} - HTML string
     */
    function parseMarkdown(text) {
        let result = escapeHtml(text);
        // Code spans
        result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Bold
        result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // Italics
        result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        return result;
    }

    /**
     * Debounces a function call.
     * @param {Function} func - The function to debounce
     * @param {number} wait - The delay in milliseconds
     * @returns {Function} - The debounced function
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
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
    // Modal Management
    // =========================================================================
    
    function showResultsModal(results) {
        const { correct, incorrect, unanswered, total, percentage } = results;
        
        // Update stats
        elements.correctCount.textContent = correct;
        elements.incorrectCount.textContent = incorrect;
        elements.unansweredCount.textContent = unanswered;
        elements.resultsScore.textContent = `${percentage}%`;
        
        // Update progress circle
        const offset = CONFIG.PROGRESS_CIRCLE_CIRCUMFERENCE - 
            (percentage / 100) * CONFIG.PROGRESS_CIRCLE_CIRCUMFERENCE;
        elements.resultsProgress.style.strokeDashoffset = offset;
        
        // Update message based on score
        let message = '';
        if (percentage >= 90) {
            message = '🎉 Outstanding! You\'ve mastered this topic!';
        } else if (percentage >= 70) {
            message = '👏 Great job! Keep up the excellent work!';
        } else if (percentage >= 50) {
            message = '💪 Good effort! A bit more practice will help.';
        } else {
            message = '📚 Keep learning! Review the material and try again.';
        }
        elements.resultsMessage.textContent = message;
        
        // Show modal
        elements.resultsModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
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
        const total = state.displayedQuestions.length;
        const answered = state.userAnswers.size;
        const percentage = total > 0 ? Math.round((answered / total) * 100) : 0;
        
        elements.progressText.textContent = `Question ${answered} of ${total}`;
        elements.progressPercentage.textContent = `${percentage}%`;
        elements.progressBar.style.width = `${percentage}%`;
        
        // Update progressbar ARIA attributes
        const progressBarContainer = elements.progressBar.parentElement;
        progressBarContainer.setAttribute('aria-valuenow', percentage);
    }

    // =========================================================================
    // Category Management
    // =========================================================================
    
    async function loadCategories() {
        showLoading();
        
        const categories = await fetchJson(`${CONFIG.BASE_URL}/categories.json`);
        
        if (!Array.isArray(categories)) {
            hideLoading();
            showEmptyState('Unable to load categories. Please try again later.');
            return;
        }
        
        state.categories = categories;
        
        // Populate category dropdown
        elements.categorySelect.innerHTML = '';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            elements.categorySelect.appendChild(option);
        });
        
        // Try to match URL slug to category
        const slug = window.location.pathname.split('/').pop().replace(/\.[^/.]+$/, '');
        const matchedCategory = categories.find(c => toSlug(c.name) === toSlug(slug));
        
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
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // Check cache first
        if (!state.categoryCache.has(categoryName)) {
            const slug = toSlug(categoryName);
            const data = await fetchJson(`${CONFIG.BASE_URL}/${slug}.json`);
            
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
        const maxQuestions = parseInt(elements.maxQuestionsInput.value, 10) || CONFIG.DEFAULT_MAX_QUESTIONS;
        const allQuestions = state.currentCategoryData.questions || [];
        
        state.displayedQuestions = pickRandom(allQuestions, maxQuestions);
        state.userAnswers.clear();
        state.isSubmitted = false;
        
        renderQuestions();
        updateProgress();
    }

    function renderQuestions() {
        const container = elements.quizContainer;
        container.innerHTML = '';
        
        if (state.displayedQuestions.length === 0) {
            showEmptyState('No questions available for this category.');
            return;
        }
        
        state.displayedQuestions.forEach((question, index) => {
            const questionCard = createQuestionCard(question, index);
            container.appendChild(questionCard);
        });
    }

    function createQuestionCard(question, index) {
        const card = document.createElement('article');
        card.className = 'question-card';
        card.setAttribute('data-question-index', index);
        
        // Question header
        const header = document.createElement('div');
        header.className = 'question-header';
        
        const numberBadge = document.createElement('span');
        numberBadge.className = 'question-number';
        numberBadge.textContent = index + 1;
        numberBadge.setAttribute('aria-hidden', 'true');
        
        header.appendChild(numberBadge);
        
        // Parse and render question text
        const questionContent = renderQuestionContent(question.text, index);
        header.appendChild(questionContent);
        
        card.appendChild(header);
        
        // Options
        const optionsList = createOptionsList(question, index);
        card.appendChild(optionsList);
        
        return card;
    }

    function renderQuestionContent(text, questionIndex) {
        const container = document.createElement('div');
        container.className = 'question-content';
        
        // Check for code blocks
        const codeBlockMatch = text.match(/`([^`]+)`/);
        
        if (codeBlockMatch) {
            const beforeCode = text.substring(0, codeBlockMatch.index);
            const codeContent = codeBlockMatch[1];
            const afterCode = text.substring(codeBlockMatch.index + codeBlockMatch[0].length);
            
            if (beforeCode.trim()) {
                const beforeP = document.createElement('p');
                beforeP.className = 'question-text';
                beforeP.id = `question-${questionIndex}-text`;
                beforeP.innerHTML = parseMarkdown(beforeCode.trim());
                container.appendChild(beforeP);
            }
            
            const pre = document.createElement('pre');
            pre.className = 'question-code';
            const code = document.createElement('code');
            code.textContent = codeContent;
            pre.appendChild(code);
            container.appendChild(pre);
            
            if (afterCode.trim()) {
                const afterP = document.createElement('p');
                afterP.innerHTML = parseMarkdown(afterCode.trim());
                container.appendChild(afterP);
            }
        } else {
            const p = document.createElement('p');
            p.className = 'question-text';
            p.id = `question-${questionIndex}-text`;
            p.innerHTML = parseMarkdown(text);
            container.appendChild(p);
        }
        
        return container;
    }

    function createOptionsList(question, questionIndex) {
        const list = document.createElement('ul');
        list.className = 'options-list';
        list.setAttribute('role', 'radiogroup');
        list.setAttribute('aria-labelledby', `question-${questionIndex}-text`);
        
        question.options.forEach((option, optionIndex) => {
            const listItem = document.createElement('li');
            listItem.className = 'option-item';
            listItem.setAttribute('data-option-index', optionIndex);
            
            const inputId = `q${questionIndex}-opt${optionIndex}`;
            
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = `question-${questionIndex}`;
            input.id = inputId;
            input.value = optionIndex;
            input.className = 'option-input';
            input.addEventListener('change', () => handleOptionSelect(questionIndex, optionIndex));
            
            const label = document.createElement('label');
            label.className = 'option-label';
            label.setAttribute('for', inputId);
            
            const radioIndicator = document.createElement('span');
            radioIndicator.className = 'option-radio';
            radioIndicator.setAttribute('aria-hidden', 'true');
            
            const optionText = document.createElement('span');
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
        
        // Update card visual state
        const card = elements.quizContainer.querySelector(`[data-question-index="${questionIndex}"]`);
        if (card) {
            card.classList.add('answered');
        }
        
        updateProgress();
    }

    // =========================================================================
    // Quiz Submission and Scoring
    // =========================================================================
    
    function submitQuiz() {
        if (state.isSubmitted) return;
        
        state.isSubmitted = true;
        
        let correct = 0;
        let incorrect = 0;
        let unanswered = 0;
        
        state.displayedQuestions.forEach((question, index) => {
            const correctIndex = question.correctOptionIndex;
            const userAnswer = state.userAnswers.get(index);
            const card = elements.quizContainer.querySelector(`[data-question-index="${index}"]`);
            const optionItems = card.querySelectorAll('.option-item');
            
            // Reset classes
            optionItems.forEach(item => {
                item.classList.remove('correct', 'incorrect');
            });
            card.classList.remove('correct-answer', 'incorrect-answer');
            
            // Mark correct answer
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
            card.querySelectorAll('.option-input').forEach(input => {
                input.disabled = true;
            });
        });
        
        const total = state.displayedQuestions.length;
        const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
        
        showResultsModal({
            correct,
            incorrect,
            unanswered,
            total,
            percentage
        });
    }

    function reviewAnswers() {
        hideResultsModal();
        
        // Scroll to first incorrect or unanswered question
        const firstIncorrect = elements.quizContainer.querySelector('.incorrect-answer, .question-card:not(.correct-answer)');
        if (firstIncorrect) {
            firstIncorrect.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // =========================================================================
    // Empty State
    // =========================================================================
    
    function showEmptyState(message) {
        elements.quizContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon" aria-hidden="true">📭</div>
                <p class="empty-state-text">${escapeHtml(message)}</p>
            </div>
        `;
    }

    // =========================================================================
    // Keyboard Navigation
    // =========================================================================
    
    function handleKeyboardNavigation(event) {
        // Close modal on Escape
        if (event.key === 'Escape' && elements.resultsModal.style.display === 'flex') {
            hideResultsModal();
        }
    }

    // =========================================================================
    // Event Listeners
    // =========================================================================
    
    function attachEventListeners() {
        // Category change
        elements.categorySelect.addEventListener('change', (e) => {
            loadCategoryData(e.target.value);
        });
        
        // Max questions change (debounced)
        const debouncedSetup = debounce(setupQuiz, 300);
        elements.maxQuestionsInput.addEventListener('input', debouncedSetup);
        
        // Reload/shuffle button
        elements.reloadBtn.addEventListener('click', setupQuiz);
        
        // Submit button
        elements.submitBtn.addEventListener('click', submitQuiz);
        
        // Modal close button
        elements.modalClose.addEventListener('click', hideResultsModal);
        
        // Modal backdrop click
        elements.modalBackdrop.addEventListener('click', hideResultsModal);
        
        // Review answers button
        elements.reviewAnswersButton.addEventListener('click', reviewAnswers);
        
        // Try again button
        elements.tryAgainButton.addEventListener('click', () => {
            hideResultsModal();
            setupQuiz();
            elements.quizContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', handleKeyboardNavigation);
    }

    // =========================================================================
    // Initialization
    // =========================================================================
    
    function initialize() {
        initializeElements();
        
        // Set default values
        elements.maxQuestionsInput.value = CONFIG.DEFAULT_MAX_QUESTIONS;
        
        // Attach event listeners
        attachEventListeners();
        
        // Load categories and start
        loadCategories();
    }

    // Start the application when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();