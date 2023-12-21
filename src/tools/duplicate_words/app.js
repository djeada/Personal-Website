document.addEventListener('DOMContentLoaded', function() {
    const textInput = document.getElementById('textInput');
    const textDisplay = document.getElementById('textDisplay');
    const duplicateTable = document.getElementById('duplicateTable');
    const minLengthInput = document.getElementById('minLength');
    const minOccurrencesInput = document.getElementById('minOccurrences'); 
    const prefixTrackingInput = document.getElementById('matchPrefixes');

    let checkboxStates = {};

    textInput.addEventListener('input', updateContent);
    minLengthInput.addEventListener('input', updateContent);
    minOccurrencesInput.addEventListener('input', updateContent);
    prefixTrackingInput.addEventListener('change', updateContent);

    window.onload = updateContent;

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

        const customReplacements = {
            'ł': 'l',
            'ø': 'o',
            'ğ': 'g',
            'ß': 'ss',
            'ñ': 'n',
            'ç': 'c',
            // ... add more replacements as needed
        };

        normalized = Array.from(normalized).map(char =>
            customReplacements[char] || char
        ).join('');

        // Remove diacritics not covered by NFD normalization using a more concise regex
        normalized = normalized.replace(/\p{M}/gu, '');

        // Convert to lowercase
        return normalized.toLowerCase();
    }

    function getWordCounts(text) {
        const minWordLength = parseInt(document.getElementById('minLength').value, 10) || 3;
        const words = text.match(/\w+/g) || [];
        const trackPrefixes = prefixTrackingInput.checked;

        return words.reduce((counts, word) => {
            if (word.length >= minWordLength) {
                counts[word] = (counts[word] || 0) + 1;

                // Count prefixes if prefix tracking is enabled
                if (trackPrefixes) {
                    for (let i = minWordLength; i < word.length; i++) {
                        const prefix = word.substring(0, i);
                        counts[prefix] = (counts[prefix] || 0) + 1;
                    }
                }
            }
            return counts;
        }, {});
    }


    function getDuplicates(wordCounts) {
        const minOccurrences = parseInt(minOccurrencesInput.value, 10) || 2; // Use the minOccurrences value
        return Object.keys(wordCounts).filter(word => wordCounts[word] >= minOccurrences);
    }

    function highlightText(normalizedText, duplicates) {
        if (!prefixTrackingInput.checked) {
            // Highlight only full words
            const originalText = normalizedText;
            let highlightedText = originalText.replace(/\b\w+\b/g, match => {
                const normalizedMatch = normalizeText(match);
                if (duplicates.includes(normalizedMatch) && (checkboxStates[normalizedMatch] !== false)) {
                    return `<span class="highlight">${match}</span>`;
                }
                return match;
            });
            textDisplay.innerHTML = highlightedText;
        } else {

            let highlightedText = normalizedText.split(/\b/).map(word => {
                if (!/\w+/.test(word)) {
                    return word; // Return non-word parts as is
                }

                let applicableDuplicates = duplicates.filter(dup =>
                    word.startsWith(dup) && checkboxStates[dup] !== false
                );
                // Sort the applicable duplicates by length in descending order
                applicableDuplicates.sort((a, b) => b.length - a.length);

                // Check if we have any applicable duplicates
                if (applicableDuplicates.length > 0) {
                    let longestDuplicate = applicableDuplicates[0]; // The first one is the longest due to sorting
                    return `<span class="highlight">${longestDuplicate}</span>${word.substring(longestDuplicate.length)}`;
                }

                return word; // No duplicated prefix found, return the word as is
            });

            textDisplay.innerHTML = highlightedText.join('');
        }
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

    window.updateCheckboxState = function(word) {
        const checkbox = document.getElementById(`checkbox-${word}`);
        checkboxStates[word] = checkbox.checked;
        highlightText(normalizeText(textInput.value), getDuplicates(getWordCounts(normalizeText(textInput.value))));
    };
});

