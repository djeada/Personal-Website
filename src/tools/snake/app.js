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


const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const gridSize = 20;
const cellSize = canvas.width / gridSize;
let isPaused = false;
let lastTapTime = 0;

const FONT_DISPLAY = '"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif';
const FONT_MONO = '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';
const FONT_SANS = '"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif';
let pal = ToolShared.palette();

function drawClasp(x, y, w, h) {
    const t = 18;
    ctx.fillStyle = pal.gold;
    ctx.fillRect(x, y, t, 2);
    ctx.fillRect(x, y, 2, t);
    ctx.fillRect(x + w - t, y + h - 2, t, 2);
    ctx.fillRect(x + w - 2, y + h - t, 2, t);
}

function uiScale() {
    const shown = canvas.getBoundingClientRect().width || canvas.width;
    return Math.min(1.8, Math.max(1, canvas.width / shown * 0.75));
}

function drawChip(text, x, y, align) {
    const u = uiScale();
    ctx.font = `500 ${15 * u}px ${FONT_MONO}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const w = ctx.measureText(text).width + 24 * u;
    const h = 32 * u;
    const left = align === 'right' ? x - w : x;
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = pal.panel;
    ctx.fillRect(left, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal.rule;
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = pal.ink;
    ctx.fillText(text, left + 12 * u, y + h / 2 + 1);
}

function drawCard(title, lines) {
    const u = uiScale();
    const cx = canvas.width / 2;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;

    ctx.font = `600 ${64 * u}px ${FONT_DISPLAY}`;
    let width = ctx.measureText(title).width;
    ctx.font = `400 ${20 * u}px ${FONT_SANS}`;
    lines.forEach(line => {
        width = Math.max(width, ctx.measureText(line).width);
    });
    const w = Math.min(canvas.width - 40, Math.max(360 * u, width + 96 * u));
    const h = (150 + lines.length * 34) * u;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;

    ctx.fillStyle = pal.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = pal.rule;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    drawClasp(x, y, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = pal.ink;
    ctx.font = `600 ${64 * u}px ${FONT_DISPLAY}`;
    ctx.fillText(title, cx, y + 86 * u);

    const ry = Math.round(y + 112 * u);
    ctx.fillStyle = pal.gold;
    ctx.save();
    ctx.translate(cx, ry);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4 * u, -4 * u, 8 * u, 8 * u);
    ctx.restore();
    ctx.fillRect(cx - 70 * u, ry, 52 * u, Math.max(1, u));
    ctx.fillRect(cx + 18 * u, ry, 52 * u, Math.max(1, u));

    lines.forEach((line, i) => {
        ctx.fillStyle = i === 0 ? pal.ink2 : pal.ink3;
        ctx.font = i === 0 ? `400 ${20 * u}px ${FONT_SANS}` : `500 ${15 * u}px ${FONT_MONO}`;
        ctx.fillText(i === 0 ? line : line.toUpperCase(), cx, y + (152 + i * 34) * u, w - 32);
    });
}

let game;
let highScore = parseInt(getCookie('SNAKE_HIGH_SCORE')) || 0;



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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                ctx.fillStyle = pal.canvas;
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                if ((x + y) % 2 === 0) {
                    ctx.fillStyle = pal.grid;
                    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                }
            }
        }

        this.obstacles.forEach(o => {
            const x = o.x * cellSize;
            const y = o.y * cellSize;
            ctx.fillStyle = pal.ink3;
            ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
            ctx.strokeStyle = pal.canvas;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + 2, y + 2);
            ctx.lineTo(x + cellSize - 2, y + cellSize - 2);
            ctx.moveTo(x + cellSize - 2, y + 2);
            ctx.lineTo(x + 2, y + cellSize - 2);
            ctx.stroke();
        });
        this.food.render();
        this.snake.render();

        drawChip(`SCORE ${this.score}   BEST ${highScore}`, 12, 12, 'left');
        drawChip(`LEVEL ${this.level}`, canvas.width - 12, 12, 'right');
    }

    renderGameOver() {
        drawCard('Game over', [`Score ${this.score}`, 'Tap or press Space to play again']);
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
            const x = segment.x * cellSize;
            const y = segment.y * cellSize;

            if (index === 0) {
                ctx.fillStyle = pal.gold;
                ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

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

                ctx.fillStyle = pal.canvas;
                ctx.fillRect(x + eyeOffsetX, y + eyeOffsetY, eyeSize, eyeSize);
                if (this.direction.x === 0) {
                    ctx.fillRect(x + cellSize - eyeOffsetX - eyeSize, y + eyeOffsetY, eyeSize, eyeSize);
                } else {
                    ctx.fillRect(x + eyeOffsetX, y + cellSize - eyeOffsetY - eyeSize, eyeSize, eyeSize);
                }
            } else {
                ctx.fillStyle = pal.verdigris;
                ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
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
        const x = this.x * cellSize + cellSize / 2;
        const y = this.y * cellSize + cellSize / 2;
        const radius = cellSize * 0.32;

        ctx.fillStyle = pal.rose;
        ctx.beginPath();
        ctx.arc(x, y + radius * 0.15, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = pal.gold;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - radius * 0.6);
        ctx.lineTo(x + radius * 0.35, y - radius * 1.25);
        ctx.stroke();
    }

}


const CellState = {
    EMPTY: 'empty',
    SNAKE: 'snake',
    FOOD: 'food',
    OBSTACLE: 'obstacle'
};


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

        game.reset();
        game.start();
    }
});



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


function renderPauseOverlay() {
    if (game.gameOver) return;

    drawCard('Paused', ['Press Space or double-tap to resume']);
}


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


function renderStartScreen() {
    ctx.fillStyle = pal.canvas;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if ((x + y) % 2 === 0) {
                ctx.fillStyle = pal.grid;
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    drawCard('Snake', ['Tap or click the board to start', `Best ${highScore}`]);
}


function redraw() {
    if (!game) {
        renderStartScreen();
        return;
    }
    game.render();
    if (game.gameOver) game.renderGameOver();
    else if (isPaused) renderPauseOverlay();
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


renderStartScreen();
disableScrolling();

ToolShared.onThemeChange(next => {
    pal = next;
    redraw();
});

if (document.fonts) document.fonts.ready.then(redraw);