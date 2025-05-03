// ——— COOKIE HELPERS ———
function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
        .toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/`;
}

function getCookie(name) {
    const match = document.cookie.match(
        new RegExp('(?:^|; )' + name + '=([^;]*)')
    );
    return match ? decodeURIComponent(match[1]) : null;
}

// Canvas Setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const gridSize = 20;
const cellSize = canvas.width / gridSize;
let isPaused = false;
let lastTapTime = 0;

// Game Variables
let game;
let highScore = parseInt(getCookie('SNAKE_HIGH_SCORE')) || 0;


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
            if (this.score > highScore) {
                highScore = this.score;
                setCookie('SNAKE_HIGH_SCORE', highScore, 365);
            }
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
        // === Constants ===
        const FONT = '16px "Helvetica Neue", sans-serif';
        const TEXT_COLOR = 'rgba(255,255,255,0.9)';
        const PANEL_BG = 'rgba(255,255,255,0.15)';
        const PANEL_BORDER = 'rgba(255,255,255,0.4)';
        const SHADOW_COLOR = 'rgba(0,0,0,0.3)';
        const SHADOW_BLUR = 10;
        const RADIUS = 8;
        const PADDING_X = 12;
        const PADDING_Y = 8;

        // === Helper to draw a rounded “glass” panel with text ===
        function drawPanel(textLines, x, y) {
            ctx.font = FONT;
            // measure widest line
            const widths = textLines.map(t => ctx.measureText(t).width);
            const w = Math.max(...widths) + PADDING_X * 2;
            const h = textLines.length * (parseInt(FONT) + 4) + PADDING_Y * 2;

            // panel shadow
            ctx.shadowColor = SHADOW_COLOR;
            ctx.shadowBlur = SHADOW_BLUR;

            // draw rounded rect
            ctx.fillStyle = PANEL_BG;
            ctx.strokeStyle = PANEL_BORDER;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + RADIUS, y);
            ctx.lineTo(x + w - RADIUS, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + RADIUS);
            ctx.lineTo(x + w, y + h - RADIUS);
            ctx.quadraticCurveTo(x + w, y + h, x + w - RADIUS, y + h);
            ctx.lineTo(x + RADIUS, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - RADIUS);
            ctx.lineTo(x, y + RADIUS);
            ctx.quadraticCurveTo(x, y, x + RADIUS, y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // reset shadow
            ctx.shadowBlur = 0;

            // draw text lines
            ctx.fillStyle = TEXT_COLOR;
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            textLines.forEach((line, i) => {
                ctx.fillText(
                    line,
                    x + PADDING_X,
                    y + PADDING_Y + i * (parseInt(FONT) + 4)
                );
            });

            return w; // for positioning
        }

        // === Clear & draw board ===
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                ctx.fillStyle = (x + y) % 2 === 0 ? '#AAD751' : '#A2D149';
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }

        // === Content ===
        ctx.fillStyle = '#8B4513';
        this.obstacles.forEach(o =>
            ctx.fillRect(o.x * cellSize, o.y * cellSize, cellSize, cellSize)
        );
        this.food.render();
        this.snake.render();

        // === HUD Panels ===
        // Left panel: Score & High Score
        drawPanel(
            [`Score: ${this.score}`, `High: ${highScore}`],
            10, 10
        );

        // Right panel: Level
        const lvlText = [`Level: ${this.level}`];
        const panelW = drawPanel(
            lvlText,
            canvas.width - 10 - (ctx.measureText(lvlText[0]).width + PADDING_X * 2),
            10
        );
    }

    renderGameOver() {
        // === Constants ===
        const FONT_TITLE = '36px "Helvetica Neue", sans-serif';
        const FONT_BODY = '20px "Helvetica Neue", sans-serif';
        const TEXT_COLOR = 'rgba(255,255,255,0.9)';
        const PANEL_BG = 'rgba(0, 0, 0, 0.6)';
        const PANEL_BORDER = 'rgba(255,255,255,0.3)';
        const SHADOW_COLOR = 'rgba(0,0,0,0.4)';
        const SHADOW_BLUR = 12;
        const RADIUS = 12;
        const PADDING = 20;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Prepare lines
        const lines = [{
                text: 'Game Over',
                font: FONT_TITLE,
                gap: 0
            },
            {
                text: `Score: ${this.score}`,
                font: FONT_BODY,
                gap: 16
            },
            {
                text: 'Tap to Restart',
                font: FONT_BODY,
                gap: 32
            },
        ];

        // measure panel size
        ctx.textAlign = 'center';
        let panelWidth = 0;
        let panelHeight = PADDING * 2;
        lines.forEach(({
            text,
            font,
            gap
        }) => {
            ctx.font = font;
            const w = ctx.measureText(text).width;
            panelWidth = Math.max(panelWidth, w);
            panelHeight += parseInt(font) + gap;
        });
        panelWidth += PADDING * 2;

        const panelX = centerX - panelWidth / 2;
        const panelY = centerY - panelHeight / 2;

        // Draw panel shadow
        ctx.shadowColor = SHADOW_COLOR;
        ctx.shadowBlur = SHADOW_BLUR;

        // Draw rounded panel
        ctx.fillStyle = PANEL_BG;
        ctx.strokeStyle = PANEL_BORDER;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(panelX + RADIUS, panelY);
        ctx.lineTo(panelX + panelWidth - RADIUS, panelY);
        ctx.quadraticCurveTo(panelX + panelWidth, panelY, panelX + panelWidth, panelY + RADIUS);
        ctx.lineTo(panelX + panelWidth, panelY + panelHeight - RADIUS);
        ctx.quadraticCurveTo(panelX + panelWidth, panelY + panelHeight, panelX + panelWidth - RADIUS, panelY + panelHeight);
        ctx.lineTo(panelX + RADIUS, panelY + panelHeight);
        ctx.quadraticCurveTo(panelX, panelY + panelHeight, panelX, panelY + panelHeight - RADIUS);
        ctx.lineTo(panelX, panelY + RADIUS);
        ctx.quadraticCurveTo(panelX, panelY, panelX + RADIUS, panelY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Reset shadow
        ctx.shadowBlur = 0;

        // Draw text lines
        let cursorY = panelY + PADDING;
        lines.forEach(({
            text,
            font,
            gap
        }) => {
            ctx.font = font;
            ctx.fillStyle = TEXT_COLOR;
            ctx.textBaseline = 'top';
            ctx.fillText(text, centerX, cursorY);
            cursorY += parseInt(font) + gap;
        });
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
        // apply a soft shadow to lift the snake off the background
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 4;

        this.body.forEach((segment, index) => {
            const x = segment.x * cellSize;
            const y = segment.y * cellSize;

            if (index === 0) {
                // Head: dark green fill + white outline
                ctx.fillStyle = 'darkgreen';
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.fillRect(x, y, cellSize, cellSize);
                ctx.strokeRect(x, y, cellSize, cellSize);

                // Eyes: white square + black outline
                const eyeSize = cellSize / 6;
                const eyeOffsetX = this.direction.x === 0 ?
                    cellSize / 4 :
                    (this.direction.x > 0 ?
                        3 * cellSize / 4 - eyeSize / 2 :
                        cellSize / 4 - eyeSize / 2);
                const eyeOffsetY = this.direction.y === 0 ?
                    cellSize / 4 :
                    (this.direction.y > 0 ?
                        3 * cellSize / 4 - eyeSize / 2 :
                        cellSize / 4 - eyeSize / 2);

                ctx.fillStyle = 'white';
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 1;
                ctx.fillRect(x + eyeOffsetX, y + eyeOffsetY, eyeSize, eyeSize);
                ctx.strokeRect(x + eyeOffsetX, y + eyeOffsetY, eyeSize, eyeSize);

            } else {
                // Body: green fill + white outline
                ctx.fillStyle = 'green';
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 1;
                ctx.fillRect(x, y, cellSize, cellSize);
                ctx.strokeRect(x, y, cellSize, cellSize);
            }
        });

        // reset shadow before drawing other things
        ctx.shadowBlur = 0;
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
        const x = this.x * cellSize + cellSize / 2;
        const y = this.y * cellSize + cellSize / 2;
        const radius = cellSize * 0.4;

        // drop-shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        // base circle with radial gradient
        const grad = ctx.createRadialGradient(
            x - radius * 0.3, y - radius * 0.3, radius * 0.2,
            x, y, radius
        );
        grad.addColorStop(0, '#ff6b6b');
        grad.addColorStop(1, '#c0392b');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        // restore so the highlight isn’t shadowed
        ctx.restore();

        // small white “shine” ellipse
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.ellipse(
            x - radius * 0.3,
            y - radius * 0.3,
            radius * 0.3,
            radius * 0.2,
            -Math.PI / 4,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // thin dark outline
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
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
        // SPACE: if game over → restart; otherwise toggle pause
        if (game && game.gameOver) {
            game.reset();
            game.start();
        } else {
            isPaused = !isPaused;
            if (isPaused) {
                renderPauseOverlay();
            } else {
                game.render();
            }
        }
        e.preventDefault();

    } else if (e.key === 'Escape' && game && game.gameOver) {
        // ESC also restarts after game over if you still want that
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
    // === Constants ===
    const BG_COLOR = '#AAD751';
    const FONT_TITLE = '48px "Helvetica Neue", sans-serif';
    const FONT_BODY = '24px "Helvetica Neue", sans-serif';
    const TEXT_COLOR = 'rgba(255,255,255,0.9)';
    const PANEL_BG = 'rgba(0, 0, 0, 0.4)';
    const PANEL_BORDER = 'rgba(255,255,255,0.3)';
    const SHADOW_COLOR = 'rgba(0,0,0,0.4)';
    const SHADOW_BLUR = 10;
    const RADIUS = 12;
    const PADDING = 24;

    // Fill background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Prepare text lines
    const lines = [{
            text: 'Snake Game',
            font: FONT_TITLE,
            gap: 16
        },
        {
            text: 'Tap to Start',
            font: FONT_BODY,
            gap: 12
        },
        {
            text: `High Score: ${highScore}`,
            font: FONT_BODY,
            gap: 0
        },
    ];

    // Center coords
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Measure panel dimensions
    ctx.textAlign = 'center';
    let panelWidth = 0;
    let panelHeight = PADDING * 2;
    lines.forEach(({
        text,
        font,
        gap
    }) => {
        ctx.font = font;
        const w = ctx.measureText(text).width;
        panelWidth = Math.max(panelWidth, w);
        panelHeight += parseInt(font) + gap;
    });
    panelWidth += PADDING * 2;
    const panelX = centerX - panelWidth / 2;
    const panelY = centerY - panelHeight / 2;

    // Draw panel shadow
    ctx.shadowColor = SHADOW_COLOR;
    ctx.shadowBlur = SHADOW_BLUR;

    // Draw rounded “glass” panel
    ctx.fillStyle = PANEL_BG;
    ctx.strokeStyle = PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + RADIUS, panelY);
    ctx.lineTo(panelX + panelWidth - RADIUS, panelY);
    ctx.quadraticCurveTo(panelX + panelWidth, panelY, panelX + panelWidth, panelY + RADIUS);
    ctx.lineTo(panelX + panelWidth, panelY + panelHeight - RADIUS);
    ctx.quadraticCurveTo(panelX + panelWidth, panelY + panelHeight, panelX + panelWidth - RADIUS, panelY + panelHeight);
    ctx.lineTo(panelX + RADIUS, panelY + panelHeight);
    ctx.quadraticCurveTo(panelX, panelY + panelHeight, panelX, panelY + panelHeight - RADIUS);
    ctx.lineTo(panelX, panelY + RADIUS);
    ctx.quadraticCurveTo(panelX, panelY, panelX + RADIUS, panelY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Reset shadow
    ctx.shadowBlur = 0;

    // Draw text
    let cursorY = panelY + PADDING;
    lines.forEach(({
        text,
        font,
        gap
    }) => {
        ctx.font = font;
        ctx.fillStyle = TEXT_COLOR;
        ctx.textBaseline = 'top';
        ctx.fillText(text, centerX, cursorY);
        cursorY += parseInt(font) + gap;
    });
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