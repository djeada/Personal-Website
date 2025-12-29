/**
 * Ant Colony Simulation
 * Demonstrates pheromone-based foraging behavior using pure JavaScript and HTML5 Canvas
 */

// ========================
// Configuration & Constants
// ========================
const CONFIG = {
    canvas: {
        width: 800,
        height: 600
    },
    nest: {
        x: 400,
        y: 300,
        radius: 30
    },
    food: [
        { x: 150, y: 150, radius: 25, amount: 1000 },
        { x: 650, y: 450, radius: 25, amount: 1000 },
        { x: 700, y: 150, radius: 20, amount: 800 }
    ],
    ant: {
        size: 3,
        speed: 0.8,
        speedVariationMin: 0.8,
        speedVariationRange: 0.4,
        maxSpeed: 2.0,
        minSpeed: 0.5,
        acceleration: 0.02,
        friction: 0.98,
        sensorDistance: 30,  // Increased from 25 to detect pheromones from farther away
        sensorAngle: Math.PI / 4,
        wanderStrength: 0.3,  // Increased from 0.2 for better exploration
        turnSpeed: 0.08,
        maxTurnSpeed: 0.15,
        bounceBaseAngle: Math.PI / 2,
        bounceRandomVariation: Math.PI / 4,
        nestNavigationFactor: 0.15,
        momentum: 0.85
    },
    pheromone: {
        gridSize: 5,
        initialStrength: 100,
        evaporationRate: 0.99,
        diffusionRate: 0.05,
        homePheromoneStrength: 0.7,
        foodPheromoneStrength: 1.2  // Increased from 0.5 to make food trails stronger
    },
    obstacle: {
        radius: 8,
        bufferDistance: 10
    }
};

// Store initial food amounts for reset
const INITIAL_FOOD_AMOUNTS = CONFIG.food.map(f => f.amount);

// ========================
// Global State
// ========================
let canvas, ctx;
let ants = [];
let pheromoneGrid = {
    food: [],
    home: []
};
let obstacles = [];
let isDrawing = false;
let lastMousePos = { x: 0, y: 0 };

// Settings from UI controls
let settings = {
    antCount: 50,
    pheromoneStrength: 100,
    evaporationRate: 0.99,
    showPheromones: true,
    showSensors: false,
    simulationSpeed: 1.0
};

// ========================
// Pheromone Grid Management
// ========================
// Track cells with active pheromones for performance optimization
let activePheremoneCells = new Set();

function initPheromoneGrid() {
    const rows = Math.ceil(CONFIG.canvas.height / CONFIG.pheromone.gridSize);
    const cols = Math.ceil(CONFIG.canvas.width / CONFIG.pheromone.gridSize);
    
    pheromoneGrid.food = Array(rows).fill(null).map(() => Array(cols).fill(0));
    pheromoneGrid.home = Array(rows).fill(null).map(() => Array(cols).fill(0));
    activePheremoneCells.clear();
}

function getPheromone(type, x, y) {
    const grid = type === 'food' ? pheromoneGrid.food : pheromoneGrid.home;
    const col = Math.floor(x / CONFIG.pheromone.gridSize);
    const row = Math.floor(y / CONFIG.pheromone.gridSize);
    
    if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) {
        return grid[row][col];
    }
    return 0;
}

function addPheromone(type, x, y, strength) {
    const grid = type === 'food' ? pheromoneGrid.food : pheromoneGrid.home;
    const col = Math.floor(x / CONFIG.pheromone.gridSize);
    const row = Math.floor(y / CONFIG.pheromone.gridSize);
    
    if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) {
        grid[row][col] = Math.min(grid[row][col] + strength, 255);
        // Track active cells for performance optimization
        activePheremoneCells.add(`${row},${col}`);
    }
}

