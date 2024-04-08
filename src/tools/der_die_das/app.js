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
let isGameOver = false;
const moveAmount = 30;

wordLists = {
    'der': [
        'Baum', 'Stuhl', 'Tisch', 'Apfel', 'Berg', 'Wagen', 'Zug', 'Hund', 'Vogel', 'Fluss',
        'Mond', 'Stern', 'Garten', 'Schuh', 'Schlüssel', 'Stift', 'Boden', 'See', 'Wald', 'Himmel',
        'Strom', 'Zweig', 'Vorhang', 'Bürgersteig', 'Hut', 'Löffel', 'Pfirsich', 'Vulkan', 'Ring', 'Teller',
        'Turm', 'Ball', 'Schrank', 'Computer', 'Kuchen'
    ],
    'die': [
        'Frau', 'Katze', 'Blume', 'Tür', 'Nacht', 'Straße', 'Wiese', 'Lampe', 'Uhr', 'Karte',
        'Tasche', 'Brücke', 'Wand', 'Zeitung', 'Wolke', 'Flasche', 'Gabel', 'Schere', 'Kerze', 'Taste',
        'Küche', 'Treppe', 'Decke', 'Brille', 'Giraffe', 'Pflanze', 'Sonne', 'Bank', 'Schrift', 'Farbe',
        'Jacke', 'Maus', 'Tafel', 'Bluse', 'Kamera'
    ],
    'das': [
        'Buch', 'Bild', 'Fenster', 'Haus', 'Bett', 'Kind', 'Spiel', 'Lied', 'Licht', 'Radio',
        'Auto', 'Schiff', 'Pferd', 'Flugzeug', 'Telefon', 'Zimmer', 'Büro', 'Restaurant', 'Theater', 'Fahrrad',
        'Sofa', 'Schloss', 'Hotel', 'Programm', 'Papier', 'Instrument', 'Projekt', 'Frühstück', 'Badezimmer', 'Geschenk',
        'Handy', 'Konto', 'Bücherregal', 'Motorrad', 'Messer'
    ]
}


function loadWords() {
    const fetchWordList = (url, article) =>
        fetch(url)
        .then(response => {
            if (response.ok) {
                return response.text();
            } else {
                throw new Error(`Failed to load ${article} words from server.`);
            }
        })
        .catch(error => {
            console.error(`Error fetching ${article} words: ${error.message}`);
            // Here we do not set any default values, just handle the error.
        });

    return Promise.all([
        fetchWordList('https://adamdjellouli.com/tools/der_die_das/der.txt', 'der'),
        fetchWordList('https://adamdjellouli.com/tools/der_die_das/die.txt', 'die'),
        fetchWordList('https://adamdjellouli.com/tools/der_die_das/das.txt', 'das')
    ]).then(([derWords, dieWords, dasWords]) => {
        // Only update wordLists if the fetch was successful
        if (derWords) wordLists['der'] = derWords.split('\n');
        if (dieWords) wordLists['die'] = dieWords.split('\n');
        if (dasWords) wordLists['das'] = dasWords.split('\n');
    });
}

function resizeCanvas() {
    const styles = window.getComputedStyle(gameCanvas);
    gameCanvas.width = parseInt(styles.width, 10);
    gameCanvas.height = parseInt(styles.height, 10);

    gameWidth = gameCanvas.width;
    gameHeight = gameCanvas.height;

    ctx.font = (gameCanvas.width <= 767) ? '15px Arial' : '20px Arial';
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
        x: Math.max(wordWidth / 2, randomX),
        y: 0,
        width: wordWidth
    };
    lastWordTime = timestamp;
}

function moveWords(deltaTime) {
    if (!currentWord) {
        return;
    }
    currentWord.y += fallingSpeed * deltaTime;
    if (currentWord.y > gameHeight) {
        currentWord = null; // Reset currentWord after it falls off the screen
    }
}

function getHitContainerIndex(wordX) {
    const containerWidth = gameWidth / 3; // Since there are 3 containers
    const containerIndex = Math.floor(wordX / containerWidth);
    return containerIndex >= 0 && containerIndex < 3 ? containerIndex : -1;
}


