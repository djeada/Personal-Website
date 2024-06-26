// Canvas Setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const gridSize = 20;
const cellSize = canvas.width / gridSize;
let isPaused = false;
let lastTapTime = 0;


// Enum for cell states
const CellState = {
    EMPTY: 'empty',
    SNAKE: 'snake',
    FOOD: 'food'
};

// Grid
const grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(CellState.EMPTY));

// Snake
const snake = {
    body: [{
        x: Math.floor(gridSize / 2),
        y: Math.floor(gridSize / 2)
    }],
    direction: {
        x: 1,
        y: 0
    }
};

// Food
let food = {
    x: Math.floor(Math.random() * gridSize),
    y: Math.floor(Math.random() * gridSize)
};

function isCellOnSnake(x, y) {
    return snake.body.some(segment => segment.x === x && segment.y === y);
}

function placeFood() {
    let foodPlaced = false;
    while (!foodPlaced) {
        food.x = Math.floor(Math.random() * gridSize);
        food.y = Math.floor(Math.random() * gridSize);
        if (!isCellOnSnake(food.x, food.y)) {
            foodPlaced = true;
        }
    }
}

// Game State
let gameOver = false;
let score = 0;

// Render Function
function render() {
    // Clear the grid
    grid.forEach(row => row.fill(CellState.EMPTY));

    // Render snake
    snake.body.forEach((segment, index) => {
        grid[segment.y][segment.x] = CellState.SNAKE;

        // Differentiate between the head and the body of the snake
        if (index === 0) { // Head of the snake
            ctx.fillStyle = 'darkgreen';
            // Draw head
            ctx.fillRect(segment.x * cellSize, segment.y * cellSize, cellSize, cellSize);
            // Draw an eye (white dot)
            const eyeSize = cellSize / 6;
            const eyeX = segment.x * cellSize + 3 * cellSize / 4 - eyeSize / 2;
            const eyeY = segment.y * cellSize + cellSize / 4;
            ctx.fillStyle = 'white';
            ctx.fillRect(eyeX, eyeY, eyeSize, eyeSize);
        } else {
            ctx.fillStyle = 'green'; // Body of the snake
            ctx.fillRect(segment.x * cellSize, segment.y * cellSize, cellSize, cellSize);
        }
    });

    // Render food
    if (grid[food.y][food.x] !== CellState.SNAKE) {
        grid[food.y][food.x] = CellState.FOOD;
        ctx.fillStyle = 'red';
        ctx.fillRect(food.x * cellSize, food.y * cellSize, cellSize, cellSize);
    }

    // Draw on canvas
    grid.forEach((row, y) => {
        row.forEach((cell, x) => {
            if (cell === CellState.EMPTY) {
                ctx.fillStyle = getColorForMode('white', 'black');
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        });
    });

    // Display Score
    ctx.fillStyle = getColorForMode('black', 'white');
    ctx.font = '20px Arial';
    ctx.fillText(`Score: ${score}`, 30, 30);
}

// Function to render pause overlay
function renderPauseOverlay() {
    if (gameOver) {
        return;
    }

    ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = getColorForMode('black', 'white');
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Double tap to unlock', canvas.width / 2, canvas.height / 2);

}

function renderGameOver() {
    enableScrolling()
    ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = getColorForMode('black', 'white');
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
}

// Game Loop
function gameLoop() {
    if (gameOver || isPaused) {
        return;
    }



    // Move snake
    let head = {
        ...snake.body[0],
        x: snake.body[0].x + snake.direction.x,
        y: snake.body[0].y + snake.direction.y
    };
    snake.body.unshift(head);

    // Check for game over
    if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize ||
        snake.body.slice(1).some(segment => segment.x === head.x && segment.y === head.y)) {
        gameOver = true;
        renderGameOver();
        return;
    }
    // Check for collision with food
    if (head.x === food.x && head.y === food.y) {
        score++;
        placeFood();
    } else {
        snake.body.pop(); // Remove tail segment
    }


    render();
}