function evaporatePheromones() {
    const evapRate = settings.evaporationRate;
    const diffusionRate = CONFIG.pheromone.diffusionRate;
    const threshold = 0.5; // Increased threshold for better performance
    
    // Neighbor offsets for diffusion
    const neighborOffsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    
    // Convert active cells to array for iteration
    const activeCells = Array.from(activePheremoneCells);
    const newActiveCells = new Set();
    
    // Process only active cells for better performance
    for (const cellKey of activeCells) {
        const [i, j] = cellKey.split(',').map(Number);
        
        if (i < 0 || i >= pheromoneGrid.food.length || j < 0 || j >= pheromoneGrid.food[0].length) {
            continue;
        }
        
        // Evaporate
        pheromoneGrid.food[i][j] *= evapRate;
        pheromoneGrid.home[i][j] *= evapRate;
        
        // Simple diffusion without creating temporary arrays
        if (pheromoneGrid.food[i][j] > 1 || pheromoneGrid.home[i][j] > 1) {
            const foodDiff = pheromoneGrid.food[i][j] * diffusionRate / 4;
            const homeDiff = pheromoneGrid.home[i][j] * diffusionRate / 4;
            
            for (const [di, dj] of neighborOffsets) {
                const ni = i + di;
                const nj = j + dj;
                
                if (ni >= 0 && ni < pheromoneGrid.food.length && 
                    nj >= 0 && nj < pheromoneGrid.food[0].length) {
                    pheromoneGrid.food[ni][nj] += foodDiff;
                    pheromoneGrid.home[ni][nj] += homeDiff;
                    pheromoneGrid.food[i][j] -= foodDiff;
                    pheromoneGrid.home[i][j] -= homeDiff;
                    
                    // Mark neighbor as active if it has significant pheromone
                    if (pheromoneGrid.food[ni][nj] > threshold || pheromoneGrid.home[ni][nj] > threshold) {
                        newActiveCells.add(`${ni},${nj}`);
                    }
                }
            }
        }
        
        // Keep cell active if it still has significant pheromone
        if (pheromoneGrid.food[i][j] > threshold || pheromoneGrid.home[i][j] > threshold) {
            newActiveCells.add(cellKey);
        } else {
            // Clear very small values for performance
            pheromoneGrid.food[i][j] = 0;
            pheromoneGrid.home[i][j] = 0;
        }
    }
    
    activePheremoneCells = newActiveCells;
}

function clearPheromones() {
    initPheromoneGrid();
}

