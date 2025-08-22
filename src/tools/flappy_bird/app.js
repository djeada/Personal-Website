// Canvas and UI setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const difficultySel = document.getElementById('difficulty');
const restartBtn = document.getElementById('restart-btn');
const pauseBtn = document.getElementById('pause-btn');
const muteBtn = document.getElementById('mute-btn');
const hsBadge = document.getElementById('hs-badge');
const themeModeSel = document.getElementById('theme-mode');
const birdSkinSel = document.getElementById('bird-skin');
const pipeSkinSel = document.getElementById('pipe-skin');

let isPaused = false;
let lastTapTime = 0;
let game;

// Persistence and audio
let highScore = Number(localStorage.getItem('flappy_highscore') || 0);
let muted = localStorage.getItem('flappy_muted') === '1';
const savedTheme = localStorage.getItem('flappy_theme') || 'auto';
const savedBird = localStorage.getItem('flappy_bird_skin') || 'classic';
const savedPipe = localStorage.getItem('flappy_pipe_skin') || 'classic';

const sfx = {
    flap: makeBeep(440, 0.05),
    score: makeBeep(880, 0.07),
    hit: makeBeep(130, 0.2),
    level: makeBeep(523, 0.12),
};

updateHSBadge();
if (muteBtn) muteBtn.textContent = muted ? '🔇 Muted' : '🔊 Sound';
if (themeModeSel) themeModeSel.value = savedTheme;
if (birdSkinSel) birdSkinSel.value = savedBird;
if (pipeSkinSel) pipeSkinSel.value = savedPipe;

// Responsive canvas sizing (square, fits container width up to 900px)
function resizeCanvas() {
    const max = Math.min(900, canvas.parentElement.clientWidth);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = Math.floor(max * dpr);
    canvas.width = size; // internal buffer
    canvas.height = size;
}
window.addEventListener('resize', () => {
    const wasPaused = isPaused;
    isPaused = true;
    resizeCanvas();
    isPaused = wasPaused;
    if (!game) renderStartScreen();
});
resizeCanvas();

// Game Class
class Game {
    constructor() {
        this.bird = new Bird();
        this.pipes = [];
        this.score = 0;
        this.level = 1;
        this.speed = 2.3;
        this.pipeInterval = 1500;
        this.gameOver = false;
        this.gravity = 0.5;
        this.spawnTimer = null;
        this.rafId = null;
        this.backgroundX = 0;
        this.backgroundColor = '#70c5ce';
        this.lastPipeX = null;
        // parallax
        this.clouds = genClouds();
        this.stars = genStars();
        this.bg2X = 0;
        // particles
        this.particles = [];
    }

    start() {
        if (this.spawnTimer) clearInterval(this.spawnTimer);
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.reset();
        this.spawnTimer = setInterval(() => this.spawnPipe(), this.pipeInterval);
        const loop = () => {
            this.rafId = requestAnimationFrame(loop);
            this.gameLoop();
        };
        this.rafId = requestAnimationFrame(loop);
    }

    reset() {
        if (this.spawnTimer) {
            clearInterval(this.spawnTimer);
            this.spawnTimer = null;
        }
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.bird.reset();
        this.pipes = [];
        this.score = 0;
        this.level = 1;
        applyDifficulty(this);
        this.gameOver = false;
        this.backgroundX = 0;
        this.lastPipeX = null;
        this.clouds = genClouds();
        this.stars = genStars();
        this.particles = [];
    }

    gameLoop() {
        if (this.gameOver || isPaused) return;
        this.update();
        this.render();
        if (this.checkCollision()) this.endGame();
    }

