// Canvas Setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let isPaused = false;
let lastTapTime = 0;
let game;

// Game Variables
let highScore = 0;

// Game Class
class Game {
    constructor() {
        this.bird = new Bird();
        this.pipes = [];
        this.score = 0;
        this.level = 1;
        this.speed = 2;
        this.pipeInterval = 4000;
        this.gameOver = false;
        this.gravity = 0.5;
        this.spawnTimer = null;
        this.gameLoopTimer = null;
        this.backgroundX = 0;
        this.backgroundColor = '#70c5ce';
    }

    start() {
        this.reset();
        this.spawnTimer = setInterval(() => this.spawnPipe(), this.pipeInterval);
        this.gameLoopTimer = setInterval(() => this.gameLoop(), 20);
    }

    reset() {
        this.bird.reset();
        this.pipes = [];
        this.score = 0;
        this.level = 1;
        this.speed = 2;
        this.pipeInterval = 1500;
        this.gameOver = false;
        this.gravity = 0.5;
        this.backgroundX = 0;
    }

    gameLoop() {
        if (this.gameOver || isPaused) return;

        this.update();
        this.render();

        if (this.checkCollision()) {
            this.endGame();
        }
    }

    update() {
        this.bird.update(this.gravity);
        this.pipes.forEach(pipe => pipe.update(this.speed));
        this.pipes = this.pipes.filter(pipe => !pipe.isOffScreen());

        this.backgroundX -= this.speed / 2;
        if (this.backgroundX <= -canvas.width) {
            this.backgroundX = 0;
        }

        this.pipes.forEach(pipe => {
            if (!pipe.passed && pipe.x + pipe.width < this.bird.x) {
                pipe.passed = true;
                this.score++;
                if (this.score > highScore) highScore = this.score;
                if (this.score % 10 === 0) this.levelUp();
            }
        });
    }

    render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.renderBackground();
        this.pipes.forEach(pipe => pipe.render());
        this.bird.render();
        this.renderScore();
    }

    renderBackground() {
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    renderScore() {
        ctx.fillStyle = 'white';
        ctx.font = '30px Arial';
        ctx.fillText(`Score: ${this.score}`, 100, 40);
        ctx.fillText(`Level: ${this.level}`, 100, 80);
        ctx.fillText(`High Score: ${highScore}`, 100, 120);
    }


    checkCollision() {
        if (this.bird.y + this.bird.height >= canvas.height || this.bird.y <= 0) {
            return true;
        }
        return this.pipes.some(pipe => this.bird.collidesWith(pipe));
    }

    spawnPipe() {
        const gapHeight = 150 - this.level * 5;
        const minHeight = 50;
        const maxHeight = canvas.height - gapHeight - minHeight;
        const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1) + minHeight);
        const bottomY = topHeight + gapHeight;

        // Determine pipeX value
        let pipeX;
        if (this.pipes.length === 0) {
            pipeX = canvas.width;
        } else {
            const lastPipeX = this.pipes[this.pipes.length - 2].x;
            pipeX = lastPipeX + Math.floor(Math.random() * (800 - 150 + 1)) + 100;
        }
        // Add new pipes to the array
        this.pipes.push(new Pipe(pipeX, 0, topHeight, true)); // Top pipe
        this.pipes.push(new Pipe(pipeX, bottomY, canvas.height - bottomY, false)); // Bottom pipe
    }


    levelUp() {
        this.level++;
        this.speed += 0.5;
        this.gravity += 0.1;
        this.pipeInterval = Math.max(800, this.pipeInterval - 100);
        clearInterval(this.spawnTimer);
        this.spawnTimer = setInterval(() => this.spawnPipe(), this.pipeInterval);
    }

    endGame() {
        this.gameOver = true;
        clearInterval(this.spawnTimer);
        clearInterval(this.gameLoopTimer);
        this.renderGameOver();
    }

    renderGameOver() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'white';
        ctx.font = '50px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 60);
        ctx.font = '30px Arial';
        ctx.fillText(`Score: ${this.score}`, canvas.width / 2, canvas.height / 2);
        ctx.fillText('Tap to Restart', canvas.width / 2, canvas.height / 2 + 60);
    }
}

class Bird {
    constructor() {
        this.width = 40;
        this.height = 30;
        this.x = 100;
        this.y = canvas.height / 2 - this.height / 2;
        this.velocity = 0;
        this.jumpStrength = -7;
        this.color = 'yellow';
    }

    reset() {
        this.x = 100;
        this.y = canvas.height / 2 - this.height / 2;
        this.velocity = 0;
    }

    update(gravity) {
        this.velocity += gravity;
        this.y += this.velocity;
    }

    jump() {
        this.velocity = this.jumpStrength;
    }

    render() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw eye
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 3, this.y + this.height / 3, this.width / 10, 0, Math.PI * 2);
        ctx.fill();

        // Draw pupil
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 3, this.y + this.height / 3, this.width / 20, 0, Math.PI * 2);
        ctx.fill();

        // Draw beak
        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y + this.height / 2);
        ctx.lineTo(this.x + this.width, this.y + this.height / 2);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height / 2 + this.height / 4);
        ctx.fill();
    }

    collidesWith(pipe) {
        return (
            this.x < pipe.x + pipe.width &&
            this.x + this.width > pipe.x &&
            this.y < pipe.y + pipe.height &&
            this.y + this.height > pipe.y
        );
    }
}

class Pipe {
    constructor(x, y, height, isTop) {
        this.width = 80;
        this.height = height;
        this.x = x;
        this.y = y;
        this.isTop = isTop;
        this.passed = false;
        this.color = 'green';
    }

    update(speed) {
        this.x -= speed;
    }

    render() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Draw pipe head
        ctx.fillStyle = 'darkgreen';
        if (this.isTop) {
            ctx.fillRect(this.x - 10, this.y + this.height - 20, this.width + 20, 20);
        } else {
            ctx.fillRect(this.x - 10, this.y, this.width + 20, 20);
        }
    }

    isOffScreen() {
        return this.x + this.width < 0;
    }
}

// Input Handling
window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (!game || game.gameOver) {
            game = new Game();
            game.start();
        } else {
            game.bird.jump();
        }
        e.preventDefault();
    } else if (e.code === 'Escape' && game.gameOver) {
        game.reset();
        game.start();
    } else if (e.code === 'KeyP') {
        isPaused = !isPaused;
        if (isPaused) renderPauseOverlay();
        else game.render();
    }
});

// Touch Input
canvas.addEventListener('touchstart', e => {
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

    if (!game || game.gameOver) {
        game = new Game();
        game.start();
    } else {
        game.bird.jump();
    }
    lastTapTime = currentTime;
    e.preventDefault();
});

// Pause Overlay
function renderPauseOverlay() {
    if (game.gameOver) return;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.font = '50px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Paused', canvas.width / 2, canvas.height / 2);
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
    ctx.fillStyle = '#70c5ce';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.font = '50px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Flappy Bird', canvas.width / 2, canvas.height / 2 - 60);
    ctx.font = '30px Arial';
    ctx.fillText('Tap to Start', canvas.width / 2, canvas.height / 2);
    ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, canvas.height / 2 + 60);
}

canvas.addEventListener('click', () => {
    if (!game || game.gameOver) {
        game = new Game();
        game.start();
    } else {
        game.bird.jump();
    }
});

canvas.addEventListener('touchstart', e => {
    if (!game || game.gameOver) {
        game = new Game();
        game.start();
    } else {
        game.bird.jump();
    }
});

// Initialize
renderStartScreen();
disableScrolling();