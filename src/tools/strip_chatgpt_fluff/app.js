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
    const romanListCheckbox = document.getElementById("roman-list-conversion");
    const tabCorrectionCheckbox = document.getElementById("tab-correction");
    const latexCorrectionCheckbox = document.getElementById("latex-correction");
    const simplifyTextCheckbox = document.getElementById("simplify-text");

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

    function correctLines() {
        if (!lineCorrectionCheckbox.checked) return;
        saveState();

        let lines = editorText.value.split("\n");

        // Helper to detect list items
        function isListItem(line) {
            // e.g. "- something" or "* something" (allow indentation too)
            return /^\s*[-*]\s+/.test(line);
        }

        // Helper to detect lines that are capital Roman numeral headings (e.g., "I. Title", "XVII. Topic")
        function isRomanHeading(line) {
            // Trim first; match one or more Roman chars, then a dot, then a space
            return /^[IVXLCDM]+\.\s/.test(line.trim());
        }

        // ============= PASS 0: Remove lines that ONLY contain minus signs (like "----") ============
        let pass0 = [];
        for (let line of lines) {
            const t = line.trim();
            if (/^-+$/.test(t)) {
                // Skip lines that ONLY have '-' characters
                continue;
            }
            pass0.push(line);
        }

        // ============= PASS 1: Insert blank lines before/after blocks, headings, tables, lists ============
        // (but do NOT modify lines inside code/math blocks).
        let pass1 = [];
        let inBlock = false;
        let blockMarker = null;

        function pushBlankLineIfNeeded(arr) {
            // Insert a blank line if the last line isn't blank (and array isn't empty).
            if (arr.length && arr[arr.length - 1].trim() !== "") {
                arr.push("");
            }
        }

        for (let i = 0; i < pass0.length; i++) {
            let line = pass0[i];
            let t = line.trim();

            if (!inBlock) {
                // Code or math block start?
                if (t === "```" || t === "$$") {
                    pushBlankLineIfNeeded(pass1); // blank line BEFORE block
                    pass1.push(line);
                    inBlock = true;
                    blockMarker = t;
                }
                // Heading? (# Something) OR capital Roman numeral heading (I. Something)
                else if (/^#+\s/.test(t) || isRomanHeading(line)) {
                    pushBlankLineIfNeeded(pass1); // blank line BEFORE heading
                    pass1.push(line);
                    pass1.push(""); // blank line AFTER heading
                }
                // Table line? (starts/ends with "|")
                else if (t.startsWith("|") && t.endsWith("|")) {
                    pushBlankLineIfNeeded(pass1); // blank line BEFORE table
                    pass1.push(line);

                    // Collect subsequent table lines
                    while (i + 1 < pass0.length) {
                        let nt = pass0[i + 1].trim();
                        if (nt.startsWith("|") && nt.endsWith("|")) {
                            i++;
                            pass1.push(pass0[i]);
                        } else {
                            break;
                        }
                    }
                    pass1.push(""); // blank line AFTER table
                }
                // First list item? Insert blank line before it (unless the last line is already blank).
                else if (isListItem(line)) {
                    pushBlankLineIfNeeded(pass1);
                    pass1.push(line);
                }
                // Otherwise, just pass it along
                else {
                    pass1.push(line);
                }
            } else {
                // We are inside a code/math block, do not alter lines
                pass1.push(line);
                // Check if we're leaving the block
                if (t === blockMarker) {
                    inBlock = false;
                    blockMarker = null;
                    pushBlankLineIfNeeded(pass1); // blank line AFTER block
                }
            }
        }

        // ============= PASS 2: Remove blank lines between consecutive list items (outside code blocks) ============
        // That is, if pass2's last line is a list item, and next line is a list item,
        // skip a blank line between them.
        let pass2 = [];
        inBlock = false;
        blockMarker = null;

        for (let i = 0; i < pass1.length; i++) {
            let line = pass1[i];
            let t = line.trim();

            if (!inBlock) {
                if (t === "```" || t === "$$") {
                    pass2.push(line);
                    inBlock = true;
                    blockMarker = t;
                } else {
                    // If it's a blank line, check neighbors
                    if (t === "" && i + 1 < pass1.length) {
                        let nextLine = pass1[i + 1];
                        // If the previous line in pass2 is a list item
                        // and next line is also a list item, remove this blank line.
                        if (
                            pass2.length > 0 &&
                            isListItem(pass2[pass2.length - 1]) &&
                            isListItem(nextLine)
                        ) {
                            continue; // skip pushing this blank line
                        }
                    }
                    pass2.push(line);
                }
            } else {
                // Inside code/math block, just push
                pass2.push(line);
                if (t === blockMarker) {
                    inBlock = false;
                    blockMarker = null;
                }
            }
        }

        // ============= PASS 3: Collapse multiple consecutive blank lines into one (outside code blocks) ============
        let pass3 = [];
        inBlock = false;
        blockMarker = null;
        let lastWasEmpty = false;

        for (let i = 0; i < pass2.length; i++) {
            let line = pass2[i];
            let t = line.trim();

            if (!inBlock) {
                // Start of code/math block?
                if (t === "```" || t === "$$") {
                    pass3.push(line);
                    inBlock = true;
                    blockMarker = t;
                    lastWasEmpty = false;
                } else if (t === "") {
                    // Only push one blank line if we haven't just pushed one
                    if (!lastWasEmpty) {
                        pass3.push("");
                        lastWasEmpty = true;
                    }
                } else {
                    pass3.push(line);
                    lastWasEmpty = false;
                }
            } else {
                pass3.push(line);
                if (t === blockMarker) {
                    inBlock = false;
                    blockMarker = null;
                    lastWasEmpty = false;
                }
            }
        }

        // Optionally ensure a trailing blank line at the end
        if (pass3.length && pass3[pass3.length - 1].trim() !== "") {
            pass3.push("");
        }

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
            // >>> ADD THIS LINE: remove leading/trailing spaces <<<
            content = content.trim();

            // (a) Remove punctuation if it appears immediately before '$' or '$$'.
            //     e.g. "something.,$$" -> "something$$"
            content = content.replace(/([.,;:!?])(\s*)(\${1,2})(?!\$)/g, '$2$3');

            // (b) Replace ",d" or ".d" with "d"
            content = content.replace(/([,\.])d/g, 'd');

            return content;
        }

        // -------------------------------------------------------------
        // 3) Helper: scans text from `startIndex` until unescaped `endTag`
        //    e.g., for \[...\], endTag = '\]'; for $...$, endTag = '$'
        // -------------------------------------------------------------
        function getMathContent(str, startIndex, endTag) {
            // We'll collect everything from after `startIndex` until we find `endTag`.
            let pos = startIndex;
            while (pos < str.length) {
                // If we find endTag not escaped, that's our end
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
            // Not found
            return null;
        }

        // -------------------------------------------------------------
        // 4) Main parse loop
        // -------------------------------------------------------------
        while (i < text.length) {
            // --- (A) Check for "\[" or "\(" to convert -> $$...$$ or $...$ ---
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
                    // We have everything from after "\[" up to "\]"
                    const rawMath = found.content;
                    const corrected = applyCorrections(rawMath);

                    // Add the replacement delimiters: $$ ... $$ or $ ... $
                    result += replacement + corrected + replacement;

                    // Advance `i` past the endTag
                    i = found.endIndex;
                    continue; // Move on to next loop iteration
                } else {
                    // We didn't find a matching "\]" or "\)", so just copy the '\'
                    result += text[i];
                    i++;
                }
            }

            // --- (B) Check for "$" or "$$" blocks in the text ---
            else if (text[i] === '$' && !isEscaped(text, i)) {
                // Check if we have "$$" vs single "$"
                let delimiter = '$';
                if (text[i + 1] === '$') {
                    delimiter = '$$';
                }

                const startSearch = i + delimiter.length;
                const found = getMathContent(text, startSearch, delimiter);
                if (found) {
                    const rawMath = found.content;
                    const corrected = applyCorrections(rawMath);

                    // Add "$$ ... $$" or "$ ... $"
                    result += delimiter + corrected + delimiter;

                    // Advance
                    i = found.endIndex;
                    continue;
                } else {
                    // No closing match, so just copy one char
                    result += text[i];
                    i++;
                }
            }

            // --- (C) Otherwise, copy the current character as-is ---
            else {
                result += text[i];
                i++;
            }
        }

        // Finally, set the transformed result back into your editor
        editorText.value = result;
    }



    function trimListItemsBeforeColon() {
        // Get the checkbox element
        const trimListsCheckbox = document.getElementById('trim-lists-before-colon');

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
                'crucial': 'important',
                'critical': 'important',
                'fundamental': 'important',
                'employ': 'use',
                'ensure': 'make sure',
                'essential': 'necessary',
                'pivotal': 'important',
                'signifies': 'indicates',
                'established': 'set up',
                'navigate': 'find your way through',
                'paramount': 'important',
                'ultimately': 'finally',
                'esteemed': 'respected',
                'myriad': 'many',
                'tapestry': 'fabric',
                'meticulous': 'careful',
                'intricate': 'complex',
                'facilitating': 'helping',
                'commendable': 'praiseworthy',
                'robust': 'strong',
                'seamless': 'smooth',
                'multi-faceted': 'many-sided',
                'complex': 'complicated',
                'ample': 'enough',
                'ascertain': 'find out',
                'benevolent': 'kind',
                'cognizant': 'aware',
                'disseminate': 'spread',
                'endeavor': 'effort',
                'exacerbate': 'worsen',
                'facilitate': 'help',
                'gregarious': 'sociable',
                'hinder': 'block',
                'implement': 'carry out',
                'juxtapose': 'place side by side',
                'leverage': 'use',
                'magnanimous': 'generous',
                'negligible': 'insignificant',
                'obfuscate': 'confuse',
                'perfunctory': 'done without care',
                'quintessential': 'perfect example',
                'reiterate': 'repeat',
                'substantiate': 'prove',
                'transient': 'temporary',
                'ubiquitous': 'everywhere',
                'vacillate': 'waver',
                'wane': 'decrease',
                'xenophobia': 'fear of foreigners',
                'yoke': 'join',
                'zealous': 'enthusiastic',
                'ameliorate': 'improve',
                'belligerent': 'hostile',
                'capricious': 'unpredictable',
                'deleterious': 'harmful',
                'efficacious': 'effective',
                'fortuitous': 'accidental',
                'gratuitous': 'unnecessary',
                'hapless': 'unfortunate',
                'idiosyncratic': 'unique',
                'jargon': 'specialized language',
                'knack': 'skill',
                'laconic': 'brief',
                'mellifluous': 'pleasant sounding',
                'nonchalant': 'casual',
                'ostracize': 'exclude',
                'pragmatic': 'practical',
                'quandary': 'dilemma',
                'rampant': 'widespread',
                'sagacious': 'wise',
                'taciturn': 'quiet',
                'untenable': 'unsustainable',
                'venerable': 'respected',
                'whimsical': 'playful',
                'xenial': 'hospitable',
                'yonder': 'over there',
                'zephyr': 'breeze',
                'aesthetic': 'beautiful',
                'bucolic': 'rustic',
                'cajole': 'persuade',
                'daunting': 'intimidating',
                'ephemeral': 'short-lived',
                'flamboyant': 'showy',
                'gregarious': 'sociable',
                'heinous': 'horrible',
                'immutable': 'unchanging',
                'jubilant': 'joyful',
                'kinetic': 'relating to motion',
                'lucid': 'clear',
                'mundane': 'ordinary',
                'noxious': 'harmful',
                'ostentatious': 'showy',
                'placate': 'calm',
                'quell': 'suppress',
                'resilient': 'strong',
                'stoic': 'unemotional',
                'tangible': 'real',
                'umbrage': 'offense',
                'vapid': 'dull',
                'wane': 'decrease',
                'xylem': 'plant tissue',
                'yielding': 'flexible',
                'zenith': 'peak',
                'alacrity': 'eagerness',
                'blatant': 'obvious',
                'candid': 'honest',
                'deference': 'respect',
                'elucidate': 'explain',
                'fallacious': 'incorrect',
                'garish': 'bright and showy',
                'harbinger': 'forerunner',
                'iconoclast': 'rebel',
                'juxtaposition': 'comparison',
                'kudos': 'praise',
                'languid': 'slow',
                'munificent': 'generous',
                'nonplussed': 'confused',
                'obdurate': 'stubborn',
                'palpable': 'clear',
                'querulous': 'complaining',
                'reticent': 'quiet',
                'sanguine': 'optimistic',
                'tirade': 'rant',
                'ubiquity': 'everywhere',
                'vociferous': 'loud',
                'winsome': 'charming',
                'yawning': 'wide',
                'zealot': 'enthusiast',
                'aberration': 'deviation',
                'bombastic': 'overblown',
                'camaraderie': 'friendship',
                'deleterious': 'harmful',
                'enigma': 'mystery',
                'fallacy': 'mistake',
                'garrulous': 'talkative',
                'hubris': 'arrogance',
                'insidious': 'sneaky',
                'jocular': 'funny',
                'lachrymose': 'tearful',
                'malaise': 'unease',
                'nefarious': 'wicked',
                'obsequious': 'overly obedient',
                'paradigm': 'model',
                'quixotic': 'unrealistic',
                'recalcitrant': 'stubborn',
                'soporific': 'sleep-inducing',
                'tantamount': 'equivalent',
                'unilateral': 'one-sided',
                'voracious': 'hungry',
                'winsome': 'charming',
                'xenial': 'hospitable',
                'yearn': 'long for',
                'zeal': 'enthusiasm',
                'ameliorate': 'improve',
                'bifurcate': 'split',
                'cogent': 'persuasive',
                'dichotomy': 'division',
                'ebb': 'decline',
                'facade': 'front',
                'garner': 'gather',
                'hinder': 'block',
                'immutable': 'unchanging',
                'juxtapose': 'place side by side',
                'knell': 'bell sound indicating death',
                'lucid': 'clear',
                'maudlin': 'sentimental',
                'nonchalant': 'casual',
                'opulent': 'rich',
                'palliate': 'lessen',
                'quagmire': 'difficult situation',
                'rapacious': 'greedy',
                'sagacity': 'wisdom',
                'tacit': 'unspoken',
                'umbrage': 'offense',
                'vicarious': 'experienced through others',
                'wane': 'decrease',
                'xenophobia': 'fear of foreigners',
                'yearn': 'long for',
                'zealous': 'enthusiastic',
                'ambivalent': 'uncertain',
                'bellicose': 'aggressive',
                'censure': 'criticize',
                'deleterious': 'harmful',
                'elaborate': 'detailed',
                'fortitude': 'courage',
                'gratuitous': 'unnecessary',
                'hubris': 'arrogance',
                'impervious': 'unaffected',
                'jovial': 'cheerful',
                'lucid': 'clear',
                'misanthrope': 'people-hater',
                'nonpareil': 'unmatched',
                'oblique': 'indirect',
                'precocious': 'advanced',
                'quandary': 'dilemma',
                'rescind': 'cancel',
                'stoic': 'unemotional',
                'truculent': 'aggressive',
                'vacillate': 'waver',
                'wanton': 'uncontrolled',
                'xenial': 'hospitable',
                'yoke': 'join',
                'zenith': 'peak',
                'apathy': 'indifference',
                'blandishment': 'flattery',
                'circumspect': 'cautious',
                'demure': 'reserved',
                'ephemeral': 'short-lived',
                'fallacious': 'incorrect',
                'grandiose': 'impressive',
                'hapless': 'unfortunate',
                'impecunious': 'poor',
                'jingoism': 'extreme nationalism',
                'knavery': 'dishonesty',
                'loquacious': 'talkative',
                'munificent': 'generous',
                'negligent': 'careless',
                'obfuscate': 'confuse',
                'palpable': 'clear',
                'quiescent': 'inactive',
                'ravenous': 'hungry',
                'sagacious': 'wise',
                'tirade': 'rant',
                'umbrageous': 'offensive',
                'vapid': 'dull',
                'winsome': 'charming',
                'xenophobia': 'fear of foreigners',
                'yawning': 'wide',
                'zephyr': 'breeze',
                'ambiguous': 'unclear',
                'bombastic': 'overblown',
                'candid': 'honest',
                'deleterious': 'harmful',
                'enigmatic': 'mysterious',
                'fallacious': 'incorrect',
                'gregarious': 'sociable',
                'haughty': 'arrogant',
                'immutable': 'unchanging',
                'juxtaposition': 'comparison',
                'kinetic': 'relating to motion',
                'lucid': 'clear',
                'malevolent': 'evil',
                'nefarious': 'wicked',
                'obstinate': 'stubborn',
                'placate': 'calm',
                'quandary': 'dilemma',
                'resilient': 'strong',
                'stoic': 'unemotional',
                'tangible': 'real',
                'umbrage': 'offense',
                'venerable': 'respected',
                'winsome': 'charming',
                'yonder': 'over there',
                'zealous': 'enthusiastic',
                // Add more replacements as needed
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
        trimListItemsBeforeColon();
        correctLists();
        removeTabIndent();
        correctLatex();
        correctLines();
        simplifyText();

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