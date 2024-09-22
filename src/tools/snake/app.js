// Canvas Setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const gridSize = 20;
const cellSize = canvas.width / gridSize;
let isPaused = false;
let lastTapTime = 0;

// Game Variables
let game;
let highScore = 0;

// Game Class
class Game {
    constructor() {
        this.grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(CellState.EMPTY));
        this.snake = new Snake();
        this.food = new Food();
        this.level = 1;
        this.score = 0;
        this.speed = 200;
        this.gameOver = false;
        this.interval = null;
        this.obstacles = [];
    }

    start() {
        this.reset();
        this.interval = setInterval(() => this.gameLoop(), this.speed);
    }

    reset() {
        this.grid.forEach(row => row.fill(CellState.EMPTY));
        this.snake.reset();
        this.food.place(this.snake.body);
        this.level = 1;
        this.score = 0;
        this.speed = 200;
        this.gameOver = false;
        this.obstacles = [];
        this.generateObstacles();
    }

    gameLoop() {
        if (this.gameOver || isPaused) return;

        this.snake.move();

        if (this.checkCollision()) {
            this.endGame();
            return;
        }

        if (this.snake.eat(this.food)) {
            this.score++;
            if (this.score > highScore) highScore = this.score;
            this.food.place(this.snake.body.concat(this.obstacles));
            if (this.score % 5 === 0) this.levelUp();
        }

        this.render();
    }

    checkCollision() {
        const head = this.snake.head();
        if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) return true;
        if (this.snake.collidesWithSelf()) return true;
        if (this.obstacles.some(obs => obs.x === head.x && obs.y === head.y)) return true;
        return false;
    }

    endGame() {
        this.gameOver = true;
        clearInterval(this.interval);
        this.renderGameOver();
    }

    levelUp() {
        this.level++;
        this.speed = Math.max(50, this.speed - 20);
        clearInterval(this.interval);
        this.interval = setInterval(() => this.gameLoop(), this.speed);
        this.generateObstacles();
    }

    generateObstacles() {
        for (let i = 0; i < this.level; i++) {
            let obstacle;
            do {
                obstacle = {
                    x: Math.floor(Math.random() * gridSize),
                    y: Math.floor(Math.random() * gridSize)
                };
            } while (this.snake.isOnBody(obstacle.x, obstacle.y) || this.food.isAt(obstacle.x, obstacle.y));
            this.obstacles.push(obstacle);
        }
    }

    render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Render grid background
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                ctx.fillStyle = (x + y) % 2 === 0 ? '#AAD751' : '#A2D149';
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }

        // Render obstacles
        ctx.fillStyle = '#8B4513';
        this.obstacles.forEach(obs => {
            ctx.fillRect(obs.x * cellSize, obs.y * cellSize, cellSize, cellSize);
        });

        // Render food
        this.food.render();

        // Render snake
        this.snake.render();

        // Display Score and Level
        ctx.fillStyle = 'black';
        ctx.font = '20px Arial';
        ctx.fillText(`Score: ${this.score}`, 30, 30);
        ctx.fillText(`Level: ${this.level}`, canvas.width - 100, 30);
        ctx.fillText(`High Score: ${highScore}`, 30, 60);
    }

    renderGameOver() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'white';
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 40);
        ctx.font = '30px Arial';
        ctx.fillText(`Score: ${this.score}`, canvas.width / 2, canvas.height / 2);
        ctx.fillText('Tap to Restart', canvas.width / 2, canvas.height / 2 + 40);
    }
}

class Snake {
    constructor() {
        this.body = [];
        this.direction = {
            x: 1,
            y: 0
        };
        this.nextDirection = {
            x: 1,
            y: 0
        };
        this.reset();
    }

    reset() {
        this.body = [{
            x: Math.floor(gridSize / 2),
            y: Math.floor(gridSize / 2)
        }];
        this.direction = {
            x: 1,
            y: 0
        };
        this.nextDirection = {
            x: 1,
            y: 0
        };
    }

    move() {
        this.direction = this.nextDirection;
        const head = {
            x: this.head().x + this.direction.x,
            y: this.head().y + this.direction.y
        };
        this.body.unshift(head);
        this.body.pop();
    }

    grow() {
        const tail = this.body[this.body.length - 1];
        this.body.push({
            x: tail.x,
            y: tail.y
        });
    }

    eat(food) {
        if (this.head().x === food.x && this.head().y === food.y) {
            this.grow();
            return true;
        }
        return false;
    }

    head() {
        return this.body[0];
    }

    isOnBody(x, y) {
        return this.body.some(segment => segment.x === x && segment.y === y);
    }

    collidesWithSelf() {
        const head = this.head();
        return this.body.slice(1).some(segment => segment.x === head.x && segment.y === head.y);
    }

    setDirection(newDirection) {
        if ((this.direction.x !== -newDirection.x || this.direction.y !== -newDirection.y) &&
            (this.direction.x !== newDirection.x || this.direction.y !== newDirection.y)) {
            this.nextDirection = newDirection;
        }
    }

