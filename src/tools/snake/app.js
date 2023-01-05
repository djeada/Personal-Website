SQUARE_SIZE = 40;
SPEED = 10;
COLOR_A = "#f98776";
COLOR_B = "#eec747";
COLOR_C = "white";
COLOR_D = "black";


// class square
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

    //static method are squares colliding
    static areColliding(square1, square2) {
        // checks if the distance between the centers of the squares is less than the sum of the half of the squares
        let distance = Math.sqrt(Math.pow(square1.x - square2.x, 2) + Math.pow(square1.y - square2.y, 2));
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
        let newSquare = new Square(lastSquare.x, lastSquare.y, this.size, this.color);
        this.body.push(newSquare);
    }

    draw(ctx) {
        for (let square of this.body) {
            console.log(square);
            square.draw(ctx);
        }
    }

    changeDirection(direction) {
        if (this.directions.indexOf(direction) !== -1 && direction !== this.oppositeDirection()) {
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
        let newHead = new Square(this.body[0].x, this.body[0].y, this.size, this.color);

        if (this.direction == "right") {
            newHead.x += SPEED;
        } else if (this.direction == "left") {
            newHead.x -= SPEED;
        } else if (this.direction == "up") {
            newHead.y -= SPEED;
        } else if (this.direction == "down") {
            newHead.y += SPEED;
        }

        this.body.unshift(newHead);
        this.body.pop();
    }
}


// class food extends square
class Food extends Square {
    constructor(x, y) {
        super(x, y, SQUARE_SIZE, COLOR_B);
    }

    draw(ctx) {
        // draw a circle
        ctx.beginPath();
        ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 2, 0, Math.PI * 2, true);
        ctx.fillStyle = this.color;
        ctx.fill();

        // change color to COLOR_E
        ctx.strokeStyle = COLOR_D;
        ctx.fillStyle = COLOR_D;

        // draw a smile
        ctx.beginPath();
        ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 4, 0, Math.PI, false);
        ctx.stroke();

        // draw eyes
        ctx.beginPath();
        ctx.arc(this.x + this.size / 4, this.y + this.size / 4, this.size / 8, 0, Math.PI * 2, true);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(this.x + this.size * 3 / 4, this.y + this.size / 4, this.size / 8, 0, Math.PI * 2, true);
        ctx.fill();
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
        this.food = [];
        this.score = 0;
        this.isGameOver = false;
        this.ctx = ctx;
    }

    draw() {
        // fill the background white
        this.ctx.fillStyle = COLOR_C;
        this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        if (this.isGameOver) {
            this.ctx.fillStyle = COLOR_D;
            this.ctx.font = "50px Comic Sans MS";
            this.ctx.fillText("Game Over", this.ctx.canvas.width / 2 - 150, this.ctx.canvas.height / 2);
            return;
        }

        this.drawGrid();

        this.snake.draw(this.ctx);
        for (let food of this.food) {
            food.draw(this.ctx);
        }

        this.ctx.fillStyle = COLOR_D;
        this.ctx.font = "20px Comic Sans MS";
        this.ctx.fillText("Score: " + this.score, 10, 30);
    }

    drawGrid() {
        this.ctx.strokeStyle = "lightgray";
        this.ctx.lineWidth = 1;

        for (let i = 0; i < this.ctx.canvas.width; i += this.snake.size) {
            this.ctx.beginPath();
            this.ctx.moveTo(i, 0);
            this.ctx.lineTo(i, this.ctx.canvas.height);
            this.ctx.stroke();
        }

        for (let i = 0; i < this.ctx.canvas.height; i += this.snake.size) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i);
            this.ctx.lineTo(this.ctx.canvas.width, i);
            this.ctx.stroke();
        }
    }


    startOver() {
        this.isGameOver = false;
        this.snake = new Snake(randomInt(0, 30) * 20, randomInt(0, 30) * 20);
        this.food = [];
        this.score = 0;
    }

    update() {
        this.snake.update();
        // spawn randomly food
        if (Math.random() < 0.03) {
            this.food.push(new Food(Math.floor(Math.random() * 30) * 20, Math.floor(Math.random() * 30) * 20));

            if (this.food.length > 5) {
                this.food.shift();
            }
        }
        this.checkCollision();
    }

    checkCollision() {
        // check collision with food
        for (let food of this.food) {
            if (Square.areColliding(this.snake.head, food)) {
                this.snake.grow();
                this.score++;
                this.food.splice(this.food.indexOf(food), 1);
            }
        }
        // check collision with wall
        if (this.snake.x < 0 || this.snake.x >= this.ctx.canvas.width || this.snake.y < 0 || this.snake.y >= this.ctx.canvas.height) {
            this.isGameOver = true;
            return;
        }
        /*
        // check collision with itself
        for (let i = 1; i < this.snake.body.length; i++) {
            if (Square.areColliding(this.snake.head, this.snake.body[i])) {
                this.isGameOver = true;
                return;
            }
        }*/
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

    // focus on the canvas
    canvas.focus();

    // create game
    let game = new Game(ctx);


    document.addEventListener('keydown', function(event) {
        const key = event.key;
        if (key === 'ArrowLeft') {
            game.snake.changeDirection("left");
        }
        if (key === 'ArrowRight') {
            game.snake.changeDirection("right");
        }
        if (key === 'ArrowUp') {
            game.snake.changeDirection("up");
        }
        if (key === 'ArrowDown') {
            game.snake.changeDirection("down");
        }
        if (key === 'Escape') {
            game.startOver();
        }
    });

    canvas.addEventListener('touchmove', function(event) {
        event.preventDefault();
        canvas.focus();
    });

        /* we want to move the shape when the user moves their finger across the screen */

    let lastX = null;
    let lastY = null;

    canvas.addEventListener('touchstart', function(event) {
        lastX = event.touches[0].clientX;
        lastY = event.touches[0].clientY;

    });

    canvas.addEventListener('touchmove', function(event) {
        const currentX = event.touches[0].clientX;
        const currentY = event.touches[0].clientY;

        const diffX = currentX - lastX;
        const diffY = currentY - lastY;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0) {
                game.snake.changeDirection("right");
            } else {
                game.snake.changeDirection("left");
            }
        } else {
            if (diffY > 0) {
                game.snake.changeDirection("down");
            } else {
                game.snake.changeDirection("up");
            }
        }

        lastX = currentX;
        lastY = currentY;
    });

    let lastTap = null;

    canvas.addEventListener('touchend', function(event) {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (lastTap && tapLength < 500 && tapLength > 0) {
            if (game.isGameOver) {
                game.startOver();
            }
        } else {
            lastTap = currentTime;
        }
    });


    // use setInterval to update and draw the game 10 times per second
    setInterval(function() {
        game.update();
        game.draw();

    }, 100);


}

main()