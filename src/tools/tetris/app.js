SQUARE_SIZE = 40;
COLOR_A = "#f98776";
COLOR_B = "#eec747";
COLOR_C = "#d3d3d3";
COLOR_D = "#b3b3b3";
COLOR_E = "#4ca394";
COLOR_F = "#6f292e";

class Model {
    constructor(numRows, numCols) {
        // grid of colors, initially all white
        this.grid = [];
        for (let i = 0; i < numRows; i++) {
            this.grid.push([]);
            for (let j = 0; j < numCols; j++) {
                this.grid[i].push("white");
            }
        }
    }

    addShape(x, y, shape, color) {
        for (let i = 0; i < shape.length && y + i < this.grid.length; i++) {
            for (let j = 0; j < shape[i].length && x + j < this.grid[i].length; j++) {
                if (shape[i][j] === 1) {
                    this.grid[y + i][x + j] = color;
                }
            }
        }
    }


    removeShape(x, y, shape) {
        for (let i = 0; i < shape.length && y + i < this.grid.length; i++) {
            for (let j = 0; j < shape[i].length && x + j < this.grid[i].length; j++) {
                if (shape[i][j] === 1) {
                    this.grid[y + i][x + j] = "white";
                }
            }
        }
    }

    areCoordinatesInBounds(x, y) {
        return x >= 0 && x < this.grid[0].length && y >= 0 && y < this.grid.length;
    }

