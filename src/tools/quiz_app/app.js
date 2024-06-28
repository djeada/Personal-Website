document.addEventListener('DOMContentLoaded', () => {
    const categorySelect = document.getElementById('categorySelect');
    const quizContainer = document.getElementById('quizContainer');
    const submitButton = document.getElementById('submitButton');

    let currentCategory = null;
    let questions = [];
    let userAnswers = [];

    const proxyUrl = 'https://api.allorigins.win/get?url=';

    const fetchJson = async (url) => {
        try {
            const response = await fetch(proxyUrl + encodeURIComponent(url));
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            const parsedData = JSON.parse(data.contents);
            return parsedData;
        } catch (error) {
            console.error('Error fetching JSON data:', error);
            return null;
        }
    };

    const loadCategories = async () => {
        const categoriesUrl = 'https://adamdjellouli.com/tools/quiz_app/categories.json';
        const categories = await fetchJson(categoriesUrl);

        if (categories && Array.isArray(categories)) {
            categories.forEach((category, index) => {
                const option = document.createElement('option');
                option.value = category.name;
                option.textContent = category.name;
                categorySelect.appendChild(option);

                if (index === 0) {
                    option.selected = true;
                    loadCategoryData(category.name);
                }
            });
        } else {
            console.error('Invalid categories data:', categories);
        }
    };

    const loadCategoryData = async (categoryName) => {
        const categoryUrl = `https://adamdjellouli.com/tools/quiz_app/${categoryName}.json`;
        const data = await fetchJson(categoryUrl);

        if (data) {
            currentCategory = data;
            questions = currentCategory.questions;
            userAnswers = Array(questions.length).fill(null);
            displayQuestions();
        } else {
            console.error('Invalid category data:', data);
        }
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

    submitButton.addEventListener('click', submitAnswers);

    loadCategories();
});