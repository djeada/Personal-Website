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
        if (this.input.value.trim() === '') this.showPlaceholder(); else this.renderLatex();
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
        this.input.addEventListener('scroll', () => { this.syncScroll(); });

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

        // Resizing
        this.initResizing();
    }

    syncScroll() {
        if (!this.lineNumbers) return;
        this.lineNumbers.scrollTop = this.input.scrollTop;
    }

    debounceRender() { clearTimeout(this.renderTimeout); this.renderTimeout = setTimeout(() => this.renderLatex(), 250); }
    debounceSave() { clearTimeout(this.saveTimeout); this.saveTimeout = setTimeout(() => this.saveState(), 500); }

    renderLatex() {
        const inputText = this.input.value.trim();
        if (!inputText) { this.showPlaceholder(); return; }
        this.setStatus('Rendering...', 'rendering');
        this.isRendering = true;
    // Validate before rendering
    const issues = this.validateLatex(this.input.value);
    this.renderDiagnostics(issues);
        this.output.innerHTML = this.processLatexContent(inputText);
        this.updateURLState(inputText);
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([this.output])
                .then(() => { this.setStatus('Rendered successfully', 'success'); this.isRendering = false; })
                .catch(err => { console.error(err); this.setStatus('Rendering error', 'error'); this.isRendering = false; });
        } else {
            setTimeout(() => { this.setStatus('Rendered (MathJax not loaded)', 'error'); this.isRendering = false; }, 100);
        }
    }

    processLatexContent(content) {
        return content.split('\n').map(line => {
            if (!line.trim()) return '<br>';
            if (line.includes('$$')) return `<div class="display-math">${line}</div>`;
            if (this.isLatexEnvironment(line)) return `<div class="latex-environment">${line}</div>`;
            return `<p>${line}</p>`;
        }).join('\n');
    }

    validateLatex(text){
        const issues=[];
        const lines=text.split('\n');
        const stack=[]; // for environments
        const envRegex=/\\(begin|end)\{([^}]+)\}/g;
        const braceMap={ '(':')','[':']','{':'}' };
        const openers=new Set(Object.keys(braceMap));

        lines.forEach((rawLine,idx)=>{
            const line=rawLine; // keep formatting
            // Skip commented lines entirely
            if(line.trim().startsWith('%')) return;

            // Basic brace / bracket / parenthesis balance (ignoring math mode dollars for now)
            const stackChars=[];
            for(let i=0;i<line.length;i++){
                const ch=line[i];
                if(openers.has(ch)) stackChars.push(ch); else if(Object.values(braceMap).includes(ch)){
                    const last=stackChars.pop();
                    if(!last || braceMap[last]!==ch){
                        issues.push({severity:'error', line:idx+1, message:`Mismatched '${ch}'`});
                    }
                }
            }
            if(stackChars.length){
                stackChars.forEach(o=>issues.push({severity:'warning', line:idx+1, message:`Unclosed '${o}' on this line` }));
            }

            // Environment tracking
            envRegex.lastIndex=0;
            let m;
            while((m=envRegex.exec(line))){
                const type=m[1]; const env=m[2];
                if(type==='begin') stack.push({env,line:idx+1});
                else { // end
                    const last=stack.pop();
                    if(!last || last.env!==env){
                        issues.push({severity:'error', line:idx+1, message:`Unexpected \\end{${env}}`});
                    }
                }
            }

            // Dollar sign pairing (simple) skip escaped \$ and $$ blocks
            const sanitized=line.replace(/\\\$/g,'');
            const doubleRemoved=sanitized.replace(/\$\$[^$]*\$\$/g,'');
            const singles=(doubleRemoved.match(/\$/g)||[]).length;
            if(singles %2 !==0){
                issues.push({severity:'warning', line:idx+1, message:'Unpaired $ delimiter'});
            }
        });

        // Any remaining unclosed environments
        stack.reverse().forEach(fr=>issues.push({severity:'warning', line:fr.line, message:`Environment '${fr.env}' opened here not closed` }));

        // Global unmatched display math $$ count
        const allDouble=(text.replace(/\\\$/g,'').match(/\$\$/g)||[]).length;
        if(allDouble %2 !==0){
            issues.push({severity:'error', line: '-', message:'Unpaired $$ display math delimiter'});
        }

        return issues;
    }

    renderDiagnostics(issues){
        if(!this.diagnosticsEl) return;
        if(!issues.length){
            this.diagnosticsEl.classList.add('empty');
            this.diagnosticsEl.innerHTML='';
            return;
        }
        this.diagnosticsEl.classList.remove('empty');
        const items=issues.map(i=>`<li class="${i.severity}"><span class="badge">${i.severity.toUpperCase()}</span><span>Line ${i.line}: ${i.message}</span></li>`).join('');
        this.diagnosticsEl.innerHTML=`<ul>${items}</ul>`;
        const mostSevere=issues.find(i=>i.severity==='error')||issues[0];
        this.announce(`${issues.length} issues detected. First: ${mostSevere.message}`);
    }

    isLatexEnvironment(line) {
        return ['\\begin{', '\\end{', '\\[', '\\]', '\\align', '\\equation', '\\matrix', '\\pmatrix', '\\bmatrix', '\\vmatrix', '\\cases']
            .some(env => line.trim().startsWith(env));
    }

    showPlaceholder() { this.output.innerHTML = `<div class="placeholder"><i class="fa fa-code"></i><p>Your rendered LaTeX will appear here</p></div>`; this.setStatus('Ready', 'ready'); }
    updateCharCount() { const c = this.input.value.length; this.charCount.textContent = `${c} character${c !== 1 ? 's' : ''}`; }
    updateLineNumbers() { if (!this.lineNumbers) return; const lines = this.input.value.split('\n').length; this.lineNumbers.innerHTML = Array.from({length: lines}, () => '<div></div>').join(''); this.syncScroll(); }
    setStatus(msg, type='ready') { this.status.textContent = msg; this.status.className = `status ${type}`; if (type === 'rendering') this.status.innerHTML = `<span class="loading"></span> ${msg}`; }

    clearContent() { if (confirm('Clear all content?')) { this.input.value=''; this.updateCharCount(); this.updateLineNumbers(); this.showPlaceholder(); this.saveState(); this.announce('Cleared content'); } }

    loadExample() {
        const examples = [
`Welcome to LaTeX Renderer!\n\nInline math: The famous equation is $E = mc^2$.\n\nDisplay math:\n$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$\n\nFractions and powers:\n$$\\frac{a^2 + b^2}{c^2} = \\frac{\\sqrt{x + y}}{\\log(z)}$$`,
`Advanced Mathematics\n\nGreek letters: $\\alpha, \\beta, \\gamma, \\delta, \\epsilon$\n\nSummation and limits:\n$$\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$$\n\nMatrix example:\n$$\\begin{pmatrix} \na & b \\\\ \nc & d \n\\end{pmatrix}\n\\begin{pmatrix} \nx \\\\ \ny \n\\end{pmatrix} = \n\\begin{pmatrix} \nax + by \\\\ \ncx + dy \n\\end{pmatrix}$$`,
`Complex Expressions\n\nDerivatives and integrals:\n$$\\frac{d}{dx}\\int_a^x f(t)dt = f(x)$$\n\nBinomial theorem:\n$$(x + y)^n = \\sum_{k=0}^{n} \\binom{n}{k} x^{n-k} y^k$$\n\nSet theory:\n$$A \\cup B = \\{x : x \\in A \\text{ or } x \\in B\\}$$`
        ];
        this.input.value = examples[Math.floor(Math.random()*examples.length)];
        this.updateCharCount(); this.updateLineNumbers(); this.renderLatex(); this.input.focus(); this.debounceSave(); this.announce('Loaded example');
    }

    copyToClipboard() {
        navigator.clipboard.writeText(this.input.value).then(() => {
            const original = this.copyBtn.innerHTML; this.copyBtn.innerHTML = '<i class="fa fa-check"></i> Copied!'; this.copyBtn.style.background='#28a745'; setTimeout(()=>{this.copyBtn.innerHTML=original; this.copyBtn.style.background='';},2000); this.announce('Copied to clipboard');
        }).catch(err => { console.error(err); alert('Failed to copy'); });
    }

    downloadTex() { const blob = new Blob([this.input.value],{type:'application/x-tex'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='document.tex'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); this.announce('Downloaded .tex'); }
    insertAtCursor(text){ const s=this.input.selectionStart,e=this.input.selectionEnd; this.input.setRangeText(text,s,e,'end'); this.updateCharCount(); this.updateLineNumbers(); }
    wrapSelection(pre,suf){ const s=this.input.selectionStart,e=this.input.selectionEnd; const sel=this.input.value.substring(s,e); this.input.setRangeText(pre+sel+suf,s,e,'select'); this.updateCharCount(); this.updateLineNumbers(); this.debounceRender(); this.announce('Wrapped selection'); }

    generateShareLink(){ const content=this.input.value; if(!content.trim()) { alert('Nothing to share'); return;} const compressed=this.compressToBase64(content); const url=`${location.origin}${location.pathname}?c=${compressed}`; navigator.clipboard.writeText(url).then(()=>{ alert('Shareable link copied'); this.announce('Share link copied'); }); }
    compressToBase64(str){ try{ if(window.LZString) return btoa(LZString.compressToUTF16(str)); }catch(_){} return btoa(unescape(encodeURIComponent(str))); }
    decompressFromBase64(b64){ try{ if(window.LZString) return LZString.decompressFromUTF16(atob(b64))||''; }catch(_){} try{ return decodeURIComponent(escape(atob(b64))); }catch{ return ''; } }
    updateURLState(content){ if(!content||this.initializedFromURL) return; try{ const compressed=this.compressToBase64(content).substring(0,1500); const url=new URL(location.href); url.searchParams.set('c',compressed); history.replaceState(null,'',url.toString()); }catch(_){}}
    restoreState(){ const params=new URLSearchParams(location.search); const c=params.get('c'); if(c){ const d=this.decompressFromBase64(c); if(d){ this.input.value=d; this.initializedFromURL=true; return; }} try{ const saved=localStorage.getItem(this.storageKey); if(saved) this.input.value=saved; }catch(_){}}
    saveState(){ try{ localStorage.setItem(this.storageKey,this.input.value);}catch(_){}}

    initResizing(){ if(!this.divider) return; let dragging=false; const start=e=>{dragging=true; e.preventDefault();}; const move=e=>{ if(!dragging) return; const isMobile=window.matchMedia('(max-width: 768px)').matches; const rect=this.splitContainer.getBoundingClientRect(); if(isMobile){ const y=(e.touches?e.touches[0].clientY:e.clientY)-rect.top; const ratio=Math.min(.85,Math.max(.15,y/rect.height)); this.editorPanel.style.order=0; this.previewPanel.style.order=2; this.editorPanel.style.flexBasis=`${ratio*100}%`; this.previewPanel.style.flexBasis=`${(1-ratio)*100}%`; } else { const x=(e.touches?e.touches[0].clientX:e.clientX)-rect.left; const ratio=Math.min(.85,Math.max(.15,x/rect.width)); this.editorPanel.style.flex=`0 0 ${ratio*100}%`; this.previewPanel.style.flex=`0 0 ${(1-ratio)*100}%`; }}; const stop=()=>{ if(dragging){ dragging=false; this.announce('Panels resized'); }}; this.divider.addEventListener('mousedown',start); window.addEventListener('mousemove',move); window.addEventListener('mouseup',stop); this.divider.addEventListener('touchstart',start,{passive:true}); window.addEventListener('touchmove',move,{passive:true}); window.addEventListener('touchend',stop); this.divider.addEventListener('keydown',e=>{ if(e.key==='ArrowLeft'||e.key==='ArrowRight'){ const delta=e.key==='ArrowLeft'?-5:5; const current=this.editorPanel.getBoundingClientRect().width/this.splitContainer.getBoundingClientRect().width*100; const next=Math.min(85,Math.max(15,current+delta)); this.editorPanel.style.flex=`0 0 ${next}%`; this.previewPanel.style.flex=`0 0 ${100-next}%`; this.announce('Panels resized'); }}); }

    announce(msg){ if(this.srStatus) this.srStatus.textContent=msg; }

    handleKeyboardShortcuts(e){
        if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){ e.preventDefault(); this.renderLatex(); }
        if((e.ctrlKey||e.metaKey)&&e.key==='k'){ e.preventDefault(); this.clearContent(); }
        if((e.ctrlKey||e.metaKey)&&e.key==='b'){ e.preventDefault(); this.wrapSelection('$','$'); }
        if((e.ctrlKey||e.metaKey)&&e.key==='m'){ e.preventDefault(); this.wrapSelection('$$\n','\n$$'); }
        if(e.key==='Tab'){ e.preventDefault(); const s=this.input.selectionStart; const epos=this.input.selectionEnd; this.input.value=this.input.value.substring(0,s)+'    '+this.input.value.substring(epos); this.input.selectionStart=this.input.selectionEnd=s+4; this.updateLineNumbers(); }
    }
}

document.addEventListener('DOMContentLoaded', ()=> new LatexRenderer());
window.addEventListener('load', () => { if(window.MathJax){ window.MathJax.startup.promise.then(()=>console.log('MathJax loaded')); }});
if (typeof module !== 'undefined' && module.exports) module.exports = LatexRenderer;
