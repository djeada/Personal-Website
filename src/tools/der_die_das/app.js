if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
        if (typeof radius === 'number') {
            radius = {
                tl: radius,
                tr: radius,
                br: radius,
                bl: radius
            };
        }
        this.moveTo(x + radius.tl, y);
        this.lineTo(x + width - radius.tr, y);
        this.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
        this.lineTo(x + width, y + height - radius.br);
        this.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
        this.lineTo(x + radius.bl, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
        this.lineTo(x, y + radius.tl);
        this.quadraticCurveTo(x, y, x + radius.tl, y);
        this.closePath();
        return this;
    };
}


const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const livesDisplay = document.getElementById('lives');
const streakDisplay = document.getElementById('streak');
const accuracyDisplay = document.getElementById('accuracy');
const levelDisplay = document.getElementById('level');
const streakBadge = document.getElementById('streakBadge');
const correctWordsTable = document.getElementById('correctWordsTable');
const incorrectWordsTable = document.getElementById('incorrectWordsTable');
const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');
const soundToggle = document.getElementById('soundToggle');
const difficultyBtns = document.querySelectorAll('.difficulty-btn');


const MAX_TABLE_ROWS = 10;
const MAX_SPEED_CAP = 2.5;
const SOUND_VOLUME = 0.3;


let gameWidth, gameHeight;
let score = 0;
let lives = 3;
let streak = 0;
let maxStreak = 0;
let totalAttempts = 0;
let correctAttempts = 0;
let level = 1;
let wordsPerLevel = 5;
let wordsInCurrentLevel = 0;


const difficulties = {
    easy: {
        baseSpeed: 0.00006,
        speedIncrement: 0.000005
    },
    intermediate: {
        baseSpeed: 0.00009,
        speedIncrement: 0.00001
    },
    hard: {
        baseSpeed: 0.00012,
        speedIncrement: 0.000015
    }
};
let currentDifficulty = 'easy';
let baseSpeed = difficulties.easy.baseSpeed;
let speedIncrement = difficulties.easy.speedIncrement;

let fallingSpeed = 0.5;
let fastDropSpeed = 8;
let isFastDropping = false;
let lastWordTime = 0;
let lastFrameTime = 0;
const fixedTimeStep = 16;
let currentWord = null;
let highlightContainerIndex = -1;
let highlightDuration = 400;
let highlightStartTime = 0;
let lastAnswerCorrect = null;
const articles = ['der', 'die', 'das'];
const moveAmount = 35;


let lastTapTime = 0;
const doubleTapDelay = 300;
let isDraggingWord = false;


let particles = [];


let soundEnabled = true;


let isGameOver = false;
let isGameStarted = false;
let gameEndMessage = '';
let isPluralPromptActive = false;


let containerAnimations = [0, 0, 0];
let recentArticles = [];
const maxSameArticleStreak = 3;

let isColorlessMode = false;
let showMeanings = false;
let pluralBonusEnabled = false;

let multiArticles = {};
let multiWords = [];
let meaningsMap = {};
let pluralsMap = {};
let correctWordSet = new Set();


function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}


function isDarkMode() {
    const darkModeValue = getCookie("darkMode");
    return darkModeValue && darkModeValue.toLowerCase() === "true";
}


function getColors() {
    const dark = isDarkMode();
    const containerColors = isColorlessMode ? [
        dark ? '#64748b' : '#94a3b8',
        dark ? '#475569' : '#cbd5f5',
        dark ? '#334155' : '#e2e8f0'
    ] : [
        '#E69F00',
        '#56B4E9',
        '#009E73'
    ];

    const containerHover = isColorlessMode ?
        containerColors.map(color => color) : [
            '#F0B429',
            '#6FC5F6',
            '#1AB085'
        ];

    return {
        bgGradientStart: dark ? '#1a1a2e' : '#667eea',
        bgGradientEnd: dark ? '#16213e' : '#764ba2',
        wordColor: dark ? '#f1f5f9' : '#1f2937',
        wordShadow: dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)',
        containerColors,
        containerHover,
        labelColor: '#ffffff',
        highlightCorrect: dark ? 'rgba(251, 191, 36, 0.95)' : 'rgba(245, 158, 11, 0.95)',
        highlightIncorrect: dark ? 'rgba(249, 115, 22, 0.95)' : 'rgba(234, 88, 12, 0.95)',
        gameOverBg: dark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(0, 0, 0, 0.85)',
        gameOverText: '#ffffff',
        particleColors: dark ? ['#fbbf24', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'] : ['#fbbf24', '#f59e0b', '#10b981', '#6366f1', '#8b5cf6']
    };
}

let colors = getColors();
let highlightColor = colors.highlightCorrect;


