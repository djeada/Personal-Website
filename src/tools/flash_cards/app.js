function resizeText(name) {
    let cardElement = document.getElementById(name);

    if (!cardElement) {
        console.error(`Container with id "${name}" not found.`);
        return;
    }

    let textElements = cardElement.querySelectorAll('p');
    if (textElements.length === 0) {
        console.error(`No text elements found inside #${name}`);
        return;
    }

    let fontSize = parseFloat(window.getComputedStyle(textElements[0]).getPropertyValue('font-size'));
    let targetFontSize = fontSize;
    let totalHeight;

    do {
        textElements.forEach(el => el.style.fontSize = targetFontSize + 'px');
        totalHeight = Array.from(textElements).reduce((sum, el) => sum + el.scrollHeight, 0);
        targetFontSize -= 1;
    } while (totalHeight > cardElement.clientHeight * 0.8 && targetFontSize > 2);
}

document.addEventListener('DOMContentLoaded', () => {
    // Create or grab an error banner
    let errorDiv = document.getElementById('errorMessage');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'errorMessage';
        Object.assign(errorDiv.style, {
            color: 'white',
            backgroundColor: '#e74c3c',
            padding: '10px',
            textAlign: 'center',
            display: 'none'
        });
        document.body.prepend(errorDiv);
    }

    function displayError(msg) {
        errorDiv.textContent = msg;
        errorDiv.style.display = 'block';
    }

    function clearError() {
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
    }

    const categorySelect = document.getElementById('categorySelect');
    const subcategoriesDiv = document.getElementById('subcategories');
    const flashcard = document.getElementById('flashcard');
    const flashcardFront = document.getElementById('flashcardFront');
    const flashcardBack = document.getElementById('flashcardBack');
    const flipButton = document.getElementById('flipButton');
    const knowButton = document.getElementById('knowButton');
    const nextButton = document.getElementById('nextButton');
    const shuffleAllButton = document.getElementById('shuffleAllButton');
    const questionsTableBody = document.getElementById('questionsTable').querySelector('tbody');
    const loadingSpinner = document.getElementById('loadingSpinner');

    const proxyUrl = 'https://api.allorigins.win/get?url=';

    let currentCategory = null;
    let currentSubcategories = new Set();
    let cards = [];
    let currentCardIndex = 0;
    let cardStatus = [];

    async function fetchJson(url) {
        clearError();
        loadingSpinner.style.display = 'block';
        try {
            const response = await fetch(proxyUrl + encodeURIComponent(url));
            if (!response.ok) throw new Error(`Network response was ${response.status}`);
            const wrapper = await response.json();
            const data = JSON.parse(wrapper.contents);
            return data;
        } catch (err) {
            console.error('Error fetching JSON data:', err);
            displayError('❌ Failed to load data. Please check your connection and try again.');
            return null;
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    async function loadCategories() {
        clearError();
        loadingSpinner.style.display = 'block';

        const categoriesUrl = 'https://adamdjellouli.com/tools/flash_cards/categories.json';
        const categories = await fetchJson(categoriesUrl);

        if (categories && Array.isArray(categories)) {
            categorySelect.innerHTML = '';
            categories.forEach((cat, i) => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                categorySelect.appendChild(opt);
                if (i === 0) opt.selected = true;
            });
            await loadCategoryData(categorySelect.value);
        } else {
            displayError('❌ Could not load category list.');
        }

        loadingSpinner.style.display = 'none';
    }

    async function loadCategoryData(category) {
        clearError();
        loadingSpinner.style.display = 'block';

        const categoryUrl = `https://adamdjellouli.com/tools/flash_cards/${category}.json`;
        const data = await fetchJson(categoryUrl);

        if (data && data.subcategories) {
            currentCategory = data;
            populateSubcategories();
            selectAllSubcategories();
            filterCards();
        } else {
            displayError('❌ Invalid category data received.');
        }

        loadingSpinner.style.display = 'none';
    }

    function populateSubcategories() {
        subcategoriesDiv.innerHTML = '';
        currentCategory.subcategories.forEach(sc => {
            const label = document.createElement('label');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = sc.name;
            cb.checked = true;
            cb.addEventListener('change', handleSubcategoryChange);
            label.append(cb, document.createTextNode(sc.name));
            subcategoriesDiv.appendChild(label);
            currentSubcategories.add(sc.name);
        });
    }

    function selectAllSubcategories() {
        currentSubcategories = new Set(currentCategory.subcategories.map(sc => sc.name));
        subcategoriesDiv.querySelectorAll('input').forEach(cb => cb.checked = true);
    }

    function handleSubcategoryChange(e) {
        if (e.target.checked) currentSubcategories.add(e.target.value);
        else currentSubcategories.delete(e.target.value);
        filterCards();
    }

    function filterCards() {
        cards = [];
        currentCategory.subcategories.forEach(sc => {
            if (currentSubcategories.has(sc.name)) {
                cards.push(...sc.cards.map(card => ({
                    ...card,
                    subcategory: sc.name
                })));
            }
        });
        cardStatus = Array(cards.length).fill(true);
        currentCardIndex = 0;
        showCard();
        populateQuestionsTable();
    }

    function shuffleAll() {
        currentCategory.subcategories.forEach(sc => {
            if (currentSubcategories.has(sc.name)) {
                sc.cards = shuffleArray(sc.cards);
            }
        });
        filterCards();
    }

    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function showCard() {
        if (!cards.length) {
            flashcardFront.innerHTML = '<p>No cards available</p>';
            flashcardBack.innerHTML = '';
            return;
        }

        let start = currentCardIndex,
            found = false;
        do {
            if (cardStatus[currentCardIndex]) {
                found = true;
                break;
            }
            currentCardIndex = (currentCardIndex + 1) % cards.length;
        } while (currentCardIndex !== start);

        if (!found) {
            flashcardFront.innerHTML = '<p>All done!</p>';
            flashcardBack.innerHTML = '';
        } else {
            flashcardFront.innerHTML = `<p>${cards[currentCardIndex].front}</p>`;
            flashcardBack.innerHTML = `<p>${cards[currentCardIndex].back}</p>`;
        }

        flashcard.classList.remove('flipped');
        resizeText('flashcardBack');
        resizeText('flashcardFront');
        if (window.MathJax) {
            MathJax.typesetPromise().catch(err => console.error('MathJax error:', err));
        }
    }

    function populateQuestionsTable() {
        questionsTableBody.innerHTML = '';
        cards.forEach((card, idx) => {
            const row = document.createElement('tr');
            const idxTd = document.createElement('td');
            const qTd = document.createElement('td');
            const subTd = document.createElement('td');
            const statTd = document.createElement('td');
            const cb = document.createElement('input');

            idxTd.textContent = idx + 1;
            qTd.innerHTML = card.front;
            subTd.innerHTML = card.subcategory;
            cb.type = 'checkbox';
            cb.checked = cardStatus[idx];
            cb.addEventListener('change', () => {
                cardStatus[idx] = cb.checked;
                showCard();
            });
            statTd.appendChild(cb);

            row.append(idxTd, qTd, subTd, statTd);
            questionsTableBody.appendChild(row);
        });
    }

    // Event listeners
    categorySelect.addEventListener('change', e => loadCategoryData(e.target.value));
    flipButton.addEventListener('click', () => {
        flashcard.classList.toggle('flipped');
        resizeText('flashcardBack');
        resizeText('flashcardFront');
    });
    knowButton.addEventListener('click', () => {
        if (cards.length) {
            cardStatus[currentCardIndex] = false;
            populateQuestionsTable();
            showCard();
        }
    });
    nextButton.addEventListener('click', () => {
        if (!cards.length) return;
        let start = currentCardIndex;
        do {
            currentCardIndex = (currentCardIndex + 1) % cards.length;
        } while (!cardStatus[currentCardIndex] && currentCardIndex !== start);
        showCard();
    });
    shuffleAllButton.addEventListener('click', shuffleAll);

    // Kick things off
    loadCategories();
});