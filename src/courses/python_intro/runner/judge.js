(function() {
    'use strict';

    const dataEl = document.getElementById('pyk-data');
    if (!dataEl) return;
    const TASK = JSON.parse(dataEl.textContent);
    const TESTS = TASK.tests || [];
    const STARTER = TASK.starter || '';
    const PREFIX = 'pyk:';
    const WORKER_URL = new URL('judge-worker.js', document.currentScript.src).href;
    const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    const RUN_SHORTCUT = IS_MAC ? 'Cmd+Enter' : 'Ctrl+Enter';


    const store = {
        get(key) {
            try {
                return window.localStorage.getItem(PREFIX + key);
            } catch (err) {
                return null;
            }
        },
        set(key, value) {
            try {
                window.localStorage.setItem(PREFIX + key, value);
            } catch (err) {

            }
        },
        remove(key) {
            try {
                window.localStorage.removeItem(PREFIX + key);
            } catch (err) {

            }
        },
    };

    function solvedSet() {
        try {
            const list = JSON.parse(store.get('solved') || '[]');
            return new Set(Array.isArray(list) ? list : []);
        } catch (err) {
            return new Set();
        }
    }

    function markSolved() {
        const solved = solvedSet();
        solved.add(TASK.slug);
        store.set('solved', JSON.stringify(Array.from(solved)));
        showSolvedBadge();
    }


    const $ = (id) => document.getElementById(id);

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    const codeEl = $('pyk-code');
    const highlightEl = $('pyk-highlight');
    const highlightPre = highlightEl.parentElement;
    const gutterEl = $('pyk-gutter');
    const runBtn = $('pyk-run');
    const resetBtn = $('pyk-reset');
    const statusEl = $('pyk-status');
    const summaryEl = $('pyk-summary');
    const stdinEl = $('pyk-stdin');
    const customBtn = $('pyk-run-custom');
    const customOut = $('pyk-custom-output');
    const doneBtn = $('pyk-mark-done');


    let lineCount = 0;
    let errorLine = null;
    let escapeTab = false;

    function highlight() {
        const code = codeEl.value;
        const text = code.endsWith('\n') || code === '' ? code + ' ' : code;
        if (window.Prism && Prism.languages && Prism.languages.python) {
            highlightEl.innerHTML = Prism.highlight(text, Prism.languages.python, 'python');
        } else {
            highlightEl.textContent = text;
        }
    }

    function renderGutter() {
        const count = Math.max(1, codeEl.value.split('\n').length);
        if (count !== lineCount) {
            lineCount = count;
            const frag = document.createDocumentFragment();
            for (let i = 1; i <= count; i += 1) {
                frag.appendChild(el('div', 'pyk-ln', String(i)));
            }
            gutterEl.textContent = '';
            gutterEl.appendChild(frag);
        }
        Array.prototype.forEach.call(gutterEl.children, (node, idx) => {
            node.classList.toggle('is-error', errorLine === idx + 1);
        });
    }

    function syncScroll() {
        highlightPre.style.transform = 'translate(' + -codeEl.scrollLeft + 'px,' + -codeEl.scrollTop + 'px)';
        gutterEl.style.transform = 'translateY(' + -codeEl.scrollTop + 'px)';
    }

    function refreshEditor() {
        highlight();
        renderGutter();
        syncScroll();
    }

    let saveTimer = null;

    function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            if (codeEl.value === STARTER) {
                store.remove('code:' + TASK.slug);
            } else {
                store.set('code:' + TASK.slug, codeEl.value);
            }
        }, 400);
    }

    function insertText(text) {
        codeEl.focus();
        let inserted = false;
        try {
            inserted = document.execCommand('insertText', false, text);
        } catch (err) {
            inserted = false;
        }
        if (!inserted) {
            codeEl.setRangeText(text, codeEl.selectionStart, codeEl.selectionEnd, 'end');
            codeEl.dispatchEvent(new Event('input'));
        }
    }

    function selectedLineRange() {
        const value = codeEl.value;
        const start = value.lastIndexOf('\n', codeEl.selectionStart - 1) + 1;
        let end = value.indexOf('\n', Math.max(codeEl.selectionEnd - (codeEl.selectionEnd > codeEl.selectionStart ? 1 : 0), start));
        if (end === -1) end = value.length;
        return [start, end];
    }

    function shiftLines(dedent) {
        const [start, end] = selectedLineRange();
        const block = codeEl.value.slice(start, end);
        const lines = block.split('\n');
        const changed = lines.map((line) => {
            if (!dedent) return '    ' + line;
            const match = line.match(/^ {1,4}|^\t/);
            return match ? line.slice(match[0].length) : line;
        }).join('\n');
        codeEl.setSelectionRange(start, end);
        insertText(changed);
        codeEl.setSelectionRange(start, start + changed.length);
    }

    codeEl.addEventListener('keydown', (ev) => {
        if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
            ev.preventDefault();
            runPrimary();
            return;
        }
        if (ev.key === 'Escape') {
            escapeTab = true;
            return;
        }
        if (ev.key === 'Tab' && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
            if (escapeTab) {
                escapeTab = false;
                return;
            }
            ev.preventDefault();
            const multi = codeEl.value.slice(codeEl.selectionStart, codeEl.selectionEnd).includes('\n');
            if (ev.shiftKey || multi) {
                shiftLines(ev.shiftKey);
            } else {
                insertText('    ');
            }
            return;
        }
        escapeTab = false;
        if (ev.key === 'Enter' && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !ev.isComposing) {
            const value = codeEl.value;
            const pos = codeEl.selectionStart;
            const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
            const before = value.slice(lineStart, pos);
            let indent = (before.match(/^[ \t]*/) || [''])[0];
            if (/:\s*$/.test(before)) indent += '    ';
            ev.preventDefault();
            insertText('\n' + indent);
        }
    });

    codeEl.addEventListener('input', () => {
        if (errorLine !== null) errorLine = null;
        refreshEditor();
        scheduleSave();
    });
    codeEl.addEventListener('scroll', syncScroll);

    function goToLine(line) {
        const lines = codeEl.value.split('\n');
        let pos = 0;
        for (let i = 0; i < Math.min(line - 1, lines.length); i += 1) pos += lines[i].length + 1;
        codeEl.focus();
        codeEl.setSelectionRange(pos, pos + (lines[line - 1] || '').length);
        const lineHeight = parseFloat(getComputedStyle(codeEl).lineHeight) || 24;
        codeEl.scrollTop = Math.max(0, (line - 3) * lineHeight);
        syncScroll();
    }

    const saved = store.get('code:' + TASK.slug);
    codeEl.value = saved !== null ? saved : STARTER;
    if (saved !== null && saved !== STARTER) {
        const note = $('pyk-restored');
        if (note) note.hidden = false;
    }
    refreshEditor();
    window.addEventListener('load', refreshEditor);

    resetBtn.addEventListener('click', () => {
        if (codeEl.value !== STARTER && !window.confirm('Przywrócić kod startowy? Twój obecny kod zostanie usunięty.')) {
            return;
        }
        codeEl.value = STARTER;
        store.remove('code:' + TASK.slug);
        errorLine = null;
        const note = $('pyk-restored');
        if (note) note.hidden = true;
        refreshEditor();
        codeEl.focus();
    });


    let worker = null;
    let runtime = 'idle';
    let pending = null;
    let active = null;
    let seq = 0;

    const STATUS_TEXT = {
        idle: 'Python uruchomi się w przeglądarce przy pierwszym teście.',
        loading: 'Ładowanie Pythona w przeglądarce… Za pierwszym razem może to potrwać kilkanaście sekund.',
        ready: 'Python gotowy. Skrót: ' + RUN_SHORTCUT + ' uruchamia testy.',
        running: 'Uruchamianie…',
        error: 'Nie udało się załadować Pythona. Sprawdź połączenie z internetem i odśwież stronę.',
    };

    function setStatus(state) {
        statusEl.textContent = STATUS_TEXT[state];
        statusEl.dataset.state = state;
    }

    function setBusy(busy, label) {
        [runBtn, customBtn].forEach((btn) => {
            if (!btn) return;
            btn.disabled = busy;
            btn.classList.toggle('is-busy', busy);
        });
        const target = label === 'custom' ? customBtn : runBtn;
        if (busy && target) target.setAttribute('aria-busy', 'true');
        else {
            runBtn.removeAttribute('aria-busy');
            if (customBtn) customBtn.removeAttribute('aria-busy');
        }
    }

    function ensureWorker() {
        if (worker) return;
        runtime = 'loading';
        setStatus('loading');
        worker = new Worker(WORKER_URL);
        worker.addEventListener('message', onWorkerMessage);
        worker.addEventListener('error', () => {
            if (runtime === 'loading') failLoading();
        });
    }

    function failLoading() {
        runtime = 'error';
        setStatus('error');
        if (worker) worker.terminate();
        worker = null;
        if (pending) {
            const job = pending;
            pending = null;
            job.resolve({
                loadError: true
            });
        }
    }

    function killWorker() {
        if (worker) worker.terminate();
        worker = null;
        runtime = 'idle';
    }

    function onWorkerMessage(ev) {
        const msg = ev.data || {};
        if (msg.type === 'ready') {
            runtime = 'ready';
            setStatus('ready');
            if (pending) {
                const job = pending;
                pending = null;
                dispatch(job);
            }
        } else if (msg.type === 'load-error') {
            failLoading();
        } else if (msg.type === 'started' && active && active.id === msg.id) {
            const budget = Math.min(15000, Math.max(5000, 3000 * active.cases.length));
            active.timer = setTimeout(() => {
                const job = active;
                active = null;
                killWorker();
                job.resolve({
                    timeout: budget
                });
                ensureWorker();
            }, budget);
        } else if (msg.type === 'result' && active && active.id === msg.id) {
            const job = active;
            active = null;
            clearTimeout(job.timer);
            if (msg.crash) {
                killWorker();
                job.resolve({
                    crash: msg.crash
                });
                ensureWorker();
            } else {
                setStatus('ready');
                job.resolve(msg.result);
            }
        }
    }

    function dispatch(job) {
        active = job;
        setStatus('running');
        worker.postMessage({
            type: 'run',
            id: job.id,
            code: job.code,
            cases: job.cases
        });
    }

    function execute(cases) {
        return new Promise((resolve) => {
            if (runtime === 'error') {
                worker = null;
                runtime = 'idle';
            }
            const job = {
                id: ++seq,
                code: codeEl.value,
                cases,
                resolve,
                timer: null
            };
            ensureWorker();
            if (runtime === 'ready') dispatch(job);
            else pending = job;
        });
    }

    function preload() {
        if (!worker && runtime !== 'error') ensureWorker();
    }

    ['focus', 'pointerdown'].forEach((type) => codeEl.addEventListener(type, preload, {
        once: true
    }));
    runBtn.addEventListener('pointerenter', preload, {
        once: true
    });
    setStatus('idle');


    const ERROR_HINTS = {
        SyntaxError: 'Python nie rozumie tej linii. Sprawdź nawiasy, cudzysłowy, przecinki i dwukropek na końcu linii z if, for, while lub def.',
        IndentationError: 'Nieprawidłowe wcięcie. Kod wewnątrz if, for, while i def musi być wcięty (najlepiej 4 spacje), a linie w jednym bloku muszą mieć takie samo wcięcie.',
        TabError: 'Wcięcia mieszają tabulatory i spacje. Używaj wyłącznie spacji (4 na poziom).',
        NameError: 'Używasz nazwy, która nie istnieje. Sprawdź literówki i wielkość liter oraz czy zmienna dostała wartość, zanim jej użyłeś.',
        UnboundLocalError: 'Zmienna jest używana w funkcji, zanim przypisano jej wartość.',
        TypeError: 'Operacja na niepasujących typach, np. dodawanie tekstu do liczby. Pamiętaj, że input() zawsze zwraca tekst — zamień go na liczbę przez int() lub float().',
        ValueError: 'Niepoprawna wartość, np. int() dostał tekst, który nie jest liczbą całkowitą. Sprawdź format danych wejściowych: jeśli kilka liczb jest w jednej linii, rozdziel je przez input().split().',
        ZeroDivisionError: 'Dzielenie przez zero. Sprawdź, czy dzielnik może być równy 0, i obsłuż ten przypadek.',
        EOFError: 'Program próbował wczytać więcej danych, niż podano na wejściu. Sprawdź, ile razy wywołujesz input() i czy kilka wartości nie jest w jednej linii (wtedy użyj split()).',
        IndexError: 'Indeks poza zakresem listy lub napisu. Pamiętaj, że indeksy zaczynają się od 0, a ostatni element ma indeks len(x) - 1.',
        KeyError: 'W słowniku nie ma takiego klucza. Sprawdź klucz lub użyj metody get().',
        AttributeError: 'Ten obiekt nie ma takiej metody ani atrybutu. Sprawdź nazwę metody i typ zmiennej.',
        RecursionError: 'Zbyt głęboka rekurencja. Sprawdź, czy funkcja rekurencyjna ma warunek zakończenia, który na pewno zostanie spełniony.',
        ModuleNotFoundError: 'Ten moduł nie jest dostępny w Pythonie w przeglądarce. Zadania da się rozwiązać biblioteką standardową.',
        ImportError: 'Nie udało się zaimportować modułu lub nazwy. Sprawdź pisownię.',
        FileNotFoundError: 'Nie znaleziono pliku. Sprawdź nazwę i ścieżkę pliku.',
        OverflowError: 'Wynik jest zbyt duży dla tej operacji.',
        MemoryError: 'Program zużył za dużo pamięci.',
    };

    function errorBlock(err) {
        const box = el('div', 'pyk-error');
        const title = err.line ? err.type + ' w linii ' + err.line : err.type;
        box.appendChild(el('p', 'pyk-error-title', title + (err.message ? ': ' + err.message : '')));
        box.appendChild(el('p', 'pyk-error-hint', ERROR_HINTS[err.type] || 'Program zakończył się błędem. Przeczytaj komunikat poniżej, aby znaleźć przyczynę.'));
        if (err.line) {
            const jump = el('button', 'pyk-link-btn', 'Pokaż linię ' + err.line + ' w edytorze');
            jump.type = 'button';
            jump.addEventListener('click', () => goToLine(err.line));
            box.appendChild(jump);
        }
        if (err.traceback) {
            const details = el('details', 'pyk-traceback');
            details.appendChild(el('summary', null, 'Pełny komunikat Pythona'));
            details.appendChild(el('pre', null, err.traceback));
            box.appendChild(details);
        }
        return box;
    }

    function normalizeOutput(text) {
        const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n').map((line) => line.replace(/\s+$/, ''));
        while (lines.length && lines[lines.length - 1] === '') lines.pop();
        return lines;
    }

    function wrongAnswerHint(output, expected) {
        const got = normalizeOutput(output);
        const want = normalizeOutput(expected);
        if (!got.length) return 'Program nic nie wypisał. Wynik wypisz funkcją print().';
        if (got.join('\n').toLowerCase() === want.join('\n').toLowerCase()) return 'Różnica dotyczy tylko wielkości liter.';
        if (got.join(' ').split(/\s+/).join(' ') === want.join(' ').split(/\s+/).join(' ')) {
            return 'Wartości się zgadzają, ale różni się podział na linie lub odstępy.';
        }
        if (got.length !== want.length) {
            return 'Oczekiwano ' + want.length + ' ' + plural(want.length, 'linii', 'linii', 'linii') + ' wyjścia, a program wypisał ' + got.length + '.';
        }
        return null;
    }

    function plural(n, one, few, many) {
        if (n === 1) return one;
        const d = n % 10;
        const t = n % 100;
        return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
    }

    function outputBlock(label, output, expected, truncated) {
        const wrap = el('div', 'pyk-io');
        wrap.appendChild(el('div', 'pyk-io-label', label));
        const pre = el('pre', 'pyk-pre');
        const got = normalizeOutput(output);
        if (!got.length) {
            pre.classList.add('is-empty');
            pre.textContent = '(brak wyjścia)';
        } else if (expected === undefined) {
            pre.textContent = String(output).replace(/\s+$/, '');
        } else {
            const want = normalizeOutput(expected);
            got.forEach((line, idx) => {
                const span = el('span', line === want[idx] ? 'pyk-line' : 'pyk-line is-diff', line === '' ? ' ' : line);
                pre.appendChild(span);
            });
        }
        wrap.appendChild(pre);
        if (truncated) wrap.appendChild(el('p', 'pyk-note', 'Wyjście zostało skrócone.'));
        return wrap;
    }


    function testCard(idx) {
        return document.querySelector('.pyk-test[data-index="' + idx + '"]');
    }

    function resetCards() {
        TESTS.forEach((t, idx) => {
            const card = testCard(idx);
            if (!card) return;
            card.dataset.state = 'pending';
            card.querySelector('.pyk-test-state').textContent = 'Sprawdzanie…';
            card.querySelector('.pyk-test-result').textContent = '';
        });
    }

    function setCard(idx, state, label, nodes) {
        const card = testCard(idx);
        if (!card) return;
        card.dataset.state = state;
        card.querySelector('.pyk-test-state').textContent = label;
        const slot = card.querySelector('.pyk-test-result');
        slot.textContent = '';
        nodes.forEach((node) => node && slot.appendChild(node));
    }

    function summary(kind, heading, text, extra) {
        summaryEl.hidden = false;
        summaryEl.dataset.state = kind;
        summaryEl.textContent = '';
        summaryEl.appendChild(el('p', 'pyk-summary-title', heading));
        if (text) summaryEl.appendChild(el('p', 'pyk-summary-text', text));
        (extra || []).forEach((node) => summaryEl.appendChild(node));
    }

    function nextLink() {
        if (!TASK.next) return null;
        const a = el('a', 'pyk-btn pyk-btn--primary', 'Następne zadanie: ' + TASK.next.title + ' →');
        a.href = TASK.next.href;
        return a;
    }

    function failureSummary(res) {
        if (res.loadError) {
            summary('error', 'Python nie jest dostępny', STATUS_TEXT.error);
            return true;
        }
        if (res.timeout) {
            summary('error', 'Przekroczono limit czasu (' + Math.round(res.timeout / 1000) + ' s)', 'Program działał zbyt długo i został przerwany. Sprawdź, czy każda pętla się kończy (np. czy zmienna w warunku while się zmienia).');
            return true;
        }
        if (res.crash) {
            summary('error', 'Program przerwał działanie Pythona', 'Najczęstsza przyczyna to nieskończona rekurencja lub zbyt duże zużycie pamięci. Szczegóły: ' + res.crash);
            return true;
        }
        return false;
    }

    async function runTests() {
        if (!TESTS.length) {
            runCustom();
            return;
        }
        setBusy(true, 'tests');
        resetCards();
        summary('running', runtime === 'ready' ? 'Sprawdzanie rozwiązania…' : 'Ładowanie Pythona…', runtime === 'ready' ? null : 'Testy uruchomią się automatycznie, gdy Python będzie gotowy.');
        const res = await execute(TESTS.map((t) => ({
            input: t.input,
            expected: t.expected
        })));
        setBusy(false);
        errorLine = null;

        if (failureSummary(res)) {
            TESTS.forEach((t, idx) => setCard(idx, 'error', 'Nie sprawdzono', []));
            renderGutter();
            return;
        }
        if (res.compile_error) {
            errorLine = res.compile_error.line || null;
            renderGutter();
            TESTS.forEach((t, idx) => setCard(idx, 'error', 'Błąd składni', []));
            summary('error', 'Kod zawiera błąd składni', null, [errorBlock(res.compile_error)]);
            return;
        }

        const results = res.results || [];
        let passed = 0;
        results.forEach((r, idx) => {
            const expected = TESTS[idx].expected;
            if (r.ok) {
                passed += 1;
                setCard(idx, 'pass', 'Zaliczony', [outputBlock('Twój wynik', r.output, expected, r.truncated)]);
            } else if (r.error) {
                if (errorLine === null && r.error.line) errorLine = r.error.line;
                setCard(idx, 'error', 'Błąd: ' + r.error.type, [
                    r.output ? outputBlock('Wypisane przed błędem', r.output, expected, r.truncated) : null,
                    errorBlock(r.error),
                ]);
            } else {
                const hint = wrongAnswerHint(r.output, expected);
                setCard(idx, 'fail', 'Niezaliczony', [
                    outputBlock('Twój wynik (różnice zaznaczone)', r.output, expected, r.truncated),
                    hint ? el('p', 'pyk-hint', hint) : null,
                    r.stderr ? outputBlock('stderr', r.stderr) : null,
                ]);
            }
        });
        renderGutter();

        if (passed === results.length) {
            markSolved();
            summary('pass', 'Brawo! Wszystkie testy zaliczone (' + passed + '/' + results.length + ').', TASK.track ? 'Zadanie zostało oznaczone jako rozwiązane.' : null, [nextLink()].filter(Boolean));
        } else {
            summary('fail', 'Zaliczone testy: ' + passed + ' z ' + results.length + '.', 'Porównaj swój wynik z oczekiwanym poniżej, popraw kod i uruchom ponownie.');
        }
        const firstBad = document.querySelector('.pyk-test[data-state="fail"], .pyk-test[data-state="error"]');
        if (firstBad && window.matchMedia('(max-width: 1023px)').matches) {
            summaryEl.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            });
        }
    }

    async function runCustom() {
        if (!customOut) return;
        const details = customOut.closest('details');
        if (details) details.open = true;
        setBusy(true, 'custom');
        customOut.textContent = '';
        customOut.appendChild(el('p', 'pyk-note', runtime === 'ready' ? 'Uruchamianie…' : 'Ładowanie Pythona…'));
        const res = await execute([{
            input: stdinEl ? stdinEl.value : ''
        }]);
        setBusy(false);
        customOut.textContent = '';
        errorLine = null;
        if (res.loadError || res.timeout || res.crash) {
            const msg = res.loadError ? STATUS_TEXT.error : res.timeout ? 'Program działał zbyt długo i został przerwany.' : 'Program przerwał działanie Pythona: ' + res.crash;
            customOut.appendChild(el('p', 'pyk-hint', msg));
            return;
        }
        const err = res.compile_error || (res.results && res.results[0] && res.results[0].error);
        const r = (res.results && res.results[0]) || {};
        if (!res.compile_error) customOut.appendChild(outputBlock('Wyjście programu', r.output || '', undefined, r.truncated));
        if (r.stderr) customOut.appendChild(outputBlock('stderr', r.stderr));
        if (err) {
            errorLine = err.line || null;
            customOut.appendChild(errorBlock(err));
        }
        renderGutter();
    }

    function runPrimary() {
        if (runBtn.disabled) return;
        runTests();
    }

    runBtn.addEventListener('click', runPrimary);
    if (customBtn) customBtn.addEventListener('click', () => !customBtn.disabled && runCustom());
    if (stdinEl) {
        stdinEl.addEventListener('keydown', (ev) => {
            if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
                ev.preventDefault();
                if (!customBtn.disabled) runCustom();
            }
        });
    }


    function showSolvedBadge() {
        const badge = $('pyk-solved');
        if (badge) badge.hidden = false;
        if (doneBtn) doneBtn.hidden = true;
    }

    if (TASK.track) {
        store.set('last', TASK.slug);
        if (solvedSet().has(TASK.slug)) showSolvedBadge();
    }
    if (doneBtn) {
        doneBtn.addEventListener('click', () => {
            markSolved();
            summary('pass', 'Zadanie oznaczone jako ukończone.', null, [nextLink()].filter(Boolean));
        });
    }

    const shortcutEl = $('pyk-shortcut');
    if (shortcutEl) shortcutEl.textContent = RUN_SHORTCUT;
})();