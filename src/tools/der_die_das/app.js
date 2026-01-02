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
const articles = ['der', 'die', 'das'];
const moveAmount = 35;


let lastTapTime = 0;
const doubleTapDelay = 300;


let particles = [];


let soundEnabled = true;


let isGameOver = false;
let isGameStarted = false;


let containerAnimations = [0, 0, 0];


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
    return {
        bgGradientStart: dark ? '#1a1a2e' : '#667eea',
        bgGradientEnd: dark ? '#16213e' : '#764ba2',
        wordColor: dark ? '#f1f5f9' : '#1f2937',
        wordShadow: dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)',
        containerColors: [
            dark ? '#ef4444' : '#f87171',
            dark ? '#22c55e' : '#4ade80',
            dark ? '#3b82f6' : '#60a5fa'
        ],
        containerHover: [
            dark ? '#dc2626' : '#ef4444',
            dark ? '#16a34a' : '#22c55e',
            dark ? '#2563eb' : '#3b82f6'
        ],
        labelColor: '#ffffff',
        highlightCorrect: dark ? 'rgba(34, 197, 94, 0.9)' : 'rgba(74, 222, 128, 0.95)',
        highlightIncorrect: dark ? 'rgba(239, 68, 68, 0.9)' : 'rgba(248, 113, 113, 0.95)',
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

const fetchWordList = (url, article) => fetch(url).then(response => {
    if (!response.ok) {
        throw new Error(`Failed to load ${article} words from server.`);
    }
    return response.json();
}).catch(error => {
    console.error(`Error fetching ${article} words: ${error.message}`);
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


    Promise.all([
            fetchWordList(wordListFiles.der, 'der'),
            fetchWordList(wordListFiles.die, 'die'),
            fetchWordList(wordListFiles.das, 'das')
        ])
        .then(([derWords, dieWords, dasWords]) => {
            const normalizedDer = normalizeWordList(derWords);
            const normalizedDie = normalizeWordList(dieWords);
            const normalizedDas = normalizeWordList(dasWords);

            if (normalizedDer) wordLists.der = normalizedDer;
            if (normalizedDie) wordLists.die = normalizedDie;
            if (normalizedDas) wordLists.das = normalizedDas;
            console.log('Extended word lists loaded successfully');
        })
        .catch(err => {
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

function measureWordWidth(word) {
    return ctx.measureText(word).width;
}

function generateWord(timestamp) {
    if (currentWord) return;

    const randomArticle = articles[Math.floor(Math.random() * articles.length)];
    const words = getWordsForDifficulty(randomArticle);
    if (!words.length) {
        return;
    }
    const wordText = words[Math.floor(Math.random() * words.length)];
    const wordWidth = measureWordWidth(wordText);
    const maxPositionX = gameWidth - wordWidth - 20;
    const randomX = Math.random() * maxPositionX + wordWidth / 2 + 10;

    currentWord = {
        text: wordText,
        article: randomArticle,
        x: Math.max(wordWidth / 2 + 10, randomX),
        y: -30,
        width: wordWidth,
        opacity: 0,
        scale: 0.5
    };
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
        const correctArticle = currentWord.article;

        totalAttempts++;

        if (userArticle === correctArticle) {

            streak++;
            correctAttempts++;


            const streakBonus = Math.min(streak, 10);
            score += 10 + streakBonus * 2;

            if (streak > maxStreak) maxStreak = streak;

            highlightColor = colors.highlightCorrect;
            addWordToTable(correctWordsTable, currentWord.text, userArticle, correctArticle);

            playCorrectSound();
            createParticles(currentWord.x, currentWord.y, 20, true);

            checkLevelUp();
        } else {

            lives--;
            streak = 0;
            highlightColor = colors.highlightIncorrect;
            addWordToTable(incorrectWordsTable, currentWord.text, userArticle, correctArticle);

            playIncorrectSound();
            createParticles(currentWord.x, currentWord.y, 15, false);

            if (lives <= 0) {
                isGameOver = true;
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
    ctx.fillText('Game Over!', gameWidth / 2, gameHeight / 2 - 80);


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

    if (isGameOver) {
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


    showStartScreen();
};
