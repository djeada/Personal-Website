document.addEventListener("DOMContentLoaded", function() {
    const coefficientsInput = document.getElementById("coefficients");
    const outputRoots = document.getElementById("output-roots");
    const calculateButton = document.getElementById("calculate");
    const clearButton = document.getElementById("clear");

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

    function newtonRaphson(
        coefficients,
        x0,
        maxIterations = 100,
        tolerance = 1e-6
    ) {
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

    calculateButton.addEventListener("click", () => {
        const coefficients = parseCoefficients(coefficientsInput.value);
        const roots = findRoots(coefficients);
        outputRoots.value = JSON.stringify(roots, null, 2);
    });

    clearButton.addEventListener("click", () => {
        coefficientsInput.value = "";
        outputRoots.value = "";
    });
});