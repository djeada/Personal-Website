/***********************************************************************
 *  Utility functions for working with matrices, polynomials, and
 *  eigenvalues/eigenvectors in pure JavaScript.
 ***********************************************************************/

/**
 * Parses an N×N sub-matrix (2≤N≤4) from the 4×4 HTML inputs.
 * Returns an N×N array or null if it can’t find a valid square.
 */
function getMatrix() {
    const table = document.getElementById("matrix-input");
    const rows = Array.from(table.querySelectorAll("tr"));
    if (rows.length !== 4) return null;

    // read all raw values into a 4×4 string grid
    const raw = rows.map(r =>
        Array.from(r.querySelectorAll("input"))
        .map(i => i.value.trim())
    );
    if (raw.some(r => r.length !== 4)) return null;

    // try sizes from 4 down to 2
    for (let N = 4; N >= 2; N--) {
        let ok = true;
        // 1) top-left N×N must be all numeric
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
                if (raw[i][j] === "" || isNaN(Number(raw[i][j]))) {
                    ok = false;
                    break;
                }
            }
            if (!ok) break;
        }
        if (!ok) continue;

        // 2) everything outside that N×N must be blank
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                if (i < N && j < N) continue;
                if (raw[i][j] !== "") {
                    ok = false;
                    break;
                }
            }
            if (!ok) break;
        }
        if (!ok) continue;

        // build numeric matrix
        return raw.slice(0, N).map(r =>
            r.slice(0, N).map(v => parseFloat(v))
        );
    }

    // no valid 2×2, 3×3 or 4×4 found
    return null;
}

/**
 * 2×2 characteristic polynomial: λ^2 - (trace)λ + det = 0
 * Returns [1, -trace, det]
 */
function characteristicPolynomial2x2(A) {
    const [
        [a, b],
        [c, d]
    ] = A;
    const tr = a + d;
    const det = a * d - b * c;
    return [1, -tr, det];
}

/**
 * 3×3 characteristic polynomial using principal minors.
 * Returns [1, -M1, M2, -M3] for λ^3 + p2 λ^2 + p1 λ + p0.
 */
function characteristicPolynomial3x3(A) {
    const [a, b, c] = A[0], [d, e, f] = A[1], [g, h, i] = A[2];
    const M1 = a + e + i;
    const M2 = (a * e + e * i + a * i) - (b * d + c * g + f * h);
    const M3 = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    return [1, -M1, M2, -M3];
}

/**
 * Find real roots of quadratic λ^2 + aλ + b = 0
 */
function findQuadraticRealRoots([p1, p2, p3]) {
    // p1=1
    const A = p2,
        B = p3;
    const D = A * A - 4 * B;
    if (D < 0) return [];
    if (D === 0) return [-A / 2];
    return [(-A + Math.sqrt(D)) / 2, (-A - Math.sqrt(D)) / 2];
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
/**
 * Solve (A - λI)x = 0 for a nonzero x, for any N×N matrix A.
 * Returns a normalized eigenvector array of length N (or all zeros if degenerate).
 */
function findEigenvector(A, lambda) {
    const N = A.length;
    // build the N×(N+1) augmented matrix [A - λI | 0]
    const M = A.map((row, i) =>
        row.map((v, j) => (i === j ? v - lambda : v)).concat([0])
    );

    // reduce
    gaussJordanElimination(M);

    // track pivots
    const pivotCols = [];
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            if (Math.abs(M[i][j]) > 1e-12) {
                pivotCols.push(j);
                break;
            }
        }
    }

    // pick a free var = 1
    const allCols = Array.from({
        length: N
    }, (_, i) => i);
    const freeCols = allCols.filter(c => !pivotCols.includes(c));
    const x = Array(N).fill(0);
    if (freeCols.length === 0) {
        // full rank → fallback
        return x;
    }
    x[freeCols[0]] = 1;

    // back-substitute pivot rows from bottom up
    for (let i = N - 1; i >= 0; i--) {
        // find pivot col in row i
        let pcol = -1;
        for (let j = 0; j < N; j++) {
            if (Math.abs(M[i][j]) > 1e-12) {
                pcol = j;
                break;
            }
        }
        if (pcol < 0) continue;
        // sum of M[i][j]*x[j] for j>pcol
        let s = 0;
        for (let j = pcol + 1; j < N; j++) {
            s += M[i][j] * x[j];
        }
        x[pcol] = -s; // since RHS is zero
    }

    // normalize
    const norm = Math.hypot(...x);
    if (norm < 1e-12) return x;
    return x.map(v => v / norm);
}


