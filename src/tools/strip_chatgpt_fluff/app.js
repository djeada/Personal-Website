document.addEventListener("DOMContentLoaded", function() {
    const editorText = document.getElementById("editor-text");
    const processButton = document.getElementById("process");
    const clearButton = document.getElementById("clear");
    const copyButton = document.getElementById("copy");
    const downloadButton = document.getElementById("download");
    const replaceButton = document.getElementById("replace");
    const undoButton = document.getElementById("undo");
    const redoButton = document.getElementById("redo");

    const removeAllStars = document.getElementById("remove-all-stars");
    const confirmStep = document.getElementById("confirm-step");
    const removeBetween = document.getElementById("remove-between");
    const lineCorrectionCheckbox = document.getElementById("line-correction");
    const listCorrectionCheckbox = document.getElementById("list-correction");
    const listCorrectionCheckbox = document.getElementById("roman-list-conversion");

    const searchText = document.getElementById("search-text");
    const replaceText = document.getElementById("replace-text");

    let history = [];
    let historyIndex = -1;
    let isUndoRedo = false;

    function saveState() {
        if (isUndoRedo) return;
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        history.push(editorText.value);
        historyIndex++;
    }

    function undo() {
        if (historyIndex > 0) {
            isUndoRedo = true;
            historyIndex--;
            editorText.value = history[historyIndex];
            isUndoRedo = false;
        }
    }

    function redo() {
        if (historyIndex < history.length - 1) {
            isUndoRedo = true;
            historyIndex++;
            editorText.value = history[historyIndex];
            isUndoRedo = false;
        }
    }

    saveState();

    editorText.addEventListener("input", () => {
        saveState();
    });

    removeAllStars.addEventListener("change", function() {
        if (removeAllStars.checked) {
            confirmStep.checked = false;
        }
    });

    confirmStep.addEventListener("change", function() {
        if (confirmStep.checked) {
            removeAllStars.checked = false;
        }
    });


    function correctLists() {
        if (!listCorrectionCheckbox.checked) return;

        saveState();

        let lines = editorText.value.split("\n");
        let newLines = [];
        let inList = false;

        lines.forEach((line) => {
            const isListItem = /^\s*[-*]\s|^\s*\d+\.\s/.test(line);

            if (isListItem) {
                if (!inList) {
                    inList = true;
                }
                newLines.push(line);
            } else {
                if (inList && line.trim() === "") {
                    // Skip empty lines between list items
                    return;
                } else {
                    inList = false;
                    newLines.push(line);
                }
            }
        });

        editorText.value = newLines.join("\n");
    }

    function replaceNumericalListsWithRoman() {
        if (!document.getElementById("roman-list-conversion").checked) return;

        saveState();

        let lines = editorText.value.split("\n");
        let newLines = [];
        let inList = false;
        let listIndex = 1;

        function toRoman(num) {
            const romanNumerals = [
                ["M", 1000],
                ["CM", 900],
                ["D", 500],
                ["CD", 400],
                ["C", 100],
                ["XC", 90],
                ["L", 50],
                ["XL", 40],
                ["X", 10],
                ["IX", 9],
                ["V", 5],
                ["IV", 4],
                ["I", 1]
            ];
            let result = "";
            romanNumerals.forEach(([roman, value]) => {
                while (num >= value) {
                    result += roman;
                    num -= value;
                }
            });
            return result;
        }

        lines.forEach((line) => {
            const numericalListItem = /^\s*(\d+)\.\s/.exec(line);

            if (numericalListItem) {
                const romanIndex = toRoman(parseInt(numericalListItem[1]));
                const romanListItem = line.replace(numericalListItem[0], `${romanIndex}. `);
                newLines.push(romanListItem);
            } else {
                newLines.push(line);
            }
        });

        editorText.value = newLines.join("\n");
    }

    function correctLines() {
        if (!lineCorrectionCheckbox.checked) return;

        saveState();

        let lines = editorText.value.split("\n");
        let newLines = [];
        let lastLineWasEmpty = false;

        lines.forEach((line, index) => {
            if (line.trim() === "") {
                if (!lastLineWasEmpty) {
                    newLines.push("");
                    lastLineWasEmpty = true;
                }
            } else {
                if (index > 0 && lines[index - 1].trim().endsWith(":")) {
                    newLines.push("");
                }

                if ((line.trim().startsWith("#") || line.trim().startsWith("```")) && index > 0 && lines[index - 1].trim() !== "") {
                    newLines.push("");
                }

                newLines.push(line);
                lastLineWasEmpty = false;
            }
        });

        if (newLines[newLines.length - 1].trim() !== "") {
            newLines.push("");
        }

        editorText.value = newLines.join("\n");
    }

    // Utility function to convert normal text to bold UTF-8 characters for popup
    function toBoldUTF8(text) {
        const boldOffset = {
            a: '𝗮',
            b: '𝗯',
            c: '𝗰',
            d: '𝗱',
            e: '𝗲',
            f: '𝗳',
            g: '𝗴',
            h: '𝗵',
            i: '𝗶',
            j: '𝗷',
            k: '𝗸',
            l: '𝗹',
            m: '𝗺',
            n: '𝗻',
            o: '𝗼',
            p: '𝗽',
            q: '𝗾',
            r: '𝗿',
            s: '𝘀',
            t: '𝘁',
            u: '𝘂',
            v: '𝘃',
            w: '𝘄',
            x: '𝘅',
            y: '𝘆',
            z: '𝘇',
            A: '𝗔',
            B: '𝗕',
            C: '𝗖',
            D: '𝗗',
            E: '𝗘',
            F: '𝗙',
            G: '𝗚',
            H: '𝗛',
            I: '𝗜',
            J: '𝗝',
            K: '𝗞',
            L: '𝗟',
            M: '𝗠',
            N: '𝗡',
            O: '𝗢',
            P: '𝗣',
            Q: '𝗤',
            R: '𝗥',
            S: '𝗦',
            T: '𝗧',
            U: '𝗨',
            V: '𝗩',
            W: '𝗪',
            X: '𝗫',
            Y: '𝗬',
            Z: '𝗭',
            0: '𝟬',
            1: '𝟭',
            2: '𝟮',
            3: '𝟯',
            4: '𝟰',
            5: '𝟱',
            6: '𝟲',
            7: '𝟳',
            8: '𝟴',
            9: '𝟵'
        };


        return text.split('').map(char => boldOffset[char] || char).join('');
    }

    function processText() {
        if (!confirmStep.checked && !removeAllStars.checked) {
            return;
        }

        saveState();

        let text = editorText.value;

        if (removeAllStars.checked) {
            if (removeBetween.checked) {
                // Remove everything after the second `**` up to and including the next whitespace
                text = text.replace(/\*\*[^*]*\*\*[^ ]*\s*/g, '');
            }
            // Remove all ** markers
            text = text.replace(/\*\*/g, '');
        } else if (confirmStep.checked) {
            let matches = [];
            let regex = /\*\*(.*?)\*\*/gs; // Match content between **
            let match;

            while ((match = regex.exec(text)) !== null) {
                matches.push({
                    match: match[0],
                    index: match.index,
                    content: match[1]
                });
            }

            let offset = 0;
            for (let i = 0; i < matches.length; i++) {
                let m = matches[i];

                // Find the entire line containing the match
                let lineStart = text.lastIndexOf('\n', m.index) + 1;
                let lineEnd = text.indexOf('\n', m.index);
                if (lineEnd === -1) lineEnd = text.length;
                let fullLine = text.slice(lineStart, lineEnd);

                // Convert the bold part to UTF-8 bold characters for display
                let displayLine = fullLine.replace(m.match, toBoldUTF8(m.content));

                // Show confirmation dialog with the full line using bold UTF-8 characters
                let userConfirmed = confirm(`Do you want to remove this text?\n"${displayLine}"`);
                if (userConfirmed) {
                    // Apply the confirmed removal immediately
                    text = text.slice(0, m.index - offset) + text.slice(m.index - offset + m.match.length);
                    offset += m.match.length;
                } else {
                    // Stop further popups, but apply the changes confirmed so far
                    break;
                }
            }
        } else if (removeBetween.checked) {
            // Remove everything after the second ** up to and including the next whitespace
            text = text.replace(/\*\*[^*]*\*\*[^ ]*\s*/g, '');
        }

        // Update the editor text with the processed version, including confirmed removals
        editorText.value = text;
    }


    function replaceTextFunction() {
        const searchValue = searchText.value;
        const replaceValue = replaceText.value;

        if (searchValue === "") {
            alert("Please enter text to search for.");
            return;
        }

        saveState();

        const regex = new RegExp(searchValue, "g");
        editorText.value = editorText.value.replace(regex, replaceValue);
    }

    processButton.addEventListener("click", () => {
        processText();
        replaceNumericalListsWithRoman();
        correctLists();
        correctLines();
    });
    replaceButton.addEventListener("click", replaceTextFunction);
    undoButton.addEventListener("click", undo);
    redoButton.addEventListener("click", redo);

    clearButton.addEventListener("click", () => {
        saveState();
        editorText.value = "";
    });

    copyButton.addEventListener("click", () => {
        navigator.clipboard
            .writeText(editorText.value)
            .then(() => {
                alert("Output copied to clipboard");
            })
            .catch(() => {
                alert("Failed to copy output");
            });
    });

    downloadButton.addEventListener("click", () => {
        const blob = new Blob([editorText.value], {
            type: "text/plain",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "processed_text.txt";
        link.click();
    });
});