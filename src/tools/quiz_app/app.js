document.addEventListener('DOMContentLoaded', () => {
    const categorySelect = document.getElementById('categorySelect');
    const maxQuestionsInput = document.getElementById('maxQuestionsInput');
    const reloadQuestionsButton = document.getElementById('reloadQuestionsButton');
    const quizContainer = document.getElementById('quizContainer');
    const submitButton = document.getElementById('submitButton');
    const loadingMessage = document.createElement('div');
    loadingMessage.id = 'loadingMessage';
    loadingMessage.textContent = 'Loading...';
    quizContainer.appendChild(loadingMessage);

    let currentCategory = null;
    let questions = [];
    let userAnswers = [];
    let maxQuestions = 20; // Default value set to 20
    let categoryCache = {}; // Cache to store category data

    maxQuestionsInput.value = 20; // Set default input value to 20

    const proxyUrl = 'https://api.allorigins.win/get?url=';

    const fetchJson = async (url) => {
        try {
            const response = await fetch(proxyUrl + encodeURIComponent(url));
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            console.log("Raw data contents:", data.contents); // Log raw data
            if (!data.contents) {
                throw new Error("No data received or empty response.");
            }
            try {
                const parsedData = JSON.parse(data.contents);
                return parsedData;
            } catch (parseError) {
                console.error("Error parsing JSON data:", parseError);
                throw parseError;
            }
        } catch (error) {
            console.error('Error fetching JSON data:', error);
            return null;
        }
    };

    const toSnakeCase = (str) => {
        return str
            .toLowerCase() // Convert to lowercase
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .replace(/[^\w]/g, '_'); // Replace non-alphanumeric characters with underscores
    }

    const loadCategories = async () => {
        const categoriesUrl = 'https://adamdjellouli.com/tools/quiz_app/categories.json';
        const categories = await fetchJson(categoriesUrl);

        if (categories && Array.isArray(categories)) {
            categories.forEach((category, index) => {
                const option = document.createElement('option');
                option.value = category.name;
                option.textContent = category.name;
                categorySelect.appendChild(option);
            });

            // Check URL for category path
            const defaultCategory = categories[0].name;
            const path = window.location.pathname.split('/').filter(Boolean);
            const urlCategory = path[path.length - 1];
            const matchedCategory = categories.find(category => toSnakeCase(category.name) === toSnakeCase(urlCategory));
            const initialCategory = matchedCategory ? matchedCategory.name : defaultCategory;

            // Set the category select value and load the initial category
            categorySelect.value = initialCategory;
            loadCategoryData(initialCategory);
        } else {
            console.error('Invalid categories data:', categories);
        }
    };

    const loadCategoryData = async (categoryName) => {
        showLoadingMessage();

        if (categoryCache[categoryName]) {
            // Use cached data if available
            const data = categoryCache[categoryName];
            processCategoryData(data);
        } else {
            // Fetch data if not in cache
            const categoryNameFormatted = toSnakeCase(categoryName);
            const categoryUrl = `https://adamdjellouli.com/tools/quiz_app/${categoryNameFormatted}.json`;
            const data = await fetchJson(categoryUrl);
            hideLoadingMessage();

            if (data) {
                categoryCache[categoryName] = data; // Cache the data
                processCategoryData(data);
            } else {
                console.error('Invalid category data:', data);
            }
        }
    };

    const processCategoryData = (data) => {
        currentCategory = data;
        maxQuestions = parseInt(maxQuestionsInput.value) || 20; // Default to 20 if input is empty or not defined
        questions = getRandomQuestions(data.questions, maxQuestions);
        userAnswers = Array(questions.length).fill(null);
        displayQuestions();
        hideLoadingMessage();
    };

    const getRandomQuestions = (questions, maxQuestions) => {
        const shuffled = questions.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, maxQuestions);
    };

    const showLoadingMessage = () => {
        loadingMessage.style.display = 'block';
    };

    const hideLoadingMessage = () => {
        loadingMessage.style.display = 'none';
    };

    const displayQuestions = () => {
        quizContainer.innerHTML = '';
        questions.forEach((question, index) => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'question';
            const questionText = document.createElement('div');
            questionText.textContent = question.text;
            questionDiv.appendChild(questionText);

            const optionsList = document.createElement('ul');
            optionsList.className = 'options';
            question.options.forEach((option, optionIndex) => {
                const li = document.createElement('li');
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = `question-${index}`;
                radio.value = optionIndex;
                radio.addEventListener('change', () => {
                    userAnswers[index] = optionIndex;
                });
                li.appendChild(radio);
                li.appendChild(document.createTextNode(option));
                optionsList.appendChild(li);
            });
            questionDiv.appendChild(optionsList);
            quizContainer.appendChild(questionDiv);
        });
    };

    const submitAnswers = () => {
        let score = 0;
        questions.forEach((question, index) => {
            const questionDiv = quizContainer.children[index];
            const optionsList = questionDiv.querySelector('.options');
            const selectedOptionIndex = userAnswers[index];
            optionsList.querySelectorAll('li').forEach((li, optionIndex) => {
                li.classList.remove('correct', 'incorrect');
                if (selectedOptionIndex === optionIndex) {
                    if (optionIndex === question.correctOptionIndex) {
                        li.classList.add('correct');
                        score++;
                    } else {
                        li.classList.add('incorrect');
                    }
                }
                if (optionIndex === question.correctOptionIndex) {
                    li.classList.add('correct');
                }
            });
        });
        alert(`Quiz submitted! Your score is ${score}/${questions.length}. Check the answers marked in green and red.`);
    };

    categorySelect.addEventListener('change', (event) => {
        loadCategoryData(event.target.value);
    });

    maxQuestionsInput.addEventListener('input', () => {
        maxQuestions = parseInt(maxQuestionsInput.value) || 20;
    });

    reloadQuestionsButton.addEventListener('click', () => {
        questions = getRandomQuestions(currentCategory.questions, maxQuestions);
        displayQuestions();
    });

    submitButton.addEventListener('click', submitAnswers);

    loadCategories();
});

