document.addEventListener("DOMContentLoaded", function() {
    const coefficientsInput = document.getElementById("coefficients");
    const outputRoots = document.getElementById("output-roots");
    const calculateButton = document.getElementById("calculate");
    const clearButton = document.getElementById("clear");
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

    function parseCoefficients(input) {
        return input.split(",").map((s) => parseFloat(s.trim()));
    }

    function polynomial(coefficients, x) {
        return coefficients.reduce(
            (sum, coeff, i) => sum + coeff * Math.pow(x, i),
            0
        );
    }

    function polynomialDerivative(coefficients, x) {
        return coefficients
            .slice(1)
            .reduce((sum, coeff, i) => sum + (i + 1) * coeff * Math.pow(x, i), 0);
    }

    function newtonRaphson(coefficients, x0, maxIterations = 100, tolerance = 1e-6) {
        let x = x0;
        for (let i = 0; i < maxIterations; i++) {
            const fx = polynomial(coefficients, x);
            const dfx = polynomialDerivative(coefficients, x);
            const newX = x - fx / dfx;

            if (Math.abs(newX - x) <= tolerance) {
                break;
            }

            x = newX;
        }
        return x;
    }

    function findRoots(coefficients) {
        const roots = [];
        const degree = coefficients.length - 1;

        for (let i = 0; i < degree; i++) {
            const x0 = Math.random() * 10 - 5;
            const root = newtonRaphson(coefficients, x0);
            roots.push(root);
        }

        return roots;
    }

    function getMinMax(roots) {
        let min = Math.min(...roots);
        let max = Math.max(...roots);

        const margin = (max - min) / 10;

        min -= margin;
        max += margin;

        return {
            min,
            max
        };
    }

    function getScaleFactors(min, max) {
        const scaleX = canvas.width / (max - min);
        const scaleY = canvas.height / (2 * (max - min));

        return {
            scaleX,
            scaleY
        };
    }

    function drawAxis() {
        ctx.beginPath();
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();
    }

    function drawScale(min, max) {
        const {
            scaleX
        } = getScaleFactors(min, max);

        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "black";

        const xAxisScale = (max - min) / 10;

        for (let i = 0; i <= 10; i++) {
            const x = min + i * xAxisScale;
            ctx.fillText(x.toFixed(2), scaleX * (x - min), canvas.height / 2 + 2);
        }
    }




    function drawFunction(coefficients, scaleX, scaleY) {
        ctx.beginPath();
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;

        const step = 0.1;
        const min = -canvas.width / (2 * scaleX);

        ctx.moveTo(0, canvas.height / 2 - polynomial(coefficients, min) * scaleY);

        for (let x = 0; x <= canvas.width; x += step) {
            const graphX = min + x / scaleX; // Corrected calculation of graphX
            const y = canvas.height / 2 - polynomial(coefficients, graphX) * scaleY;
            ctx.lineTo(x, y);
        }

        ctx.stroke();
    }



    function drawRoots(roots) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawAxis();

        const {
            min,
            max
        } = getMinMax(roots);
        drawScale(min, max);

        ctx.fillStyle = "blue";
        roots.forEach((root) => {
            const x = canvas.width / 2 + root * 10;
            const y = canvas.height / 2;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    calculateButton.addEventListener("click", () => {
        const coefficients = parseCoefficients(coefficientsInput.value);
        const roots = findRoots(coefficients);
        outputRoots.value = JSON.stringify(roots, null, 2);

        drawRoots(roots);
        drawFunction(coefficients, scaleX, scaleY);
    });

    clearButton.addEventListener("click", () => {
        coefficientsInput.value = "";
        outputRoots.value = "";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawAxis(); // Add this line
        drawScale(); // Add this line
    });
});