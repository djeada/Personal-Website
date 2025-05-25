document.addEventListener('DOMContentLoaded', () => {
    // ─── Element refs ────────────────────────────────────────────────────────────
    const categorySelect = document.getElementById('categorySelect');
    const maxQuestionsInput = document.getElementById('maxQuestionsInput');
    const reloadBtn = document.getElementById('reloadQuestionsButton');
    const submitBtn = document.getElementById('submitButton');
    const quizContainer = document.getElementById('quizContainer');
    const spinner = document.getElementById('loadingSpinner');

    // ─── State ──────────────────────────────────────────────────────────────────
    let currentCategoryData = null;
    let displayedQuestions = [];
    let userAnswers = [];
    const categoryCache = new Map();

    // Initialize default
    maxQuestionsInput.value = 12;

    // ─── Helpers ─────────────────────────────────────────────────────────────────
    const PROXY = 'https://api.allorigins.win/get?url=';

    async function fetchJson(url) {
        try {
            const resp = await fetch(PROXY + encodeURIComponent(url));
            if (!resp.ok) throw new Error(`Status ${resp.status}`);
            const {
                contents
            } = await resp.json();
            return JSON.parse(contents);
        } catch (err) {
            console.error('Fetch error:', err);
            return null;
        }
    }

    const toSnake = str =>
        str.trim().toLowerCase().replace(/\W+/g, '_');

    function pickRandom(arr, n) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy.slice(0, n);
    }

    const showSpinner = () => {
        spinner.style.display = 'block';
    };
    const hideSpinner = () => {
        spinner.style.display = 'none';
    };

    // ─── Markdown Parsing ────────────────────────────────────────────────────────
    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function parseMarkdown(text) {
        let result = escapeHtml(text);
        // code spans
        result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
        // bold
        result = result.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
        // italics
        result = result.replace(/\*([^*]+)\*/g, '<i>$1</i>');
        return result;
    }

    // ─── Load Categories ─────────────────────────────────────────────────────────
    async function loadCategories() {
        const categories = await fetchJson('https://adamdjellouli.com/tools/quiz_app/categories.json');
        if (!Array.isArray(categories)) return;

        categories.forEach(cat => {
            categorySelect.add(new Option(cat.name, cat.name));
        });
        const slug = window.location.pathname.split('/').pop();
        const match = categories.find(c => toSnake(c.name) === toSnake(slug));
        categorySelect.value = match?.name || categories[0].name;
        await loadCategoryData(categorySelect.value);
    }

    // ─── Load a Single Category ─────────────────────────────────────────────────
async function loadCategoryData(categoryName) {
  showSpinner();

  // give the browser a chance to paint the spinner
  await new Promise(requestAnimationFrame);

  if (!categoryCache.has(categoryName)) {
    const slug = toSnake(categoryName);
    const data = await fetchJson(
      `https://adamdjellouli.com/tools/quiz_app/${slug}.json`
    );
    if (data) categoryCache.set(categoryName, data);
  }

  currentCategoryData = categoryCache.get(categoryName) || { questions: [] };
  setupQuiz();
  hideSpinner();
}



    // ─── Quiz Setup & Rendering ─────────────────────────────────────────────────
    function setupQuiz() {
        const maxQ = parseInt(maxQuestionsInput.value, 10) || 20;
        displayedQuestions = pickRandom(currentCategoryData.questions, maxQ);
        userAnswers = Array(displayedQuestions.length).fill(null);
        renderQuestions();
    }

    function renderQuestions() {
        quizContainer.innerHTML = '';

        displayedQuestions.forEach((q, i) => {
            const qDiv = document.createElement('div');
            qDiv.className = 'question';

            // Render question text with special code separation
            if (/`[^`]+`/.test(q.text)) {
                const regex = /`([^`]+)`/;
                const match = regex.exec(q.text);
                const before = q.text.slice(0, match.index);
                const codeText = match[1];
                const after = q.text.slice(match.index + match[0].length);

                if (before.trim()) {
                    const pBefore = document.createElement('p');
                    pBefore.innerHTML = parseMarkdown(before);
                    qDiv.appendChild(pBefore);
                }

                // Code block separated
                const pre = document.createElement('pre');
                pre.innerHTML = `<code>${escapeHtml(codeText)}</code>`;
                qDiv.appendChild(pre);

                if (after.trim()) {
                    const pAfter = document.createElement('p');
                    pAfter.innerHTML = parseMarkdown(after);
                    qDiv.appendChild(pAfter);
                }
            } else {
                const p = document.createElement('p');
                p.innerHTML = parseMarkdown(q.text);
                qDiv.appendChild(p);
            }

            // Render options
            const ul = document.createElement('ul');
            ul.className = 'options';
            q.options.forEach((opt, idx) => {
                const li = document.createElement('li');
                const input = document.createElement('input');
                input.type = 'radio';
                input.name = `q${i}`;
                input.value = idx;
                input.addEventListener('change', () => {
                    userAnswers[i] = idx;
                });

                const label = document.createElement('span');
                label.innerHTML = parseMarkdown(opt);

                li.append(input, label);
                ul.appendChild(li);
            });
            qDiv.appendChild(ul);
            quizContainer.appendChild(qDiv);
        });
    }

    // ─── Submit & Score ──────────────────────────────────────────────────────────
    function submitQuiz() {
        let score = 0;
        displayedQuestions.forEach((q, i) => {
            const correctIdx = q.correctOptionIndex;
            const selected = userAnswers[i];
            quizContainer.querySelectorAll(`input[name="q${i}"]`).forEach(input => {
                const li = input.parentElement;
                li.classList.remove('correct', 'incorrect');
                if (+input.value === correctIdx) li.classList.add('correct');
                if (+input.value === selected && selected !== correctIdx) li.classList.add('incorrect');
            });
            if (selected === correctIdx) score++;
        });
        alert(`Your score: ${score} / ${displayedQuestions.length}`);
    }

    // ─── Event Listeners & Start ─────────────────────────────────────────────────
    categorySelect.addEventListener('change', () => loadCategoryData(categorySelect.value));
    maxQuestionsInput.addEventListener('input', setupQuiz);
    reloadBtn.addEventListener('click', setupQuiz);
    submitBtn.addEventListener('click', submitQuiz);
    loadCategories();
});