const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
let grid;
let shapes;
let currentShape = null;
let lastTime = 0;
let accumulator = 0;
const moveInterval = 1000;
let gameOver = false;
let score = 0;

function calculateCellSize() {
    const screenWidth = window.innerWidth;
    let cellSize = 50;

    if (screenWidth <= 600) {
        cellSize = 30;
    } else if (screenWidth <= 1024) {
        cellSize = 40;
    }

    return cellSize;
}

const cellSize = calculateCellSize();

class Position {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    moveLeft() {
        this.x--;
    }

    moveRight() {
        this.x++;
    }

    moveDown() {
        this.y++;
    }

    update(newX, newY) {
        this.x = newX;
        this.y = newY;
    }
}

class Shape {
    constructor(startX, startY, positions) {
        this.positions = positions.map(pos =>
            new Position(pos.x + startX, pos.y + startY)
        );
    }

    rotate() {}

    moveLeft() {
        if (this.positions.some(position => position.x <= 0) || checkCollisionForLeft(this)) {
            return;
        }
        this.positions.forEach(position => position.moveLeft());
    }

    moveRight() {
        if (this.positions.some(position => position.x >= grid.width - 1) || checkCollisionForRight(this)) {
            return;
        }
        this.positions.forEach(position => position.moveRight());
    }

    moveDown() {
        if (this.positions.some(position => position.y >= grid.height - 1)) {
            return;
        }
        this.positions.forEach(position => position.moveDown());
    }
}

class TShape extends Shape {
    constructor(startX = 0, startY = 0) {
        super(startX, startY, [
            new Position(0, 0), new Position(-1, 0), new Position(1, 0), new Position(0, -1)
        ]);
        this.color = "#FFD700";
    }

    rotate() {
        const pivot = this.positions[0];

        for (let i = 1; i < this.positions.length; i++) {
            const pos = this.positions[i];
            const x = pos.x - pivot.x;
            const y = pos.y - pivot.y;
            const rotatedX = -y;
            const rotatedY = x;
            pos.x = rotatedX + pivot.x;
            pos.y = rotatedY + pivot.y;
        }
    }
}

class SquareShape extends Shape {
    constructor(startX = 0, startY = 0) {
        super(startX, startY, [
            new Position(0, 0), new Position(0, 1), new Position(1, 0), new Position(1, 1)
        ]);
        this.color = "#f98776";
    }

    rotate() {}
}

class LineShape extends Shape {
    constructor(startX = 0, startY = 0) {
        super(startX, startY, [
            new Position(0, 0),
            new Position(-1, 0),
            new Position(1, 0),
            new Position(2, 0)
        ]);
        this.color = "#ADD8E6";
    }

    rotate() {
        const pivot = this.positions[0];

        for (let i = 1; i < this.positions.length; i++) {
            const relativeX = this.positions[i].x - pivot.x;
            const relativeY = this.positions[i].y - pivot.y;
            this.positions[i].x = pivot.x - relativeY;
            this.positions[i].y = pivot.y + relativeX;
        }
    }
}

class LShape extends Shape {
    constructor(startX = 0, startY = 0) {
        super(startX, startY, [
            new Position(0, 0),
            new Position(-1, 0),
            new Position(1, 0),
            new Position(1, -1)
        ]);
        this.rotationState = 0;
        this.color = "#d3d3d3";
    }

    rotate() {
        const pivot = this.positions[0];

        const rotationStates = [
            [new Position(0, -1), new Position(0, 1), new Position(-1, 1)],
            [new Position(1, 0), new Position(-1, 0), new Position(-1, -1)],
            [new Position(0, 1), new Position(0, -1), new Position(1, -1)],
            [new Position(-1, 0), new Position(1, 0), new Position(1, 1)]
        ];

        for (let i = 1; i < this.positions.length; i++) {
            this.positions[i].update(
                pivot.x + rotationStates[this.rotationState][i - 1].x,
                pivot.y + rotationStates[this.rotationState][i - 1].y
            );
        }

        this.rotationState = (this.rotationState + 1) % 4;
    }
}

