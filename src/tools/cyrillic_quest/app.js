document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const categorySelect = document.getElementById("category");
    const wordList = document.getElementById("word-list");
    const loadingMessage = document.getElementById("loading-message");
    const gameArea = document.getElementById("game-area");
    const cyrillicInput = document.getElementById("cyrillic-input");
    const latinOutput = document.getElementById("latin-output");
    const toastContainer = document.getElementById("toast-container");
    
    // Stats elements
    const correctCountEl = document.getElementById("correct-count");
    const incorrectCountEl = document.getElementById("incorrect-count");
    const accuracyEl = document.getElementById("accuracy");
    const totalWordsEl = document.getElementById("total-words");
    
    // State
    let words = [];
    let stats = {
        correct: 0,
        incorrect: 0,
        attempted: new Set()
    };

    // Toast notification system
    function showToast(message, type = "info") {
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        
        const icons = {
            success: "✅",
            error: "❌",
            info: "ℹ️",
            warning: "⚠️"
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // Update stats display
    function updateStats() {
        correctCountEl.textContent = stats.correct;
        incorrectCountEl.textContent = stats.incorrect;
        
        const total = stats.correct + stats.incorrect;
        const accuracy = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
        accuracyEl.textContent = `${accuracy}%`;
    }

    // Fetch words from API
    fetch('https://api.allorigins.win/get?url=' + encodeURIComponent('https://adamdjellouli.com/tools/cyrillic_quest/words.json'))
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            try {
                words = JSON.parse(data.contents);
                console.log('Successfully fetched and parsed JSON:', words);
                populateCategories(Object.keys(words));
                loadCategory(categorySelect.value);
                loadingMessage.style.display = 'none';
                gameArea.style.display = 'block';
                showToast("Word database loaded successfully!", "success");
            } catch (error) {
                console.error('Error parsing JSON:', error, data.contents);
                loadingMessage.innerHTML = '<span style="color: var(--danger-color);">❌ Error loading data. Please try again later.</span>';
                showToast("Error loading word database", "error");
            }
        })
        .catch(error => {
            console.error('Error fetching the words:', error);
            loadingMessage.innerHTML = '<span style="color: var(--danger-color);">❌ Error fetching data. Please try again later.</span>';
            showToast("Connection error. Please check your internet.", "error");
        });

    categorySelect.addEventListener("change", () => {
        loadCategory(categorySelect.value);
        // Reset stats for new category
        stats = { correct: 0, incorrect: 0, attempted: new Set() };
        updateStats();
        showToast(`Category changed to ${capitalizeFirstLetter(categorySelect.value)}`, "info");
    });

    cyrillicInput.addEventListener("input", () => {
        latinOutput.value = transliterate(cyrillicInput.value);
    });

    function populateCategories(categories) {
        categorySelect.innerHTML = '';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = capitalizeFirstLetter(category);
            categorySelect.appendChild(option);
        });
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    function loadCategory(category) {
        const wordListData = words[category];
        wordList.innerHTML = '';
        
        if (wordListData) {
            totalWordsEl.textContent = wordListData.length;
            
            wordListData.forEach((word, index) => {
                const row = document.createElement('tr');
                row.dataset.wordIndex = index;

                const cyrillicCell = document.createElement('td');
                cyrillicCell.innerHTML = `<span class="cyrillic-word">${word.cyrillic}</span>`;

                // Create result cell first so it can be referenced in event handlers
                const resultCell = document.createElement('td');
                resultCell.className = 'result-message';

                const transliterationCell = document.createElement('td');
                const transliterationInput = document.createElement('input');
                transliterationInput.className = 'transliteration-input';
                transliterationInput.setAttribute('type', 'text');
                transliterationInput.setAttribute('placeholder', 'Type here...');
                transliterationInput.setAttribute('autocomplete', 'off');
                transliterationInput.setAttribute('spellcheck', 'false');
                
                // Allow Enter key to validate
                transliterationInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        validateTransliteration(transliterationInput, word.transliteration, resultCell, index);
                    }
                });
                
                transliterationCell.appendChild(transliterationInput);

                const hintCell = document.createElement('td');
                const hintButton = document.createElement('button');
                hintButton.className = 'action-btn hint-btn';
                hintButton.innerHTML = '💡 Hint';
                hintButton.title = `English: ${word.translation}`;
                hintButton.addEventListener('click', () => {
                    transliterationInput.value = word.transliteration;
                    transliterationInput.classList.add('input-success');
                    showToast(`Hint: "${word.cyrillic}" = "${word.transliteration}" (${word.translation})`, "info");
                });
                hintCell.appendChild(hintButton);

                const validateCell = document.createElement('td');
                const validateButton = document.createElement('button');
                validateButton.className = 'action-btn validate-btn';
                validateButton.innerHTML = '✓ Check';
                validateButton.title = 'Check your answer';
                validateButton.addEventListener('click', () => validateTransliteration(transliterationInput, word.transliteration, resultCell, index));
                validateCell.appendChild(validateButton);

                row.appendChild(cyrillicCell);
                row.appendChild(transliterationCell);
                row.appendChild(hintCell);
                row.appendChild(validateCell);
                row.appendChild(resultCell);

                wordList.appendChild(row);
            });
        } else {
            console.error('No words found for category:', category);
            showToast("No words found for this category", "warning");
        }
    }

    function validateTransliteration(input, correctTransliteration, resultCell, wordIndex) {
        const userAnswer = input.value.trim().toLowerCase();
        const correctAnswer = correctTransliteration.toLowerCase();
        
        // Check if already attempted
        const wasAttempted = stats.attempted.has(wordIndex);
        
        if (userAnswer === correctAnswer) {
            input.classList.add('input-success');
            input.classList.remove('input-failure');
            resultCell.innerHTML = '<span class="success">✓ Correct!</span>';
            
            if (!wasAttempted) {
                stats.correct++;
                stats.attempted.add(wordIndex);
                showToast("Correct! Great job! 🎉", "success");
            }
        } else {
            input.classList.add('input-failure');
            input.classList.remove('input-success');
            resultCell.innerHTML = '<span class="failure">✗ Try again</span>';
            
            if (!wasAttempted) {
                stats.incorrect++;
                stats.attempted.add(wordIndex);
                showToast("Not quite right. Try again!", "error");
            }
        }
        
        updateStats();
    }

    function transliterate(text) {
        const cyrillicToLatinMap = {
            'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D',
            'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh', 'З': 'Z', 'И': 'I',
            'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N',
            'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T',
            'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch',
            'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '"', 'Ы': 'Y', 'Ь': "'",
            'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
            'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i',
            'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
            'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
            'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch',
            'ш': 'sh', 'щ': 'shch', 'ъ': '"', 'ы': 'y', 'ь': "'",
            'э': 'e', 'ю': 'yu', 'я': 'ya'
        };
        return text.split('').map(char => cyrillicToLatinMap[char] || char).join('');
    }
});
