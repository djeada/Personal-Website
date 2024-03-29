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

// Game State
let gameOver = false;
let score = 0;

// Render Function
function render() {
    // Clear the grid
    grid.forEach(row => row.fill(CellState.EMPTY));

    // Render snake
    snake.body.forEach(segment => {
        grid[segment.y][segment.x] = CellState.SNAKE;
    });

    // Render food
    grid[food.y][food.x] = CellState.FOOD;

    // Draw on canvas
    grid.forEach((row, y) => {
        row.forEach((cell, x) => {
            if (cell === CellState.SNAKE) {
                ctx.fillStyle = 'green';
            } else if (cell === CellState.FOOD) {
                ctx.fillStyle = 'red';
            } else {
                ctx.fillStyle = getColorForMode('white', 'black');
            }
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        });
    });

    // Display Score
    ctx.fillStyle = getColorForMode('black', 'white');
    ctx.font = '20px Arial';
    ctx.fillText(`Score: ${score}`, 10, 30);

    // Game Over Screen
    if (gameOver) {
        enableScrolling()
        ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = getColorForMode('black', 'white');
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
    }
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

    // Check for collision with food
    if (head.x === food.x && head.y === food.y) {
        score++;
        food = {
            x: Math.floor(Math.random() * gridSize),
            y: Math.floor(Math.random() * gridSize)
        };
    } else {
        snake.body.pop(); // Remove tail segment
    }

    // Check for game over
    if (head.x < 0 || head.y < 0 || head.x >= gridSize || head.y >= gridSize ||
        snake.body.slice(1).some(segment => segment.x === head.x && segment.y === head.y)) {
        gameOver = true;
    }

    render();
}

// Input Handling
window.addEventListener('keydown', e => {
    const direction = {
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
    if (direction) {
        snake.direction = direction;
        e.preventDefault(); // Prevent scrolling for arrow keys
    } else if (e.key === 'Escape' && gameOver) {
        // Restart game
        window.location.reload();
    } else if (e.key === ' ') {
        isPaused = !isPaused; // Toggle pause
        if (isPaused) {
            enableScrolling();
        }
        e.preventDefault(); // Prevent scrolling for space bar
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

    if (Math.abs(dx) > Math.abs(dy)) {
        snake.direction = dx > 0 ? {
            x: 1,
            y: 0
        } : {
            x: -1,
            y: 0
        };
    } else {
        snake.direction = dy > 0 ? {
            x: 0,
            y: 1
        } : {
            x: 0,
            y: -1
        };
    }

    touchStartPos = null;
    e.preventDefault();
});

canvas.addEventListener('touchstart', function(e) {
    // Current time in milliseconds
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;

    if (tapLength < 300 && tapLength > 0) {
        // Detected a double tap
        isPaused = !isPaused; // Toggle pause state

        // Prevent further processing for this tap
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



// Start Game
setInterval(gameLoop, 200);
disableScrolling();