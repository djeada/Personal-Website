class LatexRenderer {
    constructor() {
        this.input = document.getElementById('latex-input');
        this.output = document.getElementById('latex-output');
        this.charCount = document.getElementById('char-count');
        this.status = document.getElementById('render-status');
        this.lineNumbers = document.getElementById('line-numbers');
        this.srStatus = document.getElementById('sr-status');
        this.diagnosticsEl = document.getElementById('diagnostics');

        this.renderBtn = document.getElementById('render-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.exampleBtn = document.getElementById('example-btn');
        this.copyBtn = document.getElementById('copy-btn');
        this.fullscreenBtn = document.getElementById('fullscreen-btn');
        this.snippetSelect = document.getElementById('snippet-select');
        this.wrapInlineBtn = document.getElementById('wrap-inline-btn');
        this.wrapDisplayBtn = document.getElementById('wrap-display-btn');
        this.downloadBtn = document.getElementById('download-btn');
        this.shareBtn = document.getElementById('share-btn');

        this.penBtn = document.getElementById('pen-btn');
        this.highlightBtn = document.getElementById('highlight-btn');
        this.eraserBtn = document.getElementById('eraser-btn');
        this.clearDrawingBtn = document.getElementById('clear-drawing-btn');
        this.drawColorInput = document.getElementById('draw-color');

        this.quickRefFilter = document.getElementById('quick-ref-filter');
        this.quickRefList = document.getElementById('quick-ref-list');
        this.quickRefCount = document.getElementById('quick-ref-count');

        this.splitContainer = document.getElementById('split-container');
        this.editorPanel = document.getElementById('editor-panel');
        this.previewPanel = document.getElementById('preview-panel');
        this.divider = document.getElementById('divider');

        this.renderTimeout = null;
        this.saveTimeout = null;
        this.renderVersion = 0;
        this.mathJaxLoadPromise = null;
        this.storageKey = 'latex_renderer_content_v2';
        this.legacyStorageKey = 'latex_renderer_content_v1';
        this.splitRatio = 0.5;

        this.init();
    }

    init() {
        this.restoreState();
        this.setupEventListeners();
        this.updateCharCount();
        this.updateLineNumbers();
        this.setStatus('Ready', 'ready');

        if (this.input.value.trim() === '') {
            this.showPlaceholder();
        } else {
            this.renderLatex();
        }
    }

    setupEventListeners() {
        this.input.addEventListener('input', () => this.handleInputChange());
        this.input.addEventListener('scroll', () => this.syncScroll());
        this.input.addEventListener('keydown', (event) => this.handleKeyboardShortcuts(event));

        this.renderBtn?.addEventListener('click', () => this.renderLatex());
        this.clearBtn.addEventListener('click', () => this.clearContent());
        this.exampleBtn.addEventListener('click', () => this.loadExample());
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        this.downloadBtn.addEventListener('click', () => this.downloadTex());
        this.shareBtn.addEventListener('click', () => this.generateShareLink());
        this.wrapInlineBtn.addEventListener('click', () => this.wrapSelection('$', '$'));
        this.wrapDisplayBtn.addEventListener('click', () => this.wrapSelection('$$\n', '\n$$'));

        this.snippetSelect.addEventListener('change', () => {
            if (this.snippetSelect.value) {
                this.insertSnippet(this.snippetSelect.value);
                this.snippetSelect.selectedIndex = 0;
            }
        });

        this.penBtn?.addEventListener('click', () => this.toggleDrawingMode('pen'));
        this.highlightBtn?.addEventListener('click', () => this.toggleDrawingMode('highlight'));
        this.eraserBtn?.addEventListener('click', () => this.toggleDrawingMode('eraser'));
        this.clearDrawingBtn?.addEventListener('click', () => this.clearDrawing(false));
        this.drawColorInput?.addEventListener('input', () => this.renderHighlightTint());

        this.initResizing();
        this.initQuickReference();
        this.initDrawingLayer();
    }

    handleInputChange() {
        this.updateCharCount();
        this.updateLineNumbers();
        this.debounceRender();
        this.debounceSave();
    }

    syncScroll() {
        if (this.lineNumbers) {
            this.lineNumbers.scrollTop = this.input.scrollTop;
        }
    }

    debounceRender() {
        clearTimeout(this.renderTimeout);
        this.renderTimeout = setTimeout(() => this.renderLatex(), 180);
    }

    debounceSave() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => this.saveState(), 350);
    }

    renderLatex() {
        const source = this.input.value.trim();
        const renderId = ++this.renderVersion;

        if (!source) {
            this.clearDiagnostics();
            this.showPlaceholder();
            return;
        }

        const issues = this.validateLatex(this.input.value);
        this.renderDiagnostics(issues);
        this.renderSourceContent(source);
        this.setStatus('Rendering...', 'rendering');
        this.output.setAttribute('aria-busy', 'true');

        this.waitForMathJax()
            .then(() => {
                if (renderId !== this.renderVersion) return null;
                if (!window.MathJax || typeof window.MathJax.typesetPromise !== 'function') {
                    throw new Error('MathJax is not available');
                }
                return window.MathJax.typesetPromise([this.output]);
            })
            .then(() => {
                if (renderId !== this.renderVersion) return;

                const errorCount = issues.filter((issue) => issue.severity === 'error').length;
                const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
                if (errorCount) {
                    this.setStatus(`${errorCount} issue${errorCount === 1 ? '' : 's'}`, 'error');
                } else if (warningCount) {
                    this.setStatus(`${warningCount} warning${warningCount === 1 ? '' : 's'}`, 'warning');
                } else {
                    this.setStatus('Rendered', 'success');
                }
            })
            .catch((error) => {
                if (renderId !== this.renderVersion) return;
                const message = this.formatMathJaxError(error);
                this.renderDiagnostics([...issues, {
                    severity: 'error',
                    line: '-',
                    message
                }]);
                this.setStatus('Rendering error', 'error');
            })
            .finally(() => {
                if (renderId !== this.renderVersion) return;
                this.output.removeAttribute('aria-busy');
                this.resizeDrawingCanvas?.();
            });
    }

    waitForMathJax() {
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            return Promise.resolve();
        }
        if (this.mathJaxLoadPromise) {
            return this.mathJaxLoadPromise;
        }

        const script = document.getElementById('MathJax-script');
        this.mathJaxLoadPromise = new Promise((resolve, reject) => {
            let settled = false;
            let pollId = null;
            let timeoutId = null;

            const finish = (callback, value) => {
                if (settled) return;
                settled = true;
                clearInterval(pollId);
                clearTimeout(timeoutId);
                callback(value);
            };

            const tryReady = () => {
                if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
                    finish(resolve);
                    return true;
                }

                const startupPromise = window.MathJax?.startup?.promise;
                if (startupPromise && typeof startupPromise.then === 'function') {
                    startupPromise.then(() => finish(resolve)).catch((error) => finish(reject, error));
                    return true;
                }

                return false;
            };

            if (tryReady()) return;

            pollId = setInterval(tryReady, 50);
            timeoutId = setTimeout(() => {
                finish(reject, new Error('MathJax loading timed out'));
            }, 10000);

            if (script) {
                script.addEventListener('load', tryReady, { once: true });
                script.addEventListener('error', () => {
                    finish(reject, new Error('MathJax failed to load'));
                }, { once: true });
            }
        });

        return this.mathJaxLoadPromise;
    }

    renderSourceContent(source) {
        this.clearTypeset();

        const documentEl = document.createElement('div');
        documentEl.className = 'rendered-document';

        this.getRenderBlocks(source).forEach((block) => {
            const element = document.createElement(this.isDisplayBlock(block) ? 'div' : 'p');
            element.className = this.isDisplayBlock(block) ? 'display-math-block' : 'text-math-block';
            element.textContent = block;
            documentEl.appendChild(element);
        });

        this.output.replaceChildren(documentEl);
        this.attachDrawingLayer();
    }

    getRenderBlocks(source) {
        const lines = source.replace(/\r\n?/g, '\n').split('\n');
        const blocks = [];
        let current = [];
        let inDisplay = false;

        const pushCurrent = () => {
            const block = current.join('\n').trim();
            if (block) blocks.push(block);
            current = [];
        };

        lines.forEach((line) => {
            const isBlank = line.trim() === '';
            const displayToggles = this.countUnescapedToken(line, '$$');
            const bracketOpen = this.countUnescapedToken(line, '\\[');
            const bracketClose = this.countUnescapedToken(line, '\\]');

            if (!inDisplay && isBlank) {
                pushCurrent();
                return;
            }

            current.push(line);

            if (displayToggles % 2 === 1) {
                inDisplay = !inDisplay;
            }
            if (bracketOpen > bracketClose) {
                inDisplay = true;
            } else if (bracketClose > bracketOpen) {
                inDisplay = false;
            }
        });

        pushCurrent();
        return blocks.length ? blocks : [source];
    }

    isDisplayBlock(block) {
        return /(^|\n)\s*(\$\$|\\\[|\\begin\{(?:align|align\*|equation|equation\*|gather|gather\*|multline|multline\*|split|aligned|cases|matrix|pmatrix|bmatrix|vmatrix|array)\})/.test(block) ||
            /\$\$|\\\[|\\\]/.test(block);
    }

    clearTypeset() {
        try {
            if (window.MathJax && typeof window.MathJax.typesetClear === 'function') {
                window.MathJax.typesetClear([this.output]);
            }
        } catch (_) {
            // MathJax cleanup is best-effort before replacing the preview DOM.
        }
    }

    formatMathJaxError(error) {
        const raw = error?.message || String(error || 'Unknown MathJax error');
        return raw.replace(/\s+/g, ' ').trim();
    }

    validateLatex(text) {
        const issues = [];
        const lines = text.replace(/\r\n?/g, '\n').split('\n');
        const envStack = [];
        const braceStack = [];
        const braceMap = {
            '(': ')',
            '[': ']',
            '{': '}'
        };
        const closers = new Set(Object.values(braceMap));
        const envRegex = /\\(begin|end)\{([^}]+)\}/g;

        lines.forEach((rawLine, lineIndex) => {
            const lineNumber = lineIndex + 1;
            const line = this.stripLatexComment(rawLine);

            for (let index = 0; index < line.length; index++) {
                const char = line[index];
                if (this.isEscaped(line, index)) continue;

                if (braceMap[char]) {
                    braceStack.push({ char, line: lineNumber });
                } else if (closers.has(char)) {
                    const last = braceStack.pop();
                    if (!last || braceMap[last.char] !== char) {
                        issues.push({
                            severity: 'error',
                            line: lineNumber,
                            message: `Unexpected '${char}'`
                        });
                    }
                }
            }

            envRegex.lastIndex = 0;
            let match;
            while ((match = envRegex.exec(line))) {
                const type = match[1];
                const env = match[2];

                if (type === 'begin') {
                    envStack.push({ env, line: lineNumber });
                    continue;
                }

                const last = envStack.pop();
                if (!last) {
                    issues.push({
                        severity: 'error',
                        line: lineNumber,
                        message: `Unexpected \\end{${env}}`
                    });
                } else if (last.env !== env) {
                    issues.push({
                        severity: 'error',
                        line: lineNumber,
                        message: `Expected \\end{${last.env}}, found \\end{${env}}`
                    });
                }
            }
        });

        braceStack.slice(-12).forEach((entry) => {
            issues.push({
                severity: 'warning',
                line: entry.line,
                message: `Unclosed '${entry.char}'`
            });
        });

        envStack.reverse().forEach((entry) => {
            issues.push({
                severity: 'warning',
                line: entry.line,
                message: `Environment '${entry.env}' is not closed`
            });
        });

        const mathCounts = this.countMathDelimiters(text);
        if (mathCounts.display % 2 !== 0) {
            issues.push({
                severity: 'error',
                line: mathCounts.displayLine || 1,
                message: 'Unpaired $$ display math delimiter'
            });
        }
        if (mathCounts.inline % 2 !== 0) {
            issues.push({
                severity: 'warning',
                line: mathCounts.inlineLine || 1,
                message: 'Unpaired $ inline math delimiter'
            });
        }

        const bracketDisplay = this.countDelimitedPair(text, '\\[', '\\]');
        if (bracketDisplay.open !== bracketDisplay.close) {
            issues.push({
                severity: 'error',
                line: bracketDisplay.line || 1,
                message: 'Unpaired \\[ display math delimiter'
            });
        }

        return this.uniqueIssues(issues);
    }

    stripLatexComment(line) {
        for (let index = 0; index < line.length; index++) {
            if (line[index] === '%' && !this.isEscaped(line, index)) {
                return line.slice(0, index);
            }
        }
        return line;
    }

    countMathDelimiters(text) {
        let inline = 0;
        let display = 0;
        let inlineLine = null;
        let displayLine = null;
        const lines = text.replace(/\r\n?/g, '\n').split('\n');

        lines.forEach((rawLine, lineIndex) => {
            const line = this.stripLatexComment(rawLine);
            const lineNumber = lineIndex + 1;

            for (let index = 0; index < line.length; index++) {
                if (line[index] !== '$' || this.isEscaped(line, index)) continue;

                if (line[index + 1] === '$') {
                    display++;
                    displayLine = lineNumber;
                    index++;
                } else {
                    inline++;
                    inlineLine = lineNumber;
                }
            }
        });

        return { inline, display, inlineLine, displayLine };
    }

    countDelimitedPair(text, openToken, closeToken) {
        let open = 0;
        let close = 0;
        let balance = 0;
        let firstOpenLine = null;
        let unexpectedCloseLine = null;
        let lastTokenLine = null;
        const lines = text.replace(/\r\n?/g, '\n').split('\n');

        lines.forEach((rawLine, lineIndex) => {
            const line = this.stripLatexComment(rawLine);
            const lineNumber = lineIndex + 1;
            let index = 0;

            while (index < line.length) {
                const nextOpen = line.indexOf(openToken, index);
                const nextClose = line.indexOf(closeToken, index);
                const hasOpen = nextOpen !== -1;
                const hasClose = nextClose !== -1;

                if (!hasOpen && !hasClose) break;

                if (hasOpen && (!hasClose || nextOpen < nextClose)) {
                    if (!this.isEscaped(line, nextOpen)) {
                        open++;
                        balance++;
                        firstOpenLine ??= lineNumber;
                        lastTokenLine = lineNumber;
                    }
                    index = nextOpen + openToken.length;
                } else {
                    if (!this.isEscaped(line, nextClose)) {
                        close++;
                        lastTokenLine = lineNumber;
                        if (balance === 0) {
                            unexpectedCloseLine ??= lineNumber;
                        } else {
                            balance--;
                            if (balance === 0) firstOpenLine = null;
                        }
                    }
                    index = nextClose + closeToken.length;
                }
            }
        });

        return {
            open,
            close,
            line: unexpectedCloseLine || firstOpenLine || lastTokenLine
        };
    }

    countUnescapedToken(text, token) {
        let count = 0;
        let index = text.indexOf(token);

        while (index !== -1) {
            if (!this.isEscaped(text, index)) {
                count++;
            }
            index = text.indexOf(token, index + token.length);
        }

        return count;
    }

    isEscaped(text, index) {
        let backslashes = 0;
        for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor--) {
            backslashes++;
        }
        return backslashes % 2 === 1;
    }

    uniqueIssues(issues) {
        const seen = new Set();
        return issues.filter((issue) => {
            const key = `${issue.severity}|${issue.line}|${issue.message}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    renderDiagnostics(issues) {
        if (!this.diagnosticsEl) return;

        this.diagnosticsEl.replaceChildren();
        this.diagnosticsEl.className = 'diagnostics empty';

        if (!issues.length) return;

        const hasError = issues.some((issue) => issue.severity === 'error');
        this.diagnosticsEl.className = `diagnostics ${hasError ? 'has-error' : 'has-warning'}`;

        const list = document.createElement('ul');
        issues.forEach((issue) => {
            const item = document.createElement('li');
            item.className = issue.severity;

            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = issue.severity.toUpperCase();

            const text = document.createElement('span');
            text.textContent = `Line ${issue.line}: ${issue.message}`;

            item.append(badge, text);
            list.appendChild(item);
        });

        this.diagnosticsEl.appendChild(list);
        const first = issues.find((issue) => issue.severity === 'error') || issues[0];
        this.announce(`${issues.length} diagnostic${issues.length === 1 ? '' : 's'}. First: ${first.message}`);
    }

    clearDiagnostics() {
        if (!this.diagnosticsEl) return;
        this.diagnosticsEl.replaceChildren();
        this.diagnosticsEl.className = 'diagnostics empty';
    }

    showPlaceholder() {
        this.clearTypeset();

        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder';

        const icon = document.createElement('i');
        icon.className = 'fa fa-code';
        icon.setAttribute('aria-hidden', 'true');

        const text = document.createElement('p');
        text.textContent = 'Your rendered LaTeX will appear here';

        placeholder.append(icon, text);
        this.output.replaceChildren(placeholder);
        this.attachDrawingLayer();
        this.setStatus('Ready', 'ready');
        this.output.removeAttribute('aria-busy');
    }

    updateCharCount() {
        const count = this.input.value.length;
        const lines = this.input.value.split('\n').length;
        this.charCount.textContent = `${count} character${count === 1 ? '' : 's'} · ${lines} line${lines === 1 ? '' : 's'}`;
    }

    updateLineNumbers() {
        if (!this.lineNumbers) return;

        const fragment = document.createDocumentFragment();
        const lines = Math.max(1, this.input.value.split('\n').length);
        for (let index = 1; index <= lines; index++) {
            const line = document.createElement('div');
            line.textContent = index;
            fragment.appendChild(line);
        }

        this.lineNumbers.replaceChildren(fragment);
        this.syncScroll();
    }

    setStatus(message, type = 'ready') {
        this.status.className = `status ${type}`;
        this.status.replaceChildren();

        if (type === 'rendering') {
            const spinner = document.createElement('span');
            spinner.className = 'loading';
            spinner.setAttribute('aria-hidden', 'true');
            this.status.append(spinner, document.createTextNode(` ${message}`));
            return;
        }

        this.status.textContent = message;
    }

    clearContent() {
        if (!confirm('Clear the editor and drawings?')) return;

        this.input.value = '';
        this.updateCharCount();
        this.updateLineNumbers();
        this.clearDiagnostics();
        this.showPlaceholder();
        this.removeURLContentParam();
        this.saveState();
        this.clearDrawing(true);
        this.announce('Cleared content and drawings');
        this.input.focus();
    }

    removeURLContentParam() {
        try {
            const url = new URL(location.href);
            if (url.searchParams.has('c')) {
                url.searchParams.delete('c');
                history.replaceState(null, '', url.toString());
            }
        } catch (_) {
            // No URL state to clean up.
        }
    }

    loadExample() {
        const examples = [
            `Welcome to LaTeX Renderer!\n\nInline math: The famous equation is $E = mc^2$.\n\nDisplay math:\n$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$\n\nFractions and powers:\n$$\\frac{a^2 + b^2}{c^2} = \\frac{\\sqrt{x + y}}{\\log(z)}$$`,
            `Advanced Mathematics\n\nGreek letters: $\\alpha, \\beta, \\gamma, \\delta, \\epsilon$\n\nSummation and limits:\n$$\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$$\n\nMatrix example:\n$$\\begin{pmatrix}\na & b \\\\\nc & d\n\\end{pmatrix}\n\\begin{pmatrix}\nx \\\\\ny\n\\end{pmatrix} =\n\\begin{pmatrix}\nax + by \\\\\ncx + dy\n\\end{pmatrix}$$`,
            `Complex Expressions\n\nDerivatives and integrals:\n$$\\frac{d}{dx}\\int_a^x f(t)dt = f(x)$$\n\nBinomial theorem:\n$$(x + y)^n = \\sum_{k=0}^{n} \\binom{n}{k} x^{n-k} y^k$$\n\nSet theory:\n$$A \\cup B = \\{x : x \\in A \\text{ or } x \\in B\\}$$`
        ];

        this.input.value = examples[Math.floor(Math.random() * examples.length)];
        this.handleInputChange();
        this.renderLatex();
        this.input.focus();
        this.announce('Loaded example');
    }

    copyToClipboard() {
        this.copyText(this.input.value)
            .then(() => {
                this.flashButton(this.copyBtn, 'fa fa-check', 'Copied');
                this.setStatus('Copied source', 'success');
                this.announce('Copied to clipboard');
            })
            .catch(() => {
                this.setStatus('Copy failed', 'error');
                this.announce('Copy failed');
            });
    }

    downloadTex() {
        const content = this.input.value;
        if (!content.trim()) {
            this.setStatus('Nothing to download', 'warning');
            return;
        }

        const blob = new Blob([content], { type: 'application/x-tex' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'latex-render.tex';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        this.setStatus('Downloaded .tex', 'success');
        this.announce('Downloaded .tex');
    }

    insertAtCursor(text) {
        const start = this.input.selectionStart;
        const end = this.input.selectionEnd;
        this.input.setRangeText(text, start, end, 'end');
        this.input.focus();
        this.handleInputChange();
    }

    wrapSelection(prefix, suffix) {
        const start = this.input.selectionStart;
        const end = this.input.selectionEnd;
        const selected = this.input.value.substring(start, end);
        const replacement = `${prefix}${selected}${suffix}`;

        this.input.setRangeText(replacement, start, end, 'end');
        const selectionStart = start + prefix.length;
        const selectionEnd = selectionStart + selected.length;
        this.input.setSelectionRange(selectionStart, selectionEnd);
        this.input.focus();
        this.handleInputChange();
        this.announce(selected ? 'Wrapped selection' : 'Inserted delimiters');
    }

    generateShareLink() {
        const content = this.input.value;
        if (!content.trim()) {
            this.setStatus('Nothing to share', 'warning');
            return;
        }

        const url = new URL(location.href);
        url.searchParams.set('c', this.encodeContentForURL(content));
        url.hash = '';

        this.copyText(url.toString())
            .then(() => {
                this.flashButton(this.shareBtn, 'fa fa-check', 'Copied');
                this.setStatus('Share link copied', 'success');
                this.announce('Share link copied');
            })
            .catch(() => {
                window.prompt('Copy this share link:', url.toString());
                this.setStatus('Share link ready', 'warning');
            });
    }

    encodeContentForURL(value) {
        const bytes = new TextEncoder().encode(value);
        let binary = '';
        const chunkSize = 0x8000;

        for (let index = 0; index < bytes.length; index += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
        }

        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }

    decodeContentFromURL(value) {
        try {
            const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
            const padded = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '=');
            const binary = atob(padded);
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
            return new TextDecoder().decode(bytes);
        } catch (_) {
            try {
                return decodeURIComponent(escape(atob(value)));
            } catch (__) {
                return '';
            }
        }
    }

    copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }

        return new Promise((resolve, reject) => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.top = '-1000px';
            document.body.appendChild(textarea);
            textarea.select();

            try {
                document.execCommand('copy') ? resolve() : reject(new Error('execCommand copy failed'));
            } catch (error) {
                reject(error);
            } finally {
                textarea.remove();
            }
        });
    }

    flashButton(button, iconClass, label) {
        if (!button) return;
        const originalNodes = [...button.childNodes].map((node) => node.cloneNode(true));
        const icon = document.createElement('i');
        icon.className = iconClass;
        const text = document.createElement('span');
        text.textContent = label;

        button.replaceChildren(icon, text);
        button.classList.add('is-success');
        setTimeout(() => {
            button.replaceChildren(...originalNodes);
            button.classList.remove('is-success');
        }, 1600);
    }

    restoreState() {
        const params = new URLSearchParams(location.search);
        const encodedContent = params.get('c');
        if (encodedContent) {
            const decoded = this.decodeContentFromURL(encodedContent);
            if (decoded) {
                this.input.value = decoded;
                return;
            }
        }

        try {
            const saved = localStorage.getItem(this.storageKey) || localStorage.getItem(this.legacyStorageKey);
            if (saved) {
                this.input.value = saved;
            }
        } catch (_) {
            // Local storage can be unavailable in private browsing contexts.
        }
    }

    saveState() {
        try {
            localStorage.setItem(this.storageKey, this.input.value);
        } catch (_) {
            // Autosave should not interrupt editing.
        }
    }

    initResizing() {
        if (!this.divider || !this.splitContainer) return;

        const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
        const applySplit = () => {
            const first = Math.max(0.2, Math.min(0.8, this.splitRatio));
            const second = 1 - first;
            if (isMobile()) {
                this.splitContainer.style.gridTemplateColumns = '';
                this.splitContainer.style.gridTemplateRows = `${first}fr 6px ${second}fr`;
            } else {
                this.splitContainer.style.gridTemplateRows = '';
                this.splitContainer.style.gridTemplateColumns = `${first}fr 6px ${second}fr`;
            }
        };

        const setRatio = (ratio) => {
            this.splitRatio = Math.max(0.2, Math.min(0.8, ratio));
            applySplit();
        };

        let dragging = false;
        let activePointer = null;

        this.divider.addEventListener('pointerdown', (event) => {
            dragging = true;
            activePointer = event.pointerId;
            this.divider.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        });

        window.addEventListener('pointermove', (event) => {
            if (!dragging) return;
            const rect = this.splitContainer.getBoundingClientRect();
            const ratio = isMobile()
                ? (event.clientY - rect.top) / rect.height
                : (event.clientX - rect.left) / rect.width;
            setRatio(ratio);
        });

        window.addEventListener('pointerup', () => {
            if (!dragging) return;
            dragging = false;
            if (activePointer !== null) {
                this.divider.releasePointerCapture?.(activePointer);
            }
            activePointer = null;
            this.announce('Panels resized');
        });

        this.divider.addEventListener('keydown', (event) => {
            const horizontalKey = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
            const verticalKey = event.key === 'ArrowUp' || event.key === 'ArrowDown';
            if (!horizontalKey && !verticalKey && event.key !== 'Home' && event.key !== 'End') return;

            event.preventDefault();
            if (event.key === 'Home') {
                setRatio(0.2);
            } else if (event.key === 'End') {
                setRatio(0.8);
            } else {
                const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -0.05 : 0.05;
                setRatio(this.splitRatio + direction);
            }
            this.announce('Panels resized');
        });

        this.divider.addEventListener('dblclick', () => {
            setRatio(0.5);
            this.announce('Panels reset');
        });

        window.addEventListener('resize', applySplit);
        applySplit();
    }

    announce(message) {
        if (this.srStatus) {
            this.srStatus.textContent = message;
        }
    }

    handleKeyboardShortcuts(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            this.renderLatex();
            return;
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            this.clearContent();
            return;
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
            event.preventDefault();
            this.wrapSelection('$', '$');
            return;
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm') {
            event.preventDefault();
            this.wrapSelection('$$\n', '\n$$');
            return;
        }

        if (event.key === 'Tab') {
            event.preventDefault();
            const start = this.input.selectionStart;
            const end = this.input.selectionEnd;
            this.input.setRangeText('    ', start, end, 'end');
            this.handleInputChange();
        }
    }

    initQuickReference() {
        if (!this.quickRefList) return;

        this.quickRefItems = [...this.quickRefList.querySelectorAll('.latex-snippet')].map((element) => {
            element.setAttribute('tabindex', '0');
            element.setAttribute('role', 'button');
            element.addEventListener('click', () => this.insertSnippet(element.dataset.snippet));
            element.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.insertSnippet(element.dataset.snippet);
                }
            });

            return {
                element,
                row: element.closest('li'),
                column: element.closest('.help-column'),
                text: element.textContent.toLowerCase()
            };
        });

        this.quickRefFilter?.addEventListener('input', () => this.filterQuickRef());
        this.updateQuickRefCount();
    }

    insertSnippet(snippet) {
        if (!snippet) return;

        const decoded = snippet.replace(/&amp;/g, '&');
        const trimmed = decoded.trim();
        const isEnvironment = /^\\begin\{/.test(trimmed);
        const isDelimited = /\$|\\\[|\\\]/.test(trimmed);
        const shouldWrapInline = !isEnvironment && !isDelimited;
        const finalSnippet = shouldWrapInline ? `$${decoded}$` : decoded;

        this.insertAtCursor(finalSnippet);
        this.announce('Inserted snippet');
    }

    filterQuickRef() {
        if (!this.quickRefItems) return;

        const query = (this.quickRefFilter.value || '').trim().toLowerCase();
        let visibleCount = 0;

        this.quickRefItems.forEach((item) => {
            const visible = !query || item.text.includes(query);
            item.row?.classList.toggle('hidden', !visible);
            if (visible) visibleCount++;
        });

        [...this.quickRefList.querySelectorAll('.help-column')].forEach((column) => {
            const hasVisibleSnippet = [...column.querySelectorAll('li')].some((row) => !row.classList.contains('hidden'));
            column.classList.toggle('hidden', !hasVisibleSnippet);
        });

        this.updateQuickRefCount(visibleCount);
    }

    updateQuickRefCount(count) {
        if (!this.quickRefCount) return;

        const total = count === undefined
            ? this.quickRefList.querySelectorAll('.latex-snippet').length
            : count;
        const suffix = this.quickRefFilter?.value ? ' match' : '';
        this.quickRefCount.textContent = `${total} snippet${total === 1 ? '' : 's'}${suffix}`;
    }

    initDrawingLayer() {
        this.drawingMode = null;
        this.isDrawing = false;
        this.activeCtx = null;
        this.drawingWrapper = document.createElement('div');
        this.drawingWrapper.className = 'drawing-canvas-wrapper';

        this.highlightCanvas = document.createElement('canvas');
        this.highlightCanvas.className = 'drawing-canvas highlight-layer';
        this.penCanvas = document.createElement('canvas');
        this.penCanvas.className = 'drawing-canvas pen-layer';
        this.highlightMaskCanvas = document.createElement('canvas');

        this.highlightMaskCtx = this.highlightMaskCanvas.getContext('2d');
        this.highlightCtx = this.highlightCanvas.getContext('2d');
        this.penCtx = this.penCanvas.getContext('2d');

        this.drawingWrapper.append(this.highlightCanvas, this.penCanvas);
        this.attachDrawingLayer();

        this.resizeDrawingCanvas = () => {
            if (!this.output || !this.highlightCanvas || !this.penCanvas) return;

            const width = Math.max(1, this.output.clientWidth);
            const height = Math.max(1, this.output.scrollHeight);
            const previousMask = document.createElement('canvas');
            previousMask.width = this.highlightMaskCanvas.width;
            previousMask.height = this.highlightMaskCanvas.height;

            if (previousMask.width && previousMask.height) {
                previousMask.getContext('2d').drawImage(this.highlightMaskCanvas, 0, 0);
            }

            [this.highlightCanvas, this.penCanvas, this.highlightMaskCanvas].forEach((canvas) => {
                if (canvas.width !== width) canvas.width = width;
                if (canvas.height !== height) canvas.height = height;
                canvas.style.width = `${width}px`;
                canvas.style.height = `${height}px`;
            });

            if (previousMask.width && previousMask.height) {
                this.highlightMaskCtx.drawImage(previousMask, 0, 0, width, height);
                this.renderHighlightTint();
            }
        };

        if (window.ResizeObserver) {
            new ResizeObserver(() => this.resizeDrawingCanvas()).observe(this.output);
        }
        window.addEventListener('resize', () => this.resizeDrawingCanvas());

        const start = (event) => {
            if (!this.drawingMode) return;
            this.isDrawing = true;
            const { x, y } = this.getPointerPos(event);

            if (this.drawingMode === 'eraser') {
                this.eraserTargets = [this.penCtx, this.highlightMaskCtx];
                this.eraserTargets.forEach((ctx) => {
                    ctx.save();
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 30;
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                });
            } else {
                const ctx = this.drawingMode === 'highlight' ? this.highlightMaskCtx : this.penCtx;
                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalCompositeOperation = 'source-over';

                if (this.drawingMode === 'highlight') {
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 18;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                } else {
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = this.drawColorInput?.value || '#e11d48';
                    ctx.lineWidth = 2.5;
                    this.penPoints = [{ x, y }];
                }

                this.activeCtx = ctx;
            }

            event.preventDefault();
        };

        const move = (event) => {
            if (!this.isDrawing) return;
            const { x, y } = this.getPointerPos(event);

            if (this.drawingMode === 'pen') {
                this.penPoints.push({ x, y });
                const points = this.penPoints;
                const count = points.length;

                if (count === 2) {
                    this.penCtx.beginPath();
                    this.penCtx.moveTo(points[0].x, points[0].y);
                    this.penCtx.lineTo(points[1].x, points[1].y);
                    this.penCtx.stroke();
                } else if (count >= 3) {
                    const p0 = points[count - 3];
                    const p1 = points[count - 2];
                    const p2 = points[count - 1];
                    const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
                    const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                    this.penCtx.beginPath();
                    this.penCtx.moveTo(mid1.x, mid1.y);
                    this.penCtx.quadraticCurveTo(p1.x, p1.y, mid2.x, mid2.y);
                    this.penCtx.stroke();
                }
            } else if (this.drawingMode === 'eraser') {
                (this.eraserTargets || []).forEach((ctx) => {
                    ctx.lineTo(x, y);
                    ctx.stroke();
                });
                this.renderHighlightTint();
            } else if (this.drawingMode === 'highlight') {
                this.activeCtx.lineTo(x, y);
                this.activeCtx.stroke();
                this.renderHighlightTint();
            }

            event.preventDefault();
        };

        const end = () => {
            if (!this.isDrawing) return;

            if (this.drawingMode === 'pen' && this.penPoints && this.penPoints.length >= 2) {
                const points = this.penPoints;
                const last = points[points.length - 1];
                const previous = points[points.length - 2];
                this.penCtx.beginPath();
                this.penCtx.moveTo(previous.x, previous.y);
                this.penCtx.lineTo(last.x, last.y);
                this.penCtx.stroke();
            }

            if (this.drawingMode === 'eraser') {
                (this.eraserTargets || []).forEach((ctx) => {
                    try {
                        ctx.closePath();
                        ctx.restore();
                    } catch (_) {}
                });
                this.eraserTargets = null;
                this.renderHighlightTint();
            } else if (this.activeCtx) {
                try {
                    this.activeCtx.closePath();
                    this.activeCtx.restore();
                } catch (_) {}
                this.renderHighlightTint();
            }

            this.isDrawing = false;
            this.activeCtx = null;
            this.penPoints = null;
        };

        [this.highlightCanvas, this.penCanvas].forEach((canvas) => {
            canvas.addEventListener('pointerdown', start);
            canvas.addEventListener('pointermove', move);
            canvas.addEventListener('pointerup', end);
            canvas.addEventListener('pointercancel', end);
            canvas.addEventListener('pointerleave', end);
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.drawingMode) {
                this.toggleDrawingMode(null);
            }
        });

        this.resizeDrawingCanvas();
    }

    attachDrawingLayer() {
        if (!this.output || !this.drawingWrapper) return;
        if (this.drawingWrapper.parentNode !== this.output) {
            this.output.appendChild(this.drawingWrapper);
        }
        this.resizeDrawingCanvas?.();
    }

    getPointerPos(event) {
        const rect = this.output.getBoundingClientRect();
        const point = event.touches?.[0] || event;

        return {
            x: point.clientX - rect.left + this.output.scrollLeft,
            y: point.clientY - rect.top + this.output.scrollTop
        };
    }

    toggleDrawingMode(mode) {
        if (this.drawingMode === mode) {
            mode = null;
        }

        this.drawingMode = mode;
        const active = Boolean(mode);
        this.output.classList.toggle('drawing-active', active);
        this.output.classList.toggle('drawing-layer-active', active);

        [
            [this.penBtn, 'pen'],
            [this.highlightBtn, 'highlight'],
            [this.eraserBtn, 'eraser']
        ].forEach(([button, name]) => {
            const isActive = this.drawingMode === name;
            button?.classList.toggle('active', isActive);
            button?.setAttribute('aria-pressed', String(isActive));
        });

        this.announce(this.drawingMode ? `${this.drawingMode} mode enabled` : 'Drawing mode off');
    }

    clearDrawing(silent) {
        if (!this.highlightCtx || !this.penCtx) return;

        this.highlightCtx.clearRect(0, 0, this.highlightCanvas.width, this.highlightCanvas.height);
        this.highlightMaskCtx.clearRect(0, 0, this.highlightMaskCanvas.width, this.highlightMaskCanvas.height);
        this.penCtx.clearRect(0, 0, this.penCanvas.width, this.penCanvas.height);

        if (!silent) {
            this.setStatus('Drawing cleared', 'success');
            this.announce('Cleared drawing layer');
        }
    }

    renderHighlightTint() {
        if (!this.highlightCtx || !this.highlightMaskCanvas) return;

        const width = this.highlightCanvas.width;
        const height = this.highlightCanvas.height;
        const color = this.drawColorInput?.value || '#f5c542';

        this.highlightCtx.clearRect(0, 0, width, height);
        this.highlightCtx.drawImage(this.highlightMaskCanvas, 0, 0);
        this.highlightCtx.globalCompositeOperation = 'source-in';
        this.highlightCtx.globalAlpha = 0.28;
        this.highlightCtx.fillStyle = color;
        this.highlightCtx.fillRect(0, 0, width, height);
        this.highlightCtx.globalCompositeOperation = 'source-over';
        this.highlightCtx.globalAlpha = 1;
    }

    toggleFullscreen() {
        const element = this.previewPanel || this.output;
        if (!document.fullscreenElement) {
            element.requestFullscreen?.();
            this.announce('Entered fullscreen');
        } else {
            document.exitFullscreen?.();
            this.announce('Exited fullscreen');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new LatexRenderer());

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LatexRenderer;
}