class ReversedLShape extends Shape {
    constructor(startX = 0, startY = 0) {
        super(startX, startY, [
            new Position(0, 0),
            new Position(-1, 0),
            new Position(1, 0),
            new Position(-1, -1)
        ]);
        this.rotationState = 0;
        this.color = "#f0a500";
    }

    rotate() {
        const pivot = this.positions[0];

        const rotationStates = [
            [new Position(0, -1), new Position(0, 1), new Position(-1, -1)],
            [new Position(-1, 0), new Position(1, 0), new Position(1, -1)],
            [new Position(0, 1), new Position(0, -1), new Position(1, 1)],
            [new Position(1, 0), new Position(-1, 0), new Position(-1, 1)]
        ];

        for (let i = 1; i < this.positions.length; i++) {
            this.positions[i].update(
                pivot.x + rotationStates[this.rotationState][i - 1].x,
                pivot.y + rotationStates[this.rotationState][i - 1].y
            );
        }

        this.rotationState = (this.rotationState + 1) % 4;
    }
}

function createNewShape() {
    const shapeTypes = [TShape, SquareShape, LineShape, LShape, ReversedLShape];
    const randomIndex = Math.floor(Math.random() * shapeTypes.length);
    const shapeType = shapeTypes[randomIndex];
    return new shapeType(Math.floor(grid.width / 2), 0);
}

function hasReachedBottom(shape) {
    return shape.positions.some(pos => pos.y >= grid.height - 1);
}

