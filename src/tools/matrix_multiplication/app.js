document.getElementById('reset').addEventListener('click', () => {
    // reset the values of the input fields in the tables
    displayMatrix('matrix-a', []);
    displayMatrix('matrix-b', []);
    displayMatrix('matrix-result', []);
});

document.getElementById('submit').addEventListener('click', () => {


    // get the values of the input fields in the tables
    matrixA = getMatrixValues('matrix-a');
    matrixB = getMatrixValues('matrix-b');

    console.log(matrixA);
    console.log(matrixB);

    if (!checkIfMatricesCanBeMultiplied(matrixA, matrixB)) {
        alert('The matrices cannot be multiplied');
        cleanup(matrixA, matrixB);
        return;
    }

    // check if the matrices contain only numeric values
    if (!isNumericMatrix(matrixA) || !isNumericMatrix(matrixB)) {
        alert('The matrices must contain only numeric values');
        cleanup(matrixA, matrixB);
        return;
    }

    matrixA = convertToInt(matrixA);
    matrixB = convertToInt(matrixB);



    // perform the matrix multiplication and store the result in a variable
    const result = multiply(matrixA, matrixB);

    console.log(result);

    // update the result element with the result of the multiplication
    displayMatrix('matrix-result', result);

});


function cleanup(matrixA, matrixB) {
    matrixA = fillNonNumericCells(matrixA);
    matrxiB = fillNonNumericCells(matrixB);
    displayMatrix('matrix-a', matrixA);
    displayMatrix('matrix-b', matrixB);

}

function fillNonNumericCells(matrix) {
    // iterate over the rows of the matrix
    for (let i = 0; i < matrix.length; i++) {
        // get the current row
        const row = matrix[i];

        // iterate over the cells of the current row
        for (let j = 0; j < row.length; j++) {
            // get the value of the current cell
            const value = row[j];

            // check if the value is numeric
            const isNumeric = !isNaN(parseFloat(value)) && isFinite(value);

            // if the value is not numeric, replace it with "-"
            if (!isNumeric) {
                row[j] = '-';
            }

        }
    }

    return matrix;
}

function isNumericMatrix(matrix) {
    // check if the matrix contains only numeric values (integers or floats or strings that represent integers or floats)

    // iterate over the rows of the matrix
    for (let i = 0; i < matrix.length; i++) {
        // get the current row
        const row = matrix[i];

        // iterate over the cells of the current row
        for (let j = 0; j < row.length; j++) {
            // get the value of the current cell
            const value = row[j];

            // check if the value is numeric
            const isNumeric = !isNaN(parseFloat(value)) && isFinite(value);

            // if the value is not numeric, return false
            if (!isNumeric) {
                return false;
            }
        }
    }

    // if the code reaches this point, all values are numeric
    return true;
}

function displayMatrix(id, matrix) {
    // get the table element
    const table = document.getElementById(id);

    // get the rows of the table
    const rows = table.rows;

    // iterate over the rows of the table
    for (let i = 0; i < rows.length; i++) {
        // get the cells of the current row
        const cells = rows[i].cells;

        // iterate over the cells of the current row
        for (let j = 0; j < cells.length; j++) {
            // get the value of the current cell if it exists
            value = '';
            if (i < matrix.length && j < matrix[i].length) {
                value = matrix[i][j];
            }

            // update the value of the current cell
            cells[j].firstElementChild.value = value;
            cells[j].firstElementChild.textContent = value;
        }
    }
}


function getMatrixValues(id) {
    // get the table element
    const table = document.getElementById(id);

    // get the rows of the table
    const rows = table.rows;

    // create an empty array to store the values of the table
    const matrix = [];

    // iterate over the rows of the table
    for (let i = 0; i < rows.length; i++) {
        // get the cells of the current row
        const cells = rows[i].cells;

        // create an empty array to store the values of the current row
        const row = [];

        // iterate over the cells of the current row
        for (let j = 0; j < cells.length; j++) {
            // get the value of the current cell
            const value = cells[j].firstElementChild.value;

            // add the value to the current row
            row.push(value);
        }

        // add the current row to the matrix
        matrix.push(row);
    }

    return filterMatrix(matrix);
}

