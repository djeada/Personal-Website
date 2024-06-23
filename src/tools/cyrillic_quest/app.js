document.addEventListener("DOMContentLoaded", () => {
    const categorySelect = document.getElementById("category");
    const wordList = document.getElementById("word-list");
    const loadingMessage = document.getElementById("loading-message");
    const gameArea = document.getElementById("game-area");
    const cyrillicInput = document.getElementById("cyrillic-input");
    const latinOutput = document.getElementById("latin-output");
    let words = [];

    fetch('https://api.allorigins.win/get?url=' + encodeURIComponent('https://adamdjellouli.com/tools/cyrillic_quest/words.json'))
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            try {
                words = JSON.parse(data.contents); // Parse JSON
                console.log('Successfully fetched and parsed JSON:', words);
                populateCategories(Object.keys(words));
                loadCategory(categorySelect.value);
                loadingMessage.style.display = 'none';
                gameArea.style.display = 'block';
            } catch (error) {
                console.error('Error parsing JSON:', error, data.contents);
                loadingMessage.textContent = 'Error loading data. Please try again later.';
            }
        })
        .catch(error => {
            console.error('Error fetching the words:', error);
            loadingMessage.textContent = 'Error fetching data. Please try again later.';
        });

    categorySelect.addEventListener("change", () => {
        loadCategory(categorySelect.value);
    });

    cyrillicInput.addEventListener("input", () => {
        latinOutput.value = transliterate(cyrillicInput.value);
    });

    function populateCategories(categories) {
        categorySelect.innerHTML = ''; // Clear previous options
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
        wordList.innerHTML = ''; // Clear previous content
        if (wordListData) {
            wordListData.forEach(word => {
                const row = document.createElement('tr');

                const cyrillicCell = document.createElement('td');
                cyrillicCell.textContent = word.cyrillic;

                const transliterationCell = document.createElement('td');
                const transliterationInput = document.createElement('input');
                transliterationInput.className = 'transliteration-input';
                transliterationInput.setAttribute('type', 'text');
                transliterationInput.setAttribute('placeholder', 'Type transliteration');
                transliterationCell.appendChild(transliterationInput);

                const hintCell = document.createElement('td');
                const hintButton = document.createElement('button');
                hintButton.className = 'hint-btn';
                hintButton.textContent = 'Hint';
                hintButton.title = `The name in English is ${word.translation}. Press to fill.`;
                hintButton.addEventListener('click', () => {
                    transliterationInput.value = word.transliteration;
                });
                hintCell.appendChild(hintButton);

                const validateCell = document.createElement('td');
                const validateButton = document.createElement('button');
                validateButton.className = 'validate-btn';
                validateButton.textContent = 'Validate';
                validateButton.title = 'Press to validate the transliteration';
                validateButton.addEventListener('click', () => validateTransliteration(transliterationInput, word.transliteration, resultCell));
                validateCell.appendChild(validateButton);

                const resultCell = document.createElement('td');
                resultCell.className = 'result-message';

                row.appendChild(cyrillicCell);
                row.appendChild(transliterationCell);
                row.appendChild(hintCell);
                row.appendChild(validateCell);
                row.appendChild(resultCell);

                wordList.appendChild(row);
            });
        } else {
            console.error('No words found for category:', category);
        }
    }

    function validateTransliteration(input, correctTransliteration, resultCell) {
        if (input.value.toLowerCase() === correctTransliteration.toLowerCase()) {
            input.classList.add('input-success');
            input.classList.remove('input-failure');
            resultCell.textContent = 'Correct!';
            resultCell.className = 'result-message success';
        } else {
            input.classList.add('input-failure');
            input.classList.remove('input-success');
            resultCell.textContent = 'Try again!';
            resultCell.className = 'result-message failure';
        }
    }

    function transliterate(text) {
        const cyrillicToLatinMap = {
            'А': 'A',
            'Б': 'B',
            'В': 'V',
            'Г': 'G',
            'Д': 'D',
            'Е': 'E',
            'Ё': 'Yo',
            'Ж': 'Zh',
            'З': 'Z',
            'И': 'I',
            'Й': 'Y',
            'К': 'K',
            'Л': 'L',
            'М': 'M',
            'Н': 'N',
            'О': 'O',
            'П': 'P',
            'Р': 'R',
            'С': 'S',
            'Т': 'T',
            'У': 'U',
            'Ф': 'F',
            'Х': 'Kh',
            'Ц': 'Ts',
            'Ч': 'Ch',
            'Ш': 'Sh',
            'Щ': 'Shch',
            'Ъ': '"',
            'Ы': 'Y',
            'Ь': "'",
            'Э': 'E',
            'Ю': 'Yu',
            'Я': 'Ya',
            'а': 'a',
            'б': 'b',
            'в': 'v',
            'г': 'g',
            'д': 'd',
            'е': 'e',
            'ё': 'yo',
            'ж': 'zh',
            'з': 'z',
            'и': 'i',
            'й': 'y',
            'к': 'k',
            'л': 'l',
            'м': 'm',
            'н': 'n',
            'о': 'o',
            'п': 'p',
            'р': 'r',
            'с': 's',
            'т': 't',
            'у': 'u',
            'ф': 'f',
            'х': 'kh',
            'ц': 'ts',
            'ч': 'ch',
            'ш': 'sh',
            'щ': 'shch',
            'ъ': '"',
            'ы': 'y',
            'ь': "'",
            'э': 'e',
            'ю': 'yu',
            'я': 'ya'
        };
        return text.split('').map(char => cyrillicToLatinMap[char] || char).join('');
    }
});