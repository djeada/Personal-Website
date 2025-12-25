// ===== Der Die Das Game - Immersive Redesign =====

// Polyfill for roundRect (needed before any drawing code)
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
        if (typeof radius === 'number') {
            radius = {tl: radius, tr: radius, br: radius, bl: radius};
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

// DOM Elements
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

// Configuration constants
const MAX_TABLE_ROWS = 10;
const MAX_SPEED_CAP = 2.5; // Maximum falling speed multiplier

// Game State
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

// Difficulty settings
const difficulties = {
    easy: { baseSpeed: 0.00006, speedIncrement: 0.000005 },
    medium: { baseSpeed: 0.00009, speedIncrement: 0.00001 },
    hard: { baseSpeed: 0.00012, speedIncrement: 0.000015 }
};
let currentDifficulty = 'easy';
let baseSpeed = difficulties.easy.baseSpeed;
let speedIncrement = difficulties.easy.speedIncrement;

let fallingSpeed = 0.5;
let fastDropSpeed = 5; // Speed multiplier for fast drop
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

// Mobile double-tap detection
let lastTapTime = 0;
const doubleTapDelay = 300; // milliseconds

// Particles system
let particles = [];

// Sound state
let soundEnabled = true;

// Game states
let isGameOver = false;
let isGameStarted = false;

// Animation state
let containerAnimations = [0, 0, 0];

// Cookie helper
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Color scheme based on mode
function isDarkMode() {
    const darkModeValue = getCookie("darkMode");
    return darkModeValue && darkModeValue.toLowerCase() === "true";
}

// Dynamic colors
function getColors() {
    const dark = isDarkMode();
    return {
        bgGradientStart: dark ? '#1a1a2e' : '#667eea',
        bgGradientEnd: dark ? '#16213e' : '#764ba2',
        wordColor: dark ? '#f1f5f9' : '#1f2937',
        wordShadow: dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)',
        containerColors: [
            dark ? '#ef4444' : '#f87171', // der - red
            dark ? '#22c55e' : '#4ade80', // die - green  
            dark ? '#3b82f6' : '#60a5fa'  // das - blue
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
        particleColors: dark 
            ? ['#fbbf24', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7']
            : ['#fbbf24', '#f59e0b', '#10b981', '#6366f1', '#8b5cf6']
    };
}

let colors = getColors();
let highlightColor = colors.highlightCorrect;

// Word lists (fallback)
const wordLists = {
    'der': ['Baum', 'Stuhl', 'Tisch', 'Apfel', 'Berg', 'Wagen', 'Zug', 'Hund', 'Vogel', 'Fluss', 'Mond', 'Stern', 'Garten', 'Schuh', 'Schlüssel', 'Stift', 'Boden', 'See', 'Wald', 'Himmel', 'Strom', 'Zweig', 'Vorhang', 'Bürgersteig', 'Hut', 'Löffel', 'Pfirsich', 'Vulkan', 'Ring', 'Teller', 'Turm', 'Ball', 'Schrank', 'Computer', 'Kuchen'],
    'die': ['Frau', 'Katze', 'Blume', 'Tür', 'Nacht', 'Straße', 'Wiese', 'Lampe', 'Uhr', 'Karte', 'Tasche', 'Brücke', 'Wand', 'Zeitung', 'Wolke', 'Flasche', 'Gabel', 'Schere', 'Kerze', 'Taste', 'Küche', 'Treppe', 'Decke', 'Brille', 'Giraffe', 'Pflanze', 'Sonne', 'Bank', 'Schrift', 'Farbe', 'Jacke', 'Maus', 'Tafel', 'Bluse', 'Kamera'],
    'das': ['Buch', 'Bild', 'Fenster', 'Haus', 'Bett', 'Kind', 'Spiel', 'Lied', 'Licht', 'Radio', 'Auto', 'Schiff', 'Pferd', 'Flugzeug', 'Telefon', 'Zimmer', 'Büro', 'Restaurant', 'Theater', 'Fahrrad', 'Sofa', 'Schloss', 'Hotel', 'Programm', 'Papier', 'Instrument', 'Projekt', 'Frühstück', 'Badezimmer', 'Geschenk', 'Handy', 'Konto', 'Bücherregal', 'Motorrad', 'Messer']
};

// Proxy for loading words
const proxyUrl = 'https://api.allorigins.win/get?url=';

const fetchWordList = (url, article) => fetch(proxyUrl + encodeURIComponent(url)).then(response => {
    if (response.ok) {
        return response.json();
    } else {
        throw new Error(`Failed to load ${article} words from server.`);
    }
}).then(data => data.contents).catch(error => {
    console.error(`Error fetching ${article} words: ${error.message}`);
});

function loadWords() {
    // Load words in background without showing spinner
    // The game will use the pre-cached wordLists until loading completes
    Promise.all([
        fetchWordList('https://adamdjellouli.com/tools/der_die_das/der.txt', 'der'),
        fetchWordList('https://adamdjellouli.com/tools/der_die_das/die.txt', 'die'),
        fetchWordList('https://adamdjellouli.com/tools/der_die_das/das.txt', 'das')
    ])
    .then(([derWords, dieWords, dasWords]) => {
        if (derWords) wordLists['der'] = derWords.split('\n').filter(w => w.trim());
        if (dieWords) wordLists['die'] = dieWords.split('\n').filter(w => w.trim());
        if (dasWords) wordLists['das'] = dasWords.split('\n').filter(w => w.trim());
        console.log('Extended word lists loaded successfully');
    })
    .catch(err => {
        console.log('Using pre-cached word lists:', err.message);
    });
}

// Particle class
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
    const particleColors = isSuccess 
        ? ['#22c55e', '#4ade80', '#86efac', '#fbbf24']
        : ['#ef4444', '#f87171', '#fca5a5'];
    
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

// Sound effects (using Web Audio API for simple tones)
const audioContext = typeof AudioContext !== 'undefined' ? new AudioContext() : null;

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
        // Silently fail if audio doesn't work
    }
}

