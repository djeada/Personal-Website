const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const livesDisplay = document.getElementById('lives');
const correctWordsTable = document.getElementById('correctWordsTable');
const incorrectWordsTable = document.getElementById('incorrectWordsTable');
let gameWidth, gameHeight;
let wordHeight = 30;
let score = 0;
let lives = 3;
let fallingSpeed = 0.5;
let lastWordTime = 0;
let lastFrameTime = 0;
const fixedTimeStep = 16;
let currentWord = null;
let highlightContainerIndex = -1;
let highlightDuration = 500;
let highlightStartTime = 0;
const articles = ['der', 'die', 'das'];

function getColorForMode(colorLight, colorDark) {
    const darkModeValue = getCookie("darkMode");
    return darkModeValue && darkModeValue.toLowerCase() === "true" ? colorDark : colorLight;
}

// Define color variables based on mode
const backgroundColorStart = getColorForMode('#a1c4fd', '#1e1e1e'); // Light blue vs. Dark gray
const backgroundColorEnd = getColorForMode('#c2e9fb', '#121212'); // Light cyan vs. Darker gray
const wordColor = getColorForMode('#333', '#ddd'); // Dark text vs. Light text
const containerColors = [
    getColorForMode('#ff9999', '#b56565'), // Softer red for dark mode
    getColorForMode('#99ff99', '#65b565'), // Softer green for dark mode
    getColorForMode('#9999ff', '#6565b5') // Softer blue for dark mode
];
const labelColor = getColorForMode('#000', '#e0e0e0');
const containerStrokeColor = getColorForMode('#fff', '#ccc'); // White vs. Light gray
const highlightColorCorrect = getColorForMode('rgba(0, 255, 0, 1)', 'rgba(0, 200, 0, 1)'); // Green vs. Darker green
const highlightColorIncorrect = getColorForMode('rgba(255, 0, 0, 1)', 'rgba(200, 0, 0, 1)'); // Red vs. Darker red
const gameOverBackground = getColorForMode('rgba(0, 0, 0, 0.75)', 'rgba(255, 255, 255, 0.75)');
const gameOverTextColor = getColorForMode('white', 'black');
const gameOverSubTextColor = getColorForMode('white', 'black');

let highlightColor = highlightColorCorrect; // Initialize with correct highlight color
let isGameOver = false;
const moveAmount = 30;
const wordLists = {
    'der': ['Baum', 'Stuhl', 'Tisch', 'Apfel', 'Berg', 'Wagen', 'Zug', 'Hund', 'Vogel', 'Fluss', 'Mond', 'Stern', 'Garten', 'Schuh', 'Schlüssel', 'Stift', 'Boden', 'See', 'Wald', 'Himmel', 'Strom', 'Zweig', 'Vorhang', 'Bürgersteig', 'Hut', 'Löffel', 'Pfirsich', 'Vulkan', 'Ring', 'Teller', 'Turm', 'Ball', 'Schrank', 'Computer', 'Kuchen'],
    'die': ['Frau', 'Katze', 'Blume', 'Tür', 'Nacht', 'Straße', 'Wiese', 'Lampe', 'Uhr', 'Karte', 'Tasche', 'Brücke', 'Wand', 'Zeitung', 'Wolke', 'Flasche', 'Gabel', 'Schere', 'Kerze', 'Taste', 'Küche', 'Treppe', 'Decke', 'Brille', 'Giraffe', 'Pflanze', 'Sonne', 'Bank', 'Schrift', 'Farbe', 'Jacke', 'Maus', 'Tafel', 'Bluse', 'Kamera'],
    'das': ['Buch', 'Bild', 'Fenster', 'Haus', 'Bett', 'Kind', 'Spiel', 'Lied', 'Licht', 'Radio', 'Auto', 'Schiff', 'Pferd', 'Flugzeug', 'Telefon', 'Zimmer', 'Büro', 'Restaurant', 'Theater', 'Fahrrad', 'Sofa', 'Schloss', 'Hotel', 'Programm', 'Papier', 'Instrument', 'Projekt', 'Frühstück', 'Badezimmer', 'Geschenk', 'Handy', 'Konto', 'Bücherregal', 'Motorrad', 'Messer']
};
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
    // Show loading spinner while loading the word lists
    const loadingSpinner = document.getElementById('loadingSpinner');
    loadingSpinner.style.display = 'block';

    return Promise.all([
        fetchWordList('https://adamdjellouli.com/tools/der_die_das/der.txt', 'der'),
        fetchWordList('https://adamdjellouli.com/tools/der_die_das/die.txt', 'die'),
        fetchWordList('https://adamdjellouli.com/tools/der_die_das/das.txt', 'das')
    ]).then(([derWords, dieWords, dasWords]) => {
        if (derWords) wordLists['der'] = derWords.split('\n');
        if (dieWords) wordLists['die'] = dieWords.split('\n');
        if (dasWords) wordLists['das'] = dasWords.split('\n');
    }).finally(() => {
        // Hide the loading spinner after loading is complete
        loadingSpinner.style.display = 'none';
    });
}