// ========================
// Ant Class
// ========================
class Ant {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.angle = Math.random() * Math.PI * 2;
        this.hasFood = false;
        this.velocity = CONFIG.ant.speed * (CONFIG.ant.speedVariationMin + Math.random() * CONFIG.ant.speedVariationRange);
        this.targetAngle = this.angle;
    }
    
    update() {
        // Decide behavior based on whether ant has food
        if (this.hasFood) {
            this.returnToNest();
        } else {
            this.searchForFood();
        }
        
        // Move the ant
        this.move();
        
        // Drop pheromones
        this.dropPheromone();
        
        // Check for food pickup
        if (!this.hasFood) {
            this.checkFoodPickup();
        }
        
        // Check if returned to nest with food
        if (this.hasFood) {
            this.checkNestReturn();
        }
    }
    
    searchForFood() {
        // Use sensors to detect food pheromones
        const leftSensor = this.getSensorReading('left', 'food');
        const centerSensor = this.getSensorReading('center', 'food');
        const rightSensor = this.getSensorReading('right', 'food');
        
        // Smoother turning based on pheromone gradient
        const totalPheromone = leftSensor + centerSensor + rightSensor;
        
        if (totalPheromone > 0.05) {  // Reduced threshold from 0.1 for better sensitivity
            // Follow pheromone gradient with improved response
            const turnStrength = CONFIG.ant.turnSpeed;
            if (centerSensor > leftSensor && centerSensor > rightSensor) {
                // Continue mostly straight with slight correction
                const balance = (rightSensor - leftSensor) / (centerSensor + 1);
                this.targetAngle += balance * turnStrength * 0.5;
            } else if (leftSensor > rightSensor) {
                const strength = (leftSensor - rightSensor) / (leftSensor + rightSensor + 0.1);
                this.targetAngle -= turnStrength * strength * 1.5;  // Increased turning response
            } else if (rightSensor > leftSensor) {
                const strength = (rightSensor - leftSensor) / (leftSensor + rightSensor + 0.1);
                this.targetAngle += turnStrength * strength * 1.5;  // Increased turning response
            }
        } else {
            // Random wander with smoother motion
            this.targetAngle += (Math.random() - 0.5) * CONFIG.ant.wanderStrength;
        }
        
        // Smooth angle interpolation for realistic turning
        let angleDiff = this.targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        this.angle += angleDiff * CONFIG.ant.momentum;
    }
    
    returnToNest() {
        // Use sensors to detect home pheromones
        const leftSensor = this.getSensorReading('left', 'home');
        const centerSensor = this.getSensorReading('center', 'home');
        const rightSensor = this.getSensorReading('right', 'home');
        
        // Also calculate direct path to nest
        const dx = CONFIG.nest.x - this.x;
        const dy = CONFIG.nest.y - this.y;
        const angleToNest = Math.atan2(dy, dx);
        
        const totalPheromone = leftSensor + centerSensor + rightSensor;
        
        // Blend pheromone following with direct navigation
        if (totalPheromone > 0.05) {  // Reduced threshold from 0.1
            const turnStrength = CONFIG.ant.turnSpeed;
            if (centerSensor > leftSensor && centerSensor > rightSensor) {
                const balance = (rightSensor - leftSensor) / (centerSensor + 1);
                this.targetAngle += balance * turnStrength * 0.5;
            } else if (leftSensor > rightSensor) {
                const strength = (leftSensor - rightSensor) / (leftSensor + rightSensor + 0.1);
                this.targetAngle -= turnStrength * strength * 1.5;  // Increased turning response
            } else if (rightSensor > leftSensor) {
                const strength = (rightSensor - leftSensor) / (leftSensor + rightSensor + 0.1);
                this.targetAngle += turnStrength * strength * 1.5;  // Increased turning response
            }
        } else {
            // Head towards nest when no pheromone trail
            this.targetAngle = angleToNest;
        }
        
        // Smooth angle interpolation
        let angleDiff = this.targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        this.angle += angleDiff * CONFIG.ant.nestNavigationFactor;
    }
    
    getSensorReading(direction, pheromoneType) {
        let sensorAngle = this.angle;
        
        if (direction === 'left') {
            sensorAngle -= CONFIG.ant.sensorAngle;
        } else if (direction === 'right') {
            sensorAngle += CONFIG.ant.sensorAngle;
        }
        
        const sensorX = this.x + Math.cos(sensorAngle) * CONFIG.ant.sensorDistance;
        const sensorY = this.y + Math.sin(sensorAngle) * CONFIG.ant.sensorDistance;
        
        return getPheromone(pheromoneType, sensorX, sensorY);
    }
    
    move() {
        // Apply velocity with momentum
        this.velocity *= CONFIG.ant.friction;
        this.velocity = Math.max(CONFIG.ant.minSpeed, Math.min(CONFIG.ant.maxSpeed, this.velocity + CONFIG.ant.acceleration));
        
        const newX = this.x + Math.cos(this.angle) * this.velocity;
        const newY = this.y + Math.sin(this.angle) * this.velocity;
        
        // Check collision with obstacles
        if (!this.isCollidingWithObstacle(newX, newY)) {
            this.x = newX;
            this.y = newY;
        } else {
            // Bounce off obstacle with momentum consideration
            this.targetAngle += CONFIG.ant.bounceBaseAngle + (Math.random() - 0.5) * CONFIG.ant.bounceRandomVariation;
            this.velocity *= 0.5; // Reduce velocity on collision
        }
        
        // Wrap around screen edges
        if (this.x < 0) this.x = CONFIG.canvas.width;
        if (this.x > CONFIG.canvas.width) this.x = 0;
        if (this.y < 0) this.y = CONFIG.canvas.height;
        if (this.y > CONFIG.canvas.height) this.y = 0;
    }
    
    isCollidingWithObstacle(x, y) {
        for (const obstacle of obstacles) {
            const dx = x - obstacle.x;
            const dy = y - obstacle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < obstacle.radius + CONFIG.ant.size) {
                return true;
            }
        }
        return false;
    }
    
    dropPheromone() {
        const strength = settings.pheromoneStrength;
        if (this.hasFood) {
            addPheromone('home', this.x, this.y, strength * CONFIG.pheromone.homePheromoneStrength);
        } else {
            addPheromone('food', this.x, this.y, strength * CONFIG.pheromone.foodPheromoneStrength);
        }
    }
    
    checkFoodPickup() {
        for (const food of CONFIG.food) {
            if (food.amount > 0) {
                const dx = this.x - food.x;
                const dy = this.y - food.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < food.radius) {
                    this.hasFood = true;
                    food.amount--;
                    // Turn around
                    this.angle += Math.PI;
                    // Add very strong food pheromone at food source to attract other ants
                    addPheromone('food', food.x, food.y, settings.pheromoneStrength * 5);
                    break;
                }
            }
        }
    }
    
    checkNestReturn() {
        const dx = this.x - CONFIG.nest.x;
        const dy = this.y - CONFIG.nest.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < CONFIG.nest.radius) {
            this.hasFood = false;
            // Turn around
            this.angle += Math.PI;
            // Add strong home pheromone at nest to guide returning ants
            addPheromone('home', CONFIG.nest.x, CONFIG.nest.y, settings.pheromoneStrength * 3);
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Draw ant body with color that's visible in both modes
        const isDarkMode = document.body.classList.contains('dark-mode');
        ctx.fillStyle = this.hasFood ? '#ff6b6b' : (isDarkMode ? '#e0e0e0' : '#333');
        ctx.beginPath();
        ctx.ellipse(0, 0, CONFIG.ant.size * 1.5, CONFIG.ant.size, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw food if carrying
        if (this.hasFood) {
            ctx.fillStyle = '#ffeb3b';
            ctx.beginPath();
            ctx.arc(-CONFIG.ant.size, 0, CONFIG.ant.size * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
        
        // Draw sensors if enabled
        if (settings.showSensors) {
            this.drawSensors();
        }
    }
    
    drawSensors() {
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.lineWidth = 1;
        
        const angles = [
            this.angle - CONFIG.ant.sensorAngle,
            this.angle,
            this.angle + CONFIG.ant.sensorAngle
        ];
        
        for (const angle of angles) {
            const endX = this.x + Math.cos(angle) * CONFIG.ant.sensorDistance;
            const endY = this.y + Math.sin(angle) * CONFIG.ant.sensorDistance;
            
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    }
}

// ========================
// Drawing Functions
// ========================
function drawPheromones() {
    if (!settings.showPheromones) return;
    
    const gridSize = CONFIG.pheromone.gridSize;
    const isDarkMode = document.body.classList.contains('dark-mode');
    
    // Only draw active pheromone cells for better performance
    for (const cellKey of activePheremoneCells) {
        const [i, j] = cellKey.split(',').map(Number);
        
        if (i < 0 || i >= pheromoneGrid.food.length || j < 0 || j >= pheromoneGrid.food[0].length) {
            continue;
        }
        
        const foodValue = pheromoneGrid.food[i][j];
        const homeValue = pheromoneGrid.home[i][j];
        
        const x = j * gridSize;
        const y = i * gridSize;
        
        // Draw food pheromone (green) with better visibility in dark mode
        if (foodValue > 0) {
            const alpha = Math.min(foodValue / 100, 1);
            const brightness = isDarkMode ? 0.5 : 0.3;
            ctx.fillStyle = `rgba(0, 255, 0, ${alpha * brightness})`;
            ctx.fillRect(x, y, gridSize, gridSize);
        }
        
        // Draw home pheromone (blue) with better visibility in dark mode
        if (homeValue > 0) {
            const alpha = Math.min(homeValue / 100, 1);
            const brightness = isDarkMode ? 0.5 : 0.3;
            ctx.fillStyle = `rgba(100, 180, 255, ${alpha * brightness})`;
            ctx.fillRect(x, y, gridSize, gridSize);
        }
    }
}

function drawNest() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    
    // Outer ring
    ctx.fillStyle = isDarkMode ? '#8b6914' : '#8b4513';
    ctx.beginPath();
    ctx.arc(CONFIG.nest.x, CONFIG.nest.y, CONFIG.nest.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner darker circle
    ctx.fillStyle = isDarkMode ? '#6b4f0a' : '#654321';
    ctx.beginPath();
    ctx.arc(CONFIG.nest.x, CONFIG.nest.y, CONFIG.nest.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();
    
    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEST', CONFIG.nest.x, CONFIG.nest.y);
}

function drawFood() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    
    for (const food of CONFIG.food) {
        if (food.amount > 0) {
            // Main food circle
            ctx.fillStyle = isDarkMode ? '#66bb6a' : '#4caf50';
            ctx.beginPath();
            ctx.arc(food.x, food.y, food.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner highlight
            ctx.fillStyle = isDarkMode ? '#81c784' : '#66bb6a';
            ctx.beginPath();
            ctx.arc(food.x - food.radius * 0.2, food.y - food.radius * 0.2, food.radius * 0.6, 0, Math.PI * 2);
            ctx.fill();
            
            // Amount label
            ctx.fillStyle = isDarkMode ? '#000' : '#fff';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(food.amount, food.x, food.y);
        }
    }
}

function drawObstacles() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    ctx.fillStyle = isDarkMode ? '#999' : '#666';
    ctx.strokeStyle = isDarkMode ? '#bbb' : '#888';
    ctx.lineWidth = 1;
    
    for (const obstacle of obstacles) {
        ctx.beginPath();
        ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
}

function drawStats() {
    // Update stats bar instead of drawing on canvas
    const antsWithFood = ants.filter(ant => ant.hasFood).length;
    const totalFood = CONFIG.food.reduce((sum, food) => sum + food.amount, 0);
    
    document.getElementById('stat-ants').textContent = ants.length;
    document.getElementById('stat-carrying').textContent = antsWithFood;
    document.getElementById('stat-food').textContent = totalFood;
    document.getElementById('stat-pheromones').textContent = settings.showPheromones ? 'Visible' : 'Hidden';
}

// ========================
// Simulation Loop
// ========================
let lastUpdateTime = 0;
const BASE_UPDATE_INTERVAL = 16.67; // ~60 FPS

function update(currentTime) {
    if (!lastUpdateTime) lastUpdateTime = currentTime;
    const deltaTime = currentTime - lastUpdateTime;
    
    // Apply simulation speed multiplier
    const updateInterval = BASE_UPDATE_INTERVAL / settings.simulationSpeed;
    
    if (deltaTime >= updateInterval) {
        // Update all ants
        for (const ant of ants) {
            ant.update();
        }
        
        // Evaporate pheromones
        evaporatePheromones();
        
        lastUpdateTime = currentTime;
    }
}

function draw() {
    // Clear canvas with theme-appropriate background
    const isDarkMode = document.body.classList.contains('dark-mode');
    ctx.fillStyle = isDarkMode ? '#0f172a' : '#1a1a1a';
    ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
    
    // Draw everything in order
    drawPheromones();
    drawObstacles();
    drawNest();
    drawFood();
    
    for (const ant of ants) {
        ant.draw();
    }
    
    drawStats();
}

function gameLoop(currentTime) {
    update(currentTime);
    draw();
    requestAnimationFrame(gameLoop);
}

// ========================
// Initialization
// ========================
function initAnts() {
    ants = [];
    for (let i = 0; i < settings.antCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * CONFIG.nest.radius;
        const x = CONFIG.nest.x + Math.cos(angle) * distance;
        const y = CONFIG.nest.y + Math.sin(angle) * distance;
        ants.push(new Ant(x, y));
    }
}

function init() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    
    initPheromoneGrid();
    initAnts();
    setupEventListeners();
    gameLoop();
}

// ========================
// Event Handlers
// ========================
function getCanvasCoordinates(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    
    // Calculate the scale factor between displayed size and internal resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Convert client coordinates to canvas coordinates
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    return { x, y };
}

function setupEventListeners() {
    // Control sliders
    const antCountSlider = document.getElementById('ant-count');
    const antCountValue = document.getElementById('ant-count-value');
    antCountSlider.addEventListener('input', (e) => {
        settings.antCount = parseInt(e.target.value);
        antCountValue.textContent = settings.antCount;
        initAnts();
    });
    
    const pheromoneStrengthSlider = document.getElementById('pheromone-strength');
    const pheromoneStrengthValue = document.getElementById('pheromone-strength-value');
    pheromoneStrengthSlider.addEventListener('input', (e) => {
        settings.pheromoneStrength = parseInt(e.target.value);
        pheromoneStrengthValue.textContent = settings.pheromoneStrength;
    });
    
    const evaporationRateSlider = document.getElementById('evaporation-rate');
    const evaporationRateValue = document.getElementById('evaporation-rate-value');
    evaporationRateSlider.addEventListener('input', (e) => {
        settings.evaporationRate = parseFloat(e.target.value) / 100;
        evaporationRateValue.textContent = settings.evaporationRate.toFixed(2);
    });
    
    const simulationSpeedSlider = document.getElementById('simulation-speed');
    const simulationSpeedValue = document.getElementById('simulation-speed-value');
    simulationSpeedSlider.addEventListener('input', (e) => {
        settings.simulationSpeed = parseFloat(e.target.value) / 100;
        simulationSpeedValue.textContent = settings.simulationSpeed.toFixed(1) + 'x';
    });
    
    // Checkboxes
    document.getElementById('show-pheromones').addEventListener('change', (e) => {
        settings.showPheromones = e.target.checked;
    });
    
    document.getElementById('show-sensors').addEventListener('change', (e) => {
        settings.showSensors = e.target.checked;
    });
    
    // Buttons
    document.getElementById('clear-pheromones').addEventListener('click', () => {
        clearPheromones();
    });
    
    document.getElementById('clear-obstacles').addEventListener('click', () => {
        obstacles = [];
    });
    
    document.getElementById('reset-simulation').addEventListener('click', () => {
        clearPheromones();
        obstacles = [];
        // Reset food amounts
        CONFIG.food.forEach((food, index) => {
            food.amount = INITIAL_FOOD_AMOUNTS[index];
        });
        initAnts();
    });
    
    // Canvas drawing for obstacles
    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const coords = getCanvasCoordinates(e.clientX, e.clientY);
        lastMousePos.x = coords.x;
        lastMousePos.y = coords.y;
        addObstacle(lastMousePos.x, lastMousePos.y);
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (isDrawing) {
            const coords = getCanvasCoordinates(e.clientX, e.clientY);
            const x = coords.x;
            const y = coords.y;
            
            // Add obstacle if moved enough
            const dx = x - lastMousePos.x;
            const dy = y - lastMousePos.y;
            if (Math.sqrt(dx * dx + dy * dy) > 10) {
                addObstacle(x, y);
                lastMousePos.x = x;
                lastMousePos.y = y;
            }
        }
    });
    
    canvas.addEventListener('mouseup', () => {
        isDrawing = false;
    });
    
    canvas.addEventListener('mouseleave', () => {
        isDrawing = false;
    });
    
    // Touch support for mobile
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isDrawing = true;
        const touch = e.touches[0];
        const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
        lastMousePos.x = coords.x;
        lastMousePos.y = coords.y;
        addObstacle(lastMousePos.x, lastMousePos.y);
    });
    
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (isDrawing) {
            const touch = e.touches[0];
            const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
            const x = coords.x;
            const y = coords.y;
            
            const dx = x - lastMousePos.x;
            const dy = y - lastMousePos.y;
            if (Math.sqrt(dx * dx + dy * dy) > 10) {
                addObstacle(x, y);
                lastMousePos.x = x;
                lastMousePos.y = y;
            }
        }
    });
    
    canvas.addEventListener('touchend', () => {
        isDrawing = false;
    });
}

function addObstacle(x, y) {
    // Don't add obstacles on nest or food
    const distToNest = Math.sqrt((x - CONFIG.nest.x) ** 2 + (y - CONFIG.nest.y) ** 2);
    if (distToNest < CONFIG.nest.radius + CONFIG.obstacle.bufferDistance) return;
    
    for (const food of CONFIG.food) {
        const distToFood = Math.sqrt((x - food.x) ** 2 + (y - food.y) ** 2);
        if (distToFood < food.radius + CONFIG.obstacle.bufferDistance) return;
    }
    
    obstacles.push({ x, y, radius: CONFIG.obstacle.radius });
}

// ========================
// Start Simulation
// ========================
window.addEventListener('load', init);