function playCorrectSound() {
    playSound(523.25, 0.1); // C5
    setTimeout(() => playSound(659.25, 0.1), 100); // E5
    setTimeout(() => playSound(783.99, 0.15), 200); // G5
}

function playIncorrectSound() {
    playSound(200, 0.3, 'square');
}

function playLevelUpSound() {
    playSound(523.25, 0.1);
    setTimeout(() => playSound(659.25, 0.1), 80);
    setTimeout(() => playSound(783.99, 0.1), 160);
    setTimeout(() => playSound(1046.50, 0.2), 240);
}

function playGameOverSound() {
    playSound(392, 0.2, 'square');
    setTimeout(() => playSound(349.23, 0.2, 'square'), 200);
    setTimeout(() => playSound(329.63, 0.3, 'square'), 400);
}

// Canvas setup
function resizeCanvas() {
    const parent = gameCanvas.parentNode;
    const width = parent.clientWidth;
    const height = parent.clientHeight;

    gameCanvas.width = width;
    gameCanvas.height = height;

    gameWidth = gameCanvas.width;
    gameHeight = gameCanvas.height;

    fallingSpeed = baseSpeed * gameHeight;
    
    let fontSize = gameCanvas.width <= 500 ? 20 : 28;
    ctx.font = `bold ${fontSize}px 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
    
    colors = getColors();
}

function measureWordWidth(word) {
    return ctx.measureText(word).width;
}

function generateWord(timestamp) {
    if (currentWord) return;
    
    const randomArticle = articles[Math.floor(Math.random() * articles.length)];
    const words = wordLists[randomArticle];
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
    
    // Animate word appearance
    if (currentWord.opacity < 1) {
        currentWord.opacity = Math.min(1, currentWord.opacity + 0.05);
    }
    if (currentWord.scale < 1) {
        currentWord.scale = Math.min(1, currentWord.scale + 0.03);
    }
    
    // Apply fast drop speed if active
    const currentSpeed = isFastDropping ? fallingSpeed * fastDropSpeed : fallingSpeed;
    currentWord.y += currentSpeed * deltaTime;
    
    if (currentWord.y > gameHeight + 50) {
        // Word missed - count as incorrect
        totalAttempts++;
        lives--;
        streak = 0;
        isFastDropping = false; // Reset fast drop
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
    
    // Insert at the beginning for newest first
    if (tbody.firstChild) {
        tbody.insertBefore(row, tbody.firstChild);
    } else {
        tbody.appendChild(row);
    }
    
    // Limit table rows to prevent excessive DOM nodes
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
    
    // Animate streak badge
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
        
        // Increase speed with cap
        const newSpeed = fallingSpeed + speedIncrement * gameHeight;
        const maxSpeed = baseSpeed * gameHeight * MAX_SPEED_CAP;
        fallingSpeed = Math.min(newSpeed, maxSpeed);
        
        playLevelUpSound();
        updateStats();
        
        // Create celebration particles
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
    
    const containerHeight = 60;
    const hitY = gameHeight - containerHeight;
    
    if (currentWord.y < hitY) return;

    highlightContainerIndex = getHitContainerIndex(currentWord.x);

    if (highlightContainerIndex !== -1) {
        highlightStartTime = Date.now();
        const userArticle = articles[highlightContainerIndex];
        const correctArticle = currentWord.article;
        
        totalAttempts++;

        if (userArticle === correctArticle) {
            // Correct!
            streak++;
            correctAttempts++;
            
            // Score with streak bonus
            const streakBonus = Math.min(streak, 10);
            score += 10 + streakBonus * 2;
            
            if (streak > maxStreak) maxStreak = streak;
            
            highlightColor = colors.highlightCorrect;
            addWordToTable(correctWordsTable, currentWord.text, userArticle, correctArticle);
            
            playCorrectSound();
            createParticles(currentWord.x, currentWord.y, 20, true);
            
            checkLevelUp();
        } else {
            // Incorrect
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
    
    isFastDropping = false; // Reset fast drop after collision
    currentWord = null;
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, gameHeight);
    gradient.addColorStop(0, colors.bgGradientStart);
    gradient.addColorStop(1, colors.bgGradientEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    
    // Subtle pattern overlay
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
    
    // Apply animations
    ctx.globalAlpha = currentWord.opacity;
    ctx.translate(currentWord.x, currentWord.y);
    ctx.scale(currentWord.scale, currentWord.scale);
    ctx.translate(-currentWord.x, -currentWord.y);
    
    // Word shadow
    ctx.shadowColor = colors.wordShadow;
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    
    // Word background pill
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
    
    // Reset shadow for text
    ctx.shadowColor = 'transparent';
    
    // Draw text
    ctx.fillStyle = '#1f2937';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(currentWord.text, currentWord.x, currentWord.y);
    
    ctx.restore();
}

function drawContainers() {
    const containerWidth = gameWidth / 3;
    const containerHeight = 60;
    const labels = ['der', 'die', 'das'];
    const containerY = gameHeight - containerHeight;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    labels.forEach((label, index) => {
        const x = index * containerWidth;
        const padding = 8;
        
        // Update container animation
        if (containerAnimations[index] > 0) {
            containerAnimations[index] -= 0.05;
        }
        
        // Determine fill color
        let fillColor = colors.containerColors[index];
        if (index === highlightContainerIndex) {
            const elapsedTime = Date.now() - highlightStartTime;
            if (elapsedTime < highlightDuration) {
                fillColor = highlightColor;
            } else {
                highlightContainerIndex = -1;
            }
        }

        // Draw container with animation
        ctx.save();
        
        const animScale = 1 + containerAnimations[index] * 0.05;
        const centerX = x + containerWidth / 2;
        const centerY = containerY + containerHeight / 2;
        
        ctx.translate(centerX, centerY);
        ctx.scale(animScale, animScale);
        ctx.translate(-centerX, -centerY);
        
        // Container shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 5;

        // Draw rounded container
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
        
        // Reset shadow
        ctx.shadowColor = 'transparent';

        // Draw label
        ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = colors.labelColor;
        ctx.fillText(label, centerX, centerY);
        
        ctx.restore();
    });
}

function drawGameOver() {
    // Overlay
    ctx.fillStyle = colors.gameOverBg;
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    
    // Game Over text
    ctx.fillStyle = colors.gameOverText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.font = 'bold 48px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Game Over!', gameWidth / 2, gameHeight / 2 - 80);
    
    // Stats
    ctx.font = '24px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`Final Score: ${score}`, gameWidth / 2, gameHeight / 2 - 20);
    ctx.fillText(`Level: ${level}`, gameWidth / 2, gameHeight / 2 + 20);
    ctx.fillText(`Best Streak: ${maxStreak}`, gameWidth / 2, gameHeight / 2 + 60);
    
    const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 100;
    ctx.fillText(`Accuracy: ${accuracy}%`, gameWidth / 2, gameHeight / 2 + 100);
    
    // Restart instruction
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
    
    // Reset speed based on difficulty
    baseSpeed = difficulties[currentDifficulty].baseSpeed;
    speedIncrement = difficulties[currentDifficulty].speedIncrement;
    fallingSpeed = baseSpeed * gameHeight;
    
    // Clear tables
    correctWordsTable.querySelector('tbody').innerHTML = '';
    incorrectWordsTable.querySelector('tbody').innerHTML = '';
    
    updateStats();
}

function startGame() {
    startScreen.style.display = 'none';
    isGameStarted = true;
    resetGame();
    
    // Resume audio context if suspended
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    requestAnimationFrame(gameLoop);
}

function showStartScreen() {
    startScreen.style.display = 'flex';
    isGameStarted = false;
}

// Movement controls
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

// Event Handlers
function handleKeyDown(event) {
    if (!isGameStarted) {
        if (event.key === 'Enter' || event.key === ' ') {
            startGame();
        }
        return;
    }
    
    switch (event.key) {
        case 'ArrowLeft':
            moveLeft();
            break;
        case 'ArrowRight':
            moveRight();
            break;
        case ' ': // Space key for fast drop
            event.preventDefault();
            if (currentWord && !isGameOver) {
                isFastDropping = true;
            }
            break;
        case 'ArrowUp':
        case 'ArrowDown':
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

// Setup event listeners
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
    
    // Double-tap detection for fast drop
    const currentTime = Date.now();
    if (currentTime - lastTapTime < doubleTapDelay) {
        // Double tap detected
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

// Initialize
window.onload = function() {
    resizeCanvas();
    
    // Draw initial state
    drawBackground();
    drawContainers();
    
    // Load words in background (no spinner, no waiting)
    loadWords();
    
    // Show start screen immediately
    showStartScreen();
};