// Enhanced LaTeX Renderer App with advanced features
class LatexRenderer {
    constructor() {
        // Core elements
        this.input = document.getElementById('latex-input');
        this.output = document.getElementById('latex-output');
        this.charCount = document.getElementById('char-count');
        this.status = document.getElementById('render-status');
        this.lineNumbers = document.getElementById('line-numbers');
        this.srStatus = document.getElementById('sr-status');
        this.diagnosticsEl = document.getElementById('diagnostics');

        // Toolbar controls
        this.clearBtn = document.getElementById('clear-btn');
        this.exampleBtn = document.getElementById('example-btn');
        this.copyBtn = document.getElementById('copy-btn');
        this.fullscreenBtn = document.getElementById('fullscreen-btn');
        this.snippetSelect = document.getElementById('snippet-select');
        this.wrapInlineBtn = document.getElementById('wrap-inline-btn');
        this.wrapDisplayBtn = document.getElementById('wrap-display-btn');
        this.downloadBtn = document.getElementById('download-btn');
        this.shareBtn = document.getElementById('share-btn');
        // Drawing controls
        this.penBtn = document.getElementById('pen-btn');
        this.highlightBtn = document.getElementById('highlight-btn');
        this.eraserBtn = document.getElementById('eraser-btn');
        this.drawColorInput = document.getElementById('draw-color');
        // Quick reference elements
        this.quickRefFilter = document.getElementById('quick-ref-filter');
        this.quickRefList = document.getElementById('quick-ref-list');
        this.quickRefCount = document.getElementById('quick-ref-count');

        // Layout elements
        this.splitContainer = document.getElementById('split-container');
        this.editorPanel = document.getElementById('editor-panel');
        this.previewPanel = document.getElementById('preview-panel');
        this.divider = document.getElementById('divider');

        // State
        this.isRendering = false;
        this.renderTimeout = null;
        this.saveTimeout = null;
        this.storageKey = 'latex_renderer_content_v1';
        this.initializedFromURL = false;

        this.init();
    }

    init() {
        this.restoreState();
        this.setupEventListeners();
        this.updateCharCount();
        this.updateLineNumbers();
        this.setStatus('Ready', 'ready');
        if (this.input.value.trim() === '') this.showPlaceholder();
        else this.renderLatex();
    }

