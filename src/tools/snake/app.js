const NUM_BLOCKS = 20;
const MOVE_DELAY = 250;
const MAIN_COLOR = "#3399FF";

function calculateGridSize() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const smallestDimension = Math.min(screenWidth, screenHeight);
    const gridSize = Math.floor(smallestDimension / NUM_BLOCKS);
    return gridSize;
}

const GRID_SIZE = calculateGridSize();

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
            new Square(x, y, GRID_SIZE, MAIN_COLOR),
            new Square(x - GRID_SIZE, y, GRID_SIZE, MAIN_COLOR),
            new Square(x - 2 * GRID_SIZE, y, GRID_SIZE, MAIN_COLOR),
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
        this.body.unshift(new Square(newX, newY, GRID_SIZE, MAIN_COLOR));
        this.head = this.body[0];
    }

    grow() {
        let tail = this.body[this.body.length - 1];
        this.body.push(new Square(tail.x, tail.y, GRID_SIZE, MAIN_COLOR));
    }

    draw(ctx) {
        for (let i = 0; i < this.body.length; i++) {
            this.body[i].draw(ctx);

            // Draw eye on the head
            if (i === 0) {
                ctx.fillStyle = "white";
                let eyeX, eyeY;

                switch (this.direction) {
                    case "right":
                        eyeX = this.head.x + this.head.size * 0.65;
                        eyeY = this.head.y + this.head.size * 0.25;
                        break;
                    case "left":
                        eyeX = this.head.x + this.head.size * 0.25;
                        eyeY = this.head.y + this.head.size * 0.25;
                        break;
                    case "up":
                        eyeX = this.head.x + this.head.size * 0.25;
                        eyeY = this.head.y + this.head.size * 0.25;
                        break;
                    case "down":
                        eyeX = this.head.x + this.head.size * 0.25;
                        eyeY = this.head.y + this.head.size * 0.65;
                        break;
                }

                ctx.beginPath();
                ctx.arc(eyeX, eyeY, this.head.size * 0.15, 0, 2 * Math.PI);
                ctx.fill();
            }
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

class Food extends Square {
    constructor(x, y, size) {
        super(x, y, size, "#FF0000"); // Call the parent constructor with the red color
    }

    draw(ctx) {
        // Draw the apple body
        const centerX = this.x + this.size / 2;
        const centerY = this.y + this.size / 2;
        const radius = this.size / 2;
        ctx.fillStyle = "#FF0000";
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();

        // Draw the apple stem
        ctx.fillStyle = "#8B4513";
        ctx.fillRect(
            this.x + this.size * 0.4,
            this.y,
            this.size * 0.2,
            this.size * 0.4
        );
    }
}

function randomPosition(canvas) {
    let x = Math.floor(Math.random() * (canvas.width / GRID_SIZE)) * GRID_SIZE;
    let y = Math.floor(Math.random() * (canvas.height / GRID_SIZE)) * GRID_SIZE;
    return {
        x,
        y,
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

function drawScore(score, ctx) {
    ctx.fillStyle = getCookie("darkMode") === "true" ? "white" : "black";
    ctx.font = "24px Arial";
    ctx.textAlign = "left";
    const margin = 10; // You can adjust this value to your preference
    ctx.fillText("Score: " + score, margin, (GRID_SIZE * 0.75) + margin);
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
        food = new Food(
            randomPosition(canvas).x,
            randomPosition(canvas).y,
            GRID_SIZE
        );
        isPaused = false;
        gameOver = false;
        score = 0;
    }

    window.addEventListener("resize", () => {
        startOver();
    });

    let snake = new Snake(GRID_SIZE * 5, GRID_SIZE * 5);

    let food = new Food(
        randomPosition(canvas).x,
        randomPosition(canvas).y,
        GRID_SIZE
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

    // Add a touchstart listener to canvas to prevent zooming on double tap
    canvas.addEventListener("touchstart", function(event) {
        event.preventDefault();
    });

    // Define touch variables
    let touchStartX = null;
    let touchStartY = null;
    let lastTap = null;

    // Add touchstart listener to canvas to set touch start position
    canvas.addEventListener("touchstart", function(event) {
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
    });

    // Add touchend listener to canvas for changing direction and double tap
    canvas.addEventListener("touchend", function(event) {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (lastTap && tapLength < 500 && tapLength > 0) {
            if (gameOver) startOver();
        } else {
            lastTap = currentTime;

            const touchEndX = event.changedTouches[0].clientX;
            const touchEndY = event.changedTouches[0].clientY;
            const touchDiffX = touchEndX - touchStartX;
            const touchDiffY = touchEndY - touchStartY;
            if (Math.abs(touchDiffX) > Math.abs(touchDiffY)) {
                if (touchDiffX > 0 && snake.direction !== "left") {
                    snake.pendingDirection = "right";
                } else if (snake.direction !== "right") {
                    snake.pendingDirection = "left";
                }
            } else {
                if (touchDiffY > 0 && snake.direction !== "up") {
                    snake.pendingDirection = "down";
                } else if (snake.direction !== "down") {
                    snake.pendingDirection = "up";
                }
            }
        }
    });

    let gameOver = false;
    let score = 0;
    setInterval(() => {
        if (gameOver) return;

        if (isPaused) return;

        if (
            snake.head.x < 0 ||
            snake.head.y < 0 ||
            snake.head.x > canvas.width - GRID_SIZE ||
            snake.head.y > canvas.height - GRID_SIZE ||
            snake.checkCollision()
        ) {
            gameOver = true;
            drawGameOver(ctx);
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid(ctx);
        snake.draw(ctx);
        food.draw(ctx);
        drawScore(score, ctx);

        snake.update();

        if (Square.areColliding(snake.head, food)) {
            snake.grow();
            let newPosition = randomPosition(canvas);
            food.x = newPosition.x;
            food.y = newPosition.y;
            score++;
        }
    }, MOVE_DELAY);
}

document.addEventListener("DOMContentLoaded", main);