document.addEventListener("DOMContentLoaded", () => {
    const coefficientsInput = document.getElementById("coefficients");
    const outputRoots = document.getElementById("output-roots");
    const calculateButton = document.getElementById("calculate");
    const clearButton = document.getElementById("clear");
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

    const parseCoefficients = (input) => input.split(",").map(s => parseFloat(s.trim()));
    const polynomial = (coefficients, x) => coefficients.reduce((sum, coeff, i) => sum + coeff * Math.pow(x, i), 0);
    const polynomialDerivative = (coefficients, x) => coefficients.slice(1).reduce((sum, coeff, i) => sum + (i + 1) * coeff * Math.pow(x, i), 0);

    const newtonRaphson = (coefficients, x0, maxIterations = 100, tolerance = 1e-6) => {
        let x = x0;
        for (let i = 0; i < maxIterations; i++) {
            const fx = polynomial(coefficients, x);
            const dfx = polynomialDerivative(coefficients, x);
            if (dfx === 0) break; // Avoid division by zero

            const newX = x - fx / dfx;
            if (Math.abs(newX - x) <= tolerance) return newX;
            x = newX;
        }
        return x;
    };

    const findRoots = (coefficients) => {
        const roots = [];
        const tolerance = 1e-6; // Define a suitable tolerance
        const degree = coefficients.length - 1;

        for (let i = 0; i < degree * 100; i++) {
            const x0 = Math.random() * 20 - 10;
            const root = newtonRaphson(coefficients, x0);

            // Check if the found root is significantly different from already found roots
            const isUnique = !roots.some(r => Math.abs(r - root) < tolerance);
            if (isUnique && !isNaN(root)) roots.push(root);
        }
        return roots;
    };


    const getMinMax = (roots, coefficients) => {
        let minRoot = Math.min(...roots);
        let maxRoot = Math.max(...roots);
        const margin = (maxRoot - minRoot) / 10;

        let min = Math.min(minRoot - margin, -10); // -10 is an arbitrary lower bound for x-axis
        let max = Math.max(maxRoot + margin, 10); // 10 is an arbitrary upper bound for x-axis

        return {
            min,
            max
        };
    };


    const getScaleFactors = (min, max) => {
        const scaleX = canvas.width / (max - min);
        const scaleY = canvas.height / (2 * Math.abs(max - min));
        return {
            scaleX,
            scaleY
        };
    };

    const getColorForMode = (colorLight, colorDark) => {
        return getCookie("darkMode") === "true" ? colorDark : colorLight;
    };

    const drawAxis = () => {
        ctx.beginPath();
        ctx.strokeStyle = getColorForMode("black", "white");
        ctx.lineWidth = 1;
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();
    };

    drawAxis();


    const drawScale = (min, max, scaleX) => {
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = getColorForMode("black", "white");

        const xAxisScale = (max - min) / 10;
        for (let i = 0; i <= 10; i++) {
            const x = min + i * xAxisScale;
            ctx.fillText(x.toFixed(2), scaleX * (x - min), canvas.height / 2 + 2);
        }
    };

    const drawFunction = (coefficients, scaleX, scaleY) => {
        ctx.beginPath();
        ctx.strokeStyle = getColorForMode("red", "yellow");
        ctx.lineWidth = 2;

        const step = 0.1;
        const min = -canvas.width / (2 * scaleX);

        const graphMin = min; // Use the calculated min for the graph range

        for (let x = 0; x <= canvas.width; x += step) {
            const graphX = graphMin + x / scaleX;
            const y = canvas.height / 2 - polynomial(coefficients, graphX) * scaleY;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    };

    const drawRoots = (roots, scaleX, scaleY, min) => {
        ctx.fillStyle = getColorForMode("blue", "lightblue");
        roots.forEach(root => {
            const x = (root - min) * scaleX; // Adjust root position based on min
            const y = canvas.height / 2; // Center on the y-axis

            ctx.beginPath();
            ctx.arc(x, y, 10, 0, 2 * Math.PI); // Increase the radius for visibility
            ctx.fill();
        });
    };

    const formatPolynomial = (coefficients) => {
        return coefficients.map((coeff, index) => {
            let term = coeff.toFixed(2);
            if (index > 0) term += 'x';
            if (index > 1) term += `^${index}`;
            return term;
        }).reverse().join(' + ').replace(/\+\s\-/g, '- ');
    };

    calculateButton.addEventListener("click", () => {
        const coefficients = parseCoefficients(coefficientsInput.value);
        if (coefficients.some(isNaN)) {
            alert("Invalid coefficients. Please enter a comma-separated list of numbers.");
            return;
        }

        const roots = findRoots(coefficients);
        const polynomialStr = formatPolynomial(coefficients);

        // Format roots for display
        let rootsDisplay;
        if (roots.length === 0) {
            rootsDisplay = "No real roots found.";
        } else {
            rootsDisplay = roots.map(root => root.toFixed(2)).join(', ');
        }

        // Display the formatted polynomial and roots
        outputRoots.value = `Polynomial Equation:\n${polynomialStr}\n\nRoots:\n${rootsDisplay}`;

        const {
            min,
            max
        } = getMinMax(roots);
        const {
            scaleX,
            scaleY
        } = getScaleFactors(min, max);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawAxis();
        drawScale(min, max, scaleX);
        drawFunction(coefficients, scaleX, scaleY);
        drawRoots(roots, scaleX, scaleY, min);
    });

    clearButton.addEventListener("click", () => {
        coefficientsInput.value = "";
        outputRoots.value = "";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawAxis();
    });

});