    update() {
        this.bird.update(this.gravity);
        this.pipes.forEach((pipe) => pipe.update(this.speed));
        this.pipes = this.pipes.filter((pipe) => !pipe.isOffScreen());

        this.backgroundX -= this.speed / 2;
        if (this.backgroundX <= -canvas.width) this.backgroundX = 0;

        this.bg2X -= this.speed / 8;
        if (this.bg2X <= -canvas.width) this.bg2X = 0;

        this.pipes.forEach((pipe) => {
            if (!pipe.passed && pipe.x + pipe.width < this.bird.x) {
                pipe.passed = true;
                this.score++;
                playSfx('score');
                this.spawnScoreBurst(pipe.x + pipe.width, pipe.isTop ? pipe.y + pipe.height : pipe.y);
                if (this.score > highScore) {
                    highScore = this.score;
                    localStorage.setItem('flappy_highscore', String(highScore));
                    updateHSBadge();
                }
                if (this.score % 10 === 0) this.levelUp();
            }
        });
    }

    render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.renderBackground();
        this.renderParallax();
        this.pipes.forEach((pipe) => pipe.render());
        this.bird.render();
        this.updateAndRenderParticles();
        this.renderScore();
    }

    renderBackground() {
        const mode = themeModeSel?.value || 'auto';
        const hour = new Date().getHours();
        const isNight = mode === 'night' || (mode === 'auto' && (hour >= 19 || hour < 6));
        this.backgroundColor = isNight ? '#0b1020' : '#70c5ce';
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = isNight ? '#f5f3c4' : '#fff59d';
        ctx.beginPath();
        ctx.arc(canvas.width - 60, 60, 30, 0, Math.PI * 2);
        ctx.fill();
    }

    renderParallax() {
        const mode = themeModeSel?.value || 'auto';
        const hour = new Date().getHours();
        const isNight = mode === 'night' || (mode === 'auto' && (hour >= 19 || hour < 6));
        if (isNight) {
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            this.stars.forEach((s) => {
                drawStar(s.x + this.bg2X, s.y, s.r);
                drawStar(s.x + this.bg2X + canvas.width, s.y, s.r);
            });
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            this.clouds.forEach((c) => {
                drawCloud(c.x + this.bg2X, c.y, c.r);
                drawCloud(c.x + this.bg2X + canvas.width, c.y, c.r);
            });
        }
    }

    renderScore() {
        ctx.fillStyle = 'white';
        ctx.font = '30px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Score: ${this.score}`, 100, 40);
        ctx.fillText(`Level: ${this.level}`, 100, 80);
        ctx.fillText(`High Score: ${highScore}`, 100, 120);
    }

    checkCollision() {
        if (this.bird.y + this.bird.height >= canvas.height || this.bird.y <= 0) return true;
        return this.pipes.some((pipe) => this.bird.collidesWith(pipe));
    }

    spawnPipe() {
        const gapBase = 170;
        const gapHeight = Math.max(90, gapBase - this.level * 5);
        const minHeight = 50;
        const maxHeight = canvas.height - gapHeight - minHeight;
        const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1) + minHeight);
        const bottomY = topHeight + gapHeight;

        const MIN_SPACING = 300;
        const EXTRA_SPREAD = 200;
        const baseX = this.lastPipeX !== null ? this.lastPipeX + MIN_SPACING : canvas.width;
        const pipeX = baseX + Math.random() * EXTRA_SPREAD;
        this.lastPipeX = pipeX;

        this.pipes.push(new Pipe(pipeX, 0, topHeight, true));
        this.pipes.push(new Pipe(pipeX, bottomY, canvas.height - bottomY, false));
    }

    levelUp() {
        this.level++;
        this.speed += 0.4;
        this.gravity += 0.05;
        this.pipeInterval = Math.max(800, this.pipeInterval - 80);
        clearInterval(this.spawnTimer);
        this.spawnTimer = setInterval(() => this.spawnPipe(), this.pipeInterval);
        playSfx('level');
    }

    endGame() {
        this.gameOver = true;
        clearInterval(this.spawnTimer);
        if (this.rafId) cancelAnimationFrame(this.rafId);
        playSfx('hit');
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

    // Particles
    spawnScoreBurst(x, y) {
        const colors = ['#fff', '#ffe066', '#ff9f1c', '#2ec4b6'];
        for (let i = 0; i < 18; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 2.5;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 40,
                color: colors[(Math.random() * colors.length) | 0],
                size: 2 + Math.random() * 2,
            });
        }
    }

    updateAndRenderParticles() {
        this.particles.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05;
            p.life--;
        });
        this.particles = this.particles.filter((p) => p.life > 0);
        this.particles.forEach((p) => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.life / 40);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        });
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
        this.gravityCap = 10;
    }

    reset() {
        this.x = 100;
        this.y = canvas.height / 2 - this.height / 2;
        this.velocity = 0;
    }

    update(gravity) {
        this.velocity += gravity;
        if (this.velocity > this.gravityCap) this.velocity = this.gravityCap;
        this.y += this.velocity;
    }

    jump() {
        this.velocity = this.jumpStrength;
        playSfx('flap');
    }

    render() {
        const skin = birdSkinSel?.value || 'classic';
        drawBirdSkin(this, skin);
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
    }

    update(speed) {
        this.x -= speed;
    }

    render() {
        const skin = pipeSkinSel?.value || 'classic';
        drawPipeSkin(this, skin);
    }

    isOffScreen() {
        return this.x + this.width < 0;
    }
}

