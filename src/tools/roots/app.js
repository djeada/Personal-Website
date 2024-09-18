document.addEventListener("DOMContentLoaded", () => {
    const coefficientsInput = document.getElementById("coefficients");
    const outputRoots = document.getElementById("output-roots");
    const calculateButton = document.getElementById("calculate");
    const clearButton = document.getElementById("clear");
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

    const getColorForMode = (colorLight, colorDark) => {
        const darkModeValue = getCookie("darkMode");
        return darkModeValue && darkModeValue.toLowerCase() === "true" ? colorDark : colorLight;
    };

    class Complex {
        constructor(real, imag) {
            this.real = real;
            this.imag = imag;
        }

        static from(x) {
            return x instanceof Complex ? x : new Complex(x, 0);
        }

        add(other) {
            other = Complex.from(other);
            return new Complex(this.real + other.real, this.imag + other.imag);
        }

        sub(other) {
            other = Complex.from(other);
            return new Complex(this.real - other.real, this.imag - other.imag);
        }

        mul(other) {
            other = Complex.from(other);
            return new Complex(
                this.real * other.real - this.imag * other.imag,
                this.real * other.imag + this.imag * other.real
            );
        }

        div(other) {
            other = Complex.from(other);
            const denom = other.real * other.real + other.imag * other.imag;
            return new Complex(
                (this.real * other.real + this.imag * other.imag) / denom,
                (this.imag * other.real - this.real * other.imag) / denom
            );
        }

        pow(n) {
            let result = new Complex(1, 0);
            for (let i = 0; i < n; i++) {
                result = result.mul(this);
            }
            return result;
        }

        abs() {
            return Math.hypot(this.real, this.imag);
        }

        toString(precision = 6) {
            const re = this.real.toFixed(precision);
            const im = Math.abs(this.imag).toFixed(precision);
            if (this.imag >= 0) {
                return `${re} + ${im}i`;
            } else {
                return `${re} - ${im}i`;
            }
        }
    }

    const parseCoefficients = (input) =>
        input.split(",").map((s) => parseFloat(s.trim()));

    const evaluatePolynomial = (coefficients, x) =>
        coefficients.reduce(
            (sum, coeff, i) =>
                sum
                    .mul(x)
                    .add(Complex.from(coeff)),
            new Complex(0, 0)
        );

    const durandKerner = (coefficients, maxIterations = 1000, tolerance = 1e-6) => {
        const n = coefficients.length - 1;
        let roots = Array.from({ length: n }, (_, k) => {
            const angle = (2 * Math.PI * k) / n;
            return new Complex(Math.cos(angle), Math.sin(angle));
        });

        for (let iter = 0; iter < maxIterations; iter++) {
            let convergence = true;
            for (let i = 0; i < n; i++) {
                let prod = new Complex(1, 0);
                for (let j = 0; j < n; j++) {
                    if (i !== j) {
                        prod = prod.mul(roots[i].sub(roots[j]));
                    }
                }
                const delta = evaluatePolynomial(coefficients, roots[i]).div(prod);
                const newRoot = roots[i].sub(delta);
                if (delta.abs() > tolerance) convergence = false;
                roots[i] = newRoot;
            }
            if (convergence) break;
        }
        return roots;
    };

    const formatPolynomial = (coefficients) =>
        coefficients
            .map((coeff, index) => {
                const power = coefficients.length - 1 - index;
                let term = "";
                if (coeff === 0) return "";
                if (coeff > 0 && index > 0) term += "+";
                if (coeff < 0) term += "-";
                const absCoeff = Math.abs(coeff);
                if (absCoeff !== 1 || power === 0) term += absCoeff.toFixed(2);
                if (power > 0) term += "x";
                if (power > 1) term += `^${power}`;
                return term;
            })
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

    const getMinMax = (coefficients) => {
        const numPoints = 1000;
        const xRange = 20;
        const xMin = -xRange / 2;
        const xMax = xRange / 2;
        const step = (xMax - xMin) / numPoints;
        let yMin = Infinity;
        let yMax = -Infinity;

        for (let i = 0; i <= numPoints; i++) {
            const x = xMin + i * step;
            const y = evaluatePolynomial(coefficients, new Complex(x, 0)).real;
            if (y < yMin) yMin = y;
            if (y > yMax) yMax = y;
        }

        if (yMin > 0) yMin = 0;
        if (yMax < 0) yMax = 0;

        const yMargin = (yMax - yMin) * 0.1 || 1;
        yMin -= yMargin;
        yMax += yMargin;

        const xMargin = (xMax - xMin) * 0.1;
        return {
            xMin: xMin - xMargin,
            xMax: xMax + xMargin,
            yMin,
            yMax,
        };
    };

    const mapXToCanvas = (x, xMin, xMax) =>
        ((x - xMin) / (xMax - xMin)) * canvas.width;
    const mapYToCanvas = (y, yMin, yMax) =>
        canvas.height - ((y - yMin) / (yMax - yMin)) * canvas.height;

    const drawAxis = (xMin, xMax, yMin, yMax) => {
        ctx.beginPath();
        ctx.strokeStyle = getColorForMode("#000000", "#FFFFFF");
        ctx.lineWidth = 1;

        const x0 = mapXToCanvas(0, xMin, xMax);
        const y0 = mapYToCanvas(0, yMin, yMax);

        if (yMin <= 0 && yMax >= 0) {
            ctx.moveTo(0, y0);
            ctx.lineTo(canvas.width, y0);
        }

        if (xMin <= 0 && xMax >= 0) {
            ctx.moveTo(x0, 0);
            ctx.lineTo(x0, canvas.height);
        }

        ctx.stroke();
    };

    const drawGrid = (xMin, xMax, yMin, yMax) => {
        ctx.beginPath();
        ctx.strokeStyle = getColorForMode("#e0e0e0", "#555555");
        ctx.lineWidth = 1;

        const numXTicks = 10;
        const numYTicks = 10;

        for (let i = 0; i <= numXTicks; i++) {
            const x = xMin + (i * (xMax - xMin)) / numXTicks;
            const xPos = mapXToCanvas(x, xMin, xMax);
            ctx.moveTo(xPos, 0);
            ctx.lineTo(xPos, canvas.height);
        }

        for (let i = 0; i <= numYTicks; i++) {
            const y = yMin + (i * (yMax - yMin)) / numYTicks;
            const yPos = mapYToCanvas(y, yMin, yMax);
            ctx.moveTo(0, yPos);
            ctx.lineTo(canvas.width, yPos);
        }

        ctx.stroke();
    };

    const drawScale = (xMin, xMax, yMin, yMax) => {
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = getColorForMode("#000000", "#FFFFFF");

        const numXTicks = 10;
        for (let i = 0; i <= numXTicks; i++) {
            const x = xMin + (i * (xMax - xMin)) / numXTicks;
            const xPos = mapXToCanvas(x, xMin, xMax);
            const y0 = mapYToCanvas(0, yMin, yMax);
            ctx.fillText(x.toFixed(2), xPos, y0 + 2);
        }

        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        const numYTicks = 10;
        for (let i = 0; i <= numYTicks; i++) {
            const y = yMin + (i * (yMax - yMin)) / numYTicks;
            const yPos = mapYToCanvas(y, yMin, yMax);
            const x0 = mapXToCanvas(0, xMin, xMax);
            ctx.fillText(y.toFixed(2), x0 - 5, yPos);
        }
    };

    const drawFunction = (coefficients, xMin, xMax, yMin, yMax) => {
        ctx.beginPath();
        ctx.strokeStyle = getColorForMode("#FF0000", "#FF5555");
        ctx.lineWidth = 2;
        const numPoints = canvas.width;

        for (let i = 0; i <= numPoints; i++) {
            const x = xMin + (i * (xMax - xMin)) / numPoints;
            const y = evaluatePolynomial(coefficients, new Complex(x, 0)).real;
            const xPos = mapXToCanvas(x, xMin, xMax);
            const yPos = mapYToCanvas(y, yMin, yMax);
            if (i === 0) {
                ctx.moveTo(xPos, yPos);
            } else {
                ctx.lineTo(xPos, yPos);
            }
        }
        ctx.stroke();
    };

    const drawRoots = (roots, xMin, xMax, yMin, yMax) => {
        roots.forEach((root) => {
            if (Math.abs(root.imag) < 1e-6) {
                ctx.fillStyle = getColorForMode("#0000FF", "#00FFFF");
                const xPos = mapXToCanvas(root.real, xMin, xMax);
                const yPos = mapYToCanvas(0, yMin, yMax);
                ctx.beginPath();
                ctx.arc(xPos, yPos, 5, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    };

    calculateButton.addEventListener("click", () => {
        const coefficients = parseCoefficients(coefficientsInput.value);
        if (coefficients.some(isNaN)) {
            alert("Invalid coefficients. Please enter a comma-separated list of numbers.");
            return;
        }

        const roots = durandKerner(coefficients);
        const polynomialStr = formatPolynomial(coefficients);
        const rootsDisplay = roots.map((root) => root.toString(6)).join("\n");

        outputRoots.value = `Polynomial Equation:\n${polynomialStr}\n\nRoots:\n${rootsDisplay}`;

        const { xMin, xMax, yMin, yMax } = getMinMax(coefficients);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid(xMin, xMax, yMin, yMax);
        drawAxis(xMin, xMax, yMin, yMax);
        drawScale(xMin, xMax, yMin, yMax);
        drawFunction(coefficients, xMin, xMax, yMin, yMax);
        drawRoots(roots, xMin, xMax, yMin, yMax);
    });

    clearButton.addEventListener("click", () => {
        coefficientsInput.value = "";
        outputRoots.value = "";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawAxis(-10, 10, -10, 10);
    });
});