const DIFFICULTY_LEVELS = ['easy', 'intermediate', 'hard'];

const baseWordLists = {
    der: ['Baum', 'Stuhl', 'Tisch', 'Apfel', 'Berg', 'Wagen', 'Zug', 'Hund', 'Vogel', 'Fluss', 'Mond', 'Stern', 'Garten', 'Schuh', 'Schlüssel', 'Stift', 'Boden', 'See', 'Wald', 'Himmel', 'Strom', 'Zweig', 'Vorhang', 'Bürgersteig', 'Hut', 'Löffel', 'Pfirsich', 'Vulkan', 'Ring', 'Teller', 'Turm', 'Ball', 'Schrank', 'Computer', 'Kuchen'],
    die: ['Frau', 'Katze', 'Blume', 'Tür', 'Nacht', 'Straße', 'Wiese', 'Lampe', 'Uhr', 'Karte', 'Tasche', 'Brücke', 'Wand', 'Zeitung', 'Wolke', 'Flasche', 'Gabel', 'Schere', 'Kerze', 'Taste', 'Küche', 'Treppe', 'Decke', 'Brille', 'Giraffe', 'Pflanze', 'Sonne', 'Bank', 'Schrift', 'Farbe', 'Jacke', 'Maus', 'Tafel', 'Bluse', 'Kamera'],
    das: ['Buch', 'Bild', 'Fenster', 'Haus', 'Bett', 'Kind', 'Spiel', 'Lied', 'Licht', 'Radio', 'Auto', 'Schiff', 'Pferd', 'Flugzeug', 'Telefon', 'Zimmer', 'Büro', 'Restaurant', 'Theater', 'Fahrrad', 'Sofa', 'Schloss', 'Hotel', 'Programm', 'Papier', 'Instrument', 'Projekt', 'Frühstück', 'Badezimmer', 'Geschenk', 'Handy', 'Konto', 'Bücherregal', 'Motorrad', 'Messer']
};

function splitIntoTiers(words) {
    const cleanWords = words.map(word => word.trim()).filter(Boolean);
    const tierSize = Math.ceil(cleanWords.length / 3);
    return {
        easy: cleanWords.slice(0, tierSize),
        intermediate: cleanWords.slice(tierSize, tierSize * 2),
        hard: cleanWords.slice(tierSize * 2)
    };
}

const wordLists = {
    der: splitIntoTiers(baseWordLists.der),
    die: splitIntoTiers(baseWordLists.die),
    das: splitIntoTiers(baseWordLists.das)
};

const wordListFiles = {
    der: 'der.json',
    die: 'die.json',
    das: 'das.json'
};

const dataBaseUrl = new URL('.', (document.currentScript && document.currentScript.src) || window.location.href);

const fetchWordList = (url, article) => fetch(url).then(response => {
    if (!response.ok) {
        throw new Error(`Failed to load ${article} words from server.`);
    }
    return response.json();
}).catch(error => {
    console.error(`Error fetching ${article} words: ${error.message}`);
});

const fetchJson = (url, label) => fetch(url).then(response => {
    if (!response.ok) {
        throw new Error(`Failed to load ${label}.`);
    }
    return response.json();
}).catch(error => {
    console.error(`Error fetching ${label}: ${error.message}`);
});

function normalizeWordList(data) {
    if (Array.isArray(data)) {
        return splitIntoTiers(data);
    }
    if (data && typeof data === 'object') {
        const normalized = {};
        DIFFICULTY_LEVELS.forEach(level => {
            const words = Array.isArray(data[level]) ? data[level] : [];
            normalized[level] = words.map(word => word.trim()).filter(Boolean);
        });
        return normalized;
    }
    return null;
}

function loadWords() {
    if (window.location.protocol === 'file:') {
        multiArticles = {};
        multiWords = [];
        meaningsMap = {};
        pluralsMap = {};
        return;
    }

    Promise.all([
            fetchWordList(new URL(wordListFiles.der, dataBaseUrl), 'der'),
            fetchWordList(new URL(wordListFiles.die, dataBaseUrl), 'die'),
            fetchWordList(new URL(wordListFiles.das, dataBaseUrl), 'das'),
            fetchJson(new URL('multi_articles.json', dataBaseUrl), 'multi-articles'),
            fetchJson(new URL('meanings.json', dataBaseUrl), 'meanings'),
            fetchJson(new URL('plurals.json', dataBaseUrl), 'plurals')
        ])
        .then(([derWords, dieWords, dasWords, multiData, meaningsData, pluralsData]) => {
            const normalizedDer = normalizeWordList(derWords);
            const normalizedDie = normalizeWordList(dieWords);
            const normalizedDas = normalizeWordList(dasWords);

            if (normalizedDer) wordLists.der = normalizedDer;
            if (normalizedDie) wordLists.die = normalizedDie;
            if (normalizedDas) wordLists.das = normalizedDas;

            if (multiData && typeof multiData === 'object') {
                multiArticles = multiData;
                multiWords = Object.keys(multiArticles);
                removeMultiFromLists();
            }

            if (meaningsData && typeof meaningsData === 'object') {
                meaningsMap = meaningsData;
            }

            if (pluralsData && typeof pluralsData === 'object') {
                pluralsMap = pluralsData;
            }
            console.log('Extended word lists loaded successfully');
            updateMeaningDisplay(currentWord ? currentWord.text : '');
        })
        .catch(err => {
            multiArticles = {};
            multiWords = [];
            meaningsMap = {};
            pluralsMap = {};
            console.log('Using pre-cached word lists:', err.message);
        });
}