let baseSpeed = 0.0001;

function resizeCanvas() {
    const parent = gameCanvas.parentNode;
    const width = parent.clientWidth;
    const height = parent.clientHeight;

    gameCanvas.width = width;
    gameCanvas.height = height;

    gameWidth = gameCanvas.width;
    gameHeight = gameCanvas.height;

    fallingSpeed = baseSpeed * gameHeight;
    console.log(fallingSpeed)
    let fontSize = gameCanvas.width <= 767 ? 18 : 24;
    ctx.font = `${fontSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
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
    const wordText = words[Math.floor(Math.random() * words.length)];
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
    // Use fallingSpeed adjusted for canvas size
    currentWord.y += fallingSpeed * deltaTime;
    if (currentWord.y > gameHeight) {
        currentWord = null; // Reset currentWord after it falls off the screen
    }
}

function getHitContainerIndex(wordX) {
    const containerWidth = gameWidth / 3;
    const containerIndex = Math.floor(wordX / containerWidth);
    return containerIndex >= 0 && containerIndex < 3 ? containerIndex : -1;
}

function addWordToTable(table, wordText, userArticle, correctArticle) {
    const row = table.insertRow();
    const wordCell = row.insertCell(0);
    const userArticleCell = row.insertCell(1);
    const correctArticleCell = row.insertCell(2);
    wordCell.textContent = wordText;
    userArticleCell.textContent = userArticle;
    correctArticleCell.textContent = correctArticle;
}

function checkCollisions() {
    if (!currentWord || currentWord.y <= gameHeight - wordHeight) {
        return;
    }

    highlightContainerIndex = getHitContainerIndex(currentWord.x);

    if (highlightContainerIndex !== -1) {
        highlightStartTime = Date.now();
        const userArticle = articles[highlightContainerIndex];
        const correctArticle = currentWord.article;

        if (userArticle === correctArticle) {
            score += 1;
            highlightColor = highlightColorCorrect; // Use dynamic color
            addWordToTable(correctWordsTable, currentWord.text, userArticle, correctArticle);
        } else {
            lives -= 1;
            highlightColor = highlightColorIncorrect; // Use dynamic color
            addWordToTable(incorrectWordsTable, currentWord.text, userArticle, correctArticle);
            if (lives <= 0) {
                isGameOver = true;
            }
        }
        scoreDisplay.textContent = score;
        livesDisplay.textContent = lives;
    }
    currentWord = null;
}

function updateCanvas() {
    ctx.clearRect(0, 0, gameWidth, gameHeight);

    // Create a gradient background based on mode
    let gradient = ctx.createLinearGradient(0, 0, 0, gameHeight);
    gradient.addColorStop(0, backgroundColorStart);
    gradient.addColorStop(1, backgroundColorEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, gameWidth, gameHeight);

    if (currentWord) {
        ctx.fillStyle = wordColor; // Use dynamic word color
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillText(currentWord.text, currentWord.x, currentWord.y);
        ctx.shadowColor = 'transparent'; // Reset shadow
    }

    drawContainers();
}

function drawContainers() {
    const containerWidth = gameWidth / 3;
    const containerHeight = 50;
    const labels = ['der', 'die', 'das'];

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    labels.forEach((label, index) => {
        const x = index * containerWidth;
        const y = gameHeight - containerHeight;

        // Set shadow for containers (optional for aesthetic improvement)
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 5;

        // Determine fill color based on mode and highlight state
        let fillColor = containerColors[index];
        if (index === highlightContainerIndex) {
            const elapsedTime = Date.now() - highlightStartTime;
            if (elapsedTime < highlightDuration) {
                fillColor = highlightColor;
            } else {
                highlightContainerIndex = -1;
            }
        }

        // Draw rounded rectangle with dynamic fill color (no stroke)
        ctx.fillStyle = fillColor;
        roundRect(ctx, x + 10, y + 10, containerWidth - 20, containerHeight - 20, 10, true, false); // Only fill, no stroke

        // Remove shadow for text to ensure clarity
        ctx.shadowColor = 'transparent';

        // Draw label with dynamic color
        ctx.fillStyle = labelColor;
        ctx.fillText(label, x + containerWidth / 2, y + containerHeight / 2);
    });
}



// Helper function to draw rounded rectangles
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof stroke === 'undefined') {
        stroke = true;
    }
    if (typeof radius === 'undefined') {
        radius = 5;
    }
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) {
        ctx.fill();
    }
    if (stroke) {
        ctx.stroke();
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
    generateWord(timestamp);
    checkCollisions();
    updateCanvas();
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    ctx.fillStyle = gameOverBackground; // Dynamic background
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    ctx.fillStyle = gameOverTextColor; // Dynamic text color
    ctx.font = '36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', gameWidth / 2, gameHeight / 2);
    ctx.font = '24px Arial';
    ctx.fillStyle = gameOverSubTextColor; // Dynamic subtext color
    ctx.fillText('Press R to Restart', gameWidth / 2, gameHeight / 2 + 40);
}

function initGame() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    loadingSpinner.style.display = 'block'; // Show spinner during initialization

    isGameOver = false;
    score = 0;
    lives = 3;
    currentWord = null;
    scoreDisplay.textContent = score;
    livesDisplay.textContent = lives;
    lastWordTime = 0;
    correctWordsTable.innerHTML = '';
    incorrectWordsTable.innerHTML = '';

    // Run the first frame after loading is done
    requestAnimationFrame(() => {
        loadingSpinner.style.display = 'none'; // Hide spinner when initialization is complete
        gameLoop();
    });
}


function moveLeft() {
    if (currentWord) {
        currentWord.x = Math.max(currentWord.width / 2, currentWord.x - moveAmount);
    }
}

function moveRight() {
    if (currentWord) {
        currentWord.x = Math.min(gameWidth - currentWord.width / 2, currentWord.x + moveAmount);
    }
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
            event.preventDefault();
            break;
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
    const loadingSpinner = document.getElementById('loadingSpinner');
    loadingSpinner.style.display = 'block';

    resizeCanvas();
    loadWords().then(() => {
        initGame();
    }).finally(() => {
        loadingSpinner.style.display = 'none';
    });
    initGame();

    // Update DOM element styles based on mode
    const darkMode = getColorForMode(false, true); // Assuming false for light, true for dark
    if (darkMode) {
        scoreDisplay.style.color = '#ddd';
        livesDisplay.style.color = '#ddd';
        correctWordsTable.style.backgroundColor = '#333';
        incorrectWordsTable.style.backgroundColor = '#333';
        correctWordsTable.style.color = '#fff';
        incorrectWordsTable.style.color = '#fff';
    } else {
        scoreDisplay.style.color = '#333';
        livesDisplay.style.color = '#333';
        correctWordsTable.style.backgroundColor = '#fff';
        incorrectWordsTable.style.backgroundColor = '#fff';
        correctWordsTable.style.color = '#000';
        incorrectWordsTable.style.color = '#000';
    }
};