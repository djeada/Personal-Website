const GRID_SIZE = 30;
const MOVE_DELAY = 200;
const COLOR_A = "#3399FF";
const COLOR_B = "#FFCC00";

class Square {
    constructor(x, y, size, color) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }

    static areColliding(squareA, squareB) {
        return squareA.x === squareB.x && squareA.y === squareB.y;
    }
}

class Snake {
    constructor(x, y) {
        this.body = [
            new Square(x, y, GRID_SIZE, COLOR_A),
            new Square(x - GRID_SIZE, y, GRID_SIZE, COLOR_A),
            new Square(x - 2 * GRID_SIZE, y, GRID_SIZE, COLOR_A)
        ];
        this.head = this.body[0];
        this.direction = "right";
        this.pendingDirection = null;
    }

    update() {
        if (this.pendingDirection) {
            this.direction = this.pendingDirection;
            this.pendingDirection = null;
        }

        let newX = this.head.x;
        let newY = this.head.y;

        switch (this.direction) {
            case "right":
                newX += GRID_SIZE;
                break;
            case "left":
                newX -= GRID_SIZE;
                break;
            case "up":
                newY -= GRID_SIZE;
                break;
            case "down":
                newY += GRID_SIZE;
                break;
        }

        this.body.pop();
        this.body.unshift(new Square(newX, newY, GRID_SIZE, COLOR_A));
        this.head = this.body[0];
    }

    grow() {
        let tail = this.body[this.body.length - 1];
        this.body.push(new Square(tail.x, tail.y, GRID_SIZE, COLOR_A));
    }

    draw(ctx) {
        for (let square of this.body) {
            square.draw(ctx);
        }
    }


    checkCollision() {
        for (let i = 1; i < this.body.length; i++) {
            if (Square.areColliding(this.head, this.body[i])) {
                return true;
            }
        }
        return false;
    }
}

function setCanvasSize(canvas) {
    let width = Math.floor(window.innerWidth / GRID_SIZE) * GRID_SIZE;
    let height = Math.floor(window.innerHeight / GRID_SIZE) * GRID_SIZE;
    canvas.width = width;
    canvas.height = height;
}

function randomPosition(canvas) {
    let x = Math.floor(Math.random() * (canvas.width / GRID_SIZE)) * GRID_SIZE;
    let y = Math.floor(Math.random() * (canvas.height / GRID_SIZE)) * GRID_SIZE;
    return {
        x,
        y
    };
}

function drawGrid(ctx) {
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;
    for (let i = 0; i <= ctx.canvas.width; i += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, ctx.canvas.height);
        ctx.stroke();
    }

    for (let i = 0; i <= ctx.canvas.height; i += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(ctx.canvas.width, i);
        ctx.stroke();
    }
}

function drawGameOver(ctx) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.fillStyle = "white";
    ctx.font = "48px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", ctx.canvas.width / 2, ctx.canvas.height / 2);

}

function calculateCanvasSize() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const size = Math.min(screenWidth, screenHeight) * 0.9; // 90% of the smallest dimension
    return size - (size % GRID_SIZE); // Ensures the size is a multiple of the grid size
}




function main() {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const calculatedSize = calculateCanvasSize();
    canvas.width = calculatedSize;
    canvas.height = calculatedSize;
    let isPaused = false;

    function startOver() {
        snake = new Snake(GRID_SIZE * 5, GRID_SIZE * 5);
        food = new Square(
            randomPosition(canvas).x,
            randomPosition(canvas).y,
            GRID_SIZE,
            COLOR_B
        );
        isPaused = false;
        gameOver = false;
    }


    window.addEventListener("resize", () => {
        startOver();
    });

    let snake = new Snake(GRID_SIZE * 5, GRID_SIZE * 5);

    let food = new Square(
        randomPosition(canvas).x,
        randomPosition(canvas).y,
        GRID_SIZE,
        COLOR_B
    );


    document.addEventListener("keydown", function(event) {
        const key = event.key;

        if (key === "Escape") {
            startOver();
        }
        if (
            key === "ArrowUp" &&
            snake.direction !== "down" &&
            snake.direction !== "up"
        ) {
            event.preventDefault();
            snake.pendingDirection = "up";
        } else if (
            key === "ArrowDown" &&
            snake.direction !== "up" &&
            snake.direction !== "down"
        ) {
            event.preventDefault();
            snake.pendingDirection = "down";
        } else if (
            key === "ArrowLeft" &&
            snake.direction !== "right" &&
            snake.direction !== "left"
        ) {
            event.preventDefault();
            snake.pendingDirection = "left";
        } else if (
            key === "ArrowRight" &&
            snake.direction !== "left" &&
            snake.direction !== "right"
        ) {
            event.preventDefault();
            snake.pendingDirection = "right";
        } else if (key === " ") {
            event.preventDefault();
            isPaused = !isPaused;
        }
    });

    let lastTapTime = 0;

    document.addEventListener("touchstart", (e) => {
        const currentTime = Date.now();
        const tapLength = currentTime - lastTapTime;
        lastTapTime = currentTime;

        if (tapLength < 300) {
            startOver();
        } else {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }
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


    let gameOver = false;
    setInterval(() => {
        if (gameOver) return;

        if (isPaused) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid(ctx);
        snake.draw(ctx);
        food.draw(ctx);

        snake.update();

        if (
            snake.head.x < 0 ||
            snake.head.y < 0 ||
            snake.head.x >= canvas.width ||
            snake.head.y >= canvas.height ||
            snake.checkCollision()
        ) {
            gameOver = true;
            drawGameOver(ctx);
            return;
        }

        if (Square.areColliding(snake.head, food)) {
            snake.grow();
            let newPosition = randomPosition(canvas);
            food.x = newPosition.x;
            food.y = newPosition.y;
        }
    }, MOVE_DELAY);
}

document.addEventListener("DOMContentLoaded", main);