function checkCollisions() {
    if (!currentWord || currentWord.y <= gameHeight - wordHeight) {
        return;
    }
    highlightContainerIndex = getHitContainerIndex(currentWord.x);

    if (highlightContainerIndex !== -1) {
        highlightStartTime = Date.now();
        const expectedArticle = articles[highlightContainerIndex];

        if (currentWord.article === expectedArticle) {
            score += 1; // Increase score if the article matches
            highlightColor = 'rgba(0, 255, 0, INTENSITY)'
        } else {
            lives -= 1; // Decrease lives if the article doesn't match
            highlightColor = 'rgba(255, 0, 0, INTENSITY)'
            if (lives <= 0) {
                isGameOver = true;
            }
        }
        scoreDisplay.textContent = score;
        livesDisplay.textContent = lives;
    }
    currentWord = null; // Reset currentWord after it falls
}


function updateCanvas() {
    ctx.clearRect(0, 0, gameWidth, gameHeight);
    ctx.fillStyle = getColorForMode('#f0f0f0', 'black');
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    if (currentWord) {
        ctx.fillStyle = getColorForMode('black', 'white');

        ctx.fillText(currentWord.text, currentWord.x, currentWord.y);
    }
    drawContainers();
}

function drawContainers() {
    const containerWidth = gameWidth / 3;
    const containerHeight = 50;
    const labels = ['der', 'die', 'das'];
    const containerColors = [
        getColorForMode('#add8e6', '#191970'), // Light Blue / Midnight Blue
        getColorForMode('#ffdab9', '#6b8e23'), // Peach Puff / Olive Drab
        getColorForMode('#e6e6fa', '#483d8b') // Lavender / Dark Slate Blue
    ];


    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

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
        ctx.fillStyle = getColorForMode('black', 'white');
        ctx.fillText(label, x + containerWidth / 2, y + containerHeight / 2);
    });

    // Reset highlight if duration has passed
    if (Date.now() - highlightStartTime >= highlightDuration) {
        highlightContainerIndex = -1;
    }
}

function gameLoop(timestamp) {
    if (isGameOver) {
        gameOver();
        return;
    }
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


function gameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'; // Semi-transparent black overlay
    ctx.fillRect(0, 0, gameWidth, gameHeight);

    ctx.fillStyle = 'white';
    ctx.font = '36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', gameWidth / 2, gameHeight / 2);
    ctx.font = '24px Arial';
    ctx.fillText('Press R to Restart', gameWidth / 2, gameHeight / 2 + 40);
}


// Initialize game
function initGame() {
    isGameOver = false;
    score = 0;
    lives = 3;
    words = [];
    scoreDisplay.textContent = score;
    livesDisplay.textContent = lives;
    lastWordTime = 0;
    requestAnimationFrame(gameLoop);
}

function moveLeft() { // Ensure the word doesn't move beyond the left boundary
    currentWord.x = Math.max(currentWord.width / 2, currentWord.x - moveAmount);

}

function moveRight() { // Ensure the word doesn't move beyond the right boundary
    currentWord.x = Math.min(gameWidth - currentWord.width / 2, currentWord.x + moveAmount);

}

function handleKeyDown(event) {

    switch (event.key) {
        case 'ArrowLeft':
            moveLeft();
            break;
        case 'ArrowRight':
            moveRight();
            break;
        case 'ArrowUp':
        case 'ArrowDown':
            // Prevent default behavior for arrow up and down keys
            event.preventDefault();
            break;
            // Include other cases here if needed
        case 'r':
        case 'R':
            initGame();
            break;
    }
}

document.getElementById('leftButton').addEventListener('touchstart', function() {
    moveLeft();
});

document.getElementById('rightButton').addEventListener('touchstart', function() {
    moveRight();
});

gameCanvas.addEventListener('touchstart', e => {
    if (isGameOver) {
        resizeCanvas();
        initGame();
    }
});

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('resize', resizeCanvas);

window.onload = function() {
    resizeCanvas();
    loadWords();
    initGame();
};