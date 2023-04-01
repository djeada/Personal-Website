document.addEventListener("DOMContentLoaded", function () {
  const matrixInput = document.getElementById("matrix-input");
  const outputEigenvalues = document.getElementById("output-eigenvalues");
  const outputEigenvectors = document.getElementById("output-eigenvectors");
  const calculateButton = document.getElementById("calculate");
  const clearButton = document.getElementById("clear");

  function getMatrix() {
    const matrix = [];
    const rows = matrixInput.querySelectorAll("tr");
    for (const row of rows) {
      const rowData = [];
      const cells = row.querySelectorAll("input");
      for (const cell of cells) {
        rowData.push(parseFloat(cell.value));
      }
      matrix.push(rowData);
    }
    return matrix;
  }

  function normalize(vec) {
    const norm = Math.sqrt(vec.reduce((sum, val) => sum + Math.pow(val, 2), 0));
    return vec.map((val) => val / norm);
  }

  function matVecMul(mat, vec) {
    return mat.map((row) => row.reduce((sum, val, i) => sum + val * vec[i], 0));
  }

  function powerIteration(matrix, maxIterations = 100, tolerance = 1e-6) {
    const n = matrix.length;
    let vec = Array(n).fill(1);
    let eigenvalue = null;

    for (let i = 0; i < maxIterations; i++) {
      const newVec = matVecMul(matrix, vec);
      const newEigenvalue = newVec.reduce(
        (max, val) => Math.max(max, Math.abs(val)),
        0
      );

      if (
        eigenvalue !== null &&
        Math.abs(newEigenvalue - eigenvalue) <= tolerance
      ) {
        break;
      }

      eigenvalue = newEigenvalue;
      vec = normalize(newVec);
    }

    return {
      eigenvalue,
      eigenvector: vec,
    };
  }

  calculateButton.addEventListener("click", () => {
    const matrix = getMatrix();
    const result = powerIteration(matrix);
    outputEigenvalues.value = JSON.stringify([result.eigenvalue], null, 2);
    outputEigenvectors.value = JSON.stringify([result.eigenvector], null, 2);
  });

  clearButton.addEventListener("click", () => {
    outputEigenvalues.value = "";
    outputEigenvectors.value = "";
    const cells = matrixInput.querySelectorAll("input[type=number]");
    for (const cell of cells) {
      cell.value = "";
    }
  });
});
