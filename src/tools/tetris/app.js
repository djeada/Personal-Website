const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
let grid;
let shapes;
let currentShape = null;
let lastTime = 0;
let accumulator = 0; // Accumulator for time elapsed
const moveInterval = 1000; // Move down every 1000 milliseconds (1 second)
let gameOver = false;
let score = 0;

function calculateCellSize() {
    const screenWidth = window.innerWidth;
    let cellSize = 50; // Default size for large screens

    if (screenWidth <= 600) { // Considered as a mobile device
        cellSize = 25;
    } else if (screenWidth <= 1024) { // Considered as a tablet or small desktop
        cellSize = 35;
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

    rotate() {
        // Implement rotation logic specific to the shape
    }

    moveLeft() {
        if (this.positions.some(position => position.x <= 0) || checkCollisionForLeft(this)) {
            return; // Do not move if it would go out of bounds or collide
        }
        this.positions.forEach(position => position.moveLeft());
    }

    moveRight() {
        if (this.positions.some(position => position.x >= grid.width - 1) || checkCollisionForRight(this)) {
            return; // Do not move if it would go out of bounds or collide
        }
        this.positions.forEach(position => position.moveRight());
    }

    moveDown() {
        // Check if any part of the shape would go out of the grid's bottom boundary
        if (this.positions.some(position => position.y >= grid.height - 1)) {
            return; // Do not move if it would go out of bounds
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
        // Rotating each block around the pivot (the first block)
        const pivot = this.positions[0];

        for (let i = 1; i < this.positions.length; i++) {
            const pos = this.positions[i];

            // Translate position relative to pivot, rotate, then translate back
            const x = pos.x - pivot.x;
            const y = pos.y - pivot.y;

            // Applying 90 degree rotation transformation
            const rotatedX = -y;
            const rotatedY = x;

            // Update position
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

    rotate() {

    }

}


class LineShape extends Shape {
    constructor(startX = 0, startY = 0) {
        super(startX, startY, [
            new Position(0, 0),
            new Position(-1, 0),
            new Position(1, 0),
            new Position(2, 0)
        ]);
        this.color = "#eec747";
    }

    rotate() {
        // Get the center position (pivot)
        const pivot = this.positions[0];

        // Rotate the LineShape by 90 degrees
        for (let i = 1; i < this.positions.length; i++) {
            const relativeX = this.positions[i].x - pivot.x;
            const relativeY = this.positions[i].y - pivot.y;
            // Rotate 90 degrees counterclockwise
            // New X = -old Y, New Y = old X
            this.positions[i].x = pivot.x - relativeY;
            this.positions[i].y = pivot.y + relativeX;
        }
    }
}

class LShape extends Shape {
    constructor(startX = 0, startY = 0) {
        super(startX, startY, [
            new Position(0, 0), // Center block (pivot)
            new Position(-1, 0), // Tail of the 'L'
            new Position(1, 0), // End of the line
            new Position(1, -1) // Head of the 'L'
        ]);
        this.rotationState = 0;
        this.color = "#d3d3d3";
    }

    rotate() {
        // Rotate around the center block
        const pivot = this.positions[0];

        // Define rotation states
        const rotationStates = [
            [new Position(0, -1), new Position(0, 1), new Position(1, 1)], // State 0 to 1
            [new Position(1, 0), new Position(-1, 0), new Position(-1, -1)], // State 1 to 2
            [new Position(0, 1), new Position(0, -1), new Position(-1, -1)], // State 2 to 3
            [new Position(-1, 0), new Position(1, 0), new Position(1, 1)] // State 3 to 0
        ];

        // Update positions based on rotation state
        this.positions[1].update(pivot.x + rotationStates[this.rotationState][0].x, pivot.y + rotationStates[this.rotationState][0].y);
        this.positions[2].update(pivot.x + rotationStates[this.rotationState][1].x, pivot.y + rotationStates[this.rotationState][1].y);
        this.positions[3].update(pivot.x + rotationStates[this.rotationState][2].x, pivot.y + rotationStates[this.rotationState][2].y);

        // Update rotation state
        this.rotationState = (this.rotationState + 1) % 4;
    }
}

function createNewShape() {
    const shapeTypes = [TShape, SquareShape, LineShape, LShape];
    const randomIndex = Math.floor(Math.random() * shapeTypes.length);
    const shapeType = shapeTypes[randomIndex];
    // Assuming the grid is wide enough, start in the middle at the top
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
                        return true; // Collision detected
                    }
                }
            }
        }
    }
    return false; // No collision
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
                        return true; // Collision detected
                    }
                }
            }
        }
    }
    return false; // No collision
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

    // Method to fill a cell with a specific color
    fillCell(x, y, color) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.array[y][x].fill(color);
        }
    }

    // Render the grid on the canvas
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

    // Calculate the number of cells that can fit in the current canvas size
    const gridWidthCells = Math.floor(rect.width / cellSize);
    const gridHeightCells = Math.floor(rect.height / cellSize);

    // Adjust the canvas size to fit whole cells only
    canvas.width = gridWidthCells * cellSize;
    canvas.height = gridHeightCells * cellSize;

    // Create a new grid with the adjusted size
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
        console.log(fullRows)
        clearFullRows(fullRows);
    }
}

function moveCurrentShapeDown() {
    if (hasReachedBottom(currentShape) || checkCollisionWithOtherShapes(currentShape)) {
        // Fix the shape in place
        shapes.push(currentShape);

        // Create a new shape without carrying over the previous shape's positions
        currentShape = createNewShape();
    } else {
        // Move the current shape down
        currentShape.moveDown();
    }
}

function getFullRows() {
    let fullRows = [];

    // Loop through each row
    for (let y = 0; y < grid.height; y++) {
        let isRowFull = true;

        // Check each cell in the row
        for (let x = 0; x < grid.width; x++) {
            if (!grid.array[y][x].color || grid.array[y][x].color === getColorForMode('white', 'black')) {
                // If any cell is not filled (or is white), the row is not full
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

        // Remove the filled positions from all shapes
        for (let shape of shapes) {
            shape.positions = shape.positions.filter(pos => pos.y !== y);
        }

        // Move down the positions above the cleared row
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
    context.fillStyle = 'rgba(128, 128, 128, 0.5)'; // Semi-transparent gray overlay
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = getColorForMode('black', 'white');
    context.font = '40px Arial';
    context.textAlign = 'center';
    context.fillText('Game Over', canvas.width / 2, canvas.height / 2);
}


function updateAndRender() {
    grid.reset();
    // Draw all shapes including the current shape
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
    context.fillText('Score: ' + score, 10, 30); // Positioned 10px from the top and left
}

function restartGame() {
    gameOver = false;
    score = 0;
    shapes = [];
    currentShape = createNewShape();
    accumulator = 0; // Reset the accumulator
    lastTime = 0; // Reset the lastTime
    updateAndRender(); // Update and render the initial state
    requestAnimationFrame(gameLoop); // Restart the game loop
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
            currentShape.rotate();
            event.preventDefault();
            break;
        case ' ':
            currentShape.rotate(); // ' ' is the space bar
            event.preventDefault();
            break;
    }
    updateAndRender(); // Update the game state immediately after input
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

// Start the game loop
currentShape = createNewShape();
shapes = [];

requestAnimationFrame(gameLoop);