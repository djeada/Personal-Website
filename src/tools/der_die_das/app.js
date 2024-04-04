const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const livesDisplay = document.getElementById('lives');
let gameWidth, gameHeight;
let wordHeight = 30;
let score = 0;
let lives = 3;
let fallingSpeed = 0.1;
let lastWordTime = 0;
let lastFrameTime = 0;
const fixedTimeStep = 16;
let currentWord = null;
let highlightContainerIndex = -1;
let highlightDuration = 500;
let highlightStartTime = 0;
const articles = ['der', 'die', 'das'];
let highlightColor;
let wordLists = {
    'der': [],
    'die': [],
    'das': []
};

function loadWords() {
    return Promise.all([
        fetch('der.txt').then(response => response.text()),
        fetch('die.txt').then(response => response.text()),
        fetch('das.txt').then(response => response.text())
    ]).then(([derWords, dieWords, dasWords]) => {
        wordLists['der'] = derWords.split('\n');
        wordLists['die'] = dieWords.split('\n');
        wordLists['das'] = dasWords.split('\n');
    });
}

function resizeCanvas() {
    const styles = window.getComputedStyle(gameCanvas);
    gameCanvas.width = parseInt(styles.width, 10);
    gameCanvas.height = parseInt(styles.height, 10);

    // Update gameWidth and gameHeight after resizing
    gameWidth = gameCanvas.width;
    gameHeight = gameCanvas.height;
}

// Set canvas font
function setCanvasFont() {
    ctx.font = '20px Arial';
    ctx.fillStyle = 'black'; // Text color
}

function measureWordWidth(word) {
    return ctx.measureText(word).width;
}

function generateWord(timestamp) {
    if (currentWord) {
        return;
    }

    const randomArticle = articles[Math.floor(Math.random() * articles.length)];
    const words = wordLists[randomArticle];
    const wordText = words[Math.floor(Math.random() * words.length)]; // Pick a random word

    const wordWidth = measureWordWidth(wordText);
    const maxPositionX = gameWidth - wordWidth;
    const randomX = Math.random() * maxPositionX;

    currentWord = {
        text: wordText,
        article: randomArticle,
        x: randomX,
        y: 0,
        width: wordWidth
    };
    lastWordTime = timestamp;
}

function moveWords(deltaTime) {
    if (currentWord) {
        currentWord.y += fallingSpeed * deltaTime;
        if (currentWord.y > gameHeight) {
            currentWord = null; // Reset currentWord after it falls off the screen
        }
    }
}

function getHitContainerIndex(wordX) {
    const containerWidth = gameWidth / 3; // Since there are 3 containers
    const containerIndex = Math.floor(wordX / containerWidth);
    return containerIndex >= 0 && containerIndex < 3 ? containerIndex : -1;
}


function checkCollisions() {
    if (currentWord && currentWord.y > gameHeight - wordHeight) {
        // Determine which container was hit
        highlightContainerIndex = getHitContainerIndex(currentWord.x);

        if (highlightContainerIndex !== -1) {
            highlightStartTime = Date.now();
            // Assuming articles is a global array like ['der', 'die', 'das']
            // and currentWord has a property 'article' like 'der', 'die', or 'das'
            const expectedArticle = articles[highlightContainerIndex];

            if (currentWord.article === expectedArticle) {
                score += 1; // Increase score if the article matches
                highlightColor = 'rgba(0, 255, 0, INTENSITY)'
            } else {
                lives -= 1; // Decrease lives if the article doesn't match
                highlightColor = 'rgba(255, 0, 0, INTENSITY)'
            }
            scoreDisplay.textContent = score;
            livesDisplay.textContent = lives;
        }

        currentWord = null; // Reset currentWord after it falls
    }
}


function updateCanvas() {
    ctx.clearRect(0, 0, gameWidth, gameHeight);
    if (currentWord) {
        ctx.fillText(currentWord.text, currentWord.x, currentWord.y);
    }
    drawContainers();
}

function drawContainers() {
    const containerWidth = gameWidth / 3;
    const containerHeight = 50; // Adjust as needed
    const labels = ['der', 'die', 'das'];
    const containerColors = ['lightblue', 'lightgreen', 'lightcoral']; // Different colors for each container

    ctx.textAlign = 'center'; // Center align text
    ctx.textBaseline = 'middle'; // Align text in the middle vertically
    ctx.font = '18px Arial'; // Font for container label

    labels.forEach((label, index) => {
        const x = index * containerWidth;
        const y = gameHeight - containerHeight;
        let highlightWidth = containerWidth;
        let highlightHeight = containerHeight;
        let highlightX = x;
        let highlightY = y;

        // Check if this container should be highlighted
        if (index === highlightContainerIndex) {
            const elapsed = Date.now() - highlightStartTime;
            if (elapsed < highlightDuration) {
                highlightIntensity = 0.5 * (1 + Math.sin(2 * Math.PI * elapsed / highlightDuration));
                increaseBy = 3 * highlightIntensity; // Adjust size increase

                highlightWidth = containerWidth + increaseBy * 2;
                highlightHeight = containerHeight + increaseBy;
                highlightX = x - increaseBy;
                highlightY = y - increaseBy / 2;

                ctx.fillStyle = highlightColor.replace('INTENSITY', highlightIntensity); // Color intensity changes with highlight
                ctx.fillRect(highlightX, highlightY, highlightWidth, highlightHeight);
            } else {
                highlightContainerIndex = -1; // Reset highlight
            }
        } else {
            // Draw container with normal settings
            ctx.fillStyle = containerColors[index]; // Set container color
            ctx.fillRect(x, y, containerWidth, containerHeight);

            // Draw container border
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, containerWidth, containerHeight);
        }

        // Draw label
        ctx.fillStyle = 'black'; // Text color
        ctx.fillText(label, x + containerWidth / 2, y + containerHeight / 2);
    });

    // Reset highlight if duration has passed
    if (Date.now() - highlightStartTime >= highlightDuration) {
        highlightContainerIndex = -1;
    }
}

function gameLoop(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    while (timestamp - lastFrameTime > fixedTimeStep) {
        moveWords(fixedTimeStep);
        lastFrameTime += fixedTimeStep;
    }

    generateWord(timestamp); // Generate a new word if needed
    checkCollisions();
    updateCanvas();
    requestAnimationFrame(gameLoop);
}


// Game over
function gameOver() {
    cancelAnimationFrame(gameLoop);
    // Additional game over logic here
}

// Initialize game
function initGame() {
    score = 0;
    lives = 3;
    words = [];
    scoreDisplay.textContent = score;
    livesDisplay.textContent = lives;
    lastWordTime = 0;
    requestAnimationFrame(gameLoop);
}


function handleKeyDown(event) {
    const moveAmount = 30;
    if (!currentWord) return;

    switch (event.key) {
        case 'ArrowLeft':
            // Ensure the word doesn't move beyond the left boundary
            currentWord.x = Math.max(currentWord.width / 2, currentWord.x - moveAmount);
            break;
        case 'ArrowRight':
            // Ensure the word doesn't move beyond the right boundary
            currentWord.x = Math.min(gameWidth - currentWord.width / 2, currentWord.x + moveAmount);
            break;
        case 'ArrowUp':
        case 'ArrowDown':
            // Prevent default behavior for arrow up and down keys
            event.preventDefault();
            break;
            // Include other cases here if needed
    }
}

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('resize', resizeCanvas);

window.onload = function() {
    resizeCanvas();
    setCanvasFont();
    initGame();
};