function getWordsForDifficulty(article) {
    const list = wordLists[article];
    if (!list) return [];

    const easy = Array.isArray(list.easy) ? list.easy : [];
    const intermediate = Array.isArray(list.intermediate) ? list.intermediate : [];
    const hard = Array.isArray(list.hard) ? list.hard : [];

    if (currentDifficulty === 'easy') {
        return easy;
    }
    if (currentDifficulty === 'intermediate') {
        return easy.concat(intermediate);
    }
    return easy.concat(intermediate, hard);
}


class Particle {
    constructor(x, y, color, isSuccess) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 6 + 3;
        this.speedX = (Math.random() - 0.5) * 8;
        this.speedY = isSuccess ? -(Math.random() * 6 + 2) : (Math.random() - 0.5) * 4;
        this.gravity = 0.15;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.015;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.speedY += this.gravity;
        this.life -= this.decay;
        this.size *= 0.97;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function createParticles(x, y, count, isSuccess) {
    const particleColors = isSuccess ? ['#22c55e', '#4ade80', '#86efac', '#fbbf24'] : ['#ef4444', '#f87171', '#fca5a5'];

    for (let i = 0; i < count; i++) {
        const color = particleColors[Math.floor(Math.random() * particleColors.length)];
        particles.push(new Particle(x, y, color, isSuccess));
    }
}

function updateParticles() {
    particles = particles.filter(p => {
        p.update();
        return p.life > 0;
    });
}

function drawParticles() {
    particles.forEach(p => p.draw(ctx));
}


const audioContext = typeof AudioContext !== 'undefined' ? new AudioContext() : null;


let audioBuffers = {
    correct: null,
    incorrect: null,
    levelup: null,
    gameover: null
};


async function loadSoundEffect(url, key) {
    if (!audioContext) return;

    try {
        const response = await fetch(url);


        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBuffers[key] = audioBuffer;
        console.log(`Successfully loaded ${key} sound`);
    } catch (error) {
        console.log(`Failed to load ${key} sound, using fallback:`, error.message);
    }
}


function initializeSounds() {














    loadSoundEffect('https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3', 'correct');
    loadSoundEffect('https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3', 'incorrect');
    loadSoundEffect('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', 'levelup');
    loadSoundEffect('https://assets.mixkit.co/active_storage/sfx/1788/1788-preview.mp3', 'gameover');
}

function playSound(frequency, duration, type = 'sine') {
    if (!soundEnabled || !audioContext) return;

    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {

    }
}


function playLoadedSound(key, fallbackFn) {
    if (!soundEnabled || !audioContext) return;

    if (audioBuffers[key]) {
        try {
            const source = audioContext.createBufferSource();
            const gainNode = audioContext.createGain();
            source.buffer = audioBuffers[key];
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            gainNode.gain.value = SOUND_VOLUME;
            source.start(0);
            return;
        } catch (e) {
            console.log('Error playing loaded sound, using fallback');
        }
    }


    if (fallbackFn) fallbackFn();
}

function playCorrectSound() {
    playLoadedSound('correct', () => {
        playSound(523.25, 0.1);
        setTimeout(() => playSound(659.25, 0.1), 100);
        setTimeout(() => playSound(783.99, 0.15), 200);
    });
}

function playIncorrectSound() {
    playLoadedSound('incorrect', () => {
        playSound(200, 0.3, 'square');
    });
}

function playLevelUpSound() {
    playLoadedSound('levelup', () => {
        playSound(523.25, 0.1);
        setTimeout(() => playSound(659.25, 0.1), 80);
        setTimeout(() => playSound(783.99, 0.1), 160);
        setTimeout(() => playSound(1046.50, 0.2), 240);
    });
}

function playGameOverSound() {
    playLoadedSound('gameover', () => {
        playSound(392, 0.2, 'square');
        setTimeout(() => playSound(349.23, 0.2, 'square'), 200);
        setTimeout(() => playSound(329.63, 0.3, 'square'), 400);
    });
}


function resizeCanvas() {
    const parent = gameCanvas.parentNode;
    const rect = parent.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;


    const dpr = window.devicePixelRatio || 1;
    gameCanvas.width = width * dpr;
    gameCanvas.height = height * dpr;


    ctx.scale(dpr, dpr);

    gameWidth = width;
    gameHeight = height;

    fallingSpeed = baseSpeed * gameHeight;

    let fontSize = gameWidth <= 500 ? 20 : 28;
    ctx.font = `bold ${fontSize}px 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif`;

    colors = getColors();
}

function normalizeWord(word) {
    return word.trim().toLowerCase();
}

function getTouchX(event) {
    const rect = gameCanvas.getBoundingClientRect();
    const touch = event.touches[0] || event.changedTouches[0];
    return touch.clientX - rect.left;
}

function measureWordWidth(word) {
    return ctx.measureText(word).width;
}

function removeMultiFromLists() {
    const multiSet = new Set(multiWords.map(word => normalizeWord(word)));
    for (const article of articles) {
        const list = wordLists[article];
        if (!list) continue;
        DIFFICULTY_LEVELS.forEach(level => {
            list[level] = (list[level] || []).filter(word => !multiSet.has(normalizeWord(word)));
        });
    }
}

function chooseArticle() {
    if (recentArticles.length >= maxSameArticleStreak) {
        const recent = recentArticles.slice(-maxSameArticleStreak);
        if (recent.every(article => article === recent[0])) {
            const alternatives = articles.filter(article => article !== recent[0]);
            return alternatives[Math.floor(Math.random() * alternatives.length)];
        }
    }
    return articles[Math.floor(Math.random() * articles.length)];
}

function getAvailableWords(words) {
    return words.filter(word => !correctWordSet.has(normalizeWord(word)));
}

function getMultiAllowedArticles(word) {
    if (!multiArticles) return null;
    return multiArticles[word] || multiArticles[normalizeWord(word)] || null;
}

function updateMeaningDisplay(wordText) {
    const meaningDisplay = document.getElementById('meaningDisplay');
    if (!meaningDisplay) return;

    if (!showMeanings) {
        meaningDisplay.textContent = '';
        return;
    }

    const meaning = meaningsMap[wordText] || meaningsMap[normalizeWord(wordText)];
    meaningDisplay.textContent = meaning ? `Meaning: ${meaning}` : 'Meaning: —';
}

function formatArticleList(articleList) {
    if (!Array.isArray(articleList)) return '';
    return articleList.join('/');
}

function showMultiArticleHint(wordText, articleList) {
    const hint = document.getElementById('multiArticleHint');
    if (!hint) return;

    if (!articleList || !articleList.length) {
        hint.textContent = '';
        return;
    }

    hint.textContent = `"${wordText}" can take multiple articles (${formatArticleList(articleList)}). Meaning can change.`;
}

function maybeTriggerPluralBonus(wordText) {
    if (!pluralBonusEnabled) return;
    if (isPluralPromptActive) return;
    if (!pluralsMap || !getPluralAnswers(wordText).length) return;
    if (streak > 0 && streak % 5 === 0) {
        openPluralPrompt(wordText);
    }
}

function getPluralAnswers(wordText) {
    const entry = pluralsMap[wordText] || pluralsMap[normalizeWord(wordText)];
    if (!entry) return [];
    if (Array.isArray(entry)) {
        return entry;
    }
    if (typeof entry === 'string') {
        return entry.split(/[,/;]/).map(item => item.trim()).filter(Boolean);
    }
    return [];
}

function openPluralPrompt(wordText) {
    const overlay = document.getElementById('pluralOverlay');
    const wordEl = document.getElementById('pluralWord');
    const inputEl = document.getElementById('pluralInput');
    const feedbackEl = document.getElementById('pluralFeedback');
    if (!overlay || !wordEl || !inputEl || !feedbackEl) return;

    const answers = getPluralAnswers(wordText);
    if (!answers.length) return;

    overlay.dataset.answers = answers.join('|');
    wordEl.textContent = wordText;
    inputEl.value = '';
    feedbackEl.textContent = '';
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    isPluralPromptActive = true;
    inputEl.focus();
}

function closePluralPrompt() {
    const overlay = document.getElementById('pluralOverlay');
    if (!overlay) return;
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.dataset.answers = '';
    isPluralPromptActive = false;
}

function submitPluralPrompt() {
    const overlay = document.getElementById('pluralOverlay');
    const inputEl = document.getElementById('pluralInput');
    const feedbackEl = document.getElementById('pluralFeedback');
    if (!overlay || !inputEl || !feedbackEl) return;

    const answersRaw = overlay.dataset.answers || '';
    const answers = answersRaw.split('|').map(item => item.trim().toLowerCase()).filter(Boolean);
    const guess = inputEl.value.trim().toLowerCase();

    if (!guess) {
        feedbackEl.textContent = 'Enter a plural form.';
        return;
    }

    if (answers.includes(guess)) {
        feedbackEl.textContent = 'Correct! +15 bonus';
        score += 15;
        updateStats();
        setTimeout(() => closePluralPrompt(), 600);
        return;
    }

    feedbackEl.textContent = `Not quite. Answer: ${answersRaw.replace(/\\|/g, ' / ')}`;
    setTimeout(() => closePluralPrompt(), 900);
}

function generateWord(timestamp) {
    if (currentWord) return;

    const useMulti = multiWords.length > 0 && Math.random() < 0.12;
    let randomArticle = chooseArticle();
    let wordText = '';
    let allowedArticles = null;

    if (useMulti) {
        const availableMulti = getAvailableWords(multiWords);
        if (availableMulti.length) {
            wordText = availableMulti[Math.floor(Math.random() * availableMulti.length)];
            allowedArticles = getMultiAllowedArticles(wordText);
        }
    }

    if (!wordText) {
        const articleOrder = [randomArticle, ...articles.filter(article => article !== randomArticle)];
        for (const article of articleOrder) {
            const words = getWordsForDifficulty(article);
            const availableWords = getAvailableWords(words);
            if (availableWords.length) {
                randomArticle = article;
                wordText = availableWords[Math.floor(Math.random() * availableWords.length)];
                break;
            }
        }

        if (!wordText) {
            isGameOver = true;
            gameEndMessage = 'All words completed!';
            return;
        }
    }
    const wordWidth = measureWordWidth(wordText);
    const maxPositionX = gameWidth - wordWidth - 20;
    const randomX = Math.random() * maxPositionX + wordWidth / 2 + 10;

    currentWord = {
        text: wordText,
        article: randomArticle,
        allowedArticles,
        x: Math.max(wordWidth / 2 + 10, randomX),
        y: -30,
        width: wordWidth,
        opacity: 0,
        scale: 0.5
    };
    if (!allowedArticles) {
        recentArticles.push(randomArticle);
        if (recentArticles.length > maxSameArticleStreak) {
            recentArticles.shift();
        }
    }
    showMultiArticleHint('', null);
    updateMeaningDisplay(wordText);
    lastWordTime = timestamp;
}

function moveWords(deltaTime) {
    if (!currentWord) return;


    if (currentWord.opacity < 1) {
        currentWord.opacity = Math.min(1, currentWord.opacity + 0.05);
    }
    if (currentWord.scale < 1) {
        currentWord.scale = Math.min(1, currentWord.scale + 0.03);
    }


    const currentSpeed = isFastDropping ? fallingSpeed * fastDropSpeed : fallingSpeed;
    currentWord.y += currentSpeed * deltaTime;

    if (currentWord.y > gameHeight + 50) {

        totalAttempts++;
        lives--;
        streak = 0;
        isFastDropping = false;
        updateStats();

        if (lives <= 0) {
            isGameOver = true;
            gameEndMessage = 'Game Over!';
            playGameOverSound();
        } else {
            playIncorrectSound();
        }
        currentWord = null;
    }
}

function getHitContainerIndex(wordX) {
    const containerWidth = gameWidth / 3;
    const containerIndex = Math.floor(wordX / containerWidth);
    return containerIndex >= 0 && containerIndex < 3 ? containerIndex : -1;
}

function addWordToTable(table, wordText, userArticle, correctArticle) {
    const tbody = table.querySelector('tbody');
    const row = document.createElement('tr');

    const wordCell = document.createElement('td');
    wordCell.textContent = wordText;

    const userArticleCell = document.createElement('td');
    userArticleCell.textContent = userArticle;

    const correctArticleCell = document.createElement('td');
    correctArticleCell.textContent = correctArticle;

    row.appendChild(wordCell);
    row.appendChild(userArticleCell);
    row.appendChild(correctArticleCell);


    if (tbody.firstChild) {
        tbody.insertBefore(row, tbody.firstChild);
    } else {
        tbody.appendChild(row);
    }


    while (tbody.children.length > MAX_TABLE_ROWS) {
        tbody.removeChild(tbody.lastChild);
    }
}

function updateStats() {
    scoreDisplay.textContent = score;
    livesDisplay.textContent = lives;
    streakDisplay.textContent = streak;
    levelDisplay.textContent = level;

    const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 100;
    accuracyDisplay.textContent = accuracy;


    if (streak > 0 && streak % 3 === 0) {
        streakBadge.classList.add('active');
        setTimeout(() => streakBadge.classList.remove('active'), 500);
    }
}

function checkLevelUp() {
    wordsInCurrentLevel++;
    if (wordsInCurrentLevel >= wordsPerLevel) {
        level++;
        wordsInCurrentLevel = 0;


        const newSpeed = fallingSpeed + speedIncrement * gameHeight;
        const maxSpeed = baseSpeed * gameHeight * MAX_SPEED_CAP;
        fallingSpeed = Math.min(newSpeed, maxSpeed);

        playLevelUpSound();
        updateStats();


        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                createParticles(
                    Math.random() * gameWidth,
                    gameHeight - 80,
                    15,
                    true
                );
            }, i * 100);
        }
    }
}

