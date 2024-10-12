function resizeText(cardElement) {
    let textElement = cardElement.querySelector('p');

    if (!textElement) {
        console.error('Text element not found inside card:', cardElement);
        return;
    }

    let fontSize = parseFloat(window.getComputedStyle(textElement, null).getPropertyValue('font-size'));
    let targetFontSize = fontSize;

    while (textElement.scrollHeight > cardElement.clientHeight * 0.8 && targetFontSize > 2) {
        targetFontSize -= 1;
        textElement.style.fontSize = targetFontSize + 'px';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const categorySelect = document.getElementById('categorySelect');
    const subcategoriesDiv = document.getElementById('subcategories');
    const flashcard = document.getElementById('flashcard');
    const flashcardFront = document.getElementById('flashcardFront');
    const flashcardBack = document.getElementById('flashcardBack');
    const flipButton = document.getElementById('flipButton');
    const knowButton = document.getElementById('knowButton');
    const nextButton = document.getElementById('nextButton');
    const shuffleAllButton = document.getElementById('shuffleAllButton'); // Single shuffle button for all
    const questionsTableBody = document.getElementById('questionsTable').querySelector('tbody');

    let currentCategory = null;
    let currentSubcategories = new Set();
    let cards = [];
    let currentCardIndex = 0;
    let cardStatus = [];

    const proxyUrl = 'https://api.allorigins.win/get?url=';

    const fetchJson = async (url) => {
        document.getElementById('loadingSpinner').style.display = 'block';
        try {
            const response = await fetch(proxyUrl + encodeURIComponent(url));
            const data = await response.json();
            const parsedData = JSON.parse(data.contents);
            return parsedData;
        } catch (error) {
            console.error('Error fetching JSON data:', error);
            return null;
        } finally {
            document.getElementById('loadingSpinner').style.display = 'none';
        }
    };

    const loadCategories = async () => {
        document.getElementById('loadingSpinner').style.display = 'block';
        const categoriesUrl = 'https://adamdjellouli.com/tools/flash_cards/categories.json';
        const categories = await fetchJson(categoriesUrl);

        if (categories && Array.isArray(categories)) {
            categories.forEach((category, index) => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
                categorySelect.appendChild(option);

                if (index === 0) {
                    option.selected = true;
                    loadCategoryData(category);
                }
            });
        } else {
            console.error('Invalid categories data:', categories);
        }
        document.getElementById('loadingSpinner').style.display = 'none';
    };

    const loadCategoryData = async (category) => {
        document.getElementById('loadingSpinner').style.display = 'block';
        const categoryUrl = `https://adamdjellouli.com/tools/flash_cards/${category}.json`;
        const data = await fetchJson(categoryUrl);

        if (data) {
            currentCategory = data;
            populateSubcategories();
            selectAllSubcategories();
            filterCards();
        } else {
            console.error('Invalid category data:', data);
        }
        document.getElementById('loadingSpinner').style.display = 'none';
    };

    const populateSubcategories = () => {
        subcategoriesDiv.innerHTML = '';
        currentCategory.subcategories.forEach(subcategory => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = subcategory.name;
            checkbox.addEventListener('change', handleSubcategoryChange);
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(subcategory.name));
            subcategoriesDiv.appendChild(label);
        });
    };

    const selectAllSubcategories = () => {
        const checkboxes = subcategoriesDiv.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            currentSubcategories.add(checkbox.value);
        });
    };

    const handleSubcategoryChange = (event) => {
        const subcategory = event.target.value;
        if (event.target.checked) {
            currentSubcategories.add(subcategory);
        } else {
            currentSubcategories.delete(subcategory);
        }
        filterCards();
    };

    const filterCards = () => {
        cards = [];
        currentCategory.subcategories.forEach(subcategory => {
            if (currentSubcategories.has(subcategory.name)) {
                cards = cards.concat(subcategory.cards.map(card => ({
                    ...card,
                    subcategory: subcategory.name
                })));
            }
        });
        cardStatus = Array(cards.length).fill(true);
        currentCardIndex = 0;
        showCard();
        populateQuestionsTable();
    };

    const shuffleAll = () => {
        currentCategory.subcategories.forEach(subcategory => {
            if (currentSubcategories.has(subcategory.name)) {
                subcategory.cards = shuffleArray(subcategory.cards);
            }
        });
        filterCards(); // Refresh the cards with the new shuffled order
    };

    const shuffleArray = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    };

    const showCard = () => {
        let initialIndex = currentCardIndex;
        let cardFound = false;

        do {
            if (cardStatus[currentCardIndex]) {
                cardFound = true;
                break;
            }
            currentCardIndex = (currentCardIndex + 1) % cards.length;
        } while (currentCardIndex !== initialIndex);

        if (!cardFound) {
            flashcardFront.innerHTML = '<p>No more cards available</p>';
            flashcardBack.innerHTML = '';
        } else {
            flashcardFront.innerHTML = `<p>${cards[currentCardIndex].front}</p>`;
            flashcardBack.innerHTML = `<p>${cards[currentCardIndex].back}</p>`;
        }

        flashcard.classList.remove('flipped');
        resizeText(flashcardFront);
        resizeText(flashcardBack);

        if (window.MathJax) {
            MathJax.typesetPromise().catch((err) => console.error('MathJax rendering error:', err));
        }
    };

    const populateQuestionsTable = () => {
        questionsTableBody.innerHTML = '';
        cards.forEach((card, index) => {
            const row = document.createElement('tr');
            const indexCell = document.createElement('td');
            const questionCell = document.createElement('td');
            const subcategoryCell = document.createElement('td');
            const statusCell = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = cardStatus[index];
            checkbox.addEventListener('change', () => {
                cardStatus[index] = checkbox.checked;
                showCard();
            });

            indexCell.textContent = index + 1;
            // Using innerHTML to render HTML content in the question and subcategory cells
            questionCell.innerHTML = card.front;
            subcategoryCell.innerHTML = card.subcategory;
            statusCell.appendChild(checkbox);
            row.appendChild(indexCell);
            row.appendChild(questionCell);
            row.appendChild(subcategoryCell);
            row.appendChild(statusCell);
            questionsTableBody.appendChild(row);
        });
    };


    categorySelect.addEventListener('change', (event) => {
        loadCategoryData(event.target.value);
    });

    flipButton.addEventListener('click', () => {
        flashcard.classList.toggle('flipped');
        resizeText(flashcardFront);
        resizeText(flashcardBack);
    });

    knowButton.addEventListener('click', () => {
        if (cards.length > 0) {
            cardStatus[currentCardIndex] = false;
            populateQuestionsTable();
            showCard();
        }
    });

    nextButton.addEventListener('click', () => {
        if (cards.length > 0) {
            let initialIndex = currentCardIndex;
            do {
                currentCardIndex = (currentCardIndex + 1) % cards.length;
            } while (!cardStatus[currentCardIndex] && currentCardIndex !== initialIndex);

            showCard();
        }
    });

    shuffleAllButton.addEventListener('click', shuffleAll); // Single event listener for shuffling

    loadCategories();
});