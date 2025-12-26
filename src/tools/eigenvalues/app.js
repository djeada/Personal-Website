function getMatrix() {
    const table = document.getElementById("matrix-input");
    const rows = Array.from(table.querySelectorAll("tr"));
    if (rows.length !== 4) return null;


    const raw = rows.map(r =>
        Array.from(r.querySelectorAll("input"))
        .map(i => i.value.trim())
    );
    if (raw.some(r => r.length !== 4)) return null;


    for (let N = 4; N >= 2; N--) {
        let ok = true;

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


        return raw.slice(0, N).map(r =>
            r.slice(0, N).map(v => parseFloat(v))
        );
    }


    return null;
}


function characteristicPolynomial2x2(A) {
    const [
        [a, b],
        [c, d]
    ] = A;
    const tr = a + d;
    const det = a * d - b * c;
    return [1, -tr, det];
}


function characteristicPolynomial3x3(A) {
    const [a, b, c] = A[0], [d, e, f] = A[1], [g, h, i] = A[2];
    const M1 = a + e + i;
    const M2 = (a * e + e * i + a * i) - (b * d + c * g + f * h);
    const M3 = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    return [1, -M1, M2, -M3];
}


function findQuadraticRealRoots([p1, p2, p3]) {

    const A = p2,
        B = p3;
    const D = A * A - 4 * B;
    if (D < 0) return [];
    if (D === 0) return [-A / 2];
    return [(-A + Math.sqrt(D)) / 2, (-A - Math.sqrt(D)) / 2];
}


function findCubicRealRoots([p1, p2, p3, p4]) {


    if (p1 !== 1) {

        p2 /= p1;
        p3 /= p1;
        p4 /= p1;
    }

    const A = p2;
    const B = p3;
    const C = p4;


    const shift = A / 3;
    const a = B - (A * A) / 3;
    const b = (2 * A * A * A) / 27 - (A * B) / 3 + C;

    const Q = (a / 3);
    const R = (b / 2);
    const D = Q * Q * Q + R * R;

    const roots = [];

    if (Math.abs(D) < 1e-14) {

        if (Math.abs(R) < 1e-14 && Math.abs(Q) < 1e-14) {

            roots.push(-shift);
        } else {

            const t1 = Math.cbrt(-R) - shift;
            roots.push(t1);

            const t2 = -A / 3 - (t1 + A / 3);
            roots.push(t2);
        }
    } else if (D > 0) {

        const S = Math.cbrt(-R + Math.sqrt(D));
        const T = Math.cbrt(-R - Math.sqrt(D));
        const realRoot = S + T - shift;
        roots.push(realRoot);
    } else {

        const theta = Math.acos(-R / Math.sqrt(-Q * Q * Q));
        const r = Math.sqrt(-Q);
        const t1 = 2 * r * Math.cos(theta / 3) - shift;
        const t2 = 2 * r * Math.cos((theta + 2 * Math.PI) / 3) - shift;
        const t3 = 2 * r * Math.cos((theta + 4 * Math.PI) / 3) - shift;
        roots.push(t1, t2, t3);
    }


    const realRoots = [];
    for (let x of roots) {

        if (Math.abs(x) < 1e-14) x = 0;
        realRoots.push(x);
    }


    return realRoots.sort((a, b) => a - b);
}



function findEigenvector(A, lambda) {
    const N = A.length;

    const M = A.map((row, i) =>
        row.map((v, j) => (i === j ? v - lambda : v)).concat([0])
    );


    gaussJordanElimination(M);


    const pivotCols = [];
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            if (Math.abs(M[i][j]) > 1e-12) {
                pivotCols.push(j);
                break;
            }
        }
    }


    const allCols = Array.from({
        length: N
    }, (_, i) => i);
    const freeCols = allCols.filter(c => !pivotCols.includes(c));
    const x = Array(N).fill(0);
    if (freeCols.length === 0) {

        return x;
    }
    x[freeCols[0]] = 1;


    for (let i = N - 1; i >= 0; i--) {

        let pcol = -1;
        for (let j = 0; j < N; j++) {
            if (Math.abs(M[i][j]) > 1e-12) {
                pcol = j;
                break;
            }
        }
        if (pcol < 0) continue;

        let s = 0;
        for (let j = pcol + 1; j < N; j++) {
            s += M[i][j] * x[j];
        }
        x[pcol] = -s;
    }


    const norm = Math.hypot(...x);
    if (norm < 1e-12) return x;
    return x.map(v => v / norm);
}



function gaussJordanElimination(mat) {
    const rows = mat.length;
    const cols = mat[0].length;
    let r = 0;
    for (let c = 0; c < cols - 1 && r < rows; c++) {

        let pivot = r;
        for (let i = r + 1; i < rows; i++) {
            if (Math.abs(mat[i][c]) > Math.abs(mat[pivot][c])) {
                pivot = i;
            }
        }
        if (Math.abs(mat[pivot][c]) < 1e-12) continue;

        [mat[r], mat[pivot]] = [mat[pivot], mat[r]];

        const pv = mat[r][c];
        for (let j = c; j < cols; j++) mat[r][j] /= pv;

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
        const newEigenvalue = newNorm;


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




const tabButtons = document.querySelectorAll(".tab-button");
tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {

        tabButtons.forEach(b => b.classList.remove("active"));

        btn.classList.add("active");


        const contents = document.querySelectorAll(".tab-content");
        contents.forEach(tc => tc.classList.remove("active"));


        const targetId = btn.getAttribute("data-tab");
        document.getElementById(targetId).classList.add("active");
    });
});



document.getElementById("clear").addEventListener("click", () => {
    document.querySelectorAll("#matrix-input input").forEach(i => i.value = "");
    ["output-eigenvalues-analytical", "output-eigenvectors-analytical",
        "output-eigenvalue-power", "output-eigenvector-power"
    ]
    .forEach(id => document.getElementById(id).value = "");
});


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


    const uniques = realRoots.filter((v, i, a) => i === 0 || Math.abs(v - a[i - 1]) > 1e-12);
    document.getElementById("output-eigenvalues-analytical").value =
        uniques.join(", ");


    const vecs = uniques.map(λ => {
        const v = findEigenvector(A, λ);
        return `λ=${λ.toFixed(6)} ⇒ [${v.map(x=>x.toFixed(6)).join(", ")}]`;
    }).join("\n");
    document.getElementById("output-eigenvectors-analytical").value = vecs;
});


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