function checkCollisions() {
    if (!currentWord) return;

    const containerHeight = 55;
    const bottomMargin = 10;
    const hitY = gameHeight - containerHeight - bottomMargin;

    if (currentWord.y < hitY) return;

    highlightContainerIndex = getHitContainerIndex(currentWord.x);

    if (highlightContainerIndex !== -1) {
        highlightStartTime = Date.now();
        const userArticle = articles[highlightContainerIndex];
        const allowedArticles = currentWord.allowedArticles || [currentWord.article];
        const correctArticle = formatArticleList(allowedArticles) || currentWord.article;

        totalAttempts++;

        if (allowedArticles.includes(userArticle)) {

            streak++;
            correctAttempts++;


            const streakBonus = Math.min(streak, 10);
            score += 10 + streakBonus * 2;

            if (streak > maxStreak) maxStreak = streak;

            highlightColor = colors.highlightCorrect;
            lastAnswerCorrect = true;
            correctWordSet.add(normalizeWord(currentWord.text));
            addWordToTable(correctWordsTable, currentWord.text, userArticle, correctArticle);

            playCorrectSound();
            createParticles(currentWord.x, currentWord.y, 20, true);

            checkLevelUp();
            showMultiArticleHint(currentWord.text, allowedArticles.length > 1 ? allowedArticles : null);
            maybeTriggerPluralBonus(currentWord.text);
        } else {

            lives--;
            streak = 0;
            highlightColor = colors.highlightIncorrect;
            lastAnswerCorrect = false;
            addWordToTable(incorrectWordsTable, currentWord.text, userArticle, correctArticle);

            playIncorrectSound();
            createParticles(currentWord.x, currentWord.y, 15, false);
            showMultiArticleHint(currentWord.text, allowedArticles.length > 1 ? allowedArticles : null);

            if (lives <= 0) {
                isGameOver = true;
                gameEndMessage = 'Game Over!';
                playGameOverSound();
            }
        }

        updateStats();
        containerAnimations[highlightContainerIndex] = 1;
    }

    isFastDropping = false;
    currentWord = null;
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, gameHeight);
    gradient.addColorStop(0, colors.bgGradientStart);
    gradient.addColorStop(1, colors.bgGradientEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, gameWidth, gameHeight);


    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let i = 0; i < gameWidth; i += 40) {
        for (let j = 0; j < gameHeight; j += 40) {
            if ((i + j) % 80 === 0) {
                ctx.fillRect(i, j, 20, 20);
            }
        }
    }
}