    render() {
        this.body.forEach((segment, index) => {
            if (index === 0) {
                ctx.fillStyle = 'darkgreen';
                ctx.fillRect(segment.x * cellSize, segment.y * cellSize, cellSize, cellSize);
                ctx.fillStyle = 'white';
                const eyeSize = cellSize / 6;
                const eyeOffsetX = this.direction.x === 0 ? cellSize / 4 : (this.direction.x > 0 ? 3 * cellSize / 4 - eyeSize / 2 : cellSize / 4 - eyeSize / 2);
                const eyeOffsetY = this.direction.y === 0 ? cellSize / 4 : (this.direction.y > 0 ? 3 * cellSize / 4 - eyeSize / 2 : cellSize / 4 - eyeSize / 2);
                ctx.fillRect(segment.x * cellSize + eyeOffsetX, segment.y * cellSize + eyeOffsetY, eyeSize, eyeSize);
            } else {
                ctx.fillStyle = 'green';
                ctx.fillRect(segment.x * cellSize, segment.y * cellSize, cellSize, cellSize);
            }
        });
    }
}

class Food {
    constructor() {
        this.x = 0;
        this.y = 0;
    }

    place(occupiedPositions) {
        let validPosition = false;
        while (!validPosition) {
            this.x = Math.floor(Math.random() * gridSize);
            this.y = Math.floor(Math.random() * gridSize);
            if (!occupiedPositions.some(pos => pos.x === this.x && pos.y === this.y)) {
                validPosition = true;
            }
        }
    }

    isAt(x, y) {
        return this.x === x && this.y === y;
    }

    render() {
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x * cellSize, this.y * cellSize, cellSize, cellSize);
    }
}

// Enums
const CellState = {
    EMPTY: 'empty',
    SNAKE: 'snake',
    FOOD: 'food',
    OBSTACLE: 'obstacle'
};

// Input Handling
window.addEventListener('keydown', e => {
    const directionKeys = {
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
        },
        w: {
            x: 0,
            y: -1
        },
        s: {
            x: 0,
            y: 1
        },
        a: {
            x: -1,
            y: 0
        },
        d: {
            x: 1,
            y: 0
        }
    };
    if (directionKeys[e.key]) {
        game.snake.setDirection(directionKeys[e.key]);
        e.preventDefault();
    } else if (e.key === ' ') {
        isPaused = !isPaused;
        if (isPaused) renderPauseOverlay();
        else game.render();
        e.preventDefault();
    } else if (e.key === 'Escape' && game.gameOver) {
        game.reset();
        game.start();
    }
});

// Touch Input
let touchStartPos = null;
canvas.addEventListener('touchstart', e => {
    touchStartPos = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
    };
    e.preventDefault();
});

canvas.addEventListener('touchmove', e => {
    if (!touchStartPos) return;
    const dx = e.touches[0].clientX - touchStartPos.x;
    const dy = e.touches[0].clientY - touchStartPos.y;

    if (Math.abs(dx) > Math.abs(dy)) {
        const newDirection = dx > 0 ? {
            x: 1,
            y: 0
        } : {
            x: -1,
            y: 0
        };
        game.snake.setDirection(newDirection);
    } else {
        const newDirection = dy > 0 ? {
            x: 0,
            y: 1
        } : {
            x: 0,
            y: -1
        };
        game.snake.setDirection(newDirection);
    }

    touchStartPos = null;
    e.preventDefault();
});

canvas.addEventListener('touchend', e => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;

    if (tapLength < 300 && tapLength > 0) {
        if (game.gameOver) {
            game.reset();
            game.start();
            return;
        }
        isPaused = !isPaused;
        if (isPaused) renderPauseOverlay();
        else game.render();
        e.preventDefault();
        return;
    }

    lastTapTime = currentTime;
});

// Pause Overlay
function renderPauseOverlay() {
    if (game.gameOver) return;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Paused', canvas.width / 2, canvas.height / 2);
    ctx.fillText('Tap to Resume', canvas.width / 2, canvas.height / 2 + 40);
}

// Disable Scrolling
function preventDefaultTouch(e) {
    e.preventDefault();
}

function disableScrolling() {
    document.addEventListener('touchstart', preventDefaultTouch, {
        passive: false
    });
    document.addEventListener('touchmove', preventDefaultTouch, {
        passive: false
    });
    document.body.classList.add('no-scroll');
}

function enableScrolling() {
    document.removeEventListener('touchstart', preventDefaultTouch);
    document.removeEventListener('touchmove', preventDefaultTouch);
    document.body.classList.remove('no-scroll');
}

// Start Screen
function renderStartScreen() {
    ctx.fillStyle = '#AAD751';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'black';
    ctx.font = '50px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Snake Game', canvas.width / 2, canvas.height / 2 - 60);
    ctx.font = '30px Arial';
    ctx.fillText('Tap to Start', canvas.width / 2, canvas.height / 2);
    ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, canvas.height / 2 + 60);
}

canvas.addEventListener('click', () => {
    if (!game || game.gameOver) {
        game = new Game();
        game.start();
    }
});

canvas.addEventListener('touchstart', e => {
    if (!game || game.gameOver) {
        game = new Game();
        game.start();
    }
});

// Initialize
renderStartScreen();
disableScrolling();