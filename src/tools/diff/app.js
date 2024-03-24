document.addEventListener('DOMContentLoaded', () => {
    const compareButton = document.getElementById('compare');
    compareButton.addEventListener('click', compareTexts);
});

function compareTexts() {
    const text1 = document.getElementById('text1').value;
    const text2 = document.getElementById('text2').value;

    const diffHtml = generateDiffHtml(text1, text2);
    document.getElementById('diff-result').innerHTML = diffHtml;
}

function generateDiffHtml(text1, text2) {
    const diffs = getDiffs(text1, text2);
    if (diffs.length === 0) return '<p>No differences found.</p>';

    return diffs.map((diff, index) => {
        const lineNumber = `<span class="line-number">Line ${index + 1}:</span>`;
        if (diff.added) {
            return `<div class="added">${lineNumber} ${escapeHtml(diff.value)}</div>`;
        } else if (diff.removed) {
            return `<div class="removed">${lineNumber} ${escapeHtml(diff.value)}</div>`;
        }
        return `<div>${lineNumber} ${escapeHtml(diff.value)}</div>`;
    }).join('');
}


function getDiffs(text1, text2) {
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    const diffs = [];
    const maxLen = Math.max(lines1.length, lines2.length);

    for (let i = 0; i < maxLen; i++) {
        if (i < lines1.length && i < lines2.length) {
            if (lines1[i] !== lines2[i]) {
                diffs.push({
                    removed: true,
                    value: lines1[i]
                });
                diffs.push({
                    added: true,
                    value: lines2[i]
                });
            } else {
                diffs.push({
                    value: lines1[i]
                });
            }
        } else if (i < lines1.length) {
            diffs.push({
                removed: true,
                value: lines1[i]
            });
        } else if (i < lines2.length) {
            diffs.push({
                added: true,
                value: lines2[i]
            });
        }
    }

    return diffs;
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}