function drawWord() {
    if (!currentWord) return;

    ctx.save();


    ctx.globalAlpha = currentWord.opacity;
    ctx.translate(currentWord.x, currentWord.y);
    ctx.scale(currentWord.scale, currentWord.scale);
    ctx.translate(-currentWord.x, -currentWord.y);


    ctx.shadowColor = colors.wordShadow;
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;


    const padding = 16;
    const pillWidth = currentWord.width + padding * 2;
    const pillHeight = 44;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.roundRect(
        currentWord.x - pillWidth / 2,
        currentWord.y - pillHeight / 2 - 5,
        pillWidth,
        pillHeight,
        22
    );
    ctx.fill();


    ctx.shadowColor = 'transparent';


    ctx.fillStyle = '#1f2937';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(currentWord.text, currentWord.x, currentWord.y);

    ctx.restore();
}

function drawContainers() {
    const containerWidth = gameWidth / 3;
    const containerHeight = 55;
    const labels = ['der', 'die', 'das'];
    const bottomMargin = 10;
    const containerY = gameHeight - containerHeight - bottomMargin;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    labels.forEach((label, index) => {
        const x = index * containerWidth;
        const padding = 8;


        if (containerAnimations[index] > 0) {
            containerAnimations[index] -= 0.05;
        }


        let fillColor = colors.containerColors[index];
        if (index === highlightContainerIndex) {
            const elapsedTime = Date.now() - highlightStartTime;
            if (elapsedTime < highlightDuration) {
                fillColor = highlightColor;
            } else {
                highlightContainerIndex = -1;
            }
        }


        ctx.save();

        const animScale = 1 + containerAnimations[index] * 0.05;
        const centerX = x + containerWidth / 2;
        const centerY = containerY + containerHeight / 2;

        ctx.translate(centerX, centerY);
        ctx.scale(animScale, animScale);
        ctx.translate(-centerX, -centerY);


        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;


        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.roundRect(
            x + padding,
            containerY + padding / 2,
            containerWidth - padding * 2,
            containerHeight - padding,
            16
        );
        ctx.fill();


        ctx.shadowColor = 'transparent';


        ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = colors.labelColor;
        ctx.fillText(label, centerX, centerY);

        if (index === highlightContainerIndex && lastAnswerCorrect !== null) {
            const elapsedTime = Date.now() - highlightStartTime;
            if (elapsedTime < highlightDuration) {
                ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
                ctx.fillText(lastAnswerCorrect ? '✓' : '✕', centerX + containerWidth / 2 - 26, centerY);
            }
        }

        ctx.restore();
    });
}

