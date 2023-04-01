// DOM event listeners
document.getElementById("reset").addEventListener("click", reset);
document.getElementById("submit").addEventListener("click", processMatrices);

// Functions
function reset() {
  displayMatrix("matrix-a", []);
  displayMatrix("matrix-b", []);
  displayMatrix("matrix-result", []);
}

function processMatrices() {
  const matrixA = getMatrixValues("matrix-a");
  const matrixB = getMatrixValues("matrix-b");

  if (!checkIfMatricesCanBeMultiplied(matrixA, matrixB)) {
    alert("The matrices cannot be multiplied");
    cleanup(matrixA, matrixB);
    return;
  }

  if (!isNumericMatrix(matrixA) || !isNumericMatrix(matrixB)) {
    alert("The matrices must contain only numeric values");
    cleanup(matrixA, matrixB);
    return;
  }

  const result = multiply(convertToInt(matrixA), convertToInt(matrixB));
  displayMatrix("matrix-result", result);
}

function cleanup(matrixA, matrixB) {
  matrixA = fillNonNumericCells(matrixA);
  matrixB = fillNonNumericCells(matrixB);
  displayMatrix("matrix-a", matrixA);
  displayMatrix("matrix-b", matrixB);
}

function fillNonNumericCells(matrix) {
  return matrix.map((row) =>
    row.map((value) => (isNumeric(value) ? value : "-"))
  );
}

function isNumericMatrix(matrix) {
  return matrix.every((row) => row.every(isNumeric));
}

function isNumeric(value) {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

function displayMatrix(id, matrix) {
  const table = document.getElementById(id);
  const rows = table.rows;

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].cells;

    for (let j = 0; j < cells.length; j++) {
      const value =
        i < matrix.length && j < matrix[i].length ? matrix[i][j] : "";
      cells[j].firstElementChild.value = value;
      cells[j].firstElementChild.textContent = value;
    }
  }
}

function getMatrixValues(id) {
  const table = document.getElementById(id);
  const rows = table.rows;

  let matrix = [];

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].cells;
    let row = [];

    for (let j = 0; j < cells.length; j++) {
      row.push(cells[j].firstElementChild.value);
    }

    matrix.push(row);
  }

  return filterMatrix(matrix);
}

function filterMatrix(matrix) {
  matrix = matrix.filter(
    (row) => !row.every((cell) => cell === "-" || cell === "")
  );
  matrix = transpose(matrix);
  matrix = matrix.filter(
    (row) => !row.every((cell) => cell === "-" || cell === "")
  );
  return transpose(matrix);
}

function transpose(matrix) {
  return matrix[0].map((_, i) => matrix.map((row) => row[i]));
}

function convertToInt(matrix) {
  return matrix.map((row) => row.map((value) => parseInt(value, 10)));
}

function checkIfMatricesCanBeMultiplied(matrixA, matrixB) {
  return matrixA[0].length === matrixB.length;
}

function multiply(matrixA, matrixB) {
  const matrixARows = matrixA.length;
  const matrixBColumns = matrixB[0].length;

  let result = new Array(matrixARows)
    .fill(0)
    .map(() => new Array(matrixBColumns).fill(0));

  for (let i = 0; i < matrixARows; i++) {
    for (let j = 0; j < matrixBColumns; j++) {
      for (let k = 0; k < matrixB.length; k++) {
        result[i][j] += matrixA[i][k] * matrixB[k][j];
      }
    }
  }

  return result;
}

reset();
