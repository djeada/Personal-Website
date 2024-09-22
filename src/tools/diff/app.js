document.addEventListener('DOMContentLoaded', () => {
    const compareButton = document.getElementById('compare');
    if (compareButton) {
        compareButton.addEventListener('click', compareTexts);
    }
});

function compareTexts() {
    const text1Elem = document.getElementById('text1');
    const text2Elem = document.getElementById('text2');
    if (!text1Elem || !text2Elem) return;

    const text1 = text1Elem.value;
    const text2 = text2Elem.value;

    const diffHtml = generateDiffHtml(text1, text2);
    const diffResultElem = document.getElementById('diff-result');
    if (diffResultElem) {
        diffResultElem.innerHTML = diffHtml;
    }
}

function generateDiffHtml(text1, text2) {
    const diffs = getLineDiffs(text1, text2);
    if (diffs.length === 0) return '<p>No differences found.</p>';

    return diffs.map(diff => {
        if (diff.type === 'equal') {
            return `<div class="line"><span class="line-number">${diff.lineNumber}</span> ${escapeHtml(diff.value)}</div>`;
        } else if (diff.type === 'removed') {
            return `<div class="line removed"><span class="line-number">${diff.lineNumber}</span> ${escapeHtml(diff.value)}</div>`;
        } else if (diff.type === 'added') {
            return `<div class="line added"><span class="line-number">${diff.lineNumber}</span> ${escapeHtml(diff.value)}</div>`;
        } else if (diff.type === 'changed') {
            const charDiffHtml = generateCharDiffHtml(diff.value1, diff.value2);
            return `<div class="line changed"><span class="line-number">${diff.lineNumber}</span> ${charDiffHtml}</div>`;
        }
    }).join('');
}

function getLineDiffs(text1, text2) {
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');

    const dp = [];
    for (let i = 0; i <= lines1.length; i++) {
        dp[i] = [];
        for (let j = 0; j <= lines2.length; j++) {
            dp[i][j] = 0;
        }
    }

    for (let i = 1; i <= lines1.length; i++) {
        for (let j = 1; j <= lines2.length; j++) {
            if (lines1[i - 1] === lines2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    const result = [];
    let i = lines1.length;
    let j = lines2.length;

    while (i > 0 && j > 0) {
        if (lines1[i - 1] === lines2[j - 1]) {
            result.unshift({
                type: 'equal',
                value: lines1[i - 1],
                lineNumber: i
            });
            i--;
            j--;
        } else if (dp[i - 1][j] >= dp[i][j - 1]) {
            result.unshift({
                type: 'removed',
                value: lines1[i - 1],
                lineNumber: i
            });
            i--;
        } else {
            result.unshift({
                type: 'added',
                value: lines2[j - 1],
                lineNumber: j
            });
            j--;
        }
    }

    while (i > 0) {
        result.unshift({
            type: 'removed',
            value: lines1[i - 1],
            lineNumber: i
        });
        i--;
    }

    while (j > 0) {
        result.unshift({
            type: 'added',
            value: lines2[j - 1],
            lineNumber: j
        });
        j--;
    }

    const mergedResult = [];
    for (let k = 0; k < result.length; k++) {
        if (result[k].type === 'removed' && result[k + 1] && result[k + 1].type === 'added') {
            mergedResult.push({
                type: 'changed',
                value1: result[k].value,
                value2: result[k + 1].value,
                lineNumber: result[k].lineNumber
            });
            k++;
        } else {
            mergedResult.push(result[k]);
        }
    }

    return mergedResult;
}

function generateCharDiffHtml(line1, line2) {
    const diffs = getCharDiffs(line1, line2);

    return diffs.map(diff => {
        if (diff.type === 'equal') {
            return `<span>${escapeHtml(diff.value)}</span>`;
        } else if (diff.type === 'removed') {
            return `<span class="char-removed">${escapeHtml(diff.value)}</span>`;
        } else if (diff.type === 'added') {
            return `<span class="char-added">${escapeHtml(diff.value)}</span>`;
        }
    }).join('');
}

function getCharDiffs(line1, line2) {
    const chars1 = line1.split('');
    const chars2 = line2.split('');

    const dp = [];
    for (let i = 0; i <= chars1.length; i++) {
        dp[i] = [];
        for (let j = 0; j <= chars2.length; j++) {
            dp[i][j] = 0;
        }
    }

    for (let i = 1; i <= chars1.length; i++) {
        for (let j = 1; j <= chars2.length; j++) {
            if (chars1[i - 1] === chars2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    const result = [];
    let i = chars1.length;
    let j = chars2.length;

    while (i > 0 && j > 0) {
        if (chars1[i - 1] === chars2[j - 1]) {
            result.unshift({
                type: 'equal',
                value: chars1[i - 1]
            });
            i--;
            j--;
        } else if (dp[i - 1][j] >= dp[i][j - 1]) {
            result.unshift({
                type: 'removed',
                value: chars1[i - 1]
            });
            i--;
        } else {
            result.unshift({
                type: 'added',
                value: chars2[j - 1]
            });
            j--;
        }
    }

    while (i > 0) {
        result.unshift({
            type: 'removed',
            value: chars1[i - 1]
        });
        i--;
    }

    while (j > 0) {
        result.unshift({
            type: 'added',
            value: chars2[j - 1]
        });
        j--;
    }

    return result;
}

function escapeHtml(unsafe) {
    return unsafe.replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    } [m]));
}