function drawGameOver() {

    ctx.fillStyle = colors.gameOverBg;
    ctx.fillRect(0, 0, gameWidth, gameHeight);


    ctx.fillStyle = colors.gameOverText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 48px "Segoe UI", Arial, sans-serif';
    ctx.fillText(gameEndMessage || 'Game Over!', gameWidth / 2, gameHeight / 2 - 80);


    ctx.font = '24px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`Final Score: ${score}`, gameWidth / 2, gameHeight / 2 - 20);
    ctx.fillText(`Level: ${level}`, gameWidth / 2, gameHeight / 2 + 20);
    ctx.fillText(`Best Streak: ${maxStreak}`, gameWidth / 2, gameHeight / 2 + 60);

    const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 100;
    ctx.fillText(`Accuracy: ${accuracy}%`, gameWidth / 2, gameHeight / 2 + 100);


    ctx.font = '18px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('Press R or tap to restart', gameWidth / 2, gameHeight / 2 + 160);
}

function updateCanvas() {
    ctx.clearRect(0, 0, gameWidth, gameHeight);

    drawBackground();
    drawWord();
    drawContainers();
    updateParticles();
    drawParticles();

    if (isGameOver) {
        drawGameOver();
    }
}

function gameLoop(timestamp) {
    if (!isGameStarted) return;

    if (isGameOver || isPluralPromptActive) {
        updateCanvas();
        return;
    }

    if (!lastFrameTime) lastFrameTime = timestamp;

    while (timestamp - lastFrameTime > fixedTimeStep) {
        moveWords(fixedTimeStep);
        lastFrameTime += fixedTimeStep;
    }

    generateWord(timestamp);
    checkCollisions();
    updateCanvas();
    requestAnimationFrame(gameLoop);
}