/**
 * Gauss-Jordan elimination in-place for a 3x4 augmented matrix.
 * Modifies the input array.
 */
function gaussJordanElimination(mat) {
    const rows = mat.length;
    const cols = mat[0].length; // N+1
    let r = 0;
    for (let c = 0; c < cols - 1 && r < rows; c++) {
        // find best pivot in col c
        let pivot = r;
        for (let i = r + 1; i < rows; i++) {
            if (Math.abs(mat[i][c]) > Math.abs(mat[pivot][c])) {
                pivot = i;
            }
        }
        if (Math.abs(mat[pivot][c]) < 1e-12) continue;
        // swap rows
        [mat[r], mat[pivot]] = [mat[pivot], mat[r]];
        // normalize pivot row
        const pv = mat[r][c];
        for (let j = c; j < cols; j++) mat[r][j] /= pv;
        // eliminate all other rows
        for (let i = 0; i < rows; i++) {
            if (i === r) continue;
            const f = mat[i][c];
            for (let j = c; j < cols; j++) {
                mat[i][j] -= f * mat[r][j];
            }
        }
        r++;
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
document.getElementById("clear").addEventListener("click", () => {
    document.querySelectorAll("#matrix-input input").forEach(i => i.value = "");
    ["output-eigenvalues-analytical", "output-eigenvectors-analytical",
        "output-eigenvalue-power", "output-eigenvector-power"
    ]
    .forEach(id => document.getElementById(id).value = "");
});

// Analytical Calculation
document.getElementById("calculate-analytical").addEventListener("click", () => {
    const A = getMatrix();
    if (!A) {
        alert("Please enter valid numeric values in an N×N matrix (2≤N≤4).");
        return;
    }
    const N = A.length;
    let coeffs, realRoots = [];
    if (N === 2) {
        coeffs = characteristicPolynomial2x2(A);
        realRoots = findQuadraticRealRoots(coeffs);
    } else if (N === 3) {
        coeffs = characteristicPolynomial3x3(A);
        realRoots = findCubicRealRoots(coeffs);
    } else {
        alert("Analytical eigenvalues for 4×4 are not supported.");
        return;
    }

    if (realRoots.length === 0) {
        document.getElementById("output-eigenvalues-analytical").value =
            "No real eigenvalues.";
        document.getElementById("output-eigenvectors-analytical").value = "";
        return;
    }

    // Unique, sorted
    const uniques = realRoots.filter((v, i, a) => i === 0 || Math.abs(v - a[i - 1]) > 1e-12);
    document.getElementById("output-eigenvalues-analytical").value =
        uniques.join(", ");

    // eigenvectors for each real λ
    const vecs = uniques.map(λ => {
        const v = findEigenvector(A, λ);
        return `λ=${λ.toFixed(6)} ⇒ [${v.map(x=>x.toFixed(6)).join(", ")}]`;
    }).join("\n");
    document.getElementById("output-eigenvectors-analytical").value = vecs;
});

// Power Iteration
document.getElementById("calculate-power").addEventListener("click", () => {
    const A = getMatrix();
    if (!A) {
        alert("Please enter valid numeric values in an N×N matrix (2≤N≤4).");
        return;
    }
    const {
        eigenvalue,
        eigenvector
    } = powerIteration(A);
    document.getElementById("output-eigenvalue-power").value =
        eigenvalue.toFixed(6);
    document.getElementById("output-eigenvector-power").value =
        `[${eigenvector.map(v=>v.toFixed(6)).join(", ")}]`;
});