    isAreaFree(x, y, shape) {
        for (let i = 0; i < shape.length; i++) {
            for (let j = 0; j < shape[i].length; j++) {
                if (shape[i][j] === 1) {
                    if (!this.areCoordinatesInBounds(x + j, y + i) || this.grid[y + i][x + j] !== "white") {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    canMoveShape(oldX, oldY, oldShape, newX, newY, newShape, color) {
        this.removeShape(oldX, oldY, oldShape);
        var flag = this.isAreaFree(newX, newY, newShape)
        this.addShape(oldX, oldY, oldShape, color);
        return flag;
    }

    moveShape(oldX, oldY, oldShape, newX, newY, newShape, color) {
        this.removeShape(oldX, oldY, oldShape);
        this.addShape(newX, newY, newShape, color);
    }


    isRowFull(row) {
        for (let i = 0; i < this.grid[row].length; i++) {
            if (this.grid[row][i] === "white") {
                return false;
            }
        }
        return true;
    }

    removeRow(row) {
        // move all rows above down
        for (let i = row; i > 0; i--) {
            for (let j = 0; j < this.grid[i].length; j++) {
                this.grid[i][j] = this.grid[i - 1][j];
            }
        }

        // set row 0 to white
        for (let i = 0; i < this.grid[0].length; i++) {
            this.grid[0][i] = "white";
        }
    }

    removeFullRows() {
        for (let i = 0; i < this.grid.length; i++) {
            if (this.isRowFull(i)) {
                this.removeRow(i);
            }
        }
    }

    draw(ctx) {
        for (let i = 0; i < this.grid.length; i++) {
            for (let j = 0; j < this.grid[i].length; j++) {
                ctx.fillStyle = this.grid[i][j];
                ctx.fillRect(j * SQUARE_SIZE, i * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
            }
        }
    }

}

class Shape {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.dx = 0;
        this.dy = SQUARE_SIZE / 4;
        this.rotation = 0;
        this.color = color;
        this.evolution = [];
        this.currentIdx = 0;
    }

    move(ctx) {
        console.log("move", this.x, this.y, this.dx, this.dy)
        this.x += this.dx;
        this.y += this.dy;

        this.dx = 0;
        this.dy = SQUARE_SIZE / 4;

        while (this.rotation >= 0) {
            this.rotate();
            this.rotation -= 1;
        }

        if (this.x < 0) {

            this.x = 0;
        }

        if (this.x + this.shape()[0].length * SQUARE_SIZE > ctx.canvas.width) {
            this.x = ctx.canvas.width - this.shape()[0].length * SQUARE_SIZE;
        }
    }

    rotate() {
        this.currentIdx = (this.currentIdx + 1) % this.evolution.length;
    }

    shape() {
        return this.evolution[this.currentIdx];
    }
}

class TShape extends Shape {
    constructor(x, y, color) {
        super(x, y, color);
        this.evolution = [
            [
                [1, 1, 1],
                [0, 1, 0],
            ],
            [
                [1, 0],
                [1, 1],
                [1, 0],
            ],
            [
                [0, 1, 0],
                [1, 1, 1],
            ],
            [
                [0, 1],
                [1, 1],
                [0, 1],
            ],
        ];
    }
}

class LShape extends Shape {
    constructor(x, y, color) {
        super(x, y, color);
        this.evolution = [
            [
                [1, 0],
                [1, 0],
                [1, 1],
            ],
            [
                [0, 0, 1],
                [1, 1, 1],
            ],
            [
                [1, 1],
                [0, 1],
                [0, 1],
            ],
            [
                [1, 1, 1],
                [1, 0, 0],
            ],
        ];
    }
}

class SkewShape extends Shape {
    constructor(x, y, color) {
        super(x, y, color);
        this.evolution = [
            [
                [1, 0],
                [1, 1],
                [0, 1],
            ],
            [
                [0, 1, 1],
                [1, 1, 0],
            ],
        ];
    }
}

class SquareShape extends Shape {
    constructor(x, y, color) {
        super(x, y, color);
        this.evolution = [
            [
                [1, 1],
                [1, 1],
            ],
        ];
    }
}

class StraightShape extends Shape {
    constructor(x, y, color) {
        super(x, y, color);
        this.evolution = [
            [
                [1],
                [1],
                [1],
                [1],
            ],
            [
                [1, 1, 1, 1],
            ],
        ];
    }
}


class Game {
    constructor(ctx) {
        this.init(ctx);
    }

    init(ctx) {
        this.currentShape = null;
        this.isGameOver = false;

        let numRows = Math.floor(ctx.canvas.height / SQUARE_SIZE);
        let numCols = Math.floor(ctx.canvas.width / SQUARE_SIZE);
        this.model = new Model(numRows, numCols);
    }

    startOver(ctx) {
        this.init(ctx);
    }

    generateShape() {
        let shape = Math.floor(Math.random() * 5);
        let color = Math.floor(Math.random() * 6);
        let x = SQUARE_SIZE * Math.floor(Math.random() * 12);
        let y = 0;

        let colors = [COLOR_A, COLOR_B, COLOR_C, COLOR_D, COLOR_E, COLOR_F];
        let shapes = [TShape, LShape, SkewShape, SquareShape, StraightShape];

        this.currentShape = new shapes[shape](x, y, colors[color]);
    }

    draw(ctx) {

        if (this.isGameOver) {
            ctx.font = "30px Arial";
            ctx.fillStyle = "black";
            ctx.fillText("Game Over", ctx.canvas.width / 2 - 100, ctx.canvas.height / 2);
            return;
        }

        this.model.draw(ctx);
    }

    update(ctx) {

        if (this.isGameOver) {
            return;
        }

        if (!this.currentShape) {
            this.generateShape();
            this.model.addShape(this.currentShape.x, this.currentShape.y, this.currentShape.shape(), this.currentShape.color);
        }

        var oldX = Math.floor(this.currentShape.x / SQUARE_SIZE);
        var oldY = Math.floor(this.currentShape.y / SQUARE_SIZE);
        let oldShape = this.currentShape.shape();
        this.currentShape.move(ctx);
        var newX = Math.floor(this.currentShape.x / SQUARE_SIZE);
        var newY = Math.floor(this.currentShape.y / SQUARE_SIZE);
        let newShape = this.currentShape.shape();

        console.log("Old: " + oldX + ", " + oldY + ", " + oldShape);
        console.log("New: " + newX + ", " + newY + ", " + newShape);

        if (this.model.canMoveShape(oldX, oldY, oldShape, newX, newY, newShape, this.currentShape.color)) {
            this.model.moveShape(oldX, oldY, oldShape, newX, newY, newShape, this.currentShape.color);
        } else {

            if (newY == 0) {
                this.isGameOver = true;
                return;
            }
            this.currentShape = null;
        }

        this.model.removeFullRows();

    }
}

function main() {
    window.addEventListener("keydown", function(e) {
        if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.code) > -1) {
            e.preventDefault();
        }
    }, false);

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    //  you need to set the scale property to 1 so it doesn't use the devicePixelRatio: html2canvas.hertzen.com/configuration
    ctx.scale(1, 1);

    // set the width of the canvas to match a neat multiple of SQUARE_SIZE
    canvas.width = canvas.width - canvas.width % SQUARE_SIZE;
    canvas.height = canvas.height - canvas.height % SQUARE_SIZE;

    // focus on the canvas
    canvas.focus();

    let game = new Game(ctx);

    document.addEventListener('keydown', function(event) {
        const key = event.key;
        if (key === 'ArrowLeft') {
            if (game.currentShape) {
                game.currentShape.dx = -SQUARE_SIZE;
            }
        }

        if (key === 'ArrowRight') {
            if (game.currentShape) {

                game.currentShape.dx = SQUARE_SIZE;
            }
        }

        if (key === 'ArrowDown') {
            if (game.currentShape) {

                game.currentShape.dy += SQUARE_SIZE / 4;
            }
        }

        if (key === ' ') {
            if (game.currentShape) {

                game.currentShape.rotation += 1;
            }
        }

        if (key === 'Escape') {
            game.startOver(ctx);
        }

    });

    canvas.addEventListener('touchmove', function(event) {
        event.preventDefault();
        // prevent scrolling

        // prevent zooming
        event.preventDefault();
        });

    // define touch start event listener
    canvas.addEventListener('touchstart', function(event) {
        // get touch point coordinates
        const x = event.touches[0].clientX;
        const y = event.touches[0].clientY;

        // get current shape coordinates
        const shapeX = game.currentShape.x;
        const shapeY = game.currentShape.y;

        // calculate distance between touch point and shape
        const dx = x - shapeX;


        // if touch point is on the left side of the shape, move left
        if (dx < 0) {
            game.currentShape.dx = -SQUARE_SIZE;

            // if touch point is on the right side of the shape, move right
        } else {
            game.currentShape.dx = SQUARE_SIZE;

        }



    });


    let lastTap = null;

    canvas.addEventListener('touchend', function(event) {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (lastTap && tapLength < 500 && tapLength > 0) {
            if (game.isGameOver) {
                game.startOver(ctx);
            } else {
                if (game.currentShape) {
                    game.currentShape.rotation += 1;
                }
            }
        }
        lastTap = currentTime;
    });

    // use setInterval to update and draw the game 10 times per second
    setInterval(function() {
        game.update(ctx);
        draw(ctx, game);
    }, 100);

}

function draw(ctx, game) {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    game.draw(ctx);
}

main();