    setupEventListeners() {
        // Input updates
        this.input.addEventListener('input', () => {
            this.updateCharCount();
            this.updateLineNumbers();
            this.debounceRender();
            this.debounceSave();
        });
        this.input.addEventListener('paste', () => setTimeout(() => {
            this.updateCharCount();
            this.updateLineNumbers();
            this.debounceRender();
            this.debounceSave();
        }, 10));
        this.input.addEventListener('scroll', () => {
            this.syncScroll();
        });

        // Keyboard shortcuts
        this.input.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        // Toolbar actions
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
                this.insertAtCursor(this.snippetSelect.value);
                this.snippetSelect.selectedIndex = 0;
                this.debounceRender();
            }
        });

        // Drawing events
        if (this.penBtn) this.penBtn.addEventListener('click', () => this.toggleDrawingMode('pen'));
        if (this.highlightBtn) this.highlightBtn.addEventListener('click', () => this.toggleDrawingMode('highlight'));
        if (this.eraserBtn) this.eraserBtn.addEventListener('click', () => this.toggleDrawingMode('eraser'));

        // Resizing
        this.initResizing();
        this.initQuickReference();
        this.initDrawingLayer();
    }

    syncScroll() {
        if (!this.lineNumbers) return;
        this.lineNumbers.scrollTop = this.input.scrollTop;
    }

    debounceRender() {
        clearTimeout(this.renderTimeout);
        this.renderTimeout = setTimeout(() => this.renderLatex(), 250);
    }
    debounceSave() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => this.saveState(), 500);
    }

    renderLatex() {
        const inputText = this.input.value.trim();
        if (!inputText) {
            this.showPlaceholder();
            return;
        }
        // Clear previous diagnostics before new validation/render cycle
        this.clearDiagnostics();
        this.setStatus('Rendering...', 'rendering');
        this.isRendering = true;
        // Validate before rendering
        const issues = this.validateLatex(this.input.value);
        this.renderDiagnostics(issues);
        this.output.innerHTML = this.processLatexContent(inputText);
        // Reattach drawing layer after content refresh
        if (this.drawingWrapper) {
            this.output.appendChild(this.drawingWrapper);
            this.resizeDrawingCanvas();
        }
        this.updateURLState(inputText);
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([this.output])
                .then(() => {
                    this.setStatus('Rendered successfully', 'success');
                    this.isRendering = false;
                })
                .catch(err => {
                    console.error(err);
                    this.setStatus('Rendering error', 'error');
                    this.isRendering = false;
                });
        } else {
            setTimeout(() => {
                this.setStatus('Rendered (MathJax not loaded)', 'error');
                this.isRendering = false;
            }, 100);
        }
    }

    processLatexContent(content) {
        // 1. Squash multi-line $$...$$ blocks into single-line display math
        const squashed = content.replace(/\$\$([\s\S]*?)\$\$/g, (m, inner) => {
            // Preserve internal double backslashes for line breaks inside matrix environments; just remove raw newlines
            const cleaned = inner.replace(/\r?\n+/g, ' ').trim();
            return `$$${cleaned}$$`;
        });
        // 2. Map each line to simple HTML wrappers (unchanged logic from earlier version)
        return squashed.split('\n').map(line => {
            if (!line.trim()) return '<br>';
            if (line.includes('$$')) return `<div class="display-math">${line}</div>`;
            if (this.isLatexEnvironment(line)) return `<div class="latex-environment">${line}</div>`;
            return `<p>${line}</p>`;
        }).join('\n');
    }

    validateLatex(text) {
        const issues = [];
        const lines = text.split('\n');
        const stack = []; // for environments
        const envRegex = /\\(begin|end)\{([^}]+)\}/g;
        const braceMap = {
            '(': ')',
            '[': ']',
            '{': '}'
        };
        const openers = new Set(Object.keys(braceMap));

        lines.forEach((rawLine, idx) => {
            const line = rawLine; // keep formatting
            // Skip commented lines entirely
            if (line.trim().startsWith('%')) return;

            // Basic brace / bracket / parenthesis balance (ignoring math mode dollars for now)
            const stackChars = [];
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (openers.has(ch)) stackChars.push(ch);
                else if (Object.values(braceMap).includes(ch)) {
                    const last = stackChars.pop();
                    if (!last || braceMap[last] !== ch) {
                        issues.push({
                            severity: 'error',
                            line: idx + 1,
                            message: `Mismatched '${ch}'`
                        });
                    }
                }
            }
            if (stackChars.length) {
                stackChars.forEach(o => issues.push({
                    severity: 'warning',
                    line: idx + 1,
                    message: `Unclosed '${o}' on this line`
                }));
            }

            // Environment tracking
            envRegex.lastIndex = 0;
            let m;
            while ((m = envRegex.exec(line))) {
                const type = m[1];
                const env = m[2];
                if (type === 'begin') stack.push({
                    env,
                    line: idx + 1
                });
                else { // end
                    const last = stack.pop();
                    if (!last || last.env !== env) {
                        issues.push({
                            severity: 'error',
                            line: idx + 1,
                            message: `Unexpected \\end{${env}}`
                        });
                    }
                }
            }

            // Dollar sign pairing (simple) skip escaped \$ and $$ blocks
            const sanitized = line.replace(/\\\$/g, '');
            const doubleRemoved = sanitized.replace(/\$\$[^$]*\$\$/g, '');
            const singles = (doubleRemoved.match(/\$/g) || []).length;
            if (singles % 2 !== 0) {
                issues.push({
                    severity: 'warning',
                    line: idx + 1,
                    message: 'Unpaired $ delimiter'
                });
            }
        });

        // Any remaining unclosed environments
        stack.reverse().forEach(fr => issues.push({
            severity: 'warning',
            line: fr.line,
            message: `Environment '${fr.env}' opened here not closed`
        }));

        // Global unmatched display math $$ count
        const allDouble = (text.replace(/\\\$/g, '').match(/\$\$/g) || []).length;
        if (allDouble % 2 !== 0) {
            issues.push({
                severity: 'error',
                line: '-',
                message: 'Unpaired $$ display math delimiter'
            });
        }

        return issues;
    }

    renderDiagnostics(issues) {
        if (!this.diagnosticsEl) return;
        // De-duplicate issues (line + message)
        const seen = new Set();
        const unique = [];
        for (const i of issues) {
            const key = `${i.line}|${i.message}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(i);
            }
        }
        if (!unique.length) {
            this.clearDiagnostics();
            return;
        }
        this.diagnosticsEl.classList.remove('empty');
        const items = unique.map(i => `<li class="${i.severity}"><span class="badge">${i.severity.toUpperCase()}</span><span>Line ${i.line}: ${i.message}</span></li>`).join('');
        this.diagnosticsEl.innerHTML = `<ul>${items}</ul>`;
        const mostSevere = issues.find(i => i.severity === 'error') || issues[0];
        this.announce(`${issues.length} issues detected. First: ${mostSevere.message}`);
    }

    clearDiagnostics() {
        if (!this.diagnosticsEl) return;
        this.diagnosticsEl.innerHTML = '';
        this.diagnosticsEl.classList.add('empty');
    }

    isLatexEnvironment(line) {
        return ['\\begin{', '\\end{', '\\[', '\\]', '\\align', '\\equation', '\\matrix', '\\pmatrix', '\\bmatrix', '\\vmatrix', '\\cases']
            .some(env => line.trim().startsWith(env));
    }

    showPlaceholder() {
        this.output.innerHTML = `<div class="placeholder"><i class="fa fa-code"></i><p>Your rendered LaTeX will appear here</p></div>`;
        this.setStatus('Ready', 'ready');
    }
    updateCharCount() {
        const c = this.input.value.length;
        this.charCount.textContent = `${c} character${c !== 1 ? 's' : ''}`;
    }
    updateLineNumbers() {
        if (!this.lineNumbers) return;
        const lines = this.input.value.split('\n').length;
        this.lineNumbers.innerHTML = Array.from({
            length: lines
        }, () => '<div></div>').join('');
        this.syncScroll();
    }
    setStatus(msg, type = 'ready') {
        this.status.textContent = msg;
        this.status.className = `status ${type}`;
        if (type === 'rendering') this.status.innerHTML = `<span class="loading"></span> ${msg}`;
    }

    clearContent() {
        if (confirm('Clear all content (including drawings)?')) {
            this.input.value = '';
            this.updateCharCount();
            this.updateLineNumbers();
            this.showPlaceholder();
            // Remove share/compressed content param from URL so refresh stays empty
            this.removeURLContentParam();
            // Allow subsequent edits to start updating URL again
            this.initializedFromURL = false;
            this.saveState();
            this.clearDrawing(true);
            this.announce('Cleared content, drawings, and URL parameter');
        }
    }

    removeURLContentParam() {
        try {
            const url = new URL(location.href);
            if (url.searchParams.has('c')) {
                url.searchParams.delete('c');
                history.replaceState(null, '', url.toString());
            }
        } catch (_) {
            /* noop */
        }
    }

    loadExample() {
        const examples = [
            `Welcome to LaTeX Renderer!\n\nInline math: The famous equation is $E = mc^2$.\n\nDisplay math:\n$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$\n\nFractions and powers:\n$$\\frac{a^2 + b^2}{c^2} = \\frac{\\sqrt{x + y}}{\\log(z)}$$`,
            `Advanced Mathematics\n\nGreek letters: $\\alpha, \\beta, \\gamma, \\delta, \\epsilon$\n\nSummation and limits:\n$$\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$$\n\nMatrix example:\n$$\\begin{pmatrix} \na & b \\\\ \nc & d \n\\end{pmatrix}\n\\begin{pmatrix} \nx \\\\ \ny \n\\end{pmatrix} = \n\\begin{pmatrix} \nax + by \\\\ \ncx + dy \n\\end{pmatrix}$$`,
            `Complex Expressions\n\nDerivatives and integrals:\n$$\\frac{d}{dx}\\int_a^x f(t)dt = f(x)$$\n\nBinomial theorem:\n$$(x + y)^n = \\sum_{k=0}^{n} \\binom{n}{k} x^{n-k} y^k$$\n\nSet theory:\n$$A \\cup B = \\{x : x \\in A \\text{ or } x \\in B\\}$$`
        ];
        this.input.value = examples[Math.floor(Math.random() * examples.length)];
        this.updateCharCount();
        this.updateLineNumbers();
        this.renderLatex();
        this.input.focus();
        this.debounceSave();
        this.announce('Loaded example');
    }

    copyToClipboard() {
        navigator.clipboard.writeText(this.input.value).then(() => {
            const original = this.copyBtn.innerHTML;
            this.copyBtn.innerHTML = '<i class="fa fa-check"></i> Copied!';
            this.copyBtn.style.background = '#28a745';
            setTimeout(() => {
                this.copyBtn.innerHTML = original;
                this.copyBtn.style.background = '';
            }, 2000);
            this.announce('Copied to clipboard');
        }).catch(err => {
            console.error(err);
            alert('Failed to copy');
        });
    }

    downloadTex() {
        const blob = new Blob([this.input.value], {
            type: 'application/x-tex'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'document.tex';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.announce('Downloaded .tex');
    }
    insertAtCursor(text) {
        const s = this.input.selectionStart,
            e = this.input.selectionEnd;
        this.input.setRangeText(text, s, e, 'end');
        this.updateCharCount();
        this.updateLineNumbers();
    }
    wrapSelection(pre, suf) {
        const s = this.input.selectionStart,
            e = this.input.selectionEnd;
        const sel = this.input.value.substring(s, e);
        this.input.setRangeText(pre + sel + suf, s, e, 'select');
        this.updateCharCount();
        this.updateLineNumbers();
        this.debounceRender();
        this.announce('Wrapped selection');
    }

    generateShareLink() {
        const content = this.input.value;
        if (!content.trim()) {
            alert('Nothing to share');
            return;
        }
        const compressed = this.compressToBase64(content);
        const url = `${location.origin}${location.pathname}?c=${compressed}`;
        navigator.clipboard.writeText(url).then(() => {
            alert('Shareable link copied');
            this.announce('Share link copied');
        });
    }
    compressToBase64(str) {
        try {
            if (window.LZString) return btoa(LZString.compressToUTF16(str));
        } catch (_) {}
        return btoa(unescape(encodeURIComponent(str)));
    }
    decompressFromBase64(b64) {
        try {
            if (window.LZString) return LZString.decompressFromUTF16(atob(b64)) || '';
        } catch (_) {}
        try {
            return decodeURIComponent(escape(atob(b64)));
        } catch {
            return '';
        }
    }
    updateURLState(content) {
        if (!content || this.initializedFromURL) return;
        try {
            const compressed = this.compressToBase64(content).substring(0, 1500);
            const url = new URL(location.href);
            url.searchParams.set('c', compressed);
            history.replaceState(null, '', url.toString());
        } catch (_) {}
    }
    restoreState() {
        const params = new URLSearchParams(location.search);
        const c = params.get('c');
        if (c) {
            const d = this.decompressFromBase64(c);
            if (d) {
                this.input.value = d;
                this.initializedFromURL = true;
                return;
            }
        }
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) this.input.value = saved;
        } catch (_) {}
    }
    saveState() {
        try {
            localStorage.setItem(this.storageKey, this.input.value);
        } catch (_) {}
    }

    initResizing() {
        if (!this.divider) return;
        let dragging = false;
        const start = e => {
            dragging = true;
            e.preventDefault();
        };
        const move = e => {
            if (!dragging) return;
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            const rect = this.splitContainer.getBoundingClientRect();
            if (isMobile) {
                const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
                const ratio = Math.min(.85, Math.max(.15, y / rect.height));
                this.editorPanel.style.order = 0;
                this.previewPanel.style.order = 2;
                this.editorPanel.style.flexBasis = `${ratio*100}%`;
                this.previewPanel.style.flexBasis = `${(1-ratio)*100}%`;
            } else {
                const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
                const ratio = Math.min(.85, Math.max(.15, x / rect.width));
                this.editorPanel.style.flex = `0 0 ${ratio*100}%`;
                this.previewPanel.style.flex = `0 0 ${(1-ratio)*100}%`;
            }
        };
        const stop = () => {
            if (dragging) {
                dragging = false;
                this.announce('Panels resized');
            }
        };
        this.divider.addEventListener('mousedown', start);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', stop);
        this.divider.addEventListener('touchstart', start, {
            passive: true
        });
        window.addEventListener('touchmove', move, {
            passive: true
        });
        window.addEventListener('touchend', stop);
        this.divider.addEventListener('keydown', e => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                const delta = e.key === 'ArrowLeft' ? -5 : 5;
                const current = this.editorPanel.getBoundingClientRect().width / this.splitContainer.getBoundingClientRect().width * 100;
                const next = Math.min(85, Math.max(15, current + delta));
                this.editorPanel.style.flex = `0 0 ${next}%`;
                this.previewPanel.style.flex = `0 0 ${100-next}%`;
                this.announce('Panels resized');
            }
        });
    }

    announce(msg) {
        if (this.srStatus) this.srStatus.textContent = msg;
    }

    handleKeyboardShortcuts(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            this.renderLatex();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            this.clearContent();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            this.wrapSelection('$', '$');
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
            e.preventDefault();
            this.wrapSelection('$$\n', '\n$$');
        }
        if (e.key === 'Tab') {
            e.preventDefault();
            const s = this.input.selectionStart;
            const epos = this.input.selectionEnd;
            this.input.value = this.input.value.substring(0, s) + '    ' + this.input.value.substring(epos);
            this.input.selectionStart = this.input.selectionEnd = s + 4;
            this.updateLineNumbers();
        }
    }

    initQuickReference() {
        if (!this.quickRefList) return;
        // Make each snippet clickable / focusable
        this.quickRefList.querySelectorAll('.latex-snippet').forEach(el => {
            el.setAttribute('tabindex', '0');
            el.addEventListener('click', () => {
                this.insertSnippet(el.dataset.snippet);
            });
            el.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.insertSnippet(el.dataset.snippet);
                }
            });
        });
        if (this.quickRefFilter) {
            this.quickRefFilter.addEventListener('input', () => this.filterQuickRef());
        }
        this.updateQuickRefCount();
    }

    insertSnippet(snippet) {
        if (!snippet) return;
        // Decode minimal HTML entities (&amp;)
        snippet = snippet.replace(/&amp;/g, '&');
        // Replace accidental double backslashes (from HTML attribute escaping) with single
        // Preserve \\ (line breaks) inside environments by temporarily marking them
        const LINE_BREAK_TOKEN = '__BR__TOKEN__';
        snippet = snippet.replace(/\\\\/g, LINE_BREAK_TOKEN); // mark real \\ first
        snippet = snippet.replace(/\\{2,}/g, '\\'); // collapse remaining doubles
        snippet = snippet.replace(new RegExp(LINE_BREAK_TOKEN, 'g'), '\\\\'); // restore
        // Decide if should wrap with $ ... $
        const needsWrap = !/\\begin\{/.test(snippet) && !/\$/.test(snippet) && !/^\s*$/.test(snippet) && snippet.length < 40 && !/\\(sum|int|prod|lim|begin)/.test(snippet) && !snippet.includes('\\\\');
        const finalSnippet = needsWrap ? `$${snippet}$` : snippet;
        this.insertAtCursor(finalSnippet);
        this.debounceRender();
        this.debounceSave();
        this.announce('Inserted snippet');
        this.input.focus();
    }

    filterQuickRef() {
        const q = (this.quickRefFilter.value || '').trim().toLowerCase();
        const cols = [...this.quickRefList.querySelectorAll('.help-column')];
        let visibleSnippets = 0;
        cols.forEach(col => {
            let anyVisible = false;
            col.querySelectorAll('.latex-snippet').forEach(sn => {
                const text = sn.textContent.toLowerCase();
                if (!q || text.includes(q)) {
                    sn.style.display = 'inline-block';
                    anyVisible = true;
                    visibleSnippets++;
                    // simple highlight
                    if (q) {
                        const raw = sn.textContent;
                        const idx = raw.toLowerCase().indexOf(q);
                        if (idx !== -1) {
                            const before = raw.slice(0, idx);
                            const match = raw.slice(idx, idx + q.length);
                            const after = raw.slice(idx + q.length);
                            // Only wrap outside of code tag label part to avoid breaking formatting
                            sn.innerHTML = sn.innerHTML.replace(/<code>[\s\S]*?<\/code>(.*)/, (m, rest) => {
                                return m.replace(rest, before + '<mark>' + match + '</mark>' + after);
                            });
                        }
                    } else {
                        // remove marks
                        sn.innerHTML = sn.innerHTML.replace(/<mark>(.*?)<\/mark>/g, '$1');
                    }
                } else {
                    sn.style.display = 'none';
                }
            });
            col.classList.toggle('hidden', !anyVisible);
        });
        this.updateQuickRefCount(visibleSnippets);
    }

    updateQuickRefCount(count) {
        if (!this.quickRefCount) return;
        if (count === undefined) {
            count = this.quickRefList.querySelectorAll('.latex-snippet').length;
        }
        this.quickRefCount.textContent = `${count} snippet${count===1?'':'s'}${this.quickRefFilter && this.quickRefFilter.value? ' match' : ''}`;
    }
    initDrawingLayer() {
        this.drawingMode = null; // 'pen' | 'highlight' | null
        this.isDrawing = false;
        this.activeCtx = null;
        this.drawingWrapper = document.createElement('div');
        this.drawingWrapper.className = 'drawing-canvas-wrapper';
        // Separate canvases to avoid highlight compounding with pen lines
        this.highlightCanvas = document.createElement('canvas');
        this.highlightCanvas.className = 'drawing-canvas highlight-layer';
        this.penCanvas = document.createElement('canvas');
        this.penCanvas.className = 'drawing-canvas pen-layer';
        // Offscreen mask for highlight to keep constant opacity regardless of overlaps
        this.highlightMaskCanvas = document.createElement('canvas');
        this.highlightMaskCtx = this.highlightMaskCanvas.getContext('2d');
        this.highlightCtx = this.highlightCanvas.getContext('2d');
        this.penCtx = this.penCanvas.getContext('2d');
        this.drawingWrapper.appendChild(this.highlightCanvas);
        this.drawingWrapper.appendChild(this.penCanvas);
        if (this.output) {
            this.output.appendChild(this.drawingWrapper);
        }
        this.resizeDrawingCanvas = () => {
            if (!(this.highlightCanvas && this.penCanvas && this.output)) return;
            // Use clientWidth for visible width (exclude potential scrollbars), scrollHeight for full vertical drawing space
            const w = this.output.clientWidth;
            const h = this.output.scrollHeight; // allow drawing over full rendered content
            // Preserve existing mask by copying before resize
            const oldMask = document.createElement('canvas');
            oldMask.width = this.highlightMaskCanvas.width;
            oldMask.height = this.highlightMaskCanvas.height;
            if (oldMask.width && oldMask.height) {
                oldMask.getContext('2d').drawImage(this.highlightMaskCanvas, 0, 0);
            }
            [this.highlightCanvas, this.penCanvas, this.highlightMaskCanvas].forEach(c => {
                if (c.width !== w) c.width = w;
                if (c.height !== h) c.height = h;
                c.style.width = w + 'px';
                c.style.height = h + 'px';
            });
            // Restore mask content scaled if different size (simple drawImage auto-scales)
            if (oldMask.width && oldMask.height) {
                this.highlightMaskCtx.drawImage(oldMask, 0, 0, w, h);
                this.renderHighlightTint();
            }
        };
        if (window.ResizeObserver) {
            new ResizeObserver(() => this.resizeDrawingCanvas()).observe(this.output);
        }
        window.addEventListener('resize', () => this.resizeDrawingCanvas());
        this.output.addEventListener('scroll', () => {
            /* reserved */
        });
        this.resizeDrawingCanvas();
        const start = (e) => {
            if (!this.drawingMode) return;
            this.isDrawing = true;
            const {
                x,
                y
            } = this.getPointerPos(e);
            if (this.drawingMode === 'eraser') {
                this.eraserTargets = [this.penCtx, this.highlightMaskCtx];
                this.eraserTargets.forEach(c => {
                    c.save();
                    c.lineCap = 'round';
                    c.lineJoin = 'round';
                    c.globalAlpha = 1;
                    c.strokeStyle = '#000';
                    c.lineWidth = 30;
                    c.globalCompositeOperation = 'destination-out';
                    c.beginPath();
                    c.moveTo(x, y);
                });
                this.renderHighlightTint();
                this.activeCtx = this.penCtx;
            } else {
                const ctx = this.drawingMode === 'highlight' ? this.highlightMaskCtx : this.penCtx;
                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                const size = 2;
                if (this.drawingMode === 'highlight') {
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 14;
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    this.renderHighlightTint();
                } else {
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = this.drawColorInput?.value || '#ff0000';
                    ctx.lineWidth = size;
                    ctx.globalCompositeOperation = 'source-over';
                    this._penPoints = [{
                        x,
                        y
                    }];
                }
                this.activeCtx = ctx;
            }
            this.lastDrawPoint = {
                x,
                y
            };
            e.preventDefault();
        };
        const move = (e) => {
            if (!this.isDrawing) return;
            const {
                x,
                y
            } = this.getPointerPos(e);
            if (this.drawingMode === 'pen') {
                this._penPoints.push({
                    x,
                    y
                });
                const pts = this._penPoints;
                const n = pts.length;
                if (n === 2) {
                    this.penCtx.beginPath();
                    this.penCtx.moveTo(pts[0].x, pts[0].y);
                    this.penCtx.lineTo(pts[1].x, pts[1].y);
                    this.penCtx.stroke();
                } else if (n >= 3) {
                    const p0 = pts[n - 3],
                        p1 = pts[n - 2],
                        p2 = pts[n - 1];
                    const m1x = (p0.x + p1.x) / 2,
                        m1y = (p0.y + p1.y) / 2,
                        m2x = (p1.x + p2.x) / 2,
                        m2y = (p1.y + p2.y) / 2;
                    this.penCtx.beginPath();
                    this.penCtx.moveTo(m1x, m1y);
                    this.penCtx.quadraticCurveTo(p1.x, p1.y, m2x, m2y);
                    this.penCtx.stroke();
                }
            } else if (this.drawingMode === 'eraser') {
                (this.eraserTargets || []).forEach(c => {
                    c.lineTo(x, y);
                    c.stroke();
                });
                this.renderHighlightTint();
            } else if (this.drawingMode === 'highlight') {
                this.activeCtx.lineTo(x, y);
                this.activeCtx.stroke();
                this.renderHighlightTint();
            }
            this.lastDrawPoint = {
                x,
                y
            };
            e.preventDefault();
        };
        const end = () => {
            if (this.isDrawing) {
                if (this.drawingMode === 'pen' && this._penPoints && this._penPoints.length >= 3) {
                    const pts = this._penPoints;
                    const n = pts.length;
                    const pLast = pts[n - 1];
                    const pPrev = pts[n - 2];
                    this.penCtx.beginPath();
                    this.penCtx.moveTo(pPrev.x, pPrev.y);
                    this.penCtx.lineTo(pLast.x, pLast.y);
                    this.penCtx.stroke();
                } else if (this.drawingMode === 'highlight') {
                    try {
                        this.activeCtx.closePath();
                    } catch (_) {}
                    this.renderHighlightTint();
                } else if (this.drawingMode === 'eraser') {
                    (this.eraserTargets || []).forEach(c => {
                        try {
                            c.closePath();
                            c.restore();
                        } catch (_) {}
                    });
                    this.renderHighlightTint();
                    this.eraserTargets = null;
                }
                if (this.drawingMode !== 'eraser' && this.activeCtx) {
                    try {
                        this.activeCtx.restore();
                    } catch (_) {}
                };
                this.isDrawing = false;
                this.activeCtx = null;
                this._penPoints = null;
            }
        };
        // Attach to both canvases (pointer may start on either)
        ;
        [this.highlightCanvas, this.penCanvas].forEach(c => {
            c.addEventListener('mousedown', start);
            c.addEventListener('mousemove', move);
            c.addEventListener('touchstart', start, {
                passive: false
            });
            c.addEventListener('touchmove', move, {
                passive: false
            });
            c.addEventListener('touchend', end);
        });
        window.addEventListener('mouseup', end);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.drawingMode) {
                this.toggleDrawingMode(null);
            }
        });
    }
    getPointerPos(e) {
        const rect = this.output.getBoundingClientRect();
        let clientX, clientY;
        if (e.touches && e.touches[0]) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        const scrollLeft = this.output.scrollLeft;
        const scrollTop = this.output.scrollTop;
        // Use raw client offset plus scroll; padding remains part of drawable region
        return {
            x: clientX - rect.left + scrollLeft,
            y: clientY - rect.top + scrollTop
        };
    }
    toggleDrawingMode(mode) {
        if (this.drawingMode === mode) mode = null; // toggle off
        this.drawingMode = mode;
        const active = !!mode;
        this.output.classList.toggle('drawing-active', active);
        this.output.classList.toggle('drawing-layer-active', active);
        document.body.classList.toggle('drawing-toolbar-active', active);
        if (this.penBtn) this.penBtn.classList.toggle('active', this.drawingMode === 'pen');
        if (this.highlightBtn) this.highlightBtn.classList.toggle('active', this.drawingMode === 'highlight');
        if (this.eraserBtn) this.eraserBtn.classList.toggle('active', this.drawingMode === 'eraser');
        this.announce(this.drawingMode ? `${this.drawingMode} mode enabled` : 'Drawing mode off');
    }
    clearDrawing(silent) {
        if (!(this.highlightCtx && this.penCtx)) return;
        this.highlightCtx.clearRect(0, 0, this.highlightCanvas.width, this.highlightCanvas.height);
        if (this.highlightMaskCtx) this.highlightMaskCtx.clearRect(0, 0, this.highlightMaskCanvas.width, this.highlightMaskCanvas.height);
        this.penCtx.clearRect(0, 0, this.penCanvas.width, this.penCanvas.height);
        if (!silent) this.announce('Cleared drawings');
    }
    renderHighlightTint() {
        if (!(this.highlightCtx && this.highlightMaskCanvas)) return;
        const w = this.highlightCanvas.width,
            h = this.highlightCanvas.height;
        const color = this.drawColorInput?.value || '#ffff00';
        // Clear visible highlight layer
        this.highlightCtx.clearRect(0, 0, w, h);
        // Draw mask
        this.highlightCtx.drawImage(this.highlightMaskCanvas, 0, 0);
        // Apply tint with fixed alpha via source-in
        this.highlightCtx.globalCompositeOperation = 'source-in';
        this.highlightCtx.globalAlpha = 0.25;
        this.highlightCtx.fillStyle = color;
        this.highlightCtx.fillRect(0, 0, w, h);
        // Reset comp mode
        this.highlightCtx.globalCompositeOperation = 'source-over';
        this.highlightCtx.globalAlpha = 1;
    }

    /* ================= Fullscreen ================= */
    toggleFullscreen() {
        const el = this.previewPanel || this.output;
        if (!document.fullscreenElement) {
            el.requestFullscreen?.();
            this.announce('Entered fullscreen');
        } else {
            document.exitFullscreen?.();
            this.announce('Exited fullscreen');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new LatexRenderer());
window.addEventListener('load', () => {
    if (window.MathJax) {
        window.MathJax.startup.promise.then(() => console.log('MathJax loaded'));
    }
});
if (typeof module !== 'undefined' && module.exports) module.exports = LatexRenderer;