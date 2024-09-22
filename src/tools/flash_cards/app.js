function resizeText(cardElement) {
    let textElement = cardElement.querySelector('p');

    // Ensure the text element exists before resizing
    if (!textElement) {
        console.error('Text element not found inside card:', cardElement);
        return;
    }

    // Get the initial font size
    let fontSize = parseFloat(window.getComputedStyle(textElement, null).getPropertyValue('font-size'));

    // Reduce font size if the text exceeds the available height of the card
    while (textElement.scrollHeight > cardElement.clientHeight && fontSize > 8) {
        fontSize -= 1;
        textElement.style.fontSize = fontSize + 'px';
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
    const questionsTableBody = document.getElementById('questionsTable').querySelector('tbody');

    let currentCategory = null;
    let currentSubcategories = new Set();
    let cards = [];
    let currentCardIndex = 0;
    let cardStatus = [];

    const proxyUrl = 'https://api.allorigins.win/get?url=';

    const fetchJson = async (url) => {
        try {
            const response = await fetch(proxyUrl + encodeURIComponent(url));
            const data = await response.json();
            const parsedData = JSON.parse(data.contents);
            return parsedData;
        } catch (error) {
            console.error('Error fetching JSON data:', error);
            return null;
        }
    };

    const loadCategories = async () => {
        const categoriesUrl = 'https://adamdjellouli.com/tools/flash_cards/categories.json';
        const categories = await fetchJson(categoriesUrl);

        if (categories && Array.isArray(categories)) {
            categories.forEach((category, index) => {
                const option = document.createElement('option');
                option.value = category; // Keep the original category as the value
                option.textContent = category.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()); // Convert to title case for display
                categorySelect.appendChild(option);

                if (index === 0) {
                    option.selected = true;
                    loadCategoryData(category);
                }
            });

        } else {
            console.error('Invalid categories data:', categories);
        }
    };

    const loadCategoryData = async (category) => {
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
        cardStatus = Array(cards.length).fill(true); // Initialize all statuses to true (unchecked)
        currentCardIndex = 0;
        showCard();
        populateQuestionsTable();
    };

    const showCard = () => {
        let cardFound = false;
        let checkedCards = cards.length;

        while (checkedCards > 0) {
            if (cardStatus[currentCardIndex]) {
                cardFound = true;
                break;
            }
            currentCardIndex = (currentCardIndex + 1) % cards.length;
            checkedCards--;
        }

        if (!cardFound) {
            flashcardFront.innerHTML = '<p>No cards available</p>';
            flashcardBack.innerHTML = '';
        } else {
            flashcardFront.innerHTML = `<p>${cards[currentCardIndex].front}</p>`;
            flashcardBack.innerHTML = `<p>${cards[currentCardIndex].back}</p>`;
        }

        flashcard.classList.remove('flipped');

        // Apply resize after the text is added to the cards
        resizeText(flashcardFront);
        resizeText(flashcardBack);
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
            questionCell.textContent = card.front;
            subcategoryCell.textContent = card.subcategory;
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


    // Apply resize on card load and when flipping
    resizeText(flashcardFront);
    resizeText(flashcardBack);

    flipButton.addEventListener('click', () => {
        const flashcard = document.getElementById('flashcard');
        flashcard.classList.toggle('flipped');
        // Resize text on both sides after flipping
        resizeText(flashcardFront);
        resizeText(flashcardBack);
    });

    knowButton.addEventListener('click', () => {
        if (cards.length > 0) {
            cardStatus[currentCardIndex] = false; // Mark current card as known
            populateQuestionsTable();
            showCard();
        }
    });

    nextButton.addEventListener('click', () => {
        if (cards.length > 0) {
            currentCardIndex = (currentCardIndex + 1) % cards.length;
            showCard();
        }
    });

    loadCategories();
});