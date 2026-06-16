document.addEventListener("DOMContentLoaded", function() {

    const editorText = document.getElementById("editor-text");
    const outputText = document.getElementById("output-text");
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


    const presetButtons = document.querySelectorAll(".preset-option");


    const charCount = document.getElementById("char-count");
    const wordCount = document.getElementById("word-count");
    const lineCount = document.getElementById("line-count");
    const readTime = document.getElementById("read-time");


    let history = [];
    let historyIndex = -1;
    let isUndoRedo = false;
    const MAX_HISTORY = 50;
    let preProcessText = null;


    function showToast(message, type = "info") {
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;

        const icons = {
            success: "OK",
            error: "ERR",
            info: "INFO",
            warning: "WARN"
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


    function getResultText() {
        return outputText.value || editorText.value;
    }

    function updateStats() {
        const text = getResultText();
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



    let changeReport = {};

    function resetChangeReport() {
        changeReport = {};
    }

    function trackChange(category, count) {
        if (count <= 0) return;
        if (!changeReport[category]) changeReport[category] = 0;
        changeReport[category] += count;
    }

    function countMatches(text, pattern) {
        const matches = text.match(pattern);
        return matches ? matches.length : 0;
    }

    function escapeRegExp(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function preserveProtectedBlocks(text, transform) {
        const blockPattern = /(```[\s\S]*?```|\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|!?\[[^\]\n]*\]\([^) \n]+(?:\s+"[^"\n]*")?\)|https?:\/\/[^\s)]+)/g;
        const protectedBlocks = [];
        const placeholderPrefix = "@@PROTECTED_BLOCK_";
        const placeholderSuffix = "@@";
        const maskedText = text.replace(blockPattern, match => {
            const placeholder = `${placeholderPrefix}${protectedBlocks.length}${placeholderSuffix}`;
            protectedBlocks.push(match);
            return placeholder;
        });

        let result = transform(maskedText);
        protectedBlocks.forEach((block, index) => {
            result = result.split(`${placeholderPrefix}${index}${placeholderSuffix}`).join(block);
        });
        return result;
    }

    function showChangeReport() {
        const reportEl = document.getElementById("change-report");
        const contentEl = document.getElementById("report-content");

        const entries = Object.entries(changeReport);
        if (entries.length === 0) {
            reportEl.style.display = "none";
            return;
        }

        let html = '<ul class="report-list">';
        entries.forEach(([category, count]) => {
            html += `<li><span class="report-count">${count}</span> ${category}</li>`;
        });
        html += '</ul>';
        contentEl.innerHTML = html;
        reportEl.style.display = "block";
    }

    function computeSimpleDiff(original, modified) {
        const origLines = original.split('\n');
        const modLines = modified.split('\n');
        let html = '';
        const maxLen = Math.max(origLines.length, modLines.length);

        for (let i = 0; i < maxLen; i++) {
            const origLine = i < origLines.length ? origLines[i] : undefined;
            const modLine = i < modLines.length ? modLines[i] : undefined;

            if (origLine === modLine) {
                html += `<div class="diff-line diff-same"><span class="diff-prefix">&nbsp;</span><span class="diff-text">${escapeHtml(origLine)}</span></div>`;
            } else {
                if (origLine !== undefined) {
                    html += `<div class="diff-line diff-removed"><span class="diff-prefix">−</span><span class="diff-text">${escapeHtml(origLine)}</span></div>`;
                }
                if (modLine !== undefined) {
                    html += `<div class="diff-line diff-added"><span class="diff-prefix">+</span><span class="diff-text">${escapeHtml(modLine)}</span></div>`;
                }
            }
        }
        return html;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showDiffPreview(original, modified) {
        const diffEl = document.getElementById("diff-preview");
        const contentEl = document.getElementById("diff-content");
        contentEl.innerHTML = computeSimpleDiff(original, modified);
        diffEl.classList.add("collapsed");
        document.getElementById("close-diff").textContent = "Show";
        diffEl.style.display = "block";
    }


    function saveState() {
        if (isUndoRedo) return;
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }

        const state = {
            text: outputText.value,
            timestamp: new Date()
        };

        history.push(state);
        if (history.length > MAX_HISTORY) {
            history.shift();
            historyIndex--;
        }
        historyIndex++;

        updateHistoryPanel();
        updateStats();
    }


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


        historyContent.querySelectorAll(".history-item").forEach(item => {
            item.addEventListener("click", () => {
                const idx = parseInt(item.dataset.index);
                restoreHistoryState(idx);
            });
        });
    }


    function restoreHistoryState(idx) {
        if (idx >= 0 && idx < history.length) {
            isUndoRedo = true;
            historyIndex = idx;
            outputText.value = history[idx].text;
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
            outputText.value = history[historyIndex].text;
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
            outputText.value = history[historyIndex].text;
            updateHistoryPanel();
            updateStats();
            isUndoRedo = false;
            showToast("Redo", "info");
        }
    }


    saveState();


    editorText.addEventListener("input", () => {
        updateStats();
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


    const presets = {
        safe: {
            removeAllStars: true,
            confirmStep: false,
            removeBetween: false,
            lineCorrection: true,
            listCorrection: false,
            romanListConversion: false,
            tabCorrection: false,
            latexCorrection: true,
            simplifyText: false,
            trimListsBeforeColon: false
        },
        markdown: {
            removeAllStars: true,
            confirmStep: false,
            removeBetween: false,
            lineCorrection: true,
            listCorrection: true,
            romanListConversion: false,
            tabCorrection: false,
            latexCorrection: true,
            simplifyText: false,
            trimListsBeforeColon: false
        },
        polish: {
            removeAllStars: true,
            confirmStep: false,
            removeBetween: false,
            lineCorrection: true,
            listCorrection: true,
            romanListConversion: false,
            tabCorrection: false,
            latexCorrection: true,
            simplifyText: false,
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


        presetButtons.forEach(btn => {
            btn.classList.toggle("active", btn.dataset.preset === presetName);
        });

        showToast(`${presetName.charAt(0).toUpperCase() + presetName.slice(1)} preset applied`, "success");
    }


    presetButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            applyPreset(btn.dataset.preset);
        });
    });


    resetDefaults.addEventListener("click", () => {
        applyPreset("safe");
    });


    document.querySelectorAll(".card-toggle").forEach(toggle => {
        toggle.addEventListener("click", () => {
            const expanded = toggle.getAttribute("aria-expanded") === "true";
            toggle.setAttribute("aria-expanded", !expanded);
        });
    });


    toggleHistory.addEventListener("click", () => {
        historyContent.classList.toggle("collapsed");
        toggleHistory.textContent = historyContent.classList.contains("collapsed") ? "Show" : "Hide";
    });


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
            outputText.value = "";
            updateStats();
            showToast(`File "${file.name}" loaded`, "success");
        };
        reader.onerror = () => {
            showToast("Error reading file", "error");
        };
        reader.readAsText(file);
    }


    pasteBtn.addEventListener("click", async () => {
        try {
            const text = await navigator.clipboard.readText();
            editorText.value = text;
            outputText.value = "";
            updateStats();
            showToast("Text pasted from clipboard", "success");
        } catch (err) {
            showToast("Unable to paste from clipboard", "error");
        }
    });


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


    document.addEventListener("keydown", (e) => {

        if (e.ctrlKey && e.key === "Enter") {
            e.preventDefault();
            processButton.click();
        }

        if (e.ctrlKey && e.key === "z" && document.activeElement !== editorText) {
            e.preventDefault();
            undo();
        }

        if (e.ctrlKey && e.key === "y") {
            e.preventDefault();
            redo();
        }
    });


    function correctLists() {
        if (!listCorrectionCheckbox.checked) return;

        let lines = editorText.value.split("\n");
        let newLines = [];
        let inList = false;
        let removedBlankLines = 0;

        lines.forEach((line) => {
            const isListItem = /^\s*[-*]\s|^\s*\d+\.\s/.test(line);

            if (isListItem) {
                if (!inList) {
                    inList = true;
                }
                newLines.push(line);
            } else {
                if (inList && line.trim() === "") {
                    removedBlankLines++;
                    return;
                } else {
                    inList = false;
                    newLines.push(line);
                }
            }
        });

        editorText.value = newLines.join("\n");
        trackChange("blank lines removed from lists", removedBlankLines);
    }

    function replaceNumericalListsWithRoman() {
        if (!romanListCheckbox.checked) return;

        let lines = editorText.value.split("\n");
        let newLines = [];
        let convertedCount = 0;

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
                convertedCount++;
            } else {
                newLines.push(line);
            }
        });

        editorText.value = newLines.join("\n");
        trackChange("list items converted to Roman numerals", convertedCount);
    }


    function correctLines() {
        if (!lineCorrectionCheckbox.checked) return;

        const beforeText = editorText.value;
        const lines = editorText.value.split("\n");
        const result = [];
        let removedSeparatorLines = 0;
        let inFence = false;
        let fenceMarker = null;

        function isBlank(line) {
            return line.trim() === "";
        }

        function isFenceStart(line) {
            const match = line.trim().match(/^(`{3,}|~{3,})/);
            return match ? match[1][0] : null;
        }

        function isFenceEnd(line, marker) {
            if (!marker) return false;
            const pattern = marker === "`" ? /^`{3,}\s*$/ : /^~{3,}\s*$/;
            return pattern.test(line.trim());
        }

        function isMathFence(line) {
            return line.trim() === "$$";
        }

        function isSeparator(line) {
            return /^-{3,}$/.test(line.trim());
        }

        function isHeading(line) {
            return /^#{1,6}\s+/.test(line.trim()) || /^[IVXLCDM]+\.\s+/.test(line.trim());
        }

        function isListItem(line) {
            return /^\s*(?:[-*+] |\d+\.\s+)/.test(line);
        }

        function isTableLine(line) {
            const trimmed = line.trim();
            return trimmed.startsWith("|") && trimmed.endsWith("|");
        }

        function trimTrailingBlanks() {
            while (result.length && isBlank(result[result.length - 1])) {
                result.pop();
            }
        }

        function ensureOneBlankBefore() {
            trimTrailingBlanks();
            if (result.length) result.push("");
        }

        function pushBlockLine(line) {
            result.push(line.replace(/[ \t]+$/g, ""));
        }

        function isOpeningFenceLine(line, marker) {
            if (!marker) return false;
            return marker === "$$" ? isMathFence(line) : isFenceStart(line) === marker;
        }

        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];

            if (inFence) {
                const nextLine = index + 1 < lines.length ? lines[index + 1] : "";
                const nextClosesFence = fenceMarker === "$$" ? isMathFence(nextLine) : isFenceEnd(nextLine, fenceMarker);
                const previousLine = result.length ? result[result.length - 1] : "";
                const previousOpensFence = isOpeningFenceLine(previousLine, fenceMarker);
                if (isBlank(line) && (previousOpensFence || nextClosesFence)) {
                    continue;
                }

                pushBlockLine(line);
                if (fenceMarker === "$$" ? isMathFence(line) : isFenceEnd(line, fenceMarker)) {
                    inFence = false;
                    fenceMarker = null;
                    trimTrailingBlanks();
                    while (index + 1 < lines.length && isBlank(lines[index + 1])) {
                        index++;
                    }
                    if (index < lines.length - 1) result.push("");
                }
                continue;
            }

            if (isSeparator(line)) {
                removedSeparatorLines++;
                continue;
            }

            const fenceStart = isFenceStart(line);
            if (fenceStart || isMathFence(line)) {
                ensureOneBlankBefore();
                pushBlockLine(line);
                inFence = true;
                fenceMarker = fenceStart || "$$";
                if (fenceMarker === "$$") {
                    while (index + 1 < lines.length && isBlank(lines[index + 1])) {
                        index++;
                    }
                }
                continue;
            }

            if (isHeading(line)) {
                ensureOneBlankBefore();
                pushBlockLine(line);
                if (index < lines.length - 1) result.push("");
                continue;
            }

            if (isTableLine(line)) {
                ensureOneBlankBefore();
                pushBlockLine(line);
                while (index + 1 < lines.length && isTableLine(lines[index + 1])) {
                    index++;
                    pushBlockLine(lines[index]);
                }
                if (index < lines.length - 1) result.push("");
                continue;
            }

            if (isBlank(line)) {
                if (result.length && !isBlank(result[result.length - 1])) {
                    result.push("");
                }
                continue;
            }

            if (isListItem(line) && result.length && isListItem(result[result.length - 1])) {
                pushBlockLine(line);
                continue;
            }

            pushBlockLine(line);
        }

        trimTrailingBlanks();
        editorText.value = result.join("\n");

        const afterLineCount = editorText.value.split("\n").length;
        const beforeLineCount = beforeText.split("\n").length;
        const diff = beforeLineCount - afterLineCount;
        if (removedSeparatorLines > 0) trackChange("separator lines removed", removedSeparatorLines);
        if (diff > 0) trackChange("blank lines normalized", diff);
        if (diff < 0) trackChange("structural blank lines added", Math.abs(diff));
    }

    function removeTabIndent() {
        if (!tabCorrectionCheckbox.checked) return;

        let lines = editorText.value.split("\n");
        let newLines = [];
        let removedCount = 0;

        lines.forEach(line => {
            const match = line.match(/^(\t| {1,4})/);
            if (match) {
                newLines.push(line.substring(match[0].length));
                removedCount++;
            } else {
                newLines.push(line);
            }
        });

        editorText.value = newLines.join("\n");
        trackChange("tab indents removed", removedCount);
    }



    function correctLatex() {
        if (!latexCorrectionCheckbox.checked) return;
        const beforeText = editorText.value;

        const text = convertBareBracketDisplayMath(editorText.value);
        let result = '';
        let i = 0;




        function isEscaped(str, index) {
            let backslashCount = 0;
            let pos = index - 1;

            while (pos >= 0 && str[pos] === '\\') {
                backslashCount++;
                pos--;
            }

            return (backslashCount % 2) === 1;
        }




        function applyCorrections(content) {

            content = content.trim();
            content = content.replace(/\\;/g, '');
            content = content.replace(/\\,/g, ',');
            content = content.replace(/\\\./g, '.');
            content = content.replace(/([.,;:!?])(\s*)(\${1,2})(?!\$)/g, '$2$3');
            content = content.replace(/([,\.])d/g, 'd');
            content = content.replace(/([.,;:!?])\s*$/, '');

            return content;
        }






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
            return null;
        }

        while (i < text.length) {

            if (
                text[i] === '\\' &&
                (text[i + 1] === '[' || text[i + 1] === '(') &&
                !isEscaped(text, i)
            ) {
                const twoChar = text.substr(i, 2);
                let endTag, replacement;

                if (twoChar === '\\[') {
                    endTag = '\\]';
                    replacement = '$$';
                } else {
                    endTag = '\\)';
                    replacement = '$';
                }


                const startSearch = i + 2;
                const found = getMathContent(text, startSearch, endTag);

                if (found) {

                    const rawMath = found.content;
                    const corrected = applyCorrections(rawMath);

                    if (twoChar === '\\[') {
                        result += "$$\n" + corrected + "\n$$";
                    } else {
                        result += replacement + corrected + replacement;
                    }
                    i = found.endIndex;
                    continue;
                } else {

                    result += text[i];
                    i++;
                }
            } else if (text[i] === '$' && !isEscaped(text, i)) {

                let delimiter = '$';
                if (text[i + 1] === '$') {
                    delimiter = '$$';
                }

                const startSearch = i + delimiter.length;
                const found = getMathContent(text, startSearch, delimiter);
                if (found) {
                    const rawMath = found.content;
                    const corrected = applyCorrections(rawMath);
                    if (delimiter === '$$' && rawMath.includes('\n')) {
                        result += '$$\n' + corrected + '\n$$';
                    } else {
                        result += delimiter + corrected + delimiter;
                    }
                    i = found.endIndex;
                    continue;
                } else {

                    result += text[i];
                    i++;
                }
            } else {
                result += text[i];
                i++;
            }
        }


        editorText.value = result;
        if (editorText.value !== beforeText) {
            const changes = (beforeText.match(/\\\[|\\\(|\\;|\\,|\\\./g) || []).length;
            trackChange("LaTeX delimiters/formatting fixed", Math.max(changes, 1));
        }
    }

    function convertBareBracketDisplayMath(text) {
        const lines = text.split("\n");
        const result = [];
        let inCodeFence = false;
        let codeFenceMarker = null;

        function isCodeFenceStart(line) {
            const match = line.trim().match(/^(`{3,}|~{3,})/);
            return match ? match[1][0] : null;
        }

        function isCodeFenceEnd(line, marker) {
            if (!marker) return false;
            const pattern = marker === "`" ? /^`{3,}\s*$/ : /^~{3,}\s*$/;
            return pattern.test(line.trim());
        }

        function trimBlankEdges(blockLines) {
            const trimmed = blockLines.slice();
            while (trimmed.length && trimmed[0].trim() === "") {
                trimmed.shift();
            }
            while (trimmed.length && trimmed[trimmed.length - 1].trim() === "") {
                trimmed.pop();
            }
            return trimmed;
        }

        function isBareBracketOpener(line) {
            return line.trim() === "[";
        }

        function isBareBracketCloser(line) {
            return line.trim() === "]";
        }

        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];

            if (inCodeFence) {
                result.push(line);
                if (isCodeFenceEnd(line, codeFenceMarker)) {
                    inCodeFence = false;
                    codeFenceMarker = null;
                }
                continue;
            }

            const codeFenceStart = isCodeFenceStart(line);
            if (codeFenceStart) {
                result.push(line);
                inCodeFence = true;
                codeFenceMarker = codeFenceStart;
                continue;
            }

            if (!isBareBracketOpener(line)) {
                result.push(line);
                continue;
            }

            const blockLines = [];
            let closeIndex = -1;

            for (let scanIndex = index + 1; scanIndex < lines.length; scanIndex++) {
                if (isBareBracketCloser(lines[scanIndex])) {
                    closeIndex = scanIndex;
                    break;
                }
                blockLines.push(lines[scanIndex]);
            }

            if (closeIndex === -1) {
                result.push(line);
                continue;
            }

            const mathLines = trimBlankEdges(blockLines);
            result.push("$$");
            result.push(...mathLines);
            result.push("$$");
            index = closeIndex;
        }

        return result.join("\n");
    }

    function normalizeDisplayMathBlockText(text) {
        const lines = text.split("\n");
        const result = [];
        let inCodeFence = false;
        let codeFenceMarker = null;
        let inMathBlock = false;
        let mathBlockLines = [];

        function isBlank(line) {
            return line.trim() === "";
        }

        function isCodeFenceStart(line) {
            const match = line.trim().match(/^(`{3,}|~{3,})/);
            return match ? match[1][0] : null;
        }

        function isCodeFenceEnd(line, marker) {
            if (!marker) return false;
            const pattern = marker === "`" ? /^`{3,}\s*$/ : /^~{3,}\s*$/;
            return pattern.test(line.trim());
        }

        function isMathFence(line) {
            return line.trim() === "$$";
        }

        function trimTrailingBlanks() {
            while (result.length && isBlank(result[result.length - 1])) {
                result.pop();
            }
        }

        function normalizeMathBlockLines(blockLines) {
            const normalized = blockLines.map(line => line.replace(/[ \t]+$/g, ""));

            while (normalized.length && isBlank(normalized[0])) {
                normalized.shift();
            }
            while (normalized.length && isBlank(normalized[normalized.length - 1])) {
                normalized.pop();
            }

            const joined = [];

            function nextNonBlankIndex(startIndex) {
                for (let scanIndex = startIndex; scanIndex < normalized.length; scanIndex++) {
                    if (!isBlank(normalized[scanIndex])) return scanIndex;
                }
                return -1;
            }

            for (let lineIndex = 0; lineIndex < normalized.length; lineIndex++) {
                const line = normalized[lineIndex];
                const trimmed = line.trim();

                if (isBlank(line)) {
                    if (joined.length && !isBlank(joined[joined.length - 1])) {
                        joined.push("");
                    }
                    continue;
                }

                if (/^=+$/.test(trimmed) && joined.length) {
                    const nextIndex = nextNonBlankIndex(lineIndex + 1);
                    if (nextIndex !== -1) {
                        joined[joined.length - 1] = `${joined[joined.length - 1].trimEnd()} = ${normalized[nextIndex].trim()}`;
                        lineIndex = nextIndex;
                        continue;
                    }
                }

                if (/=\s*$/.test(line)) {
                    const nextIndex = nextNonBlankIndex(lineIndex + 1);
                    if (nextIndex !== -1) {
                        joined.push(`${line.trimEnd()} ${normalized[nextIndex].trim()}`);
                        lineIndex = nextIndex;
                        continue;
                    }
                }

                joined.push(line);
            }

            while (joined.length && isBlank(joined[joined.length - 1])) {
                joined.pop();
            }

            return joined;
        }

        for (let index = 0; index < lines.length; index++) {
            const line = lines[index].replace(/[ \t]+$/g, "");

            if (inCodeFence) {
                result.push(line);
                if (isCodeFenceEnd(line, codeFenceMarker)) {
                    inCodeFence = false;
                    codeFenceMarker = null;
                }
                continue;
            }

            const codeFenceStart = isCodeFenceStart(line);
            if (codeFenceStart) {
                result.push(line);
                inCodeFence = true;
                codeFenceMarker = codeFenceStart;
                continue;
            }

            if (inMathBlock) {
                if (isMathFence(line)) {
                    result.push(...normalizeMathBlockLines(mathBlockLines));
                    result.push("$$");
                    inMathBlock = false;
                    mathBlockLines = [];
                    trimTrailingBlanks();
                    while (index + 1 < lines.length && isBlank(lines[index + 1])) {
                        index++;
                    }
                    if (index < lines.length - 1) result.push("");
                } else {
                    mathBlockLines.push(line);
                }
                continue;
            }

            if (isMathFence(line)) {
                trimTrailingBlanks();
                if (result.length) result.push("");
                result.push("$$");
                inMathBlock = true;
                mathBlockLines = [];

                while (index + 1 < lines.length && isBlank(lines[index + 1])) {
                    index++;
                }
                continue;
            }

            result.push(line);
        }

        trimTrailingBlanks();
        return result.join("\n");
    }

    function normalizeDisplayMathBlocks() {
        const beforeText = editorText.value;
        editorText.value = normalizeDisplayMathBlockText(editorText.value);

        if (editorText.value !== beforeText) {
            trackChange("math block spacing normalized", 1);
        }
    }


    function trimListItemsBeforeColon() {
        if (!trimListsCheckbox.checked) return;

        let lines = editorText.value.split("\n");
        let newLines = [];
        let trimmedCount = 0;

        lines.forEach(line => {
            let trimmedLine = line.trim();
            let listStartRegex = /^(\d+\.|\*|-)/;

            if (listStartRegex.test(trimmedLine) && trimmedLine.includes(":")) {
                let colonIndex = trimmedLine.indexOf(":");
                let listSymbolMatch = trimmedLine.match(listStartRegex)[0];
                let newText = listSymbolMatch + " " + trimmedLine.slice(colonIndex + 1).trim();
                newLines.push(newText);
                trimmedCount++;
            } else {
                newLines.push(line);
            }
        });

        editorText.value = newLines.join("\n");
        trackChange("list prefixes trimmed", trimmedCount);
    }


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
        let text = editorText.value;

        if (removeAllStars.checked) {
            let removedCount = 0;
            let remainingBold = 0;

            text = preserveProtectedBlocks(text, segment => {
                let nextSegment = segment;

                if (removeBetween.checked) {
                    removedCount += countMatches(nextSegment, /\*\*[^*\n][\s\S]*?\*\*/g);
                    nextSegment = nextSegment.replace(/\*\*[^*\n][\s\S]*?\*\*/g, '');
                }

                remainingBold += countMatches(nextSegment, /\*\*/g) / 2;
                return nextSegment.replace(/\*\*/g, '');
            });

            if (removedCount > 0) {
                trackChange("bold sections removed (with content)", removedCount);
            }
            if (remainingBold > 0) {
                trackChange("bold markers removed", Math.floor(remainingBold));
            }
        } else if (confirmStep.checked) {
            let matches = [];
            let regex = /\*\*(.*?)\*\*/gs;
            let match;

            while ((match = regex.exec(text)) !== null) {
                matches.push({
                    match: match[0],
                    index: match.index,
                    content: match[1]
                });
            }

            let offset = 0;
            let confirmedCount = 0;
            for (let i = 0; i < matches.length; i++) {
                let m = matches[i];

                let lineStart = text.lastIndexOf('\n', m.index) + 1;
                let lineEnd = text.indexOf('\n', m.index);
                if (lineEnd === -1) lineEnd = text.length;
                let fullLine = text.slice(lineStart, lineEnd);

                let displayLine = fullLine.replace(m.match, toBoldUTF8(m.content));

                let userConfirmed = confirm(`Do you want to remove this text?\n"${displayLine}"`);
                if (userConfirmed) {
                    text = text.slice(0, m.index - offset) + text.slice(m.index - offset + m.match.length);
                    offset += m.match.length;
                    confirmedCount++;
                } else {
                    break;
                }
            }
            if (confirmedCount > 0) trackChange("bold sections confirmed and removed", confirmedCount);
        } else if (removeBetween.checked) {
            const removedCount = (text.match(/\*\*[^*]*\*\*[^ ]*\s*/g) || []).length;
            text = text.replace(/\*\*[^*]*\*\*[^ ]*\s*/g, '');
            trackChange("bold sections removed (with content)", removedCount);
        }

        editorText.value = text;
    }

    function normalizeTextArtifacts() {
        const beforeText = editorText.value;

        editorText.value = preserveProtectedBlocks(editorText.value, segment => segment
            .replace(/[\u200B-\u200D\uFEFF]/g, "")
            .replace(/\u00A0/g, " ")
            .replace(/[“”]/g, '"')
            .replace(/[‘’]/g, "'")
            .replace(/\s+([,.;:!?])/g, "$1")
            .replace(/([,.;:!?])([^\s\n)\]}])/g, "$1 $2")
            .replace(/[ \t]+$/gm, "")
            .replace(/[ \t]{2,}/g, " ")
        );

        if (editorText.value !== beforeText) {
            trackChange("spacing and punctuation artifacts normalized", 1);
        }
    }

    function removeAiBoilerplate() {
        const beforeText = editorText.value;
        const phraseRules = [
            /\b(certainly|sure|absolutely|of course)[,!]?\s+(here(?:'s| is)|below is|i can help with)\b[:\s-]*/gi,
            /\bhere(?:'s| is)\s+(?:a|an|the)\s+(?:cleaned|revised|polished|improved|updated)\s+(?:version|draft)\b[:\s-]*/gi,
            /\bbelow is\s+(?:a|an|the)\s+(?:cleaned|revised|polished|improved|updated)\s+(?:version|draft)\b[:\s-]*/gi,
            /\b(?:i hope this helps|hope this helps)[.!]?\s*/gi,
            /\b(?:let me know if you(?:'d| would)? like(?: me)? to make any further changes|let me know if you need anything else)[.!]?\s*/gi,
            /\b(?:as an ai language model|as an ai|i don't have personal opinions)\b[,.]?\s*/gi,
            /\b(?:it is important to note that|it is worth noting that|in conclusion,?)\s+/gi
        ];

        editorText.value = preserveProtectedBlocks(editorText.value, segment => {
            let text = segment;
            phraseRules.forEach(rule => {
                text = text.replace(rule, "");
            });
            return text.replace(/^\s*[-–—]*\s*$/gm, "");
        });

        if (editorText.value !== beforeText) {
            trackChange("AI boilerplate phrases removed", 1);
        }
    }

    function simplifyText() {
        if (!simplifyTextCheckbox.checked) return;

        const beforeText = editorText.value;
        const replacements = {
            utilize: "use",
            utilizes: "uses",
            utilized: "used",
            utilizing: "using",
            leverage: "use",
            leverages: "uses",
            leveraged: "used",
            leveraging: "using",
            facilitate: "help",
            facilitates: "helps",
            facilitated: "helped",
            facilitating: "helping",
            endeavor: "try",
            endeavors: "tries",
            endeavored: "tried",
            robust: "solid",
            seamless: "smooth",
            paramount: "important",
            pivotal: "important",
            crucial: "important",
            myriad: "many",
            delve: "examine",
            delves: "examines",
            delved: "examined",
            delving: "examining",
            realm: "area",
            showcase: "show",
            showcases: "shows",
            showcased: "showed",
            showcasing: "showing"
        };
        const pattern = new RegExp(`\\b(${Object.keys(replacements).map(escapeRegExp).join("|")})\\b`, "gi");
        let replacementCount = 0;

        editorText.value = preserveProtectedBlocks(editorText.value, segment => segment.replace(pattern, match => {
            let replacement = replacements[match.toLowerCase()];
            if (!replacement) return match;
            replacementCount++;

            if (match === match.toUpperCase()) {
                return replacement.toUpperCase();
            }

            if (match[0] === match[0].toUpperCase()) {
                return replacement.charAt(0).toUpperCase() + replacement.slice(1);
            }

            return replacement;
        }));

        if (editorText.value !== beforeText) {
            trackChange("vocabulary simplifications applied", replacementCount);
        }
    }

    function replaceTextFunction() {
        const searchValue = searchText.value;
        const replaceValue = replaceTextInput.value;
        const targetText = outputText.value ? outputText : editorText;

        if (searchValue === "") {
            showToast("Please enter text to search for", "warning");
            return;
        }

        const regex = new RegExp(escapeRegExp(searchValue), "g");
        const originalText = targetText.value;
        targetText.value = targetText.value.replace(regex, replaceValue);

        if (targetText.value !== originalText) {
            if (targetText === outputText) {
                saveState();
            }
            showToast("Text replaced successfully", "success");
        } else {
            showToast("No matches found", "info");
        }
        updateStats();
    }

    processButton.addEventListener("click", () => {
        const originalText = editorText.value;
        if (!originalText.trim()) {
            showToast("Paste text before processing", "warning");
            return;
        }

        preProcessText = originalText;
        resetChangeReport();

        editorText.value = originalText;
        normalizeTextArtifacts();
        removeAiBoilerplate();
        processText();
        replaceNumericalListsWithRoman();
        trimListItemsBeforeColon();
        correctLists();
        removeTabIndent();
        correctLatex();
        normalizeDisplayMathBlocks();
        correctLines();
        simplifyText();

        const processedText = normalizeDisplayMathBlockText(editorText.value);
        editorText.value = originalText;
        outputText.value = processedText;
        updateStats();

        if (processedText !== originalText) {
            saveState();
            outputText.focus();
            outputText.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
            showToast("Cleaned text written to Output", "success");
            showChangeReport();
            showDiffPreview(originalText, processedText);
        } else {
            showToast("No changes were made", "info");
        }
    });
    replaceButton.addEventListener("click", replaceTextFunction);
    undoButton.addEventListener("click", undo);
    redoButton.addEventListener("click", redo);

    clearButton.addEventListener("click", () => {
        if (editorText.value.trim() || outputText.value.trim()) {
            editorText.value = "";
            outputText.value = "";
            saveState();
            updateStats();
            showToast("Text cleared", "info");
        }
    });

    copyButton.addEventListener("click", () => {
        const textToCopy = getResultText();
        if (!textToCopy.trim()) {
            showToast("Nothing to copy", "warning");
            return;
        }

        navigator.clipboard
            .writeText(textToCopy)
            .then(() => {
                showToast("Copied to clipboard", "success");
            })
            .catch(() => {
                showToast("Failed to copy", "error");
            });
    });

    downloadButton.addEventListener("click", () => {
        const textToDownload = getResultText();
        if (!textToDownload.trim()) {
            showToast("Nothing to download", "warning");
            return;
        }

        const blob = new Blob([textToDownload], {
            type: "text/plain",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "processed_text.txt";
        link.click();
        showToast("File downloaded", "success");
    });


    document.getElementById("close-report").addEventListener("click", () => {
        document.getElementById("change-report").style.display = "none";
    });

    document.getElementById("close-diff").addEventListener("click", () => {
        const diffPreview = document.getElementById("diff-preview");
        const diffCollapsed = diffPreview.classList.toggle("collapsed");
        document.getElementById("close-diff").textContent = diffCollapsed ? "Show" : "Hide";
    });

    document.getElementById("revert-all").addEventListener("click", () => {
        if (preProcessText !== null) {
            outputText.value = preProcessText;
            saveState();
            preProcessText = null;
            updateStats();
            document.getElementById("change-report").style.display = "none";
            showToast("All changes reverted", "success");
        }
    });
});
