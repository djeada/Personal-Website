    /***********************************************************************
     *  Utility functions for working with matrices, polynomials, and
     *  eigenvalues/eigenvectors in pure JavaScript.
     ***********************************************************************/

    /**
     * Parses the 3x3 matrix from the HTML inputs.
     * Returns an array of arrays (3x3).
     * If any cell is invalid, it returns null.
     */
    function getMatrix() {
        const matrixInput = document.getElementById("matrix-input");
        const rows = matrixInput.querySelectorAll("tr");
        const matrix = [];
        for (let r = 0; r < rows.length; r++) {
            const cells = rows[r].querySelectorAll("input");
            const rowData = [];
            for (let c = 0; c < cells.length; c++) {
                const value = cells[c].value.trim();
                if (value === "" || isNaN(Number(value))) {
                    return null; // indicates invalid input
                }
                rowData.push(parseFloat(value));
            }
            matrix.push(rowData);
        }
        return matrix;
    }

    /**
     * Computes the characteristic polynomial coefficients of a 3x3 matrix.
     * The characteristic polynomial is det(A - λI) = -λ^3 + c2 λ^2 - c1 λ + c0.
     * We return [1, a, b, c] so the polynomial is p(λ) = λ^3 + a λ^2 + b λ + c.
     *
     * Note: We solve for p(λ) = λ^3 - (trace(A))λ^2 + ... etc.
     * We'll do it carefully.
     */
    function characteristicPolynomial3x3(A) {
        const a = A[0][0],
            b = A[0][1],
            c = A[0][2];
        const d = A[1][0],
            e = A[1][1],
            f = A[1][2];
        const g = A[2][0],
            h = A[2][1],
            i = A[2][2];

        // Trace
        const traceA = a + e + i;

        // Some known formula for 3x3:
        // Coefficients for λ^3 + α λ^2 + β λ + γ
        // (But it's common to see polynomial as -λ^3 + c2 λ^2 - c1 λ + c0; let's keep it standard λ^3 + ...)

        // Sum of principal minors:
        //   M1 = a + e + i  (trace)
        //   M2 = a e + e i + a i - b d - c g - f h  (sum of 2x2 principal minors)
        //   M3 = det(A)

        const M1 = traceA;
        const M2 = (a * e + e * i + a * i) - (b * d + c * g + f * h);
        const M3 = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);

        // So the characteristic polynomial is:
        // λ^3 - M1 λ^2 + M2 λ - M3 = 0
        // We want in the form p(λ) = λ^3 + p2 λ^2 + p1 λ + p0
        // => p2 = -M1, p1 = M2, p0 = -M3
        return [1, -M1, M2, -M3];
    }

    /**
     * Finds the real roots of a cubic polynomial of the form:
     * p(λ) = λ^3 + a λ^2 + b λ + c = 0
     * Returns an array of real roots (1, 2, or 3 real solutions).
     * If roots are complex, they won't be listed.
     *
     * This uses Cardano's method for cubic equations.
     */
    function findCubicRealRoots([p1, p2, p3, p4]) {
        // polynomial is p1*x^3 + p2*x^2 + p3*x + p4 = 0
        // for convenience, we want x^3 + Ax^2 + Bx + C = 0, so let's do:
        if (p1 !== 1) {
            // Normalize if leading coefficient != 1
            p2 /= p1;
            p3 /= p1;
            p4 /= p1;
        }

        const A = p2;
        const B = p3;
        const C = p4;

        // Convert to depressed cubic t^3 + pt + q = 0 with x = t - A/3
        const shift = A / 3;
        const a = B - (A * A) / 3;
        const b = (2 * A * A * A) / 27 - (A * B) / 3 + C;

        const Q = (a / 3);
        const R = (b / 2);
        const D = Q * Q * Q + R * R; // discriminant

        const roots = [];

        if (Math.abs(D) < 1e-14) {
            // Probably multiple roots
            if (Math.abs(R) < 1e-14 && Math.abs(Q) < 1e-14) {
                // Triple root at x = shift
                roots.push(-shift);
            } else {
                // There's a chance of a double root
                const t1 = Math.cbrt(-R) - shift;
                roots.push(t1);
                // second root
                const t2 = -A / 3 - (t1 + A / 3);
                roots.push(t2);
            }
        } else if (D > 0) {
            // One real root
            const S = Math.cbrt(-R + Math.sqrt(D));
            const T = Math.cbrt(-R - Math.sqrt(D));
            const realRoot = S + T - shift;
            roots.push(realRoot);
        } else {
            // Three real roots
            const theta = Math.acos(-R / Math.sqrt(-Q * Q * Q));
            const r = Math.sqrt(-Q);
            const t1 = 2 * r * Math.cos(theta / 3) - shift;
            const t2 = 2 * r * Math.cos((theta + 2 * Math.PI) / 3) - shift;
            const t3 = 2 * r * Math.cos((theta + 4 * Math.PI) / 3) - shift;
            roots.push(t1, t2, t3);
        }

        // Filter out very small imaginary parts and rounding errors, return real part
        const realRoots = [];
        for (let x of roots) {
            // If it's "very close" to zero, fix to 0
            if (Math.abs(x) < 1e-14) x = 0;
            realRoots.push(x);
        }

        // Return sorted for convenience
        return realRoots.sort((a, b) => a - b);
    }

    /**
     * Solve the linear system (A - λI)x = 0 to find an eigenvector.
     * We only need one non-trivial solution. We'll do basic row-reduction.
     * This works for 3x3.
     */
    function findEigenvector(A, lambda) {
        // Construct M = A - λI
        const M = A.map((row, r) => row.map((val, c) => (r === c ? val - lambda : val)));

        // We'll do a basic row-reduction. Then pick a non-zero solution (or zero if there's degeneracy).
        // M x = 0
        const augmented = M.map(row => [...row, 0]);

        // Perform Gauss-Jordan elimination on augmented
        gaussJordanElimination(augmented);

        // After elimination, we want a non-trivial vector x. We pick a free variable = 1 if needed.
        // For 3x3, we can interpret the row echelon form to see how many free variables we have.

        // We expect at least one dimension free. We'll pick the last variable as free=1 if needed.
        const solution = [0, 0, 0];
        let pivotCols = [];

        // Find pivot columns
        for (let r = 0; r < 3; r++) {
            let pivotCol = -1;
            for (let c = 0; c < 3; c++) {
                if (Math.abs(augmented[r][c]) > 1e-12) {
                    pivotCol = c;
                    break;
                }
            }
            if (pivotCol >= 0) {
                pivotCols.push(pivotCol);
            }
        }

        // If rank < 3, we have free variables
        // We'll proceed from bottom row up.
        if (pivotCols.length === 3) {
            // Possibly degenerate case, but let's see if the system is trivial.
            // This might happen if the matrix is full rank for some numerical glitch.
            // We'll just pick x3 = 0, x2 = 0, x1 = 0 => might not be the non-trivial solution.
            // In a typical scenario, if the eigenvalue is correct, we won't get rank 3.
            return [0, 0, 0];
        } else {
            // We'll pick the last variable (or any free variable) = 1
            // Then solve upwards
            // Identify free columns
            const usedCols = new Set(pivotCols);
            const freeCols = [0, 1, 2].filter(c => !usedCols.has(c));

            if (freeCols.length === 0) {
                // fallback
                return [0, 0, 0];
            }

            // We'll pick the first free column as 1
            const freeCol = freeCols[0];
            solution[freeCol] = 1;

            // Back-substitute
            for (let r = 2; r >= 0; r--) {
                // check pivot in row r
                let pivotCol = -1;
                for (let c = 0; c < 3; c++) {
                    if (Math.abs(augmented[r][c]) > 1e-12) {
                        pivotCol = c;
                        break;
                    }
                }
                if (pivotCol >= 0) {
                    // solution[pivotCol] = - (rest of columns)
                    let sum = 0;
                    for (let c = pivotCol + 1; c < 3; c++) {
                        sum += augmented[r][c] * solution[c];
                    }
                    solution[pivotCol] = -sum;
                }
            }
        }

        // Normalize the solution for readability
        const norm = Math.sqrt(solution.reduce((acc, val) => acc + val * val, 0));
        if (norm < 1e-12) {
            return [0, 0, 0];
        }
        return solution.map(v => v / norm);
    }

    /**
     * Gauss-Jordan elimination in-place for a 3x4 augmented matrix.
     * Modifies the input array.
     */
    function gaussJordanElimination(mat) {
        const rows = mat.length; // 3
        const cols = mat[0].length; // 4 (3 + 1 augmented)

        let row = 0;
        for (let col = 0; col < cols - 1 && row < rows; col++) {
            // Find pivot
            let pivot = row;
            for (let r = row + 1; r < rows; r++) {
                if (Math.abs(mat[r][col]) > Math.abs(mat[pivot][col])) {
                    pivot = r;
                }
            }
            if (Math.abs(mat[pivot][col]) < 1e-12) {
                continue; // no pivot in this column
            }
            // Swap if needed
            if (pivot !== row) {
                [mat[row], mat[pivot]] = [mat[pivot], mat[row]];
            }
            // Normalize pivot row
            const pivotVal = mat[row][col];
            for (let c = col; c < cols; c++) {
                mat[row][c] /= pivotVal;
            }
            // Eliminate below & above
            for (let r2 = 0; r2 < rows; r2++) {
                if (r2 !== row) {
                    const factor = mat[r2][col];
                    for (let c2 = col; c2 < cols; c2++) {
                        mat[r2][c2] -= factor * mat[row][c2];
                    }
                }
            }
            row++;
        }
    }

    /**
     * Power iteration for the dominant eigenvalue/eigenvector.
     * matrix = 3x3
     * maxIterations and tolerance are optional.
     */
    function powerIteration(matrix, maxIterations = 1000, tolerance = 1e-10) {
        const n = matrix.length;
        let vec = Array(n).fill(1);
        let eigenvalue = 0;

        function matVecMul(mat, v) {
            const res = [];
            for (let r = 0; r < mat.length; r++) {
                let sum = 0;
                for (let c = 0; c < mat[0].length; c++) {
                    sum += mat[r][c] * v[c];
                }
                res.push(sum);
            }
            return res;
        }

        function vectorNorm(v) {
            return Math.sqrt(v.reduce((acc, val) => acc + val * val, 0));
        }

        function normalize(v) {
            const norm = vectorNorm(v);
            return v.map(x => x / (norm || 1));
        }

        for (let i = 0; i < maxIterations; i++) {
            const newVec = matVecMul(matrix, vec);
            const newNorm = vectorNorm(newVec);
            const newEigenvalue = newNorm; // approximate

            // check for convergence
            if (Math.abs(newEigenvalue - eigenvalue) < tolerance) {
                break;
            }

            eigenvalue = newEigenvalue;
            vec = normalize(newVec);
        }

        return {
            eigenvalue,
            eigenvector: vec
        };
    }

    /***********************************************************************
     *  Event Listeners and DOM Manipulations
     ***********************************************************************/

    // Tab switching
    const tabButtons = document.querySelectorAll(".tab-button");
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            // Remove active from all
            tabButtons.forEach(b => b.classList.remove("active"));
            // Add active to clicked
            btn.classList.add("active");

            // Hide all tab-contents
            const contents = document.querySelectorAll(".tab-content");
            contents.forEach(tc => tc.classList.remove("active"));

            // Show the selected tab
            const targetId = btn.getAttribute("data-tab");
            document.getElementById(targetId).classList.add("active");
        });
    });

    // Clear button
    const clearButton = document.getElementById("clear");
    clearButton.addEventListener("click", () => {
        const matrixInput = document.getElementById("matrix-input");
        const cells = matrixInput.querySelectorAll("input[type=text]");
        cells.forEach(cell => (cell.value = ""));

        document.getElementById("output-eigenvalues-analytical").value = "";
        document.getElementById("output-eigenvectors-analytical").value = "";
        document.getElementById("output-eigenvalue-power").value = "";
        document.getElementById("output-eigenvector-power").value = "";
    });

    // Analytical Calculation
    const calcAnalyticalButton = document.getElementById("calculate-analytical");
    const outputEigenvaluesAnalytical = document.getElementById("output-eigenvalues-analytical");
    const outputEigenvectorsAnalytical = document.getElementById("output-eigenvectors-analytical");

    calcAnalyticalButton.addEventListener("click", () => {
        const A = getMatrix();
        if (!A) {
            alert("Please enter valid numeric values in the 3×3 matrix.");
            return;
        }

        // Characteristic polynomial
        const polyCoeffs = characteristicPolynomial3x3(A);

        // Real roots
        const roots = findCubicRealRoots(polyCoeffs);
        // Filter out very small imaginary part or duplicates due to numerical issues
        const realEigenvalues = roots.filter((val, idx, arr) => {
            // Could also do a more robust "unique within tolerance" check
            // Here, we assume Cardano's method gave us distinct real solutions or repeated ones
            if (idx > 0 && Math.abs(val - arr[idx - 1]) < 1e-12) {
                return false;
            }
            return true;
        });

        if (realEigenvalues.length === 0) {
            outputEigenvaluesAnalytical.value = "No real eigenvalues found (all complex?).";
            outputEigenvectorsAnalytical.value = "";
            return;
        }

        outputEigenvaluesAnalytical.value = realEigenvalues.join(", ");

        // For each eigenvalue, compute one eigenvector
        let vectorsStr = "";
        for (let lv of realEigenvalues) {
            const eigvec = findEigenvector(A, lv);
            vectorsStr += `λ = ${lv.toFixed(6)} ⇒ v ≈ [${eigvec.map(x => x.toFixed(6)).join(", ")}]\n`;
        }
        outputEigenvectorsAnalytical.value = vectorsStr;
    });

    // Power Iteration
    const calcPowerButton = document.getElementById("calculate-power");
    const outputEigenvaluePower = document.getElementById("output-eigenvalue-power");
    const outputEigenvectorPower = document.getElementById("output-eigenvector-power");

    calcPowerButton.addEventListener("click", () => {
        const A = getMatrix();
        if (!A) {
            alert("Please enter valid numeric values in the 3×3 matrix.");
            return;
        }
        const {
            eigenvalue,
            eigenvector
        } = powerIteration(A);
        outputEigenvaluePower.value = eigenvalue.toFixed(6);
        outputEigenvectorPower.value = `[${eigenvector.map(v => v.toFixed(6)).join(", ")}]`;
    });