// Input Handling
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (!game || game.gameOver) {
            game = new Game();
            game.start();
        } else {
            game.bird.jump();
        }
        e.preventDefault();
    } else if (e.code === 'Escape') {
        if (game) {
            game.reset();
            game.start();
        }
    } else if (e.code === 'KeyP') {
        isPaused = !isPaused;
        if (isPaused) renderPauseOverlay();
        else if (game) game.render();
    } else if (e.code === 'KeyM') {
        toggleMute();
    }
});

// Touch Input
canvas.addEventListener('touchstart', (e) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;

    if (tapLength < 300 && tapLength > 0) {
        if (game && game.gameOver) {
            game.reset();
            game.start();
            e.preventDefault();
            return;
        }
        isPaused = !isPaused;
        if (isPaused) renderPauseOverlay();
        else if (game) game.render();
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
    if (game?.gameOver) return;
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

// Initialize
renderStartScreen();
disableScrolling();

// Controls wiring
restartBtn?.addEventListener('click', () => {
    if (!game) game = new Game();
    game.reset();
    game.start();
});

pauseBtn?.addEventListener('click', () => {
    isPaused = !isPaused;
    if (isPaused) renderPauseOverlay();
    else if (game) game.render();
});

muteBtn?.addEventListener('click', () => toggleMute());

difficultySel?.addEventListener('change', () => {
    if (!game) return;
    const wasPaused = isPaused;
    isPaused = true;
    applyDifficulty(game);
    isPaused = wasPaused;
});

themeModeSel?.addEventListener('change', () => {
    localStorage.setItem('flappy_theme', themeModeSel.value);
});

birdSkinSel?.addEventListener('change', () => {
    localStorage.setItem('flappy_bird_skin', birdSkinSel.value);
});

pipeSkinSel?.addEventListener('change', () => {
    localStorage.setItem('flappy_pipe_skin', pipeSkinSel.value);
});

// Helpers
function applyDifficulty(g) {
    const d = difficultySel?.value || 'normal';
    if (d === 'easy') {
        g.speed = 2;
        g.pipeInterval = 1700;
        g.gravity = 0.45;
    } else if (d === 'normal') {
        g.speed = 2.3;
        g.pipeInterval = 1500;
        g.gravity = 0.5;
    } else if (d === 'hard') {
        g.speed = 2.6;
        g.pipeInterval = 1300;
        g.gravity = 0.55;
    } else {
        g.speed = 3.0;
        g.pipeInterval = 1100;
        g.gravity = 0.6;
    }
    if (g.spawnTimer) {
        clearInterval(g.spawnTimer);
        g.spawnTimer = setInterval(() => g.spawnPipe(), g.pipeInterval);
    }
}

function updateHSBadge() {
    if (hsBadge) hsBadge.textContent = `High: ${highScore}`;
}

function toggleMute() {
    muted = !muted;
    localStorage.setItem('flappy_muted', muted ? '1' : '0');
    if (muteBtn) muteBtn.textContent = muted ? '🔇 Muted' : '🔊 Sound';
}

function playSfx(name) {
    if (muted) return;
    const fn = sfx[name];
    if (fn) fn();
}

// Tiny synth using WebAudio Oscillator for simple beeps
let audioCtx;

function makeBeep(freq, durationSec) {
    return function() {
        try {
            if (!audioCtx) audioCtx = new(window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.value = 0.05;
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            const now = audioCtx.currentTime;
            osc.start(now);
            gain.gain.setTargetAtTime(0, now + durationSec, 0.02);
            osc.stop(now + durationSec + 0.05);
        } catch (_) {}
    };
}

function drawCloud(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.8, y + r * 0.2, r * 0.8, 0, Math.PI * 2);
    ctx.arc(x - r * 0.8, y + r * 0.2, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
}

function drawStar(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

function drawBirdSkin(bird, skin) {
    if (skin === 'ghost') {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
    } else if (skin === 'red') {
        ctx.fillStyle = '#ef4444';
    } else if (skin === 'blue') {
        ctx.fillStyle = '#3b82f6';
    } else if (skin === 'green') {
        ctx.fillStyle = '#22c55e';
    } else {
        ctx.fillStyle = 'yellow';
    }
    ctx.beginPath();
    ctx.ellipse(bird.x + bird.width / 2, bird.y + bird.height / 2, bird.width / 2, bird.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (skin !== 'ghost') {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(bird.x + bird.width / 3, bird.y + bird.height / 3, bird.width / 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(bird.x + bird.width / 3, bird.y + bird.height / 3, bird.width / 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.moveTo(bird.x + bird.width / 2, bird.y + bird.height / 2);
        ctx.lineTo(bird.x + bird.width, bird.y + bird.height / 2);
        ctx.lineTo(bird.x + bird.width / 2, bird.y + bird.height / 2 + bird.height / 4);
        ctx.fill();
    }
}

function drawPipeSkin(pipe, skin) {
    if (skin === 'purple') {
        ctx.fillStyle = '#7c3aed';
    } else if (skin === 'gray') {
        ctx.fillStyle = '#64748b';
    } else if (skin === 'wood') {
        ctx.fillStyle = '#b45309';
    } else if (skin === 'lava') {
        const grad = ctx.createLinearGradient(pipe.x, pipe.y, pipe.x, pipe.y + pipe.height);
        grad.addColorStop(0, '#ef4444');
        grad.addColorStop(1, '#f97316');
        ctx.fillStyle = grad;
    } else {
        ctx.fillStyle = 'green';
    }
    ctx.fillRect(pipe.x, pipe.y, pipe.width, pipe.height);
    if (skin === 'lava') ctx.fillStyle = '#7c2d12';
    else if (skin === 'wood') ctx.fillStyle = '#92400e';
    else if (skin === 'gray') ctx.fillStyle = '#475569';
    else if (skin === 'purple') ctx.fillStyle = '#6d28d9';
    else ctx.fillStyle = 'darkgreen';
    if (pipe.isTop) ctx.fillRect(pipe.x - 10, pipe.y + pipe.height - 20, pipe.width + 20, 20);
    else ctx.fillRect(pipe.x - 10, pipe.y, pipe.width + 20, 20);
}

function genClouds() {
    const arr = [];
    const n = 6;
    for (let i = 0; i < n; i++) {
        arr.push({
            x: Math.random() * canvas.width,
            y: Math.random() * (canvas.height * 0.4),
            r: 20 + Math.random() * 35,
        });
    }
    return arr;
}

function genStars() {
    const arr = [];
    const n = 50;
    for (let i = 0; i < n; i++) {
        arr.push({
            x: Math.random() * canvas.width,
            y: Math.random() * (canvas.height * 0.6),
            r: 1 + Math.random() * 1.5,
        });
    }
    return arr;
}