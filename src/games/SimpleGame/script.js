var enemies = [];
var personHeight = 64;
var personWidth = 42;
var radius = 30;
var screenHeight = 640;
var screenWidth = 800;
var dx = 5;
var dy = 5;

$(document).ready(function() {
    $(document).click(function() {
        animateMovement($("#human"), event.pageX, event.pageY)
    });
    prepareEnemies();
    runGame();
});

function prepareEnemies() {
    enemies.push({
        el: $("#enemy1"),
        top: parseInt(Math.random() * screenHeight),
        left: parseInt(Math.random() * screenWidth),
        directionX: 1,
        directionY: 1
    });
    enemies.push({
        el: $("#enemy2"),
        top: parseInt(Math.random() * screenHeight),
        left: parseInt(Math.random() * screenWidth),
        directionX: 1,
        directionY: 1
    });
    enemies.push({
        el: $("#enemy3"),
        top: parseInt(Math.random() * screenHeight),
        left: parseInt(Math.random() * screenWidth),
        directionX: 1,
        directionY: 1
    });
    enemies.push({
        el: $("#enemy4"),
        top: parseInt(Math.random() * screenHeight),
        left: parseInt(Math.random() * screenWidth),
        directionX: 1,
        directionY: 1
    });
    enemies.push({
        el: $("#enemy5"),
        top: parseInt(Math.random() * screenHeight),
        left: parseInt(Math.random() * screenWidth),
        directionX: 1,
        directionY: 1
    });
    enemies.push({
        el: $("#enemy6"),
        top: parseInt(Math.random() * screenHeight),
        left: parseInt(Math.random() * screenWidth),
        directionX: 1,
        directionY: 1
    });
}

function runGame() {
    for (i = 0; i < enemies.length; i++) {
        move(enemies[i], dx * enemies[i].directionX, dy * enemies[i].directionY);
        borderCollision(enemies[i]);
        for (j = 0; j < enemies.length; j++) {
            if (j != i) {
                checkCollision(enemies[i], enemies[j]);
            }
        }
        animateMovement(enemies[i].el, enemies[i].left, enemies[i].top)
    }
    setTimeout(runGame, 100);
}

function borderCollision(a) {
    if (a.left < 5) {
        a.left = 5;
        a.directionX = -a.directionX;
    }
    if (a.top < 5) {
        a.top = 5;
        a.directionY = -a.directionY;
    }
    if (a.top + personHeight > screenHeight - 5) {
        a.top = screenHeight - personHeight - 5;
        a.directionY = -a.directionY;
    }
    if (a.left + personWidth > screenWidth - 5) {
        a.left = screenWidth - personWidth - 5;
        a.directionX = -a.directionX;
    }
}

function checkCollision(a, b) {
    var centerXa = a.top - radius;
    var centerYa = a.left + radius;
    var centerXb = b.top - radius;
    var centerYb = b.left + radius;

    if (Math.abs(centerXa - centerXb) < 2 * radius && Math.abs(centerYa - centerYb) < 2 * radius) {
        move(a, 50 * (-a.directionX), 50 * (-a.directionY));
        move(b, 50 * (-b.directionX), -50 * (-b.directionX));
        reverseDirection(a);
        reverseDirection(b);
    }
}

function move(a, x, y) {
    a.top += y;
    a.left += x;
}

function reverseDirection(a) {
    a.directionX = -a.directionX;
    a.directionY = -a.directionY;
}

function animateMovement(a, x, y) {
    a.css("top", y + "px");
    a.css("left", x + "px");
}