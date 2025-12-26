document.addEventListener("DOMContentLoaded", function() {
    // DOM Elements
    const editorText = document.getElementById("editor-text");
    const processButton = document.getElementById("process");
    const clearButton = document.getElementById("clear");
    const copyButton = document.getElementById("copy");
    const downloadButton = document.getElementById("download");
    const replaceButton = document.getElementById("replace");
    const undoButton = document.getElementById("undo");
    const redoButton = document.getElementById("redo");
    const pasteBtn = document.getElementById("paste-btn");
    const uploadBtn = document.getElementById("upload-btn");
    const fileInput = document.getElementById("file-input");
    const dropZone = document.getElementById("drop-zone");
    const resetDefaults = document.getElementById("reset-defaults");
    const toggleHistory = document.getElementById("toggle-history");
    const historyContent = document.getElementById("history-content");
    const toastContainer = document.getElementById("toast-container");

    // Option checkboxes
    const removeAllStars = document.getElementById("remove-all-stars");
    const confirmStep = document.getElementById("confirm-step");
    const removeBetween = document.getElementById("remove-between");
    const lineCorrectionCheckbox = document.getElementById("line-correction");
    const listCorrectionCheckbox = document.getElementById("list-correction");
    const romanListCheckbox = document.getElementById("roman-list-conversion");
    const tabCorrectionCheckbox = document.getElementById("tab-correction");
    const latexCorrectionCheckbox = document.getElementById("latex-correction");
    const simplifyTextCheckbox = document.getElementById("simplify-text");
    const trimListsCheckbox = document.getElementById("trim-lists-before-colon");

    const searchText = document.getElementById("search-text");
    const replaceTextInput = document.getElementById("replace-text");

    // Preset buttons
    const presetButtons = document.querySelectorAll(".preset-option");

    // Stats elements
    const charCount = document.getElementById("char-count");
    const wordCount = document.getElementById("word-count");
    const lineCount = document.getElementById("line-count");
    const readTime = document.getElementById("read-time");

    // History management
    let history = [];
    let historyIndex = -1;
    let isUndoRedo = false;
    const MAX_HISTORY = 50;

    // Toast notification system
    function showToast(message, type = "info") {
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        
        const icons = {
            success: "✅",
            error: "❌",
            info: "ℹ️",
            warning: "⚠️"
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // Update stats
    function updateStats() {
        const text = editorText.value;
        const chars = text.length;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const lines = text ? text.split("\n").length : 0;
        const avgWordsPerMin = 200;
        const minutes = words > 0 ? Math.ceil(words / avgWordsPerMin) : 0;

        charCount.textContent = chars.toLocaleString();
        wordCount.textContent = words.toLocaleString();
        lineCount.textContent = lines.toLocaleString();
        readTime.textContent = `${minutes} min`;
    }

    // Save state to history
    function saveState() {
        if (isUndoRedo) return;
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        
        const state = {
            text: editorText.value,
            timestamp: new Date()
        };
        
        history.push(state);
        if (history.length > MAX_HISTORY) {
            history.shift();
            historyIndex--; // Adjust index when oldest entry is removed
        }
        historyIndex++;
        
        updateHistoryPanel();
        updateStats();
    }

    // Update history panel
    function updateHistoryPanel() {
        if (history.length <= 1) {
            historyContent.innerHTML = '<div class="history-empty"><p>No history yet. Make some changes!</p></div>';
            return;
        }

        const items = history.slice().reverse().map((state, idx) => {
            const realIdx = history.length - 1 - idx;
            const time = state.timestamp.toLocaleTimeString();
            const preview = state.text.substring(0, 50).replace(/\n/g, " ") || "(empty)";
            const isActive = realIdx === historyIndex ? "active" : "";
            
            return `
                <div class="history-item ${isActive}" data-index="${realIdx}">
                    <span class="history-time">${time}</span>
                    <span class="history-preview">${preview}...</span>
                </div>
            `;
        }).join("");

        historyContent.innerHTML = items;

        // Add click handlers
        historyContent.querySelectorAll(".history-item").forEach(item => {
            item.addEventListener("click", () => {
                const idx = parseInt(item.dataset.index);
                restoreHistoryState(idx);
            });
        });
    }

    // Restore history state
    function restoreHistoryState(idx) {
        if (idx >= 0 && idx < history.length) {
            isUndoRedo = true;
            historyIndex = idx;
            editorText.value = history[idx].text;
            updateHistoryPanel();
            updateStats();
            isUndoRedo = false;
            showToast("State restored", "success");
        }
    }

    function undo() {
        if (historyIndex > 0) {
            isUndoRedo = true;
            historyIndex--;
            editorText.value = history[historyIndex].text;
            updateHistoryPanel();
            updateStats();
            isUndoRedo = false;
            showToast("Undo", "info");
        }
    }

    function redo() {
        if (historyIndex < history.length - 1) {
            isUndoRedo = true;
            historyIndex++;
            editorText.value = history[historyIndex].text;
            updateHistoryPanel();
            updateStats();
            isUndoRedo = false;
            showToast("Redo", "info");
        }
    }

    // Initialize history
    saveState();

    // Input event listeners
    editorText.addEventListener("input", () => {
        saveState();
    });

    // Checkbox interactions
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

    // Preset configurations
    const presets = {
        minimal: {
            removeAllStars: true,
            confirmStep: false,
            removeBetween: false,
            lineCorrection: false,
            listCorrection: false,
            romanListConversion: false,
            tabCorrection: false,
            latexCorrection: false,
            simplifyText: false,
            trimListsBeforeColon: false
        },
        standard: {
            removeAllStars: true,
            confirmStep: false,
            removeBetween: false,
            lineCorrection: true,
            listCorrection: true,
            romanListConversion: true,
            tabCorrection: false,
            latexCorrection: true,
            simplifyText: true,
            trimListsBeforeColon: true
        },
        aggressive: {
            removeAllStars: true,
            confirmStep: false,
            removeBetween: false,
            lineCorrection: true,
            listCorrection: true,
            romanListConversion: true,
            tabCorrection: true,
            latexCorrection: true,
            simplifyText: true,
            trimListsBeforeColon: true
        }
    };

    function applyPreset(presetName) {
        const preset = presets[presetName];
        if (!preset) return;

        removeAllStars.checked = preset.removeAllStars;
        confirmStep.checked = preset.confirmStep;
        removeBetween.checked = preset.removeBetween;
        lineCorrectionCheckbox.checked = preset.lineCorrection;
        listCorrectionCheckbox.checked = preset.listCorrection;
        romanListCheckbox.checked = preset.romanListConversion;
        tabCorrectionCheckbox.checked = preset.tabCorrection;
        latexCorrectionCheckbox.checked = preset.latexCorrection;
        simplifyTextCheckbox.checked = preset.simplifyText;
        trimListsCheckbox.checked = preset.trimListsBeforeColon;

        // Update active state
        presetButtons.forEach(btn => {
            btn.classList.toggle("active", btn.dataset.preset === presetName);
        });

        showToast(`${presetName.charAt(0).toUpperCase() + presetName.slice(1)} preset applied`, "success");
    }

    // Preset button handlers
    presetButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            applyPreset(btn.dataset.preset);
        });
    });

    // Reset defaults
    resetDefaults.addEventListener("click", () => {
        applyPreset("standard");
    });

    // Card toggle functionality
    document.querySelectorAll(".card-toggle").forEach(toggle => {
        toggle.addEventListener("click", () => {
            const expanded = toggle.getAttribute("aria-expanded") === "true";
            toggle.setAttribute("aria-expanded", !expanded);
        });
    });

    // History panel toggle
    toggleHistory.addEventListener("click", () => {
        historyContent.classList.toggle("collapsed");
        toggleHistory.textContent = historyContent.classList.contains("collapsed") ? "▶" : "▼";
    });

    // File upload handling
    uploadBtn.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            readFile(file);
        }
    });

    function readFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            editorText.value = e.target.result;
            saveState();
            showToast(`File "${file.name}" loaded`, "success");
        };
        reader.onerror = () => {
            showToast("Error reading file", "error");
        };
        reader.readAsText(file);
    }

    // Paste button
    pasteBtn.addEventListener("click", async () => {
        try {
            const text = await navigator.clipboard.readText();
            editorText.value = text;
            saveState();
            showToast("Text pasted from clipboard", "success");
        } catch (err) {
            showToast("Unable to paste from clipboard", "error");
        }
    });

    // Drag and drop handling
    ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
        editorText.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ["dragenter", "dragover"].forEach(eventName => {
        editorText.addEventListener(eventName, () => {
            dropZone.classList.add("active");
        }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        document.body.addEventListener(eventName, () => {
            dropZone.classList.remove("active");
        }, false);
    });

    editorText.addEventListener("drop", (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            readFile(files[0]);
        }
        dropZone.classList.remove("active");
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
        // Ctrl+Enter to process
        if (e.ctrlKey && e.key === "Enter") {
            e.preventDefault();
            processButton.click();
        }
        // Ctrl+Z to undo (when not focused on textarea)
        if (e.ctrlKey && e.key === "z" && document.activeElement !== editorText) {
            e.preventDefault();
            undo();
        }
        // Ctrl+Y to redo
        if (e.ctrlKey && e.key === "y") {
            e.preventDefault();
            redo();
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
        if (!romanListCheckbox.checked) return;

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

    /*
    implements the three main formatting rules while never altering lines inside code blocks, math blocks, or table lines (“forbidden zones”). The passes proceed in this order:

        Pass 0: Remove lines containing only - - - ...
        Pass 1: Insert blank lines around recognized elements (headings, lists, code/math blocks, tables) but do no changes inside them.
        Pass 2: Collapse multiple consecutive blank lines outside forbidden zones (keep only one).
        Pass 3: Remove any blank lines that appear between consecutive list items (last step).
        */
    function correctLines() {
        // 0) Check if corrections are enabled
        if (!lineCorrectionCheckbox.checked) return;
        saveState();

        // 1) Split the editor text into lines
        let lines = editorText.value.split("\n");

        // ------------------------------------------------------------------------
        // Helper functions
        // ------------------------------------------------------------------------

        function isListItem(line) {
            // Matches, e.g., '- something' or '* something' (with optional indentation)
            return /^\s*[-*]\s+/.test(line);
        }

        function isRomanHeading(line) {
            // Matches uppercase Roman numerals followed by a dot and space
            // e.g. "I. Title", "XVII. Topic"
            return /^[IVXLCDM]+\.\s/.test(line.trim());
        }

        function isTableLine(line) {
            // Treat as a table line if it starts and ends with '|'
            // e.g. "| Col1 | Col2 |"
            let t = line.trim();
            return t.startsWith("|") && t.endsWith("|");
        }

        // ------------------------------------------------------------------------
        // Pass 0: Remove lines that ONLY contain minus signs (like "----")
        // ------------------------------------------------------------------------
        let pass0 = [];
        for (let line of lines) {
            let t = line.trim();
            // Skip lines that ONLY have '-' characters
            if (/^-+$/.test(t)) {
                continue;
            }
            pass0.push(line);
        }

        // ------------------------------------------------------------------------
        // Pass 1: Insert blank lines above/below certain elements
        //         (but do NOT modify lines inside code/math/table blocks)
        // ------------------------------------------------------------------------
        let pass1 = [];
        let inBlock = false; // for code/math
        let blockMarker = null; // will store "```" or "$$"

        function pushBlankLineIfNeeded(arr) {
            // Insert a blank line if the last line isn't already blank
            if (arr.length && arr[arr.length - 1].trim() !== "") {
                arr.push("");
            }
        }

        for (let i = 0; i < pass0.length; i++) {
            let line = pass0[i];
            let t = line.trim();

            // Check if this line is the start/end of code or math block
            // (forbidden zone)
            if (!inBlock) {
                if (t === "```" || t === "$$") {
                    // Insert blank line before block
                    pushBlankLineIfNeeded(pass1);
                    pass1.push(line);
                    inBlock = true;
                    blockMarker = t;
                    continue;
                }
            } else {
                // We are inside a code/math block
                pass1.push(line);
                // Check if it's the closing marker
                if (t === blockMarker) {
                    inBlock = false;
                    blockMarker = null;
                    // Insert blank line after block
                    pushBlankLineIfNeeded(pass1);
                }
                continue;
            }

            // If we get here, we're NOT in a code/math block
            // but we also need to treat table lines as forbidden.
            if (isTableLine(line)) {
                // Insert blank line before the table block
                pushBlankLineIfNeeded(pass1);
                pass1.push(line);

                // Collect any subsequent table lines as one block
                while (i + 1 < pass0.length) {
                    let nextT = pass0[i + 1].trim();
                    if (nextT.startsWith("|") && nextT.endsWith("|")) {
                        i++;
                        pass1.push(pass0[i]);
                    } else {
                        break;
                    }
                }

                // Insert blank line after table block
                pushBlankLineIfNeeded(pass1);
            } else if (/^#+\s/.test(t) || isRomanHeading(line)) {
                // Heading => insert blank line above and below
                pushBlankLineIfNeeded(pass1);
                pass1.push(line);
                pass1.push("");
            } else if (isListItem(line)) {
                // List item => insert blank line above
                pushBlankLineIfNeeded(pass1);
                pass1.push(line);
            } else {
                // Normal line => just push
                pass1.push(line);
            }
        }

        // ------------------------------------------------------------------------
        // Pass 2: Collapse multiple consecutive blank lines
        //         (but skip inside code/math/table blocks)
        // ------------------------------------------------------------------------
        let pass2 = [];
        inBlock = false;
        blockMarker = null;
        let lastWasBlank = false;

        for (let i = 0; i < pass1.length; i++) {
            let line = pass1[i];
            let t = line.trim();
            let tableCheck = isTableLine(line);

            if (!inBlock && !tableCheck) {
                // Check code/math block start
                if (t === "```" || t === "$$") {
                    pass2.push(line);
                    inBlock = true;
                    blockMarker = t;
                    lastWasBlank = false;
                } else if (t === "") {
                    // If it's a blank line, only push it if we haven't just pushed one
                    if (!lastWasBlank) {
                        pass2.push("");
                        lastWasBlank = true;
                    }
                } else {
                    // Normal line => push it
                    pass2.push(line);
                    lastWasBlank = false;
                }
            } else {
                // Either inside code/math block OR it's a table line => pass through
                pass2.push(line);

                // If inside code/math, check for the end marker
                if (!tableCheck && t === blockMarker) {
                    inBlock = false;
                    blockMarker = null;
                }
                lastWasBlank = false;
            }
        }

        // ------------------------------------------------------------------------
        // Pass 3: Remove any blank lines that appear between consecutive list items
        //         (outside forbidden zones)
        // ------------------------------------------------------------------------
        let pass3 = [];
        inBlock = false;
        blockMarker = null;

        for (let i = 0; i < pass2.length; i++) {
            let line = pass2[i];
            let t = line.trim();
            let tableCheck = isTableLine(line);

            if (!inBlock && !tableCheck) {
                // Check if it's start/end of code/math
                if (t === "```" || t === "$$") {
                    pass3.push(line);
                    inBlock = true;
                    blockMarker = t;
                }
                // If it's a blank line, see if the previous line and the next line are list items
                else if (t === "" && i + 1 < pass2.length) {
                    let nextLine = pass2[i + 1];
                    if (
                        pass3.length > 0 &&
                        isListItem(pass3[pass3.length - 1]) &&
                        isListItem(nextLine)
                    ) {
                        // Skip pushing this blank line
                        continue;
                    }
                    pass3.push(line);
                } else {
                    pass3.push(line);
                }
            } else {
                // Inside code/math block or table => pass through unmodified
                pass3.push(line);
                if (!tableCheck && t === blockMarker) {
                    inBlock = false;
                    blockMarker = null;
                }
            }
        }

        // Optionally ensure a trailing blank line at the end
        if (pass3.length && pass3[pass3.length - 1].trim() !== "") {
            pass3.push("");
        }

        // 5) Rejoin everything
        editorText.value = pass3.join("\n");
    }



    function removeTabIndent() {
        // Check if tab correction is enabled
        if (!tabCorrectionCheckbox.checked) return;

        saveState();

        let lines = editorText.value.split("\n");
        let newLines = [];

        lines.forEach(line => {
            // Regex to match tabs or up to 4 leading spaces
            const match = line.match(/^(\t| {1,4})/);

            if (match) {
                newLines.push(line.substring(match[0].length)); // Remove the matched tab or spaces
            } else {
                newLines.push(line); // If no tab or leading spaces, keep the line as it is
            }
        });


        editorText.value = newLines.join("\n");
    }

    // TODO:
    // - add remove ,\
    function correctLatex() {
        if (!latexCorrectionCheckbox.checked) return;
        saveState();

        const text = editorText.value;
        let result = '';
        let i = 0;

        // -------------------------------------------------------------
        // 1) Helper: checks if a given `index` is "escaped" by backslash
        // -------------------------------------------------------------
        function isEscaped(str, index) {
            let backslashCount = 0;
            let pos = index - 1;
            // Count consecutive backslashes going backward
            while (pos >= 0 && str[pos] === '\\') {
                backslashCount++;
                pos--;
            }
            // If we have an odd number of backslashes, it's escaped
            return (backslashCount % 2) === 1;
        }

        // -------------------------------------------------------------
        // 2) Helper: apply small corrections to math content itself
        // -------------------------------------------------------------
        function applyCorrections(content) {

            content = content.trim();
            content = content.replace(/\\;/g, '');
            content = content.replace(/\\,/g, ',');
            content = content.replace(/\\\./g, '.');
            content = content.replace(/\\d/g, 'd');
            content = content.replace(/([.,;:!?])(\s*)(\${1,2})(?!\$)/g, '$2$3');
            content = content.replace(/([,\.])d/g, 'd');
            content = content.replace(/([.,;:!?])\s*$/, '');

            return content;
        }


        // -------------------------------------------------------------
        // 3) Helper: scans text from `startIndex` until unescaped `endTag`
        //    e.g., for \[...\], endTag = '\]'; for $...$, endTag = '$'
        // -------------------------------------------------------------
        function getMathContent(str, startIndex, endTag) {
            let pos = startIndex;
            while (pos < str.length) {
                if (
                    str.substr(pos, endTag.length) === endTag &&
                    !isEscaped(str, pos)
                ) {
                    return {
                        content: str.substring(startIndex, pos),
                        endIndex: pos + endTag.length
                    };
                }
                pos++;
            }
            return null; // no matching endTag found
        }

        // -------------------------------------------------------------
        // 4) Main parse loop
        // -------------------------------------------------------------
        while (i < text.length) {
            // --- (A) Convert \[...\] to $$...$$ or \(...\) to $...$ ---
            if (
                text[i] === '\\' &&
                (text[i + 1] === '[' || text[i + 1] === '(') &&
                !isEscaped(text, i)
            ) {
                const twoChar = text.substr(i, 2); // "\[" or "\("
                let endTag, replacement;

                if (twoChar === '\\[') {
                    endTag = '\\]'; // we look for "\]"
                    replacement = '$$';
                } else {
                    endTag = '\\)'; // we look for "\)"
                    replacement = '$';
                }

                // Skip the 2-character delimiter
                const startSearch = i + 2;
                const found = getMathContent(text, startSearch, endTag);

                if (found) {
                    // content inside the brackets
                    const rawMath = found.content;
                    const corrected = applyCorrections(rawMath);
                    // Add the replacement delimiters: $$...$$ or $...$
                    result += replacement + corrected + replacement;
                    i = found.endIndex;
                    continue;
                } else {
                    // No matching "\]" or "\)", just copy this character
                    result += text[i];
                    i++;
                }
            }

            // --- (B) Check for "$" or "$$" math blocks ---
            else if (text[i] === '$' && !isEscaped(text, i)) {
                // Determine if it's a single-dollar or double-dollar block
                let delimiter = '$';
                if (text[i + 1] === '$') {
                    delimiter = '$$';
                }

                const startSearch = i + delimiter.length;
                const found = getMathContent(text, startSearch, delimiter);
                if (found) {
                    const rawMath = found.content;
                    const corrected = applyCorrections(rawMath);
                    result += delimiter + corrected + delimiter;
                    i = found.endIndex;
                    continue;
                } else {
                    // No closing match
                    result += text[i];
                    i++;
                }
            }

            // --- (C) Otherwise, copy normal text ---
            else {
                result += text[i];
                i++;
            }
        }

        // Finally, set the transformed result back into your editor
        editorText.value = result;
    }


    function trimListItemsBeforeColon() {
        // Check if trimming is enabled
        if (!trimListsCheckbox.checked) return;

        saveState();

        let lines = editorText.value.split("\n");
        let newLines = [];

        lines.forEach(line => {
            let trimmedLine = line.trim();

            // Check if the line starts with a numeral, hyphen, or star and contains a colon
            let listStartRegex = /^(\d+\.|\*|-)/; // Regex for numbers followed by a dot, star, or hyphen

            if (listStartRegex.test(trimmedLine) && trimmedLine.includes(":")) {
                // Find the position of the first colon
                let colonIndex = trimmedLine.indexOf(":");

                // Get only the part after the colon, while keeping the list symbol at the beginning
                let listSymbolMatch = trimmedLine.match(listStartRegex)[0]; // Extract the list symbol (e.g., '- ', '1. ', '* ')
                let newText = listSymbolMatch + " " + trimmedLine.slice(colonIndex + 1).trim();

                newLines.push(newText);
            } else {
                // If no colon or does not match list pattern, leave it unchanged
                newLines.push(line);
            }
        });

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

    function simplifyText() {
        // Check if Text Simplification is enabled
        if (!simplifyTextCheckbox.checked) return;

        saveState(); // Save current editor state

        let text = editorText.value;
        let result = '';
        let i = 0;

        // Helper function to check if the character at position index is escaped
        function isEscaped(text, index) {
            let backslashCount = 0;
            index--;
            while (index >= 0 && text[index] === '\\') {
                backslashCount++;
                index--;
            }
            return backslashCount % 2 === 1;
        }

        // Internal function to apply word replacements in text blocks
        function applySimplifications(content) {
            // Define the mapping of complex words to simpler alternatives
            const replacements = {
                "work": "function",
                "works": "functions",
                "worked": "functioned",
                "working": "functioning",
                "employ": "use",
                "employs": "uses",
                "employed": "used",
                "employing": "using",
                "ensure": "make sure",
                "ensures": "makes sure",
                "ensured": "made sure",
                "ensuring": "making sure",
                "facilitate": "help",
                "facilitates": "helps",
                "facilitated": "helped",
                "facilitating": "helping",
                "hinder": "block",
                "hinders": "blocks",
                "hindered": "blocked",
                "hindering": "blocking",
                "implement": "carry out",
                "implements": "carries out",
                "implemented": "carried out",
                "implementing": "carrying out",
                "navigate": "find your way through",
                "navigates": "finds your way through",
                "navigated": "found your way through",
                "navigating": "finding your way through",
                "signify": "indicate",
                "signifies": "indicates",
                "signified": "indicated",
                "signifying": "indicating",
                "establish": "set up",
                "establishes": "sets up",
                "established": "set up",
                "establishing": "setting up",
                "ascertain": "find out",
                "ascertains": "finds out",
                "ascertained": "found out",
                "ascertaining": "finding out",
                "disseminate": "spread",
                "disseminates": "spreads",
                "disseminated": "spread",
                "disseminating": "spreading",
                "endeavor": "try",
                "endeavors": "tries",
                "endeavored": "tried",
                "endeavoring": "trying",
                "exacerbate": "worsen",
                "exacerbates": "worsens",
                "exacerbated": "worsened",
                "exacerbating": "worsening",
                "leverage": "use",
                "leverages": "uses",
                "leveraged": "used",
                "leveraging": "using",
                "reiterate": "repeat",
                "reiterates": "repeats",
                "reiterated": "repeated",
                "reiterating": "repeating",
                "substantiate": "prove",
                "substantiates": "proves",
                "substantiated": "proved",
                "substantiating": "proving",
                "vacillate": "waver",
                "vacillates": "wavers",
                "vacillated": "wavered",
                "vacillating": "wavering",
                "wane": "decrease",
                "wanes": "decreases",
                "waned": "decreased",
                "waning": "decreasing",
                "yoke": "join",
                "yokes": "joins",
                "yoked": "joined",
                "yoking": "joining",
                "yearn": "long for",
                "yearns": "longs for",
                "yearned": "longed for",
                "yearning": "longing for",
                "bifurcate": "split",
                "bifurcates": "splits",
                "bifurcated": "split",
                "bifurcating": "splitting",
                "cajole": "persuade",
                "cajoles": "persuades",
                "cajoled": "persuaded",
                "cajoling": "persuading",
                "censure": "criticize",
                "censures": "criticizes",
                "censured": "criticized",
                "censuring": "criticizing",
                "elucidate": "explain",
                "elucidates": "explains",
                "elucidated": "explained",
                "elucidating": "explaining",
                "garner": "gather",
                "garners": "gathers",
                "garnered": "gathered",
                "garnering": "gathering",
                "juxtapose": "place side by side",
                "juxtaposes": "places side by side",
                "juxtaposed": "placed side by side",
                "juxtaposing": "placing side by side",
                "obfuscate": "confuse",
                "obfuscates": "confuses",
                "obfuscated": "confused",
                "obfuscating": "confusing",
                "ostracize": "exclude",
                "ostracizes": "excludes",
                "ostracized": "excluded",
                "ostracizing": "excluding",
                "palliate": "lessen",
                "palliates": "lessens",
                "palliated": "lessened",
                "palliating": "lessening",
                "placate": "calm",
                "placates": "calms",
                "placated": "calmed",
                "placating": "calming",
                "quell": "suppress",
                "quells": "suppresses",
                "quelled": "suppressed",
                "quelling": "suppressing",
                "rescind": "cancel",
                "rescinds": "cancels",
                "rescinded": "canceled",
                "rescinding": "canceling",
                "crucial": "important",
                "critical": "important",
                "fundamental": "important",
                "employ": "use",
                "ensure": "make sure",
                "essential": "necessary",
                "pivotal": "important",
                "signifies": "indicates",
                "established": "set up",
                "navigate": "find your way through",
                "paramount": "important",
                "ultimately": "finally",
                "esteemed": "respected",
                "myriad": "many",
                "tapestry": "fabric",
                "meticulous": "careful",
                "intricate": "complex",
                "facilitating": "helping",
                "commendable": "praiseworthy",
                "robust": "strong",
                "seamless": "smooth",
                "multi-faceted": "many-sided",
                "complex": "complicated",
                "ample": "enough",
                "ascertain": "find out",
                "benevolent": "kind",
                "cognizant": "aware",
                "disseminate": "spread",
                "endeavor": "effort",
                "exacerbate": "worsen",
                "facilitate": "help",
                "gregarious": "sociable",
                "hinder": "block",
                "implement": "carry out",
                "juxtapose": "place side by side",
                "magnanimous": "generous",
                "negligible": "insignificant",
                "obfuscate": "confuse",
                "perfunctory": "done without care",
                "quintessential": "perfect example",
                "reiterate": "repeat",
                "substantiate": "prove",
                "transient": "temporary",
                "ubiquitous": "everywhere",
                "vacillate": "waver",
                "wane": "decrease",
                "xenophobia": "fear of foreigners",
                "yoke": "join",
                "zealous": "enthusiastic",
                "ameliorate": "improve",
                "belligerent": "hostile",
                "capricious": "unpredictable",
                "deleterious": "harmful",
                "efficacious": "effective",
                "fortuitous": "accidental",
                "gratuitous": "unnecessary",
                "hapless": "unfortunate",
                "idiosyncratic": "unique",
                "jargon": "specialized language",
                "knack": "skill",
                "laconic": "brief",
                "mellifluous": "pleasant sounding",
                "nonchalant": "casual",
                "ostracize": "exclude",
                "pragmatic": "practical",
                "quandary": "dilemma",
                "rampant": "widespread",
                "sagacious": "wise",
                "taciturn": "quiet",
                "untenable": "unsustainable",
                "venerable": "respected",
                "whimsical": "playful",
                "xenial": "hospitable",
                "yonder": "over there",
                "zephyr": "breeze",
                "aesthetic": "beautiful",
                "bucolic": "rustic",
                "cajole": "persuade",
                "daunting": "intimidating",
                "ephemeral": "short-lived",
                "flamboyant": "showy",
                "gregarious": "sociable",
                "heinous": "horrible",
                "immutable": "unchanging",
                "jubilant": "joyful",
                "kinetic": "relating to motion",
                "lucid": "clear",
                "mundane": "ordinary",
                "noxious": "harmful",
                "ostentatious": "showy",
                "placate": "calm",
                "quell": "suppress",
                "resilient": "strong",
                "stoic": "unemotional",
                "tangible": "real",
                "umbrage": "offense",
                "vapid": "dull",
                "wane": "decrease",
                "xylem": "plant tissue",
                "yielding": "flexible",
                "zenith": "peak",
                "alacrity": "eagerness",
                "blatant": "obvious",
                "candid": "honest",
                "deference": "respect",
                "elucidate": "explain",
                "fallacious": "incorrect",
                "garish": "bright and showy",
                "harbinger": "forerunner",
                "iconoclast": "rebel",
                "juxtaposition": "comparison",
                "kudos": "praise",
                "languid": "slow",
                "munificent": "generous",
                "nonplussed": "confused",
                "obdurate": "stubborn",
                "palpable": "clear",
                "querulous": "complaining",
                "reticent": "quiet",
                "sanguine": "optimistic",
                "tirade": "rant",
                "ubiquity": "everywhere",
                "vociferous": "loud",
                "winsome": "charming",
                "yawning": "wide",
                "zealot": "enthusiast",
                "aberration": "deviation",
                "bombastic": "overblown",
                "camaraderie": "friendship",
                "deleterious": "harmful",
                "enigma": "mystery",
                "fallacy": "mistake",
                "garrulous": "talkative",
                "hubris": "arrogance",
                "insidious": "sneaky",
                "jocular": "funny",
                "lachrymose": "tearful",
                "malaise": "unease",
                "nefarious": "wicked",
                "obsequious": "overly obedient",
                "paradigm": "model",
                "quixotic": "unrealistic",
                "recalcitrant": "stubborn",
                "soporific": "sleep-inducing",
                "tantamount": "equivalent",
                "unilateral": "one-sided",
                "voracious": "hungry",
                "winsome": "charming",
                "xenial": "hospitable",
                "yearn": "long for",
                "zeal": "enthusiasm",
                "ameliorate": "improve",
                "bifurcate": "split",
                "cogent": "persuasive",
                "dichotomy": "division",
                "ebb": "decline",
                "facade": "front",
                "garner": "gather",
                "hinder": "block",
                "immutable": "unchanging",
                "juxtapose": "place side by side",
                "knell": "bell sound indicating death",
                "lucid": "clear",
                "maudlin": "sentimental",
                "nonchalant": "casual",
                "opulent": "rich",
                "palliate": "lessen",
                "quagmire": "difficult situation",
                "rapacious": "greedy",
                "sagacity": "wisdom",
                "tacit": "unspoken",
                "umbrage": "offense",
                "vicarious": "experienced through others",
                "wane": "decrease",
                "xenophobia": "fear of foreigners",
                "yearn": "long for",
                "zealous": "enthusiastic",
                "ambivalent": "uncertain",
                "bellicose": "aggressive",
                "censure": "criticize",
                "deleterious": "harmful",
                "elaborate": "detailed",
                "fortitude": "courage",
                "gratuitous": "unnecessary",
                "hubris": "arrogance",
                "impervious": "unaffected",
                "jovial": "cheerful",
                "lucid": "clear",
                "misanthrope": "people-hater",
                "nonpareil": "unmatched",
                "oblique": "indirect",
                "precocious": "advanced",
                "quandary": "dilemma",
                "rescind": "cancel",
                "stoic": "unemotional",
                "truculent": "aggressive",
                "vacillate": "waver",
                "wanton": "uncontrolled",
                "xenial": "hospitable",
                "yoke": "join",
                "zenith": "peak",
                "apathy": "indifference",
                "blandishment": "flattery",
                "circumspect": "cautious",
                "demure": "reserved",
                "ephemeral": "short-lived",
                "fallacious": "incorrect",
                "grandiose": "impressive",
                "hapless": "unfortunate",
                "impecunious": "poor",
                "jingoism": "extreme nationalism",
                "knavery": "dishonesty",
                "loquacious": "talkative",
                "munificent": "generous",
                "negligent": "careless",
                "obfuscate": "confuse",
                "palpable": "clear",
                "quiescent": "inactive",
                "ravenous": "hungry",
                "sagacious": "wise",
                "tirade": "rant",
                "umbrageous": "offensive",
                "vapid": "dull",
                "winsome": "charming",
                "xenophobia": "fear of foreigners",
                "yawning": "wide",
                "zephyr": "breeze",
                "ambiguous": "unclear",
                "bombastic": "overblown",
                "candid": "honest",
                "deleterious": "harmful",
                "enigmatic": "mysterious",
                "fallacious": "incorrect",
                "gregarious": "sociable",
                "haughty": "arrogant",
                "immutable": "unchanging",
                "juxtaposition": "comparison",
                "kinetic": "relating to motion",
                "lucid": "clear",
                "malevolent": "evil",
                "nefarious": "wicked",
                "obstinate": "stubborn",
                "placate": "calm",
                "quandary": "dilemma",
                "resilient": "strong",
                "stoic": "unemotional",
                "tangible": "real",
                "umbrage": "offense",
                "venerable": "respected",
                "winsome": "charming",
                "yonder": "over there",
                "zealous": "enthusiastic"
            };


            // Create a regex pattern to match all keys in the replacements map
            // The 'i' flag makes it case-insensitive
            const pattern = new RegExp(`\\b(${Object.keys(replacements).join('|')})\\b`, 'gi');

            // Replace matched words using the replacements map
            content = content.replace(pattern, function(match) {
                // Preserve the original case (capitalize if necessary)
                const lowerMatch = match.toLowerCase();
                let replacement = replacements[lowerMatch];

                if (!replacement) return match; // If no replacement found, return the original word

                // Handle case preservation
                if (match[0] === match[0].toUpperCase()) {
                    // Capitalize the first letter of the replacement
                    replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
                }

                return replacement;
            });

            return content;
        }

        while (i < text.length) {
            // Check for unescaped \[ or \(
            if (text[i] === '\\' && (text[i + 1] === '[' || text[i + 1] === '(') && !isEscaped(text, i)) {
                const startDelimiter = text.substr(i, 2); // '\[' or '\('
                const endDelimiter = startDelimiter === '\\[' ? '\\]' : '\\)';
                const replacementDelimiter = startDelimiter === '\\[' ? '$$' : '$';
                let j = i + 2; // Position after the opening delimiter

                // Skip optional whitespace/newlines after opening delimiter
                if (startDelimiter === '\\[') {
                    while (j < text.length && /\s/.test(text[j])) {
                        j++;
                    }
                } else if (startDelimiter === '\\(') {
                    while (j < text.length && text[j] === ' ') {
                        j++;
                    }
                }

                let contentStart = j; // Start position of the content

                // Search for the closing delimiter
                let contentEnd = null;
                let k; // Declare k here
                while (j < text.length) {
                    k = j; // Assign to k inside the loop

                    // Before checking for endDelimiter, skip optional whitespace/newlines before it
                    if (endDelimiter === '\\]') {
                        while (k < text.length && /\s/.test(text[k])) {
                            k++;
                        }
                    } else if (endDelimiter === '\\)') {
                        while (k < text.length && text[k] === ' ') {
                            k++;
                        }
                    }

                    // Check for unescaped closing delimiter at position k
                    if (text.substr(k, endDelimiter.length) === endDelimiter && !isEscaped(text, k)) {
                        contentEnd = j; // End position of the content (before skipped whitespace)
                        break;
                    } else {
                        j++;
                    }
                }

                if (contentEnd !== null) {
                    // Found matching closing delimiter
                    let content = text.substring(contentStart, contentEnd);

                    // Do NOT apply simplifications within math blocks
                    result += replacementDelimiter + content + replacementDelimiter;
                    // Move i to after the closing delimiter and any skipped whitespace
                    i = k + endDelimiter.length;
                } else {
                    // No matching closing delimiter, copy the opening delimiter and move on
                    result += text[i];
                    i++;
                }
            } else if (text[i] === '$') {
                // Handle existing $...$ or $$...$$ blocks
                let delimiter = '$';
                if (text[i + 1] === '$') {
                    delimiter = '$$';
                }
                let startDelimiter = delimiter;
                let endDelimiter = delimiter;
                let j = i + delimiter.length;

                let contentStart = j;

                // Find the matching closing delimiter
                let contentEnd = text.indexOf(endDelimiter, j);
                while (contentEnd !== -1 && isEscaped(text, contentEnd)) {
                    // If the found delimiter is escaped, search for the next one
                    contentEnd = text.indexOf(endDelimiter, contentEnd + endDelimiter.length);
                }

                if (contentEnd !== -1) {
                    // Found matching closing delimiter
                    let content = text.substring(contentStart, contentEnd);

                    // Do NOT apply simplifications within math blocks
                    result += startDelimiter + content + endDelimiter;
                    i = contentEnd + endDelimiter.length;
                } else {
                    // No matching closing delimiter, copy the current character and move on
                    result += text[i];
                    i++;
                }
            } else {
                // Handle regular text outside math blocks
                // Find the next delimiter to minimize processing
                let nextDelimiterIndex = text.indexOf('\\[', i);
                let nextDelimiterIndex2 = text.indexOf('\\(', i);
                let nextDelimiterIndex3 = text.indexOf('$', i);
                let nextIndices = [nextDelimiterIndex, nextDelimiterIndex2, nextDelimiterIndex3].filter(index => index !== -1);
                let nextIndex = nextIndices.length > 0 ? Math.min(...nextIndices) : text.length;

                // Extract the text block to simplify
                let textBlock = text.substring(i, nextIndex);

                // Apply simplifications to the text block
                textBlock = applySimplifications(textBlock);

                result += textBlock;
                i = nextIndex;
            }
        }

        // Set the simplified text back to the editor
        editorText.value = result;
    }

    function replaceTextFunction() {
        const searchValue = searchText.value;
        const replaceValue = replaceTextInput.value;

        if (searchValue === "") {
            showToast("Please enter text to search for", "warning");
            return;
        }

        saveState();

        const regex = new RegExp(searchValue, "g");
        const originalLength = editorText.value.length;
        editorText.value = editorText.value.replace(regex, replaceValue);
        
        if (editorText.value.length !== originalLength) {
            showToast("Text replaced successfully", "success");
        } else {
            showToast("No matches found", "info");
        }
        updateStats();
    }

    processButton.addEventListener("click", () => {
        const originalText = editorText.value;
        
        processText();
        replaceNumericalListsWithRoman();
        trimListItemsBeforeColon();
        correctLists();
        removeTabIndent();
        correctLatex();
        correctLines();
        simplifyText();
        
        updateStats();
        
        if (editorText.value !== originalText) {
            showToast("Text processed successfully! ✨", "success");
        } else {
            showToast("No changes were made", "info");
        }
    });
    replaceButton.addEventListener("click", replaceTextFunction);
    undoButton.addEventListener("click", undo);
    redoButton.addEventListener("click", redo);

    clearButton.addEventListener("click", () => {
        if (editorText.value.trim()) {
            saveState();
            editorText.value = "";
            updateStats();
            showToast("Text cleared", "info");
        }
    });

    copyButton.addEventListener("click", () => {
        if (!editorText.value.trim()) {
            showToast("Nothing to copy", "warning");
            return;
        }
        
        navigator.clipboard
            .writeText(editorText.value)
            .then(() => {
                showToast("Copied to clipboard! 📋", "success");
            })
            .catch(() => {
                showToast("Failed to copy", "error");
            });
    });

    downloadButton.addEventListener("click", () => {
        if (!editorText.value.trim()) {
            showToast("Nothing to download", "warning");
            return;
        }
        
        const blob = new Blob([editorText.value], {
            type: "text/plain",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "processed_text.txt";
        link.click();
        showToast("File downloaded! 💾", "success");
    });
});