function filterMatrix(matrix) {
    // if a row contains only cell with value "-" remove the row
    // if a column contains only cell with value "-" remove the column

    // create a copy of the matrix
    const matrixCopy = matrix.map(row => row.slice());

    // iterate over the rows of the matrix
    for (let i = 0; i < matrixCopy.length; i++) {
        // get the current row
        const row = matrixCopy[i];

        // check if the row contains only cells with value "-" or empty cells
        const isRowEmpty = row.every(cell => cell === '-' || cell === "");

        // if the row contains only cells with value "-", remove the row
        if (isRowEmpty) {

            // remove the row from the matrix
            matrixCopy.splice(i, 1);

            // decrement the index to account for the removed row
            i--;
        }

    }

    // iterate over the columns of the matrix
    for (let i = 0; i < matrixCopy[0].length; i++) {

        // create an array to store the values of the current column
        const column = [];

        // iterate over the rows of the matrix
        for (let j = 0; j < matrixCopy.length; j++) {

            // get the value of the current cell
            const value = matrixCopy[j][i];

            // add the value to the current column
            column.push(value);
        }

        // check if the column contains only cells with value "-"
        const isColumnEmpty = column.every(cell => cell === '-' || cell === "");

        // if the column contains only cells with value "-", remove the column
        if (isColumnEmpty) {

            // iterate over the rows of the matrix
            for (let j = 0; j < matrixCopy.length; j++) {

                // remove the current cell from the matrix

                matrixCopy[j].splice(i, 1);

            }
            // decrement the index to account for the removed column
            i--;
        }
    }
    return matrixCopy;
}

function fillEmpty(matrix) {
    // fill empty cells ("-") with 0

    // iterate over the rows of the matrix
    for (let i = 0; i < matrix.length; i++) {
        // get the current row
        const row = matrix[i];

        // iterate over the cells of the current row
        for (let j = 0; j < row.length; j++) {
            // get the value of the current cell

            const value = row[j];

            // if the value is "-", replace it with 0
            if (value === '-' || value === '') {
                row[j] = 0;
            }
        }
    }
    return matrix;
}

function convertToInt(matrix) {
    // convert the values of the matrix from strings to integers

    // iterate over the rows of the matrix
    for (let i = 0; i < matrix.length; i++) {
        // get the current row
        const row = matrix[i];

        // iterate over the cells of the current row
        for (let j = 0; j < row.length; j++) {
            // get the value of the current cell
            const value = row[j];

            // convert the value from string to integer
            const valueInt = parseInt(value);

            // replace the value in the matrix with the converted value
            row[j] = valueInt;
        }

    }

    return matrix;

}

// check if two matrices can be multiplied\
function checkIfMatricesCanBeMultiplied(matrixA, matrixB) {
    // get the number of columns in matrix A
    const matrixAColumns = matrixA[0].length;

    // get the number of rows in matrix B
    const matrixBRows = matrixB.length;

    // check if the number of columns in matrix A is equal to the number of rows in matrix B
    // EVENT LISTENER FOR BUTTON WITH ID = 'submit'

    const canBeMultiplied = matrixAColumns === matrixBRows;

    return canBeMultiplied;
}

// multiply two matrices
function multiply(matrixA, matrixB) {
    // get the number of rows in matrix A
    const matrixARows = matrixA.length;

    // get the number of columns in matrix B
    const matrixBColumns = matrixB[0].length;

    // create a new matrix with the correct dimensions
    const result = new Array(matrixARows).fill(0).map(() => new Array(matrixBColumns).fill(0));

    // multiply the matrices
    for (let i = 0; i < matrixARows; i++) {
        for (let j = 0; j < matrixBColumns; j++) {
            for (let k = 0; k < matrixB.length; k++) {
                result[i][j] += matrixA[i][k] * matrixB[k][j];

            }
        }
    }

    return result;

}