function checkCollisionWithOtherShapes(currentShape) {
    for (const shape of shapes) {
        if (shape !== currentShape) {
            for (const pos of shape.positions) {
                for (const currentPos of currentShape.positions) {
                    if (currentPos.x === pos.x && currentPos.y + 1 === pos.y) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

function checkCollisionForLeft(currentShape) {
    return checkCollisionWithDirection(currentShape, -1);
}

function checkCollisionForRight(currentShape) {
    return checkCollisionWithDirection(currentShape, 1);
}

function checkCollisionWithDirection(currentShape, deltaX) {
    for (const shape of shapes) {
        if (shape !== currentShape) {
            for (const pos of shape.positions) {
                for (const currentPos of currentShape.positions) {
                    if (currentPos.x + deltaX === pos.x && currentPos.y === pos.y) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

class Cell {
    constructor() {
        this.reset();
    }

    reset() {
        this.color = getColorForMode('white', 'black');
    }

    fill(color) {
        this.color = color;
    }
}

class Grid {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.array = this.createGrid();
    }

    createGrid() {
        let array = new Array(this.height);
        for (let y = 0; y < this.height; y++) {
            array[y] = new Array(this.width);
            for (let x = 0; x < this.width; x++) {
                array[y][x] = new Cell();
            }
        }
        return array;
    }

    reset() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.array[y][x].reset();
            }
        }
    }

    fillCell(x, y, color) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.array[y][x].fill(color);
        }
    }

    render(context) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.array[y][x];
                context.fillStyle = cell.color;
                context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }
}

function adjustCanvas() {
    const rect = canvas.getBoundingClientRect();
    const gridWidthCells = Math.floor(rect.width / cellSize);
    const gridHeightCells = Math.floor(rect.height / cellSize);
    canvas.width = gridWidthCells * cellSize;
    canvas.height = gridHeightCells * cellSize;
    grid = new Grid(gridWidthCells, gridHeightCells);
}

function gameLoop(timestamp) {
    if (gameOver) {
        renderGameOverOverlay();
        return;
    }
    if (!lastTime) lastTime = timestamp;
    let deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    accumulator += deltaTime;

    if (accumulator > moveInterval) {
        if (hasReachedBottom(currentShape) || checkCollisionWithOtherShapes(currentShape)) {
            shapes.push(currentShape);
            currentShape = createNewShape();
            if (checkCollisionWithOtherShapes(currentShape)) {
                gameOver = true;
                renderGameOverOverlay();
                return;
            }
        } else {
            currentShape.moveDown();
        }
        accumulator -= moveInterval;
    }

    updateAndRender();
    requestAnimationFrame(gameLoop);
    let fullRows = getFullRows();
    if (fullRows.length > 0) {
        console.log(fullRows);
        clearFullRows(fullRows);
    }
}

function moveCurrentShapeDown() {
    if (hasReachedBottom(currentShape) || checkCollisionWithOtherShapes(currentShape)) {
        shapes.push(currentShape);
        currentShape = createNewShape();
    } else {
        currentShape.moveDown();
    }
}

function getFullRows() {
    let fullRows = [];
    for (let y = 0; y < grid.height; y++) {
        let isRowFull = true;
        for (let x = 0; x < grid.width; x++) {
            if (!grid.array[y][x].color || grid.array[y][x].color === getColorForMode('white', 'black')) {
                isRowFull = false;
                break;
            }
        }
        if (isRowFull) {
            fullRows.push(y);
        }
    }
    return fullRows;
}

function clearFullRows(fullRows) {
    for (let y of fullRows) {
        for (let shape of shapes) {
            shape.positions = shape.positions.filter(pos => pos.y !== y);
        }
        for (let shape of shapes) {
            shape.positions.forEach(pos => {
                if (pos.y < y) {
                    pos.y += 1;
                }
            });
        }
        score += 1;
    }
}

function renderGameOverOverlay() {
    context.fillStyle = 'rgba(128, 128, 128, 0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = getColorForMode('black', 'white');
    context.font = '40px Arial';
    context.textAlign = 'center';
    context.fillText('Game Over', canvas.width / 2, canvas.height / 2);
}

function updateAndRender() {
    grid.reset();
    [currentShape, ...shapes].forEach(shape => {
        shape.positions.forEach(pos => {
            if (pos.x >= 0 && pos.x < grid.width && pos.y >= 0 && pos.y < grid.height) {
                grid.fillCell(pos.x, pos.y, shape.color);
            }
        });
    });
    grid.render(context);
    renderScore();
}

function renderScore() {
    context.fillStyle = getColorForMode('black', 'white');
    context.font = '20px Arial';
    context.fillText('Score: ' + score, 10, 30);
}

function restartGame() {
    gameOver = false;
    score = 0;
    shapes = [];
    currentShape = createNewShape();
    accumulator = 0;
    lastTime = 0;
    updateAndRender();
    requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', function(event) {
    switch (event.key) {
        case 'Escape':
            restartGame();
            break;
        case 'ArrowLeft':
            currentShape.moveLeft();
            event.preventDefault();
            break;
        case 'ArrowRight':
            currentShape.moveRight();
            event.preventDefault();
            break;
        case 'ArrowDown':
            moveCurrentShapeDown();
            event.preventDefault();
            break;
        case 'ArrowUp':
        case ' ':
            currentShape.rotate();
            event.preventDefault();
            break;
    }
    updateAndRender();
});

document.getElementById('leftButton').addEventListener('touchstart', function() {
    currentShape.moveLeft();
    updateAndRender();
});

document.getElementById('rightButton').addEventListener('touchstart', function() {
    currentShape.moveRight();
    updateAndRender();
});

document.getElementById('downButton').addEventListener('touchstart', function() {
    moveCurrentShapeDown();
    updateAndRender();
});

document.getElementById('rotateButton').addEventListener('touchstart', function() {
    currentShape.rotate();
    updateAndRender();
});

adjustCanvas();
window.addEventListener('resize', adjustCanvas);

currentShape = createNewShape();
shapes = [];

requestAnimationFrame(gameLoop);