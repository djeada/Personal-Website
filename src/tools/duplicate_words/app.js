document.addEventListener('DOMContentLoaded', function() {
    const textInput = document.getElementById('textInput');
    const textDisplay = document.getElementById('textDisplay');
    const duplicateTable = document.getElementById('duplicateTable');
    const minLengthInput = document.getElementById('minLength');
    const minOccurrencesInput = document.getElementById('minOccurrences');
    const prefixTrackingInput = document.getElementById('matchPrefixes');
    const clearButton = document.getElementById('clearButton');
    const copyButton = document.getElementById('copyButton');
    const downloadButton = document.getElementById('downloadButton');
    const selectAllButton = document.getElementById('selectAllButton');
    const deselectAllButton = document.getElementById('deselectAllButton');
    const statsDisplay = document.getElementById('statsDisplay');

    let checkboxStates = {};
    let debounceTimer = null;
    let currentSort = { column: 'count', direction: 'desc' };

    textInput.addEventListener('input', debounceUpdate);
    minLengthInput.addEventListener('input', debounceUpdate);
    minOccurrencesInput.addEventListener('input', debounceUpdate);
    prefixTrackingInput.addEventListener('change', updateContent);
    
    clearButton.addEventListener('click', clearAll);
    copyButton.addEventListener('click', copyResults);
    downloadButton.addEventListener('click', downloadResults);
    selectAllButton.addEventListener('click', selectAllWords);
    deselectAllButton.addEventListener('click', deselectAllWords);

    window.onload = updateContent;

    function debounceUpdate() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateContent, 300);
    }

    function clearAll() {
        textInput.value = '';
        textDisplay.innerHTML = '';
        duplicateTable.innerHTML = '';
        statsDisplay.innerHTML = '';
        checkboxStates = {};
    }

    function copyResults() {
        const text = textInput.value;
        const normalizedText = normalizeText(text);
        const wordCounts = getWordCounts(normalizedText);
        const duplicates = getDuplicates(wordCounts);
        
        let result = 'Duplicate Words Analysis\n';
        result += '========================\n\n';
        
        const sortedDuplicates = duplicates.sort((a, b) => wordCounts[b] - wordCounts[a]);
        sortedDuplicates.forEach(word => {
            result += `${word}: ${wordCounts[word]}\n`;
        });
        
        navigator.clipboard.writeText(result).then(() => {
            showNotification('Results copied to clipboard!');
        }).catch(() => {
            showNotification('Failed to copy results', 'error');
        });
    }

    function downloadResults() {
        const text = textInput.value;
        const normalizedText = normalizeText(text);
        const wordCounts = getWordCounts(normalizedText);
        const duplicates = getDuplicates(wordCounts);
        
        const data = {
            timestamp: new Date().toISOString(),
            settings: {
                minLength: parseInt(minLengthInput.value, 10),
                minOccurrences: parseInt(minOccurrencesInput.value, 10),
                prefixTracking: prefixTrackingInput.checked
            },
            duplicates: duplicates.map(word => ({
                word: word,
                count: wordCounts[word]
            })).sort((a, b) => b.count - a.count)
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'duplicate-words-analysis.json';
        link.click();
        showNotification('Results downloaded!');
    }

    function selectAllWords() {
        const text = textInput.value;
        const normalizedText = normalizeText(text);
        const wordCounts = getWordCounts(normalizedText);
        const duplicates = getDuplicates(wordCounts);
        
        duplicates.forEach(word => {
            checkboxStates[word] = true;
        });
        updateContent();
    }

    function deselectAllWords() {
        const text = textInput.value;
        const normalizedText = normalizeText(text);
        const wordCounts = getWordCounts(normalizedText);
        const duplicates = getDuplicates(wordCounts);
        
        duplicates.forEach(word => {
            checkboxStates[word] = false;
        });
        updateContent();
    }

    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'error' ? '#f44336' : '#4CAF50'};
            color: white;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    function updateContent() {
        const text = textInput.value;
        const normalizedText = normalizeText(text);
        const wordCounts = getWordCounts(normalizedText);
        const duplicates = getDuplicates(wordCounts);

        updateStats(text, normalizedText, wordCounts, duplicates);
        updateDuplicateTable(wordCounts, duplicates);
        highlightText(normalizedText, duplicates);
    }

    function updateStats(originalText, normalizedText, wordCounts, duplicates) {
        const words = normalizedText.match(/\w+/g) || [];
        const totalWords = words.length;
        const uniqueWords = Object.keys(wordCounts).length;
        const duplicateWords = duplicates.length;
        const duplicatePercentage = totalWords > 0 ? ((duplicateWords / uniqueWords) * 100).toFixed(1) : 0;
        
        statsDisplay.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Total Words:</span>
                    <span class="stat-value">${totalWords}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Unique Words:</span>
                    <span class="stat-value">${uniqueWords}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Duplicate Words:</span>
                    <span class="stat-value">${duplicateWords}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Duplicate %:</span>
                    <span class="stat-value">${duplicatePercentage}%</span>
                </div>
            </div>
        `;
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
        let sortedDuplicates = [...duplicates];
        
        if (currentSort.column === 'word') {
            sortedDuplicates.sort((a, b) => {
                return currentSort.direction === 'asc' 
                    ? a.localeCompare(b) 
                    : b.localeCompare(a);
            });
        } else {
            sortedDuplicates.sort((a, b) => {
                return currentSort.direction === 'asc'
                    ? wordCounts[a] - wordCounts[b]
                    : wordCounts[b] - wordCounts[a];
            });
        }
        
        let html = '<table><thead><tr>';
        html += `<th class="sortable" data-column="word">Word ${getSortIcon('word')}</th>`;
        html += `<th class="sortable" data-column="count">Count ${getSortIcon('count')}</th>`;
        html += '<th>Toggle</th>';
        html += '</tr></thead><tbody>';
        
        sortedDuplicates.forEach(duplicate => {
            const isChecked = checkboxStates[duplicate] !== false;
            const escapedWord = escapeHtml(duplicate);
            html += `<tr>
                <td>${escapedWord}</td>
                <td>${wordCounts[duplicate]}</td>
                <td><input type="checkbox" class="word-checkbox" data-word="${escapedWord}" ${isChecked ? 'checked' : ''}></td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        duplicateTable.innerHTML = html;
        
        // Add event listeners for sorting
        duplicateTable.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', function() {
                const column = this.dataset.column;
                if (currentSort.column === column) {
                    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.column = column;
                    currentSort.direction = 'desc';
                }
                updateContent();
            });
        });
        
        // Add event listeners for checkboxes
        duplicateTable.querySelectorAll('.word-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const word = unescapeHtml(this.dataset.word);
                checkboxStates[word] = this.checked;
                const text = textInput.value;
                const normalizedText = normalizeText(text);
                const wordCounts = getWordCounts(normalizedText);
                const duplicates = getDuplicates(wordCounts);
                highlightText(normalizedText, duplicates);
            });
        });
    }

    function getSortIcon(column) {
        if (currentSort.column !== column) {
            return '⇅';
        }
        return currentSort.direction === 'asc' ? '↑' : '↓';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function unescapeHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent;
    }
});