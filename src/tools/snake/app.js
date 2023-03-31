document.addEventListener("DOMContentLoaded", function() {

const SQUARE_SIZE = 40;
const MOVE_DELAY = 200;
const COLOR_A = "#f98776";
const COLOR_B = "#eec747";

// class square
class Square {
    constructor(x, y, size, color) {
        x = Math.floor(x / SQUARE_SIZE) * SQUARE_SIZE;
        y = Math.floor(y / SQUARE_SIZE) * SQUARE_SIZE;
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }

    //static method are squares colliding
    static areColliding(square1, square2) {
        // checks if the distance between the centers of the squares is less than the sum of the half of the squares
        let distance = Math.sqrt(
            Math.pow(square1.x - square2.x, 2) + Math.pow(square1.y - square2.y, 2)
        );
        return distance < (square1.size + square2.size) / 2;
    }
}

// class snake
class Snake {
    constructor(x, y) {
        this.size = SQUARE_SIZE;
        this.color = COLOR_A;
        this.directions = ["right", "left", "up", "down"];
        this.direction = "right";
        this.body = [];
        this.body[0] = new Square(x, y, this.size, this.color);
    }

    get x() {
        return this.body[0].x;
    }

    get y() {
        return this.body[0].y;
    }

    get head() {
        return this.body[0];
    }

    grow() {
        let lastSquare = this.body[this.body.length - 1];
        let newSquare = new Square(
            lastSquare.x,
            lastSquare.y,
            this.size,
            this.color
        );
        this.body.push(newSquare);
    }

    draw(ctx) {
        for (let square of this.body) {
            square.draw(ctx);
        }

        let eyeX = this.body[0].x + this.size / 4;
        let eyeY = this.body[0].y + this.size / 4;
        let eyeSize = this.size / 8;

        ctx.beginPath();
        ctx.arc(eyeX, eyeY, eyeSize, 0, Math.PI * 2, true);
        ctx.fillStyle = getCookie("darkMode") ? "black" : "white";
        ctx.fill();
    }

    changeDirection(direction) {
        if (
            this.directions.indexOf(direction) !== -1 &&
            direction !== this.oppositeDirection()
        ) {
            this.direction = direction;
        }
    }

    oppositeDirection() {
        if (this.direction === "right") {
            return "left";
        } else if (this.direction === "left") {
            return "right";
        } else if (this.direction === "up") {
            return "down";
        } else if (this.direction === "down") {
            return "up";
        }
    }

    update() {
        let newHead = new Square(
            this.body[0].x,
            this.body[0].y,
            this.size,
            this.color
        );

        if (this.direction == "right") {
            newHead.x += SQUARE_SIZE;
        } else if (this.direction == "left") {
            newHead.x -= SQUARE_SIZE;
        } else if (this.direction == "up") {
            newHead.y -= SQUARE_SIZE;
        } else if (this.direction == "down") {
            newHead.y += SQUARE_SIZE;
        }

        this.body.unshift(newHead);
        this.body.pop();
    }

    isCollidingWithSelf() {
        for (let i = 1; i < this.body.length; i++) {
            if (Square.areColliding(this.head, this.body[i])) {
                return true;
            }
        }
        return false;
    }

    isOutOfBounds(canvasWidth, canvasHeight) {
        return (
            this.x < 0 ||
            this.x + this.size > canvasWidth ||
            this.y < 0 ||
            this.y + this.size > canvasHeight
        );
    }

}

class Food {
    constructor(x, y) {
        this.size = SQUARE_SIZE;
        this.color = COLOR_B;
        this.square = new Square(x, y, this.size, this.color);
    }

    draw(ctx) {
        this.square.draw(ctx);
    }
    isEatenBy(snake) {
        return Square.areColliding(this.square, snake.head);
    }

    static generateRandom(canvasWidth, canvasHeight, snake) {
        let x = Math.floor(Math.random() * (canvasWidth / SQUARE_SIZE)) * SQUARE_SIZE;
        let y = Math.floor(Math.random() * (canvasHeight / SQUARE_SIZE)) * SQUARE_SIZE;

        let newFood = new Food(x, y);

        while (snake.body.some((square) => Square.areColliding(square, newFood.square))) {
            x = Math.floor(Math.random() * (canvasWidth / SQUARE_SIZE)) * SQUARE_SIZE;
            y = Math.floor(Math.random() * (canvasHeight / SQUARE_SIZE)) * SQUARE_SIZE;
            newFood = new Food(x, y);
        }

        return newFood;
    }

}

function randomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

class Game {
    // contains one snake and array of food
    constructor(ctx) {
        this.snake = new Snake(randomInt(0, 30) * 20, randomInt(0, 30) * 20);
        this.food = [Food.generateRandom(ctx.canvas.width, ctx.canvas.height, this.snake)];
        this.score = 0;
        this.isGameOver = false;
        this.ctx = ctx;
    }
    draw() {
        // fill the background
        this.ctx.fillStyle = getCookie("darkMode") ? "black" : "white";
        this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        if (this.isGameOver) {
            this.ctx.fillStyle = getCookie("darkMode") ? "white" : "black";
            this.ctx.font = "50px Comic Sans MS";
            this.ctx.fillText(
                "Game Over",
                this.ctx.canvas.width / 2 - 150,
                this.ctx.canvas.height / 2
            );
            return;
        }

        this.drawGrid();

        this.snake.draw(this.ctx);
        for (let food of this.food) {
            food.draw(this.ctx);
        }

        this.ctx.fillStyle = getCookie("darkMode") ? "white" : "black";
        this.ctx.font = "20px Comic Sans MS";
        this.ctx.fillText("Score: " + this.score, 10, 30);
    }

    drawGrid() {
        this.ctx.strokeStyle = "lightgray";
        this.ctx.lineWidth = 1;

        for (let i = 0; i < this.ctx.canvas.width; i += SQUARE_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(i, 0);
            this.ctx.lineTo(i, this.ctx.canvas.height);
            this.ctx.stroke();
        }

        for (let i = 0; i < this.ctx.canvas.height; i += SQUARE_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i);
            this.ctx.lineTo(this.ctx.canvas.width, i);
            this.ctx.stroke();
        }
    }

    startOver() {
        this.isGameOver = false;
        this.snake = new Snake(randomInt(0, 30) * 20, randomInt(0, 30) * 20);
        this.food = [Food.generateRandom(this.ctx.canvas.width, this.ctx.canvas.height, this.snake)];
        this.score = 0;
    }

    update() {
        this.snake.update();
        // spawn randomly food
        if (Math.random() < 0.05) {
            this.food.push(
                Food.generateRandom(this.ctx.canvas.width, this.ctx.canvas.height, this.snake)
            );

            if (this.food.length > 5) {
                this.food.shift();
            }
        }
        this.checkCollision();
    }

    checkCollision() {
        // check collision with food
        for (let food of this.food) {
            if (food.isEatenBy(this.snake)) {
                this.snake.grow();
                this.score++;
                this.food.splice(this.food.indexOf(food), 1);
            }
        }
        // check collision with wall
        if (
            this.snake.x < 0 ||
            this.snake.x + this.snake.size > this.ctx.canvas.width ||
            this.snake.y < 0 ||
            this.snake.y + this.snake.size > this.ctx.canvas.height
            //|| this.snake.isCollidingWithSelf()
        ) {
            this.isGameOver = true;
        }
    }


}

let isPaused = false;
let lastMoveTime = Date.now();
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Limit the maximum size of the canvas
const maxSize = Math.min(window.innerWidth * 0.8, window.innerHeight * 0.8);
const canvasWidth = Math.min(window.innerWidth, maxSize);
const canvasHeight = Math.min(window.innerHeight, maxSize);

// Set the canvas size based on the device's pixel ratio
canvas.width = canvasWidth * window.devicePixelRatio;
canvas.height = canvasHeight * window.devicePixelRatio;

// Set the canvas style size to the desired size
canvas.style.width = canvasWidth + "px";
canvas.style.height = canvasHeight + "px";

// Scale the context based on the device's pixel ratio
ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

document.addEventListener("keydown", (e) => {
    let newDirection;
    if (e.key === "Escape") { // listen for the Escape key
        game.startOver(); // restart the game
    }
    if (e.key === "ArrowRight") {
        newDirection = "right";
        e.preventDefault(); // prevent scrolling to the right
    } else if (e.key === "ArrowLeft") {
        newDirection = "left";
        e.preventDefault(); // prevent scrolling to the left
    } else if (e.key === "ArrowUp") {
        newDirection = "up";
        e.preventDefault(); // prevent scrolling up
    } else if (e.key === "ArrowDown") {
        newDirection = "down";
        e.preventDefault(); // prevent scrolling down
    } else if (e.key === " ") {
        e.preventDefault(); // Prevent default behavior of space bar
        isPaused = !isPaused;
    }
    if (newDirection) {
        game.snake.changeDirection(newDirection);
    }
});

let touchStartX = null;
let touchStartY = null;

document.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});

document.addEventListener("touchmove", (e) => {
    if (!touchStartX || !touchStartY) {
        return;
    }
    const touchEndX = e.touches[0].clientX;
    const touchEndY = e.touches[0].clientY;
    const touchDiffX = touchEndX - touchStartX;
    const touchDiffY = touchEndY - touchStartY;
    if (Math.abs(touchDiffX) > Math.abs(touchDiffY)) {
        // horizontal swipe
        if (touchDiffX > 0) {
            // swipe right
            snake.changeDirection("right");
        } else {
            // swipe left
            snake.changeDirection("left");
        }
    } else {
        // vertical swipe
        if (touchDiffY > 0) {
            // swipe down
            snake.changeDirection("down");
        } else {
            // swipe up
            snake.changeDirection("up");
        }
    }
    touchStartX = null;
    touchStartY = null;
});

document.addEventListener("touchend", (e) => {
    touchStartX = null;
    touchStartY = null;
});



function gameLoop() {
    if (!isPaused) {
        game.update();

        ctx.fillStyle = getCookie("darkMode") ? "black" : "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        game.draw();
    }

    setTimeout(() => requestAnimationFrame(gameLoop), MOVE_DELAY);

}
let game = new Game(ctx);

gameLoop();
});