function resetGame() {
    isGameOver = false;
    gameEndMessage = '';
    score = 0;
    lives = 3;
    streak = 0;
    maxStreak = 0;
    totalAttempts = 0;
    correctAttempts = 0;
    level = 1;
    wordsInCurrentLevel = 0;
    currentWord = null;
    particles = [];
    lastWordTime = 0;
    lastFrameTime = 0;
    highlightContainerIndex = -1;
    containerAnimations = [0, 0, 0];
    isFastDropping = false;
    lastTapTime = 0;
    lastAnswerCorrect = null;
    recentArticles = [];
    correctWordSet.clear();
    isPluralPromptActive = false;
    updateMeaningDisplay('');
    closePluralPrompt();


    baseSpeed = difficulties[currentDifficulty].baseSpeed;
    speedIncrement = difficulties[currentDifficulty].speedIncrement;
    fallingSpeed = baseSpeed * gameHeight;


    correctWordsTable.querySelector('tbody').innerHTML = '';
    incorrectWordsTable.querySelector('tbody').innerHTML = '';

    updateStats();
}

function startGame() {
    startScreen.style.display = 'none';
    isGameStarted = true;
    resetGame();


    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }

    requestAnimationFrame(gameLoop);
}

function showStartScreen() {
    startScreen.style.display = 'flex';
    isGameStarted = false;
}


function moveLeft() {
    if (currentWord && !isGameOver) {
        currentWord.x = Math.max(currentWord.width / 2 + 10, currentWord.x - moveAmount);
    }
}