// Input Handling
window.addEventListener('keydown', e => {
    const newDirection = {
        ArrowUp: {
            x: 0,
            y: -1
        },
        ArrowDown: {
            x: 0,
            y: 1
        },
        ArrowLeft: {
            x: -1,
            y: 0
        },
        ArrowRight: {
            x: 1,
            y: 0
        }
    } [e.key];

    if (newDirection) {
        const oppositeDirection = snake.direction.x === -newDirection.x && snake.direction.y === -newDirection.y;
        if (!oppositeDirection) {
            snake.direction = newDirection;
        }
        e.preventDefault();
    } else if (e.key === 'Escape' && gameOver) {
        // Restart game
        window.location.reload();
    } else if (e.key === ' ') {
        isPaused = !isPaused; // Toggle pause
        if (isPaused) {
            renderPauseOverlay();
        }
        e.preventDefault();
    }
});


// Touch Input for Mobile
let touchStartPos = null;
canvas.addEventListener('touchstart', e => {
    touchStartPos = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
    };
    e.preventDefault();
});

canvas.addEventListener('touchmove', e => {
    if (!touchStartPos) {
        return;
    }
    const dx = e.touches[0].clientX - touchStartPos.x;
    const dy = e.touches[0].clientY - touchStartPos.y;

    // Inside the touchmove event listener
    if (Math.abs(dx) > Math.abs(dy)) {
        const newDirection = dx > 0 ? {
            x: 1,
            y: 0
        } : {
            x: -1,
            y: 0
        };
        const oppositeDirection = snake.direction.x === -newDirection.x && snake.direction.y === -newDirection.y;
        if (!oppositeDirection) {
            snake.direction = newDirection;
        }
    } else {
        const newDirection = dy > 0 ? {
            x: 0,
            y: 1
        } : {
            x: 0,
            y: -1
        };
        const oppositeDirection = snake.direction.x === -newDirection.x && snake.direction.y === -newDirection.y;
        if (!oppositeDirection) {
            snake.direction = newDirection;
        }
    }

    touchStartPos = null;
    e.preventDefault();
});

canvas.addEventListener('touchstart', function(e) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;

    if (tapLength < 300 && tapLength > 0) {
        if (gameOver) {
            window.location.reload();
            return;
        }

        isPaused = !isPaused; // Toggle pause state

        // Check if the game is paused or unpaused
        if (isPaused) {
            renderPauseOverlay(); // Render pause overlay if paused
        } else {
            // Clear the overlay if unpaused
            render();
        }

        e.preventDefault();
        return;
    }


    // Not a double tap, process as a single tap
    // Your existing touch handling code goes here
    touchStartPos = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
    };

    // Update the lastTapTime for the next tap
    lastTapTime = currentTime;
});


// Function to prevent default behavior
function preventDefaultTouch(e) {
    e.preventDefault();
}

// Disable scrolling on the entire document
function disableScrolling() {
    document.addEventListener('touchstart', preventDefaultTouch, {
        passive: false
    });
    document.addEventListener('touchmove', preventDefaultTouch, {
        passive: false
    });
    document.body.classList.add('no-scroll');
}

// Enable scrolling again
function enableScrolling() {
    document.removeEventListener('touchstart', preventDefaultTouch);
    document.removeEventListener('touchmove', preventDefaultTouch);
    document.body.classList.remove('no-scroll');
}

function centerScreenOnCanvas() {
    // Calculate the position to scroll to
    const canvasX = canvas.offsetLeft;
    const canvasY = canvas.offsetTop;
    const canvasWidth = canvas.offsetWidth;
    const canvasHeight = canvas.offsetHeight;

    const centerX = canvasX + canvasWidth / 2 - window.innerWidth / 2;
    const centerY = canvasY + canvasHeight / 2 - window.innerHeight / 2;

    // Scroll to the calculated position
    window.scrollTo(centerX, centerY);
}


// Start Game
setInterval(gameLoop, 200);
disableScrolling();
centerScreenOnCanvas(); // Center after resizing