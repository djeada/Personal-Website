document.addEventListener('DOMContentLoaded', function () {
    const textInput = document.getElementById('textInput');
    const textDisplay = document.getElementById('textDisplay');
    const duplicateTable = document.getElementById('duplicateTable');
    const minLengthInput = document.getElementById('minLength'); // Add reference to minLength input
    let checkboxStates = {};

    // Event listener for text input
    textInput.addEventListener('input', updateContent);

    // Event listener for minimum length input
    minLengthInput.addEventListener('input', updateContent); // Add this line


    function updateContent() {
        const text = textInput.value;
        const normalizedText = normalizeText(text);
        const wordCounts = getWordCounts(normalizedText);
        const duplicates = getDuplicates(wordCounts);

        updateDuplicateTable(wordCounts, duplicates);
        highlightText(normalizedText, duplicates);
    }
function normalizeText(text) {
    // Normalize to NFD (decomposing diacritics)
    let normalized = text.normalize("NFD");

    // Custom replacements for specific cases
    const customReplacements = {
        'ł': 'l',
        'ø': 'o',
        'ğ': 'g',
        // Add other specific replacements as needed
    };

    // Apply custom replacements
    Object.keys(customReplacements).forEach(char => {
        normalized = normalized.replace(new RegExp(char, 'g'), customReplacements[char]);
    });

    // Remove diacritics not covered by NFD normalization
    normalized = normalized.replace(/[\u0300-\u036f]/g, '');

    // Convert to lowercase
    return normalized.toLowerCase();
}

function getWordCounts(text) {
    const minWordLength = parseInt(document.getElementById('minLength').value, 10) || 3;
    const words = text.match(/\w+/g) || [];
    return words.reduce((counts, word) => {
        if (word.length >= minWordLength) {
            counts[word] = (counts[word] || 0) + 1;
        }
        return counts;
    }, {});
}


    function getDuplicates(wordCounts) {
        return Object.keys(wordCounts).filter(word => wordCounts[word] > 1);
    }

    function highlightText(normalizedText, duplicates) {
        const originalText = normalizedText;
        let highlightedText = originalText.replace(/\b\w+\b/g, match => {
            const normalizedMatch = normalizeText(match);
            if (duplicates.includes(normalizedMatch) && (checkboxStates[normalizedMatch] !== false)) {
                return `<span class="highlight">${match}</span>`;
            }
            return match;
        });
        textDisplay.innerHTML = highlightedText;
    }

    function updateDuplicateTable(wordCounts, duplicates) {
        let sortedDuplicates = duplicates.sort((a, b) => wordCounts[b] - wordCounts[a]);
        let html = '<table><tr><th>Word</th><th>Count</th><th>Toggle</th></tr>';
        sortedDuplicates.forEach(duplicate => {
            const isChecked = checkboxStates[duplicate] !== false;
            html += `<tr><td>${duplicate}</td><td>${wordCounts[duplicate]}</td><td><input type="checkbox" id="checkbox-${duplicate}" ${isChecked ? 'checked' : ''} onchange="updateCheckboxState('${duplicate}')"></td></tr>`;
        });
        html += '</table>';
        duplicateTable.innerHTML = html;
    }

    window.updateCheckboxState = function (word) {
        const checkbox = document.getElementById(`checkbox-${word}`);
        checkboxStates[word] = checkbox.checked;
        highlightText(normalizeText(textInput.value), getDuplicates(getWordCounts(normalizeText(textInput.value))));
    };
});