function moveRight() {
    if (currentWord && !isGameOver) {
        currentWord.x = Math.min(gameWidth - currentWord.width / 2 - 10, currentWord.x + moveAmount);
    }
}


function handleKeyDown(event) {
    if (!isGameStarted) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            startGame();
        }
        return;
    }

    switch (event.key) {
        case 'ArrowLeft':
            event.preventDefault();
            moveLeft();
            break;
        case 'ArrowRight':
            event.preventDefault();
            moveRight();
            break;
        case ' ':
        case 'ArrowDown':
            event.preventDefault();
            if (currentWord && !isGameOver) {
                isFastDropping = true;
            }
            break;
        case 'ArrowUp':
            event.preventDefault();
            break;
        case 'r':
        case 'R':
            if (isGameOver) {
                resetGame();
                requestAnimationFrame(gameLoop);
            }
            break;
    }
}


document.getElementById('leftButton').addEventListener('touchstart', (e) => {
    e.preventDefault();
    moveLeft();
});

document.getElementById('rightButton').addEventListener('touchstart', (e) => {
    e.preventDefault();
    moveRight();
});

document.getElementById('leftButton').addEventListener('click', moveLeft);
document.getElementById('rightButton').addEventListener('click', moveRight);

gameCanvas.addEventListener('touchstart', (e) => {
    if (!isGameStarted) return;
    if (isGameOver) {
        resetGame();
        requestAnimationFrame(gameLoop);
        return;
    }


    const currentTime = Date.now();
    if (currentTime - lastTapTime < doubleTapDelay) {

        if (currentWord) {
            isFastDropping = true;
        }
    }
    lastTapTime = currentTime;

    if (currentWord && !isGameOver) {
        isDraggingWord = true;
        const touchX = getTouchX(e);
        currentWord.x = Math.min(
            gameWidth - currentWord.width / 2 - 10,
            Math.max(currentWord.width / 2 + 10, touchX)
        );
    }
});

gameCanvas.addEventListener('touchmove', (e) => {
    if (!isGameStarted || isGameOver || !currentWord || !isDraggingWord) return;
    e.preventDefault();
    const touchX = getTouchX(e);
    currentWord.x = Math.min(
        gameWidth - currentWord.width / 2 - 10,
        Math.max(currentWord.width / 2 + 10, touchX)
    );
}, {
    passive: false
});

gameCanvas.addEventListener('touchend', () => {
    isDraggingWord = false;
});

startBtn.addEventListener('click', startGame);

soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
    soundToggle.classList.toggle('muted', !soundEnabled);

    if (soundEnabled && audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
});

const pluralSubmitBtn = document.getElementById('pluralSubmit');
const pluralSkipBtn = document.getElementById('pluralSkip');
const pluralInput = document.getElementById('pluralInput');

if (pluralSubmitBtn) {
    pluralSubmitBtn.addEventListener('click', submitPluralPrompt);
}
if (pluralSkipBtn) {
    pluralSkipBtn.addEventListener('click', closePluralPrompt);
}
if (pluralInput) {
    pluralInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            submitPluralPrompt();
        }
    });
}

const colorlessToggle = document.getElementById('colorlessToggle');
if (colorlessToggle) {
    colorlessToggle.addEventListener('change', () => {
        isColorlessMode = colorlessToggle.checked;
        colors = getColors();
        drawBackground();
        drawContainers();
    });
}

const meaningToggle = document.getElementById('meaningToggle');
if (meaningToggle) {
    meaningToggle.addEventListener('change', () => {
        showMeanings = meaningToggle.checked;
        updateMeaningDisplay(currentWord ? currentWord.text : '');
    });
}

const pluralToggle = document.getElementById('pluralToggle');
if (pluralToggle) {
    pluralToggle.addEventListener('change', () => {
        pluralBonusEnabled = pluralToggle.checked;
    });
}

difficultyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        difficultyBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDifficulty = btn.dataset.difficulty;
        baseSpeed = difficulties[currentDifficulty].baseSpeed;
        speedIncrement = difficulties[currentDifficulty].speedIncrement;
    });
});

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('resize', resizeCanvas);


window.onload = function() {
    resizeCanvas();


    drawBackground();
    drawContainers();


    initializeSounds();


    loadWords();

    if (meaningToggle) {
        showMeanings = meaningToggle.checked;
        updateMeaningDisplay(currentWord ? currentWord.text : '');
    }
    if (pluralToggle) {
        pluralBonusEnabled = pluralToggle.checked;
    }
    if (colorlessToggle) {
        isColorlessMode = colorlessToggle.checked;
        colors = getColors();
    }


    showStartScreen();
};