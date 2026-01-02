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
const soundToggleIcon = soundToggle ? soundToggle.querySelector('.sound-icon') : null;
const soundToggleLabel = soundToggle ? soundToggle.querySelector('.sound-label') : null;
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
let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;
let skipRevealTap = false;
let dragOffsetX = 0;
let dragOffsetY = 0;


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
let showMeanings = true;
let pluralBonusEnabled = true;

let multiArticles = {};
let multiWords = [];
let meaningsMap = {};
let pluralsMap = {};
let correctWordSet = new Set();
let meaningRevealActive = false;
const MEANING_REVEAL_PROMPT = 'Tap to reveal meaning';
let multiArticlePopupTimeout = null;


function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}


function isDarkMode() {
    return document.body.classList.contains('dark-mode');
}


function getColors() {
    const dark = isDarkMode();
    
    // Colorblind mode uses high-contrast distinct colors
    const containerColors = isColorlessMode ? [
        dark ? '#4169E1' : '#0047AB',  // Blue for der (with patterns)
        dark ? '#FF1493' : '#DC143C',  // Red for die (with patterns)
        dark ? '#32CD32' : '#228B22'   // Green for das (with patterns)
    ] : [
        dark ? '#3b82f6' : '#2563eb',  // Blue for der (masc)
        dark ? '#ec4899' : '#f472b6',  // Pink for die (fem)
        dark ? '#10b981' : '#059669'   // Green for das (neut)
    ];

    const containerHover = isColorlessMode ? [
        dark ? '#87CEEB' : '#1E90FF',  // Lighter blue
        dark ? '#FFB6C1' : '#FF6B6B',  // Lighter red
        dark ? '#98FB98' : '#90EE90'   // Lighter green
    ] : [
        dark ? '#60a5fa' : '#3b82f6',
        dark ? '#f472b6' : '#f9a8d4',
        dark ? '#34d399' : '#10b981'
    ];

    const highlightCorrect = isColorlessMode 
        ? (dark ? 'rgba(50, 205, 50, 0.95)' : 'rgba(34, 139, 34, 0.95)')
        : 'rgba(16, 185, 129, 0.95)';
    const highlightIncorrect = isColorlessMode 
        ? (dark ? 'rgba(255, 20, 147, 0.95)' : 'rgba(220, 20, 60, 0.95)')
        : 'rgba(239, 68, 68, 0.95)';
    const particleColors = isColorlessMode
        ? dark 
            ? ['#87CEEB', '#98FB98', '#FFB6C1', '#4169E1', '#32CD32', '#FF1493']
            : ['#1E90FF', '#90EE90', '#FF6B6B', '#0047AB', '#228B22', '#DC143C']
        : dark
            ? ['#fbbf24', '#f59e0b', '#60a5fa', '#fb7185', '#34d399', '#c084fc']
            : ['#f59e0b', '#d97706', '#3b82f6', '#ec4899', '#10b981', '#a855f7'];

    return {
        bgGradientStart: dark ? '#0f0f23' : '#f8fafc',
        bgGradientMid: dark ? '#1a1a2e' : '#e2e8f0',
        bgGradientEnd: dark ? '#16213e' : '#dbe3f0',
        gridColor: dark ? 'rgba(99, 102, 241, 0.03)' : 'rgba(15, 23, 42, 0.06)',
        orbColors: dark ? [
            'rgba(99, 102, 241, 0.12)',
            'rgba(139, 92, 246, 0.1)',
            'rgba(251, 191, 36, 0.06)'
        ] : [
            'rgba(59, 130, 246, 0.18)',
            'rgba(236, 72, 153, 0.14)',
            'rgba(148, 163, 184, 0.16)'
        ],
        wordColor: '#f8fafc',
        wordShadow: 'rgba(0,0,0,0.6)',
        containerColors,
        containerHover,
        labelColor: '#ffffff',
        highlightCorrect,
        highlightIncorrect,
        gameOverBg: 'rgba(10, 10, 26, 0.95)',
        gameOverText: '#ffffff',
        particleColors
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
        this.size = Math.random() * 8 + 4;
        this.speedX = (Math.random() - 0.5) * 10;
        this.speedY = isSuccess ? -(Math.random() * 8 + 3) : (Math.random() - 0.5) * 5;
        this.gravity = 0.12;
        this.life = 1;
        this.decay = Math.random() * 0.015 + 0.012;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.speedY += this.gravity;
        this.life -= this.decay;
        this.size *= 0.98;
        this.rotation += this.rotationSpeed;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function createParticles(x, y, count, isSuccess) {
    const particleColors = isSuccess ? 
        ['#00ff88', '#33ffa3', '#66ffbb', '#fbbf24', '#00d9ff'] : 
        ['#ff6b35', '#ff8c5a', '#ffad80', '#ff4444'];

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

    ctx.font = getWordFont();

    colors = getColors();
}

function normalizeWord(word) {
    return word.trim().toLowerCase();
}

function isCompactLayout() {
    return gameWidth <= 500;
}

function getTouchX(event) {
    const rect = gameCanvas.getBoundingClientRect();
    const touch = event.touches[0] || event.changedTouches[0];
    return touch.clientX - rect.left;
}

function getTouchY(event) {
    const rect = gameCanvas.getBoundingClientRect();
    const touch = event.touches[0] || event.changedTouches[0];
    return touch.clientY - rect.top;
}

function measureWordWidth(word) {
    ctx.font = getWordFont();
    return ctx.measureText(word).width;
}

function getWordFontSize() {
    return isCompactLayout() ? 28 : 44;
}

function getMeaningFontSize() {
    return isCompactLayout() ? 13 : 18;
}

function getWordFont() {
    return `700 ${getWordFontSize()}px 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
}

function getMeaningFont() {
    return `600 ${getMeaningFontSize()}px 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
}

function getHintFontSize() {
    return isCompactLayout() ? 11 : 14;
}

function getHintFont() {
    return `600 ${getHintFontSize()}px 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
}

function getMeaningForWord(wordText) {
    if (!wordText) return '';
    return meaningsMap[wordText] || meaningsMap[normalizeWord(wordText)] || '';
}

function getMeaningDisplayText(wordText) {
    if (!showMeanings) return '';
    if (!meaningRevealActive) return MEANING_REVEAL_PROMPT;
    const meaning = getMeaningForWord(wordText);
    return meaning || 'Meaning unavailable';
}

function truncateText(text, maxWidth, font) {
    if (!text) return '';
    ctx.font = font;
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 3 && ctx.measureText(`${truncated}...`).width > maxWidth) {
        truncated = truncated.slice(0, -1);
    }
    return `${truncated}...`;
}

function measureTextWidth(text, font) {
    if (!text) return 0;
    ctx.font = font;
    return ctx.measureText(text).width;
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
    if (meaningDisplay) {
        meaningDisplay.textContent = '';
    }

    if (currentWord && normalizeWord(currentWord.text) === normalizeWord(wordText)) {
        if (!showMeanings) {
            currentWord.meaning = '';
            currentWord.width = measureWordWidth(currentWord.text);
            return;
        }
        const meaning = getMeaningDisplayText(wordText);
        const maxLineWidth = Math.min(gameWidth - 80, 520);
        const meaningText = truncateText(meaning, maxLineWidth, getMeaningFont());
        currentWord.meaning = meaningText;
        const hintWidth = measureTextWidth(currentWord.hint || '', getHintFont());
        currentWord.width = Math.max(
            measureWordWidth(currentWord.text),
            measureTextWidth(meaningText, getMeaningFont()),
            hintWidth
        );
    }
}

function formatArticleList(articleList) {
    if (!Array.isArray(articleList)) return '';
    return articleList.join('/');
}

function showMultiArticleHint(wordText, articleList) {
    const popup = document.getElementById('multiArticlePopup');
    if (!popup) return;
    if (multiArticlePopupTimeout) {
        clearTimeout(multiArticlePopupTimeout);
        multiArticlePopupTimeout = null;
    }
    popup.classList.remove('show');
    popup.textContent = '';

    const normalizedArticles = Array.isArray(articleList)
        ? articleList
        : String(articleList || '')
            .split(/[\\/|,]/)
            .map(item => item.trim())
            .filter(Boolean);

    if (!normalizedArticles.length || !wordText) {
        return;
    }

    const title = document.createElement('div');
    title.className = 'multi-article-title';
    title.textContent = 'Multiple articles';

    const wordEl = document.createElement('div');
    wordEl.className = 'multi-article-word';
    wordEl.textContent = wordText;

    const chips = document.createElement('div');
    chips.className = 'multi-article-chips';
    normalizedArticles.forEach((article) => {
        const chip = document.createElement('span');
        const normalized = String(article || '').toLowerCase();
        const classSuffix = ['der', 'die', 'das'].includes(normalized) ? normalized : 'unknown';
        chip.className = `article-chip article-chip--${classSuffix}`;
        chip.textContent = article;
        chips.appendChild(chip);
    });

    popup.appendChild(title);
    popup.appendChild(wordEl);
    popup.appendChild(chips);
    popup.classList.add('show');
    multiArticlePopupTimeout = setTimeout(() => {
        popup.classList.remove('show');
        multiArticlePopupTimeout = null;
    }, 3500);
}

function maybeTriggerPluralBonus(wordText) {
    if (!pluralBonusEnabled) return;
    if (isPluralPromptActive) return;
    if (!pluralsMap || !getPluralAnswers(wordText).length) return;
    if (streak > 0 && streak % 5 === 0 && Math.random() < 0.25) {
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

    overlay.classList.remove('plural-correct', 'plural-wrong');
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
    overlay.classList.remove('plural-correct', 'plural-wrong');
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
        overlay.classList.remove('plural-wrong');
        overlay.classList.add('plural-correct');
        feedbackEl.textContent = 'Correct! +15 bonus, +1 health';
        score += 15;
        lives += 1;
        updateStats();
        setTimeout(() => closePluralPrompt(), 600);
        return;
    }

    overlay.classList.remove('plural-correct');
    overlay.classList.add('plural-wrong');
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
    meaningRevealActive = false;
    const meaning = getMeaningDisplayText(wordText);
    const maxLineWidth = Math.min(gameWidth - 80, 520);
    const meaningText = showMeanings ? truncateText(meaning, maxLineWidth, getMeaningFont()) : '';
    const wordWidth = Math.max(
        measureWordWidth(wordText),
        measureTextWidth(meaningText, getMeaningFont())
    );
    const maxPositionX = gameWidth - wordWidth - 20;
    const randomX = Math.random() * maxPositionX + wordWidth / 2 + 10;

    currentWord = {
        text: wordText,
        article: randomArticle,
        allowedArticles,
        x: Math.max(wordWidth / 2 + 10, randomX),
        y: -30,
        width: wordWidth,
        meaning: meaningText,
        hint: '',
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

    if (isDraggingWord) {
        return;
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

    const { containerY } = getContainerLayout();
    const hitY = containerY;

    if (currentWord.y < hitY) return;

    const overlapInfo = getContainerOverlapInfo(currentWord);
    if (overlapInfo.maxIndex === -1) return;

    highlightContainerIndex = overlapInfo.maxIndex;

    if (highlightContainerIndex !== -1) {
        highlightStartTime = Date.now();
        const allowedArticles = currentWord.allowedArticles || [currentWord.article];
        const allowedIndices = allowedArticles
            .map(article => articles.indexOf(article))
            .filter(index => index >= 0);
        const closeAllowedIndex = overlapInfo.closeIndices.find(index => allowedIndices.includes(index));
        const acceptedIndex = allowedIndices.includes(highlightContainerIndex) || closeAllowedIndex === undefined
            ? highlightContainerIndex
            : closeAllowedIndex;

        highlightContainerIndex = acceptedIndex;
        const userArticle = articles[acceptedIndex];
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
    // Create immersive gradient background
    const gradient = ctx.createLinearGradient(0, 0, gameWidth * 0.3, gameHeight);
    gradient.addColorStop(0, colors.bgGradientStart);
    gradient.addColorStop(0.5, colors.bgGradientMid);
    gradient.addColorStop(1, colors.bgGradientEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, gameWidth, gameHeight);

    // Subtle grid pattern for depth
    ctx.strokeStyle = colors.gridColor;
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < gameWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, gameHeight);
        ctx.stroke();
    }
    for (let y = 0; y < gameHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(gameWidth, y);
        ctx.stroke();
    }

    // Floating orbs effect
    const time = Date.now() * 0.001;
    ctx.save();
    
    // First orb
    const orb1X = gameWidth * 0.15 + Math.sin(time * 0.5) * 20;
    const orb1Y = gameHeight * 0.2 + Math.cos(time * 0.3) * 15;
    const orb1Gradient = ctx.createRadialGradient(orb1X, orb1Y, 0, orb1X, orb1Y, 80);
    orb1Gradient.addColorStop(0, colors.orbColors[0]);
    orb1Gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = orb1Gradient;
    ctx.beginPath();
    ctx.arc(orb1X, orb1Y, 80, 0, Math.PI * 2);
    ctx.fill();

    // Second orb
    const orb2X = gameWidth * 0.85 + Math.cos(time * 0.4) * 25;
    const orb2Y = gameHeight * 0.6 + Math.sin(time * 0.6) * 20;
    const orb2Gradient = ctx.createRadialGradient(orb2X, orb2Y, 0, orb2X, orb2Y, 100);
    orb2Gradient.addColorStop(0, colors.orbColors[1]);
    orb2Gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = orb2Gradient;
    ctx.beginPath();
    ctx.arc(orb2X, orb2Y, 100, 0, Math.PI * 2);
    ctx.fill();

    // Third orb
    const orb3X = gameWidth * 0.5 + Math.sin(time * 0.7) * 30;
    const orb3Y = gameHeight * 0.35 + Math.cos(time * 0.5) * 25;
    const orb3Gradient = ctx.createRadialGradient(orb3X, orb3Y, 0, orb3X, orb3Y, 60);
    orb3Gradient.addColorStop(0, colors.orbColors[2]);
    orb3Gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = orb3Gradient;
    ctx.beginPath();
    ctx.arc(orb3X, orb3Y, 60, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawWord() {
    if (!currentWord) return;

    ctx.save();

    // Smooth animations
    ctx.globalAlpha = currentWord.opacity;
    ctx.translate(currentWord.x, currentWord.y);
    ctx.scale(currentWord.scale, currentWord.scale);
    ctx.translate(-currentWord.x, -currentWord.y);

    // Enhanced shadow with glow
    ctx.shadowColor = 'rgba(99, 102, 241, 0.4)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8;

    // Calculate dimensions
    const wordFont = getWordFont();
    const meaningFont = getMeaningFont();
    const hintFont = getHintFont();
    const maxLineWidth = Math.min(gameWidth - 80, 520);
    const meaningText = showMeanings ? truncateText(currentWord.meaning || getMeaningDisplayText(currentWord.text), maxLineWidth, meaningFont) : '';
    const hintText = currentWord.hint || '';
    const wordWidth = measureWordWidth(currentWord.text);
    const meaningWidth = measureTextWidth(meaningText, meaningFont);
    const hintWidth = measureTextWidth(hintText, hintFont);
    currentWord.width = Math.max(wordWidth, meaningWidth, hintWidth);

    const paddingX = isCompactLayout() ? 22 : 28;
    const paddingY = isCompactLayout() ? 16 : 20;
    const wordFontSize = getWordFontSize();
    const meaningFontSize = getMeaningFontSize();
    const hintFontSize = getHintFontSize();
    const lineGap = 10;
    const hintGap = meaningText ? 8 : 10;
    const textHeight = wordFontSize +
        (meaningText ? meaningFontSize + lineGap : 0) +
        (hintText ? hintFontSize + hintGap : 0);
    const pillWidth = currentWord.width + paddingX * 2;
    const pillHeight = textHeight + paddingY * 2;
    currentWord.pillWidth = pillWidth;
    currentWord.pillHeight = pillHeight;

    // Frosted glass card with gradient border
    const cardX = currentWord.x - pillWidth / 2;
    const cardY = currentWord.y - pillHeight / 2;
    
    // Outer glow
    const glowGradient = ctx.createRadialGradient(
        currentWord.x, currentWord.y, pillWidth * 0.3,
        currentWord.x, currentWord.y, pillWidth * 0.8
    );
    glowGradient.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(currentWord.x, currentWord.y, pillWidth * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Card background with gradient
    const cardGradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + pillHeight);
    cardGradient.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    cardGradient.addColorStop(1, 'rgba(248, 250, 252, 0.95)');
    ctx.fillStyle = cardGradient;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, pillWidth, pillHeight, 24);
    ctx.fill();

    // Subtle border highlight
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Top shine effect
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, pillWidth, pillHeight / 2, [24, 24, 0, 0]);
    ctx.clip();
    const shineGradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + pillHeight / 2);
    shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = shineGradient;
    ctx.fillRect(cardX, cardY, pillWidth, pillHeight / 2);
    ctx.restore();

    // Reset shadow for text
    ctx.shadowColor = 'transparent';

    // Word text
    ctx.fillStyle = '#1a1a2e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = wordFont;

    const textTop = currentWord.y - textHeight / 2;
    ctx.fillText(currentWord.text, currentWord.x, textTop);

    // Meaning text
    if (meaningText) {
        ctx.font = meaningFont;
        ctx.fillStyle = meaningRevealActive ? '#374151' : 'rgba(55, 65, 81, 0.6)';
        ctx.globalAlpha = Math.min(1, currentWord.opacity);
        ctx.fillText(meaningText, currentWord.x, textTop + wordFontSize + lineGap);
    }

    // Hint text
    if (hintText) {
        const hintY = textTop + wordFontSize +
            (meaningText ? meaningFontSize + lineGap : 0) + hintGap;
        ctx.font = hintFont;
        ctx.fillStyle = '#6366f1';
        ctx.fillText(hintText, currentWord.x, hintY);
    }

    ctx.restore();
}

function isPointInWord(x, y) {
    if (!currentWord) return false;
    const paddingX = isCompactLayout() ? 22 : 28;
    const paddingY = isCompactLayout() ? 16 : 20;
    const halfWidth = (currentWord.pillWidth || currentWord.width + paddingX * 2) / 2;
    const halfHeight = (currentWord.pillHeight || (getWordFontSize() + paddingY * 2)) / 2;
    return x >= currentWord.x - halfWidth &&
        x <= currentWord.x + halfWidth &&
        y >= currentWord.y - halfHeight &&
        y <= currentWord.y + halfHeight;
}

function clampWordPosition(x, y) {
    if (!currentWord) return;
    const paddingX = isCompactLayout() ? 22 : 28;
    const paddingY = isCompactLayout() ? 16 : 20;
    const pillWidth = currentWord.pillWidth || (currentWord.width + paddingX * 2);
    const pillHeight = currentWord.pillHeight || (getWordFontSize() + paddingY * 2);
    const halfWidth = pillWidth / 2;
    const halfHeight = pillHeight / 2;
    const clampedX = Math.min(gameWidth - halfWidth - 10, Math.max(halfWidth + 10, x));
    const clampedY = Math.min(gameHeight - halfHeight - 10, Math.max(halfHeight + 10, y));
    currentWord.x = clampedX;
    currentWord.y = clampedY;
}

function getContainerLayout() {
    const containerWidth = gameWidth / 3;
    const containerHeight = isCompactLayout() ? 84 : 100;
    const padding = isCompactLayout() ? 4 : 6;
    const bottomMargin = 0;
    const containerY = gameHeight - containerHeight - bottomMargin;
    return {
        containerWidth,
        containerHeight,
        padding,
        bottomMargin,
        containerY
    };
}

function getContainerOverlapInfo(word) {
    const layout = getContainerLayout();
    const paddingX = isCompactLayout() ? 22 : 28;
    const pillWidth = word.pillWidth || (word.width + paddingX * 2);
    const wordLeft = word.x - pillWidth / 2;
    const wordRight = word.x + pillWidth / 2;
    const overlaps = [];

    for (let i = 0; i < 3; i++) {
        const containerLeft = i * layout.containerWidth + layout.padding;
        const containerRight = (i + 1) * layout.containerWidth - layout.padding;
        const overlap = Math.max(0, Math.min(wordRight, containerRight) - Math.max(wordLeft, containerLeft));
        overlaps.push(overlap);
    }

    const maxOverlap = Math.max(...overlaps);
    if (maxOverlap <= 0) {
        return {
            maxOverlap,
            maxIndex: -1,
            closeIndices: []
        };
    }

    const overlapTolerance = Math.max(10, layout.containerWidth * 0.08);
    const closeIndices = overlaps
        .map((overlap, index) => (overlap > 0 && maxOverlap - overlap <= overlapTolerance ? index : null))
        .filter(index => index !== null);

    return {
        maxOverlap,
        maxIndex: overlaps.indexOf(maxOverlap),
        closeIndices
    };
}

function drawContainers() {
    const {
        containerWidth,
        containerHeight,
        padding,
        containerY
    } = getContainerLayout();
    const labels = ['der', 'die', 'das'];
    const sublabels = ['MASC', 'FEM', 'NEUT'];
    const icons = ['♂', '♀', '◆'];
    const isCompact = isCompactLayout();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Container colors (respect colorblind mode palette)
    const containerGradients = colors.containerColors.map((baseColor, index) => [
        baseColor,
        colors.containerHover[index] || baseColor
    ]);

    labels.forEach((label, index) => {
        const x = index * containerWidth;
        // Animation decay
        if (containerAnimations[index] > 0) {
            containerAnimations[index] -= 0.04;
        }

        // Determine fill color
        let isHighlighted = index === highlightContainerIndex;
        const elapsedTime = isHighlighted ? Date.now() - highlightStartTime : 0;
        if (isHighlighted && elapsedTime >= highlightDuration) {
            highlightContainerIndex = -1;
            isHighlighted = false;
        }

        ctx.save();

        const animScale = 1 + containerAnimations[index] * 0.08;
        const centerX = x + containerWidth / 2;
        const centerY = containerY + containerHeight / 2;

        ctx.translate(centerX, centerY);
        ctx.scale(animScale, animScale);
        ctx.translate(-centerX, -centerY);

        // Container shadow and glow
        if (isHighlighted) {
            ctx.shadowColor = lastAnswerCorrect ? 'rgba(16, 185, 129, 0.65)' : 'rgba(239, 68, 68, 0.65)';
            ctx.shadowBlur = 25;
        } else {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 15;
        }
        ctx.shadowOffsetY = 4;

        // Create gradient for container
        const gradientColors = containerGradients[index];
        const containerGradient = ctx.createLinearGradient(
            x + padding, containerY,
            x + padding, containerY + containerHeight
        );
        
        if (isHighlighted) {
            const highlightBaseColor = lastAnswerCorrect ? '#10b981' : '#ef4444';
            containerGradient.addColorStop(0, highlightBaseColor);
            containerGradient.addColorStop(1, lastAnswerCorrect ? '#059669' : '#dc2626');
        } else {
            containerGradient.addColorStop(0, gradientColors[0]);
            containerGradient.addColorStop(1, gradientColors[1]);
        }

        // Draw container shape
        ctx.fillStyle = containerGradient;
        ctx.beginPath();
        ctx.roundRect(
            x + padding,
            containerY + padding / 2,
            containerWidth - padding * 2,
            containerHeight - padding,
            [isCompact ? 16 : 20, isCompact ? 16 : 20, 0, 0]
        );
        ctx.fill();

        // Border highlight
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Add patterns for colorblind mode to make containers more distinguishable
        if (isColorlessMode && !isHighlighted) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(
                x + padding,
                containerY + padding / 2,
                containerWidth - padding * 2,
                containerHeight - padding,
                [isCompact ? 16 : 20, isCompact ? 16 : 20, 0, 0]
            );
            ctx.clip();
            
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 3;
            
            const patternX = x + padding;
            const patternY = containerY + padding / 2;
            const patternW = containerWidth - padding * 2;
            const patternH = containerHeight - padding;
            
            if (index === 0) { // der - vertical stripes
                for (let i = 0; i < patternW; i += 12) {
                    ctx.beginPath();
                    ctx.moveTo(patternX + i, patternY);
                    ctx.lineTo(patternX + i, patternY + patternH);
                    ctx.stroke();
                }
            } else if (index === 1) { // die - dots pattern
                const dotSize = 4;
                const spacing = 14;
                for (let dy = 0; dy < patternH; dy += spacing) {
                    for (let dx = 0; dx < patternW; dx += spacing) {
                        ctx.beginPath();
                        ctx.arc(patternX + dx + spacing/2, patternY + dy + spacing/2, dotSize, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            } else if (index === 2) { // das - diagonal lines
                for (let i = -patternH; i < patternW + patternH; i += 15) {
                    ctx.beginPath();
                    ctx.moveTo(patternX + i, patternY);
                    ctx.lineTo(patternX + i + patternH, patternY + patternH);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }

        // Top shine effect
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(
            x + padding,
            containerY + padding / 2,
            containerWidth - padding * 2,
            (containerHeight - padding) * 0.4,
            [isCompact ? 16 : 20, isCompact ? 16 : 20, 0, 0]
        );
        ctx.clip();
        const shineGradient = ctx.createLinearGradient(
            x + padding, containerY + padding / 2,
            x + padding, containerY + containerHeight * 0.4
        );
        shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = shineGradient;
        ctx.fillRect(x + padding, containerY + padding / 2, containerWidth - padding * 2, containerHeight * 0.4);
        ctx.restore();

        if (isHighlighted && lastAnswerCorrect !== null) {
            const feedbackFill = lastAnswerCorrect ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)';
            const feedbackBorder = lastAnswerCorrect ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)';
            ctx.fillStyle = feedbackFill;
            ctx.beginPath();
            ctx.roundRect(
                x + padding,
                containerY + padding / 2,
                containerWidth - padding * 2,
                containerHeight - padding,
                [isCompact ? 16 : 20, isCompact ? 16 : 20, 0, 0]
            );
            ctx.fill();
            ctx.strokeStyle = feedbackBorder;
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // Reset shadow
        ctx.shadowColor = 'transparent';

        const iconOffset = isCompact ? 22 : 28;
        const sublabelOffset = isCompact ? 18 : 22;

        // Icon
        ctx.font = `700 ${isCompact ? 16 : 20}px "Segoe UI Symbol", Arial, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(icons[index], centerX, centerY - iconOffset);

        // Article label
        ctx.font = `bold ${isCompact ? 22 : 28}px "Segoe UI", Arial, sans-serif`;
        ctx.fillStyle = colors.labelColor;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        ctx.fillText(label, centerX, centerY - 4);
        ctx.shadowColor = 'transparent';

        // Sublabel
        ctx.font = `700 ${isCompact ? 11 : 13}px "Segoe UI", Arial, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillText(sublabels[index], centerX, centerY + sublabelOffset);

        // Feedback indicator
        if (isHighlighted && lastAnswerCorrect !== null) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
            ctx.shadowBlur = 8;
            ctx.font = `800 ${isCompact ? 22 : 28}px "Segoe UI Symbol", Arial, sans-serif`;
            ctx.fillText(lastAnswerCorrect ? '✓' : '✕', centerX, centerY - (isCompact ? 8 : 10));
            ctx.font = `800 ${isCompact ? 15 : 18}px "Segoe UI", Arial, sans-serif`;
            ctx.fillText(lastAnswerCorrect ? 'CORRECT' : 'WRONG', centerX, centerY + (isCompact ? 12 : 14));
            ctx.shadowColor = 'transparent';
        }

        ctx.restore();
    });
}

function exportSessionToPDF() {
    // Check if jsPDF is available
    if (typeof window.jspdf === 'undefined') {
        console.error('jsPDF library not loaded');
        alert('PDF export is not available. Please refresh the page and try again.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Set document properties
    doc.setProperties({
        title: 'Der Die Das - Session Recap',
        subject: 'Game Session Statistics',
        author: 'Der Die Das Game',
        keywords: 'german, articles, game, statistics',
        creator: 'Der Die Das Game'
    });

    // Title
    doc.setFontSize(24);
    doc.setTextColor(59, 130, 246);
    doc.text('Der Die Das', 105, 20, { align: 'center' });
    
    doc.setFontSize(18);
    doc.setTextColor(100, 100, 100);
    doc.text('Session Recap', 105, 30, { align: 'center' });

    // Game Over Message
    doc.setFontSize(16);
    doc.setTextColor(251, 191, 36);
    doc.text(gameEndMessage || 'Game Over!', 105, 45, { align: 'center' });

    // Session date
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    const sessionDate = new Date().toLocaleString();
    doc.text(`Session Date: ${sessionDate}`, 105, 52, { align: 'center' });

    // Statistics Section
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Game Statistics', 20, 65);

    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 100;
    
    const stats = [
        `Final Score: ${score}`,
        `Level Reached: ${level}`,
        `Best Streak: ${maxStreak}`,
        `Accuracy: ${accuracy}%`,
        `Total Attempts: ${totalAttempts}`,
        `Correct Answers: ${correctAttempts}`,
        `Incorrect Answers: ${totalAttempts - correctAttempts}`,
        `Difficulty: ${currentDifficulty.charAt(0).toUpperCase() + currentDifficulty.slice(1)}`
    ];

    let yPos = 75;
    stats.forEach(stat => {
        doc.text(stat, 25, yPos);
        yPos += 8;
    });

    // Incorrect Words Section
    yPos += 10;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Incorrect Words', 20, yPos);
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    
    const incorrectRows = incorrectWordsTable.querySelectorAll('tbody tr');
    if (incorrectRows.length > 0) {
        // Table headers
        doc.setFont(undefined, 'bold');
        doc.text('Word', 25, yPos);
        doc.text('Your Choice', 80, yPos);
        doc.text('Correct', 130, yPos);
        doc.setFont(undefined, 'normal');
        yPos += 6;

        // Table rows
        incorrectRows.forEach((row, index) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            const cells = row.querySelectorAll('td');
            doc.text(cells[0].textContent, 25, yPos);
            doc.text(cells[1].textContent, 80, yPos);
            doc.text(cells[2].textContent, 130, yPos);
            yPos += 6;
        });
    } else {
        doc.text('No incorrect words! Perfect game!', 25, yPos);
        yPos += 6;
    }

    // Correct Words Section
    yPos += 10;
    if (yPos > 250) {
        doc.addPage();
        yPos = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Correct Words', 20, yPos);
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    
    const correctRows = correctWordsTable.querySelectorAll('tbody tr');
    if (correctRows.length > 0) {
        // Table headers
        doc.setFont(undefined, 'bold');
        doc.text('Word', 25, yPos);
        doc.text('Your Choice', 80, yPos);
        doc.text('Correct', 130, yPos);
        doc.setFont(undefined, 'normal');
        yPos += 6;

        // Limit to first 20 correct words to avoid overly long PDFs
        const displayRows = Array.from(correctRows).slice(0, 20);
        displayRows.forEach((row, index) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            const cells = row.querySelectorAll('td');
            doc.text(cells[0].textContent, 25, yPos);
            doc.text(cells[1].textContent, 80, yPos);
            doc.text(cells[2].textContent, 130, yPos);
            yPos += 6;
        });

        if (correctRows.length > 20) {
            yPos += 2;
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text(`... and ${correctRows.length - 20} more correct words`, 25, yPos);
        }
    } else {
        doc.text('No correct words recorded.', 25, yPos);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
        doc.text('Generated by Der Die Das Game - https://adamdjellouli.com', 105, 285, { align: 'center' });
    }

    // Save the PDF
    const filename = `der-die-das-session-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
}

function drawGameOver() {
    // Dark overlay with gradient
    const overlayGradient = ctx.createRadialGradient(
        gameWidth / 2, gameHeight / 2, 0,
        gameWidth / 2, gameHeight / 2, gameWidth * 0.8
    );
    overlayGradient.addColorStop(0, 'rgba(10, 10, 26, 0.92)');
    overlayGradient.addColorStop(1, 'rgba(10, 10, 26, 0.98)');
    ctx.fillStyle = overlayGradient;
    ctx.fillRect(0, 0, gameWidth, gameHeight);

    // Decorative glow
    const glowGradient = ctx.createRadialGradient(
        gameWidth / 2, gameHeight / 2 - 60, 0,
        gameWidth / 2, gameHeight / 2 - 60, 200
    );
    glowGradient.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(gameWidth / 2, gameHeight / 2 - 60, 200, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title with glow
    ctx.shadowColor = 'rgba(251, 191, 36, 0.5)';
    ctx.shadowBlur = 30;
    ctx.font = 'bold 52px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(gameEndMessage || 'Game Over!', gameWidth / 2, gameHeight / 2 - 100);
    ctx.shadowColor = 'transparent';

    // Stats with icons
    ctx.font = '600 26px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    
    ctx.fillText(`⭐ Final Score: ${score}`, gameWidth / 2, gameHeight / 2 - 30);
    ctx.fillText(`📈 Level: ${level}`, gameWidth / 2, gameHeight / 2 + 15);
    ctx.fillText(`🔥 Best Streak: ${maxStreak}`, gameWidth / 2, gameHeight / 2 + 60);

    const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 100;
    ctx.fillText(`🎯 Accuracy: ${accuracy}%`, gameWidth / 2, gameHeight / 2 + 105);

    // Export to PDF button hint
    ctx.font = '600 18px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(99, 102, 241, 0.9)';
    ctx.fillText('📄 Export to PDF', gameWidth / 2, gameHeight / 2 + 145);

    // Restart prompt with animation hint
    ctx.font = '600 20px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillText('Press R or tap to restart', gameWidth / 2, gameHeight / 2 + 180);

    // Decorative line
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gameWidth / 2 - 100, gameHeight / 2 - 60);
    ctx.lineTo(gameWidth / 2 + 100, gameHeight / 2 - 60);
    ctx.stroke();
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

    if (isGameOver) {
        updateCanvas();
        return;
    }
    if (isPluralPromptActive) {
        updateCanvas();
        requestAnimationFrame(gameLoop);
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
    meaningRevealActive = false;
    recentArticles = [];
    correctWordSet.clear();
    isPluralPromptActive = false;
    updateMeaningDisplay('');
    showMultiArticleHint('', null);
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
        case 'p':
        case 'P':
            if (isGameOver) {
                event.preventDefault();
                exportSessionToPDF();
            }
            break;
        case 'm':
        case 'M':
            if (currentWord && showMeanings && !meaningRevealActive) {
                meaningRevealActive = true;
                updateMeaningDisplay(currentWord.text);
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
        // Check if user tapped on PDF export area
        const touchX = getTouchX(e);
        const touchY = getTouchY(e);
        const pdfButtonY = gameHeight / 2 + 145;
        const pdfButtonHeight = 30;
        
        if (touchY >= pdfButtonY - pdfButtonHeight / 2 && 
            touchY <= pdfButtonY + pdfButtonHeight / 2 &&
            touchX >= gameWidth / 2 - 100 &&
            touchX <= gameWidth / 2 + 100) {
            // User tapped on PDF export button
            e.preventDefault();
            exportSessionToPDF();
            return;
        }
        
        // Otherwise restart the game
        resetGame();
        requestAnimationFrame(gameLoop);
        return;
    }


    const currentTime = Date.now();
    if (currentTime - lastTapTime < doubleTapDelay) {
        if (currentWord) {
            isFastDropping = true;
        }
        skipRevealTap = true;
    } else {
        skipRevealTap = false;
    }
    lastTapTime = currentTime;

    if (currentWord && !isGameOver) {
        const touchX = getTouchX(e);
        const touchY = getTouchY(e);
        if (isPointInWord(touchX, touchY)) {
            isDraggingWord = true;
            touchStartX = touchX;
            touchStartY = touchY;
            dragOffsetX = touchX - currentWord.x;
            dragOffsetY = touchY - currentWord.y;
            touchMoved = false;
        } else {
            isDraggingWord = false;
        }
    }
});

gameCanvas.addEventListener('touchmove', (e) => {
    if (!isGameStarted || isGameOver || !currentWord || !isDraggingWord) return;
    e.preventDefault();
    const touchX = getTouchX(e);
    const touchY = getTouchY(e);
    if (Math.abs(touchX - touchStartX) > 8 || Math.abs(touchY - touchStartY) > 8) {
        touchMoved = true;
    }
    clampWordPosition(touchX - dragOffsetX, touchY - dragOffsetY);
}, {
    passive: false
});

gameCanvas.addEventListener('touchend', (e) => {
    if (skipRevealTap) {
        skipRevealTap = false;
        isDraggingWord = false;
        return;
    }
    if (showMeanings && !meaningRevealActive && currentWord && !touchMoved) {
        const touchX = getTouchX(e);
        const touchY = getTouchY(e);
        if (isPointInWord(touchX, touchY)) {
            meaningRevealActive = true;
            updateMeaningDisplay(currentWord.text);
        }
    }
    isDraggingWord = false;
});

gameCanvas.addEventListener('click', (e) => {
    if (!isGameStarted) return;
    
    // Handle game over screen clicks
    if (isGameOver) {
        const rect = gameCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const pdfButtonY = gameHeight / 2 + 145;
        const pdfButtonHeight = 30;
        
        if (y >= pdfButtonY - pdfButtonHeight / 2 && 
            y <= pdfButtonY + pdfButtonHeight / 2 &&
            x >= gameWidth / 2 - 100 &&
            x <= gameWidth / 2 + 100) {
            // User clicked on PDF export button
            exportSessionToPDF();
            return;
        }
        return;
    }
    
    if (!currentWord || !showMeanings || meaningRevealActive) return;
    const rect = gameCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (isPointInWord(x, y)) {
        meaningRevealActive = true;
        updateMeaningDisplay(currentWord.text);
    }
});

startBtn.addEventListener('click', startGame);

soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    if (soundToggleIcon) {
        soundToggleIcon.textContent = soundEnabled ? '🔊' : '🔇';
    }
    if (soundToggleLabel) {
        soundToggleLabel.textContent = soundEnabled ? 'Sound' : 'Muted';
    }
    soundToggle.setAttribute('aria-label', soundEnabled ? 'Sound on' : 'Sound off');
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
const darkModeButton = document.getElementById('dark-mode-button');
const resetGameButton = document.getElementById('resetGameButton');
if (colorlessToggle) {
    colorlessToggle.addEventListener('change', () => {
        isColorlessMode = colorlessToggle.checked;
        colors = getColors();
        drawBackground();
        drawContainers();
    });
}
if (darkModeButton) {
    darkModeButton.addEventListener('click', () => {
        // Wait for dark mode class to be applied, then refresh colors
        const checkAndUpdate = () => {
            colors = getColors();
            if (isGameStarted) {
                updateCanvas();
            } else {
                drawBackground();
                drawContainers();
            }
        };
        
        // Check immediately and after a short delay to ensure class is applied
        setTimeout(checkAndUpdate, 50);
    });
}
if (resetGameButton) {
    resetGameButton.addEventListener('click', () => {
        const wasGameOver = isGameOver;
        resetGame();
        if (!isGameStarted) {
            showStartScreen();
            return;
        }
        if (wasGameOver) {
            requestAnimationFrame(gameLoop);
        }
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

    if (colorlessToggle) {
        isColorlessMode = colorlessToggle.checked;
        colors = getColors();
    }


    showStartScreen();
};
