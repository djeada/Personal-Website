/*
 * Injected into each filmed tool page (1280×720 CSS px, captured at 1.5x).
 * Adapted from the optics overlay: the camera, veil, spotlight, captions and
 * cards are pure functions of the timeline time t, so any frame always looks
 * the same. frame(t) returns a signature of everything visible, and the
 * recorder only takes a new screenshot when it changes.
 */
(function () {
    "use strict";
    let measured = {};
    let T, page, W, H, main, root, veil, dip, spot, caption, mark, chips, band, foot, end;
    const cards = [];
    const ease = x => { const k = Math.min(1, Math.max(0, x)); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
    const CAMERA_MOVE = 1.2, FADE = .45, DIP = .45, VEIL_FADE = .7;

    /* Plex's Latin subset has no arrows, ≤ or superscripts, so those are drawn. */
    const glyphs = html => html
        .replace(/(\S+–\S+)/g, '<span class="nw">$1</span>')
        .replace(/→/g, '<i class="g g-arrow"></i>')
        .replace(/≤/g, '<i class="g g-le"></i>')
        .replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, m => `<sup>${[...m].map(c => "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c)).join("")}</sup>`);
    const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    function el(tag, cls, html, parent = root) {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (html) node.innerHTML = html;
        parent.appendChild(node);
        return node;
    }

    const opacity = (t, from, to, fade = FADE) => Math.min(ease((t - from) / fade), ease((to - t) / fade));

    /* ---------------------------------------------------------------- cards ---- */

    const PY_KEYWORDS = /^(for|in|if|else|elif|return|def|while|not|and|or|None|True|False|lambda|import|from|class|is)$/;
    function tokens(line) {
        const out = [];
        const re = /(#.*$)|("[^"]*"|'[^']*')|(\b\d+\b)|([A-Za-z_]\w*)(?=\s*\()|([A-Za-z_]\w*)|(\s+)|(.)/g;
        let m;
        while ((m = re.exec(line))) {
            const [text] = m;
            const kind = m[1] ? "c" : m[2] ? "s" : m[3] ? "n" : m[4] ? "f" : m[5] && PY_KEYWORDS.test(text) ? "k" : "";
            out.push({ text, kind });
        }
        return out;
    }

    // The typed part of each line, tinted, with a block caret where typing has reached.
    function codeHTML(card, chars, typing) {
        let left = chars, caret = !typing || chars >= card.total;
        return card.tokens.map((line, i) => {
            const length = card.lines[i].length;
            let take = Math.max(0, Math.min(length, left)), html = "";
            for (const tok of line) {
                if (take <= 0) break;
                const text = tok.text.slice(0, take);
                take -= text.length;
                html += tok.kind ? `<span class="t-${tok.kind}">${esc(text)}</span>` : esc(text);
            }
            const here = !caret && left >= 0 && left <= length;
            if (here) caret = true;
            left -= length + 1;
            return `<div class="ln" data-line="${i + 1}"><span class="no">${i + 1}</span><span class="src">${html}${here ? '<span class="caret"></span>' : ""}</span></div>`;
        }).join("");
    }

    const codeLine = line => tokens(line).map(tok => (tok.kind ? `<span class="t-${tok.kind}">${esc(tok.text)}</span>` : esc(tok.text))).join("");
    const WORD_ROW = 54, DQ_CELL = 76, DQ_GAP = 10, DQ_STEP = DQ_CELL + DQ_GAP;
    const fmtInt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    // The first letter that differs between each pair of neighboring words (null if one is a prefix).
    function wordDiffs(words) {
        return words.slice(1).map((b, i) => {
            const a = words[i];
            for (let k = 0; k < Math.min(a.length, b.length); k++) if (a[k] !== b[k]) return { k, a: a[k], b: b[k] };
            return null;
        });
    }

    // Deque states after each op: [{ t, ids, op }], plus every cell that ever enters it.
    function dequeStates(c) {
        const cells = {}, states = [];
        let ids = (c.items || []).map((value, i) => { cells[`i${i}`] = { value }; return `i${i}`; });
        states.push({ t: -Infinity, ids });
        (c.ops || []).slice().sort((a, b) => a.at - b.at).forEach((op, n) => {
            ids = ids.slice();
            if (op.op === "pop") ids.shift();
            else {
                const id = `o${n}`;
                cells[id] = { value: op.value, cost: op.cost };
                if (op.op === "front") ids.unshift(id); else ids.push(id);
            }
            states.push({ t: op.at, ids, op });
        });
        return { cells, states, slots: Math.max(...states.map(st => st.ids.length), 1) };
    }

    const builders = {
        title: c => `<div class="kicker">${c.kicker}</div><div class="rule"></div><h1><span class="part">Part ${c.part}</span><span class="dot">·</span>${esc(c.title)}</h1>`,
        next: c => `<div class="kicker">${c.kicker}</div><h2>${esc(c.text)}</h2>` +
            (c.url ? `<div class="url">${esc(c.url)}</div>` : "") + (c.small ? `<div class="small">${esc(c.small)}</div>` : ""),
        problems: c => c.items.map((item, i) => {
            let text = esc(item.text);
            (item.keys || []).forEach((key, k) => { text = text.replace(esc(key), `<span class="key" data-k="${i}:${k}">${esc(key)}</span>`); });
            // Any number of labels per item, stacked under it in the order given.
            const labels = (c.labels || []).map((l, j) => (l.item === i ? `<div class="pc-label" data-l="${j}">${glyphs(esc(l.text))}</div>` : "")).join("");
            return `<div class="pc"><div class="pc-tag">${esc(item.tag)}</div><div class="pc-title">${esc(item.title)}</div><div class="pc-text">${glyphs(text)}</div>${labels}</div>`;
        }).join(""),
        code: c => `<div class="code-head"><span>${esc(c.title || "")}</span><span>${esc(c.lang || "python")}</span></div>` +
            (c.pairs ? `<div class="code-pairs"><span class="lbl">${esc(c.pairs.label)}</span>${c.pairs.items.map(p => `<span class="pair">${esc(p)}</span>`).join("")}</div>` : "") +
            `<div class="code-body"></div>` + (c.labels || []).map(l => `<div class="code-label">${glyphs(esc(l.text))}</div>`).join(""),
        checklist: c => `<div class="cl-title">${esc(c.title)}</div>` + c.items.map((item, i) => `<div class="cl-item"><span class="cl-no">${String(i + 1).padStart(2, "0")}</span><span>${glyphs(esc(item))}</span></div>`).join(""),
        // Two columns; a column can carry a problem tag, a sample input in mono and notes that appear later.
        compare: c => c.columns.map(col => `<div class="cmp-col${col.tag ? " has-tag" : ""}">` +
            (col.tag ? `<div class="cmp-tag">${esc(col.tag)}</div>` : "") + `<div class="cmp-head">${esc(col.title)}</div>` +
            (col.sample ? `<div class="cmp-sample">${[].concat(col.sample).map(codeLine).join("<br>")}</div>` : "") +
            (col.items || []).map(item => `<div class="cmp-item">${glyphs(esc(item))}</div>`).join("") +
            (col.notes || []).map(n => `<div class="cmp-note">${glyphs(esc(n.text))}</div>`).join("") + "</div>").join(""),
        // Alien Dictionary: the word list, and for each neighboring pair the first letters that differ and the edge they give.
        words: c => `<div class="pc-tag">${esc(c.tag || "")}</div><div class="pc-title">${esc(c.title || "")}</div>` +
            (c.text ? `<div class="pc-text">${glyphs(esc(c.text))}</div>` : "") +
            `<div class="w-body"><div class="w-list">${c.words.map((w, i) => `<div class="w-row">${[...w].map((ch, k) => `<span class="w-ch" data-w="${i}" data-k="${k}">${esc(ch)}</span>`).join("")}</div>`).join("")}</div>` +
            `<div class="w-edges">${c.diffs.map((d, i) => `<div class="w-edge" style="top:${i * WORD_ROW + WORD_ROW / 2 + 7}px;height:${WORD_ROW - 14}px"><span class="w-brace"></span>` +
                `<span class="w-label">${d ? `<b>${esc(d.a)}</b><i class="g g-arrow"></i><b>${esc(d.b)}</b><span class="w-why">${esc(c.words[i])} / ${esc(c.words[i + 1])}</span>` : "no letter differs"}</span></div>`).join("")}</div></div>` +
            (c.footer ? `<div class="w-foot">${glyphs(esc(c.footer.text))}</div>` : ""),
        // A wrong line struck through, the right line under it.
        fix: c => `<div class="fx-title">${esc(c.title || "")}</div>` +
            `<div class="fx-line wrong"><span class="fx-tag">wrong</span><span class="fx-code">${codeLine(c.wrong.text)}<i class="fx-strike"></i></span></div>` +
            `<div class="fx-line right"><span class="fx-tag">right</span><span class="fx-code">${codeLine(c.right.text)}</span></div>` +
            (c.note ? `<div class="fx-note">${glyphs(esc(c.note.text))}</div>` : ""),
        // A deque: cells slide in at the front or the back, and the rule that moved them lights up.
        deque: c => (c.heading ? `<div class="dq-head">${glyphs(esc(c.heading))}</div>` : "") +
            `<div class="dq-rules">${c.rules.map(r => `<div class="dq-rule">${glyphs(esc(r))}</div>`).join("")}</div>` +
            `<div class="dq-track"><span class="dq-end">front</span><div class="dq-cells" style="width:${c.slots * DQ_STEP - DQ_GAP}px">` +
            Object.entries(c.cells).map(([id, cell]) => `<div class="dq-cell" data-id="${id}">${esc(cell.value)}${cell.cost !== undefined ? `<span class="dq-cost">+${esc(cell.cost)}</span>` : ""}</div>`).join("") +
            `</div><span class="dq-end">back</span></div>`,
        // Big statements stacked with arrows between; a line can count up to a number ({n} in its text).
        big: c => c.lines.map((line, i) => (i ? `<div class="bg-arrow"><i class="g g-arrow"></i></div>` : "") + `<div class="bg-line${i ? " accent" : ""}"></div>`).join("") +
            (c.note ? `<div class="bg-note">${glyphs(esc(c.note.text))}</div>` : ""),
        // Phrase → answer rows that build one by one, with optional questions above (the cheat sheet).
        sheet: c => (c.kicker ? `<div class="sh-kicker">${esc(c.kicker)}</div>` : "") + (c.heading ? `<div class="sh-heading">${glyphs(esc(c.heading))}</div>` : "") +
            (c.questions ? `<div class="sh-questions">${c.questions.items.map(q => `<span>${glyphs(esc(q))}</span>`).join("")}</div>` : "") +
            (c.title ? `<div class="sh-title">${esc(c.title)}</div>` : "") +
            c.rows.map(r => `<div class="sh-row"><span class="sh-phrase">${glyphs(esc(r.phrase))}</span><i class="g g-arrow"></i><span class="sh-answer">${glyphs(esc(r.answer))}</span></div>`).join(""),
        constraints: c => `<div class="cs-title">${esc(c.title || "Constraints")}</div>` + c.lines.map(line => `<div class="cs-line"><span class="cs-expr">${glyphs(esc(line.text))}</span><span class="cs-note">${glyphs(esc(line.note || ""))}</span></div>`).join("")
    };

    function makeCard(c) {
        if (c.type === "words") c.diffs = wordDiffs(c.words);
        if (c.type === "deque") {
            Object.assign(c, dequeStates(c));
            c.rules = c.rules || ["cost 0 → push to the front", "cost 1 → push to the back", "always pop from the front"];
        }
        if (c.type === "sheet") c.rows = c.rows.map(r => (r.text ? { ...r, phrase: r.text.split(" → ")[0], answer: r.text.split(" → ").slice(1).join(" → ") } : r));
        if (!builders[c.type]) throw new Error(`unknown card type "${c.type}"`);
        const node = el("div", `rc rc-${c.type} place-${c.place || "center"}${c.items && c.items.length === 1 ? " single" : ""}`, builders[c.type](c));
        if (c.type === "code") {
            c.tokens = c.lines.map(tokens);
            c.total = c.lines.reduce((n, l) => n + l.length + 1, 0) - 1;
        }
        cards.push({ c, node, key: "" });
    }

    // Characters of code typed by t: one range for the whole panel, or one per line.
    function typedChars(c, t) {
        if (!c.typing) return c.total;
        const ranges = Array.isArray(c.typing) ? c.typing : null;
        if (!ranges) return Math.round(c.total * Math.min(1, Math.max(0, (t - c.typing.from) / (c.typing.to - c.typing.from))));
        let chars = 0;
        c.lines.forEach((line, i) => {
            const r = ranges[i] || ranges[ranges.length - 1];
            chars += Math.round(line.length * Math.min(1, Math.max(0, (t - r.from) / (r.to - r.from)))) + (t >= r.to && i < c.lines.length - 1 ? 1 : 0);
        });
        return chars;
    }

    function fadeUp(node, t, at, lift = 8) {
        const k = ease((t - at) / .5);
        node.style.opacity = k.toFixed(3);
        node.style.translate = `0 ${((1 - k) * lift).toFixed(1)}px`;
        return k;
    }
    const latest = (list, t) => { let i = -1; list.forEach((x, k) => { if (x.at <= t) i = k; }); return i; };

    const renderers = {
        words(c, node, t) {
            const done = c.footer ? t >= c.footer.at : false;
            const current = done ? -1 : latest(c.arrows || [], t);
            node.querySelectorAll(".w-ch").forEach(ch => {
                const w = Number(ch.dataset.w), k = Number(ch.dataset.k), d = c.diffs[current];
                const inPair = d && (w === current || w === current + 1);
                ch.className = `w-ch${inPair && k === d.k ? " hit" : inPair && k < d.k ? " same" : ""}`;
            });
            node.querySelectorAll(".w-edge").forEach((edge, i) => {
                const a = c.arrows && c.arrows[i];
                edge.style.opacity = a ? ease((t - a.at) / .5).toFixed(3) : "0";
                edge.classList.toggle("on", i === current);
            });
            const foot = node.querySelector(".w-foot");
            if (foot) fadeUp(foot, t, c.footer.at);
        },
        fix(c, node, t) {
            const struck = ease((t - c.wrong.at) / .6);
            node.querySelector(".fx-strike").style.width = `${(struck * 100).toFixed(1)}%`;
            node.querySelector(".fx-line.wrong").classList.toggle("struck", struck > .5);
            fadeUp(node.querySelector(".fx-line.right"), t, c.right.at);
            if (c.note) fadeUp(node.querySelector(".fx-note"), t, c.note.at);
        },
        deque(c, node, t) {
            let k = 0;
            c.states.forEach((st, i) => { if (st.t <= t) k = i; });
            const now = c.states[k], before = k ? c.states[k - 1] : now, p = k ? ease((t - now.t) / .45) : 1;
            node.querySelectorAll(".dq-cell").forEach(cell => {
                const id = cell.dataset.id, a = before.ids.indexOf(id), b = now.ids.indexOf(id);
                let x = b, o = 1;
                if (a >= 0 && b >= 0) x = a + (b - a) * p;
                else if (b >= 0) { x = b + (1 - p) * (now.op.op === "front" ? -1 : 1); o = p; }
                else if (a >= 0) { x = a - p; o = 1 - p; }
                else o = 0;
                cell.style.opacity = o.toFixed(3);
                cell.style.left = `${(x * DQ_STEP).toFixed(1)}px`;
                cell.classList.toggle("new", k > 0 && b >= 0 && a < 0);
            });
            const lit = k ? { front: 0, back: 1, pop: 2 }[now.op.op] : -1;
            node.querySelectorAll(".dq-rule").forEach((rule, i) => rule.classList.toggle("on", i === lit));
        },
        big(c, node, t) {
            const lines = node.querySelectorAll(".bg-line"), arrows = node.querySelectorAll(".bg-arrow");
            c.lines.forEach((line, i) => {
                const k = fadeUp(lines[i], t, line.at, 12);
                if (i) arrows[i - 1].style.opacity = k.toFixed(3);
                const n = line.count === undefined ? null : fmtInt(line.count * ease((t - line.at) / (line.countFor ?? 1.6)));
                const text = n === null ? line.text : line.text.replace("{n}", n);
                if (lines[i].dataset.text !== text) { lines[i].dataset.text = text; lines[i].innerHTML = glyphs(esc(text)); }
            });
            if (c.note) fadeUp(node.querySelector(".bg-note"), t, c.note.at);
        },
        sheet(c, node, t) {
            const shown = c.rows.map(r => r.at <= t);
            const newest = latest(c.rows, t);
            const visible = shown.filter(Boolean).length;
            node.querySelectorAll(".sh-row").forEach((row, i) => {
                // `limit` keeps only the newest rows (a side panel over clips); older ones step out.
                const out = !shown[i] || (c.limit && i <= newest - c.limit);
                row.style.display = out ? "none" : "";
                if (out) return;
                fadeUp(row, t, c.rows[i].at, 10);
                row.classList.toggle("on", c.focus !== false && i === newest && visible > 0 && (c.rows[i].until === undefined || t < c.rows[i].until));
            });
            const q = node.querySelector(".sh-questions");
            if (q) fadeUp(q, t, c.questions.at);
        }
    };

    function renderCard(card, t) {
        const { c, node } = card;
        const a = opacity(t, c.from, c.to);
        node.style.opacity = a.toFixed(3);
        node.style.visibility = a > 0 ? "visible" : "hidden";
        if (a <= 0) return;
        node.style.translate = `0 ${((1 - ease((t - c.from) / FADE)) * 12).toFixed(1)}px`;
        const kids = node.querySelectorAll(c.type === "problems" ? ".pc" : c.type === "checklist" ? ".cl-item" : c.type === "constraints" ? ".cs-line" : ".kicker, .rule, h1, h2");
        if (c.show) kids.forEach((kid, i) => {
            const k = ease((t - (c.show[i] ?? Infinity)) / .5);
            // A checklist builds line by line: unseen lines take no space.
            if (c.type === "checklist") kid.style.display = t < (c.show[i] ?? Infinity) ? "none" : "";
            kid.style.opacity = k.toFixed(3);
            kid.style.translate = `0 ${((1 - k) * 10).toFixed(1)}px`;
        });
        if (c.type === "title" || c.type === "next") node.querySelectorAll(".kicker, .rule, h1, h2, .url, .small").forEach((kid, i) => {
            const k = ease((t - c.from - .25 - i * .3) / .6);
            kid.style.opacity = k.toFixed(3);
            kid.style.translate = `0 ${((1 - k) * 14).toFixed(1)}px`;
        });
        if (c.type === "problems") {
            (c.marks || []).forEach(m => {
                const key = node.querySelector(`.key[data-k="${m.item}:${m.key}"]`);
                if (!key) return;
                const k = ease((t - m.at) / .4);
                key.style.backgroundColor = `rgba(138, 194, 255, ${(0.18 * k).toFixed(3)})`;
                key.style.color = k > .5 ? "var(--r-accent)" : "";
                key.style.borderBottomColor = `rgba(138, 194, 255, ${k.toFixed(3)})`;
            });
            (c.labels || []).forEach((l, j) => {
                const label = node.querySelector(`.pc-label[data-l="${j}"]`);
                if (!label) return;
                const k = ease((t - l.at) / .5);
                label.style.opacity = k.toFixed(3);
                label.style.translate = `0 ${((1 - k) * 8).toFixed(1)}px`;
            });
        }
        if (c.type === "code") {
            // Size the card once from the full code, so it does not widen as lines type in.
            if (!card.sized) {
                node.querySelector(".code-body").innerHTML = codeHTML(c, c.total, false);
                node.style.width = `${Math.max(620, Math.ceil(node.querySelector(".code-body").scrollWidth) + 24)}px`;
                card.sized = true;
                card.key = "";
            }
            const chars = typedChars(c, t);
            const start = c.typing ? (Array.isArray(c.typing) ? c.typing[0].from : c.typing.from) : -Infinity;
            const typing = t >= start && chars < c.total, key = `${chars}:${typing}`;
            const body = node.querySelector(".code-body");
            if (card.key !== key) { card.key = key; body.innerHTML = codeHTML(c, chars, typing); }
            body.querySelectorAll(".ln").forEach(ln => {
                const n = Number(ln.dataset.line);
                const h = (c.highlights || []).find(x => x.line === n && t >= x.at && (x.until === undefined || t < x.until));
                ln.classList.toggle("hl", Boolean(h));
            });
            if (c.pairs) {
                const step = (c.steps || []).filter(s => t >= s).length - 1;
                node.querySelectorAll(".pair").forEach((p, i) => { p.className = `pair${i < step ? " done" : i === step ? " on" : ""}`; });
            }
        }
        if (c.type === "code") node.querySelectorAll(".code-label").forEach((label, i) => {
            const k = ease((t - c.labels[i].at) / .5);
            label.style.opacity = k.toFixed(3);
            label.style.display = k > 0 ? "block" : "none";
        });
        if (c.type === "compare") node.querySelectorAll(".cmp-col").forEach((col, i) => {
            const k = ease((t - c.columns[i].at) / .5);
            col.style.opacity = k.toFixed(3);
            col.style.translate = `0 ${((1 - k) * 10).toFixed(1)}px`;
            col.querySelectorAll(".cmp-note").forEach((note, j) => fadeUp(note, t, c.columns[i].notes[j].at));
        });
        if (renderers[c.type]) renderers[c.type](c, node, t);
        if (c.type === "checklist") {
            const current = (c.active || []).filter(x => t >= x.at).pop();
            node.querySelectorAll(".cl-item").forEach((item, i) => item.classList.toggle("on", Boolean(current) && current.item === i));
        }
        if (c.type === "constraints") {
            node.querySelectorAll(".cs-note").forEach((note, i) => { note.style.opacity = ease((t - ((c.notes || [])[i] ?? Infinity)) / .5).toFixed(3); });
        }
    }

    /* --------------------------------------------------------------- camera ---- */

    // `hold: true` keeps a shot's first placement while the target changes size under it
    // (a tall tree that path compression flattens), so the camera does not re-zoom.
    function placement(shot) {
        if (shot.hold && shot.held) return shot.held;
        const p = place(shot);
        if (shot.hold) shot.held = p;
        return p;
    }

    function place(shot) {
        main.style.transform = "none";
        const base = main.getBoundingClientRect();
        // `union: true` frames every element the selector matches (a graph's nodes, without the
        // empty canvas around them); `margin` (px) leaves room around the target.
        const targets = !shot.target ? [] : shot.union ? [...document.querySelectorAll(shot.target)] : [document.querySelector(shot.target)].filter(Boolean);
        const boxes = targets.map(t => t.getBoundingClientRect()).filter(r => r.width || r.height);
        const m = shot.margin ?? 0;
        const rect = !boxes.length ? base : (([l, t, r, b]) => ({ left: l - m, top: t - m, width: r - l + 2 * m, height: b - t + 2 * m }))(
            [Math.min(...boxes.map(r => r.left)), Math.min(...boxes.map(r => r.top)), Math.max(...boxes.map(r => r.right)), Math.max(...boxes.map(r => r.bottom))]);
        const [x0, y0, x1, y1] = shot.box || [.06, .06, .94, .8];
        const s = shot.zoom ?? Math.min((x1 - x0) * W / rect.width, (y1 - y0) * H / rect.height, shot.maxZoom ?? 1.8);
        const cx = rect.left - base.left + rect.width / 2, cy = rect.top - base.top + rect.height / 2;
        return { s, tx: (x0 + x1) / 2 * W - s * cx, ty: (y0 + y1) / 2 * H - s * cy };
    }

    // Shots on the same page glide; a page switch, a far jump or `dip: true` dips to dark.
    function camera(t) {
        const index = Math.max(0, T.shots.findIndex((shot, i) => shot.t <= t && (i === T.shots.length - 1 || T.shots[i + 1].t > t)));
        const shot = T.shots[index];
        let current = shot, darkness = 0, p;
        const previous = index > 0 ? T.shots[index - 1] : null, age = t - shot.t;
        if (previous && age < CAMERA_MOVE && (shot.dip || previous.page !== shot.page) && age < 2 * DIP) {
            if (age < DIP) { current = previous; darkness = ease(age / DIP); } else darkness = 1 - ease((age - DIP) / DIP);
            p = placement(current);
        } else if (previous && age < CAMERA_MOVE && !shot.dip && previous.page === shot.page) {
            const before = placement(previous), now = placement(shot), k = ease(age / CAMERA_MOVE);
            p = { s: before.s + (now.s - before.s) * k, tx: before.tx + (now.tx - before.tx) * k, ty: before.ty + (now.ty - before.ty) * k };
        } else p = placement(shot);
        main.style.transform = `translate(${p.tx.toFixed(2)}px, ${p.ty.toFixed(2)}px) scale(${p.s.toFixed(4)})`;
        dip.style.opacity = darkness.toFixed(3);
        // Reels: the foot band starts where the current shot's film window ends.
        if (foot) foot.style.top = `${((current.box || [0, 0, 0, .81])[3] * H).toFixed(1)}px`;
        renderSpot(current);
    }

    function renderSpot(shot) {
        const selector = shot.spot === false ? null : (typeof shot.spot === "string" ? shot.spot : shot.target);
        const node = selector && document.querySelector(selector);
        if (!node) { spot.style.opacity = "0"; return; }
        const rect = node.getBoundingClientRect(), pad = shot.pad ?? 10;
        spot.style.outlineColor = `rgba(14, 18, 24, ${shot.dim ?? .93})`;
        Object.assign(spot.style, { left: `${(rect.left - pad).toFixed(1)}px`, top: `${(rect.top - pad).toFixed(1)}px`, width: `${(rect.width + 2 * pad).toFixed(1)}px`, height: `${(rect.height + 2 * pad).toFixed(1)}px`, opacity: "1" });
    }

    // The page dims under cards: each keyframe eases from wherever the veil was toward its level.
    function renderVeil(t) {
        const keys = T.veils.filter(v => v.t <= t);
        let value = keys.length ? keys[0].level : 0;
        for (let i = 1; i < keys.length; i++) value += (keys[i].level - value) * ease(((i + 1 < keys.length ? keys[i + 1].t : t) - keys[i].t) / VEIL_FADE);
        veil.style.opacity = value.toFixed(3);
    }

    /* Vertical reels: one short sentence at a time in the top band, optics-reel style. */
    function renderReelCaption(t) {
        const i = T.captions.findIndex(c => t >= c.t && t < c.end);
        const c = T.captions[i];
        if (!c) { caption.style.opacity = "0"; return; }
        if (caption.dataset.key !== String(i)) {
            caption.dataset.key = String(i);
            // {name} is a value measured during setup (a path length), so a caption never states a stale number.
            const fill = text => text.replace(/\{(\w+)\}/g, (m, name) => String(measured[name] ?? "–"));
            caption.innerHTML = c.lines.map(line => `<span class="line">${glyphs(fill(line))}</span>`).join("") + (c.sub ? `<span class="sub">${glyphs(fill(c.sub))}</span>` : "");
        }
        // Back-to-back captions swap quickly instead of fading through an empty band.
        const prev = T.captions[i - 1], next = T.captions[i + 1];
        const joinedIn = prev && c.t - prev.end < .05, joinedOut = next && next.t - c.end < .05;
        const fadeIn = ease((t - c.t) / (joinedIn ? .22 : FADE)), fadeOut = ease((c.end - t) / (joinedOut ? .18 : FADE));
        caption.style.opacity = Math.min(fadeIn, fadeOut).toFixed(3);
        caption.style.translate = `0 ${((1 - fadeIn) * (joinedIn ? 6 : 14)).toFixed(1)}px`;
    }

    function renderEnd(t) {
        const k = ease((t - T.endCard) / .8);
        end.style.opacity = k.toFixed(3);
        [...end.children].forEach((child, i) => {
            const c = ease((t - T.endCard - .3 - i * .35) / .6);
            child.style.opacity = c.toFixed(3);
            child.style.translate = `0 ${((1 - c) * 18).toFixed(1)}px`;
        });
        const film = (t < T.endCard ? 1 : 1 - k).toFixed(3);
        mark.style.opacity = band.style.opacity = foot.style.opacity = film;
    }

    function renderCaption(t) {
        if (T.vertical) { renderReelCaption(t); return; }
        const list = T.captions;
        let i = -1;
        for (let k = 0; k < list.length && list[k].t <= t; k++) i = k;
        const c = list[i], next = list[i + 1];
        const until = c ? Math.min(next ? next.t : Infinity, c.end + .7) : 0;
        if (!c || t >= until || !T.captionsOn) { caption.style.opacity = "0"; return; }
        if (caption.dataset.key !== String(i)) { caption.dataset.key = String(i); caption.innerHTML = `<span>${glyphs(esc(c.text))}</span>`; }
        // Back-to-back sentences swap like subtitles; fades only around real pauses.
        const prev = list[i - 1];
        const fadeIn = prev && prev.end + .7 >= c.t - .05 ? 1 : ease((t - c.t) / .25);
        const fadeOut = next && next.t <= c.end + .7 ? 1 : ease((until - t) / .25);
        caption.style.opacity = Math.min(fadeIn, fadeOut).toFixed(3);
    }

    // Live readouts copied from the page: an attribute, or the text of the first element
    // matching `source` (and `match`), optionally cut down by the regex group `pick`.
    function chipText(c) {
        if (c.value !== undefined) return c.value;
        if (c.measured) return String(measured[c.measured] ?? "–");
        const nodes = [...document.querySelectorAll(c.source)];
        const node = c.match ? nodes.find(n => new RegExp(c.match).test(n.textContent)) : nodes[0];
        if (!node) return "–";
        let text = c.attr ? node.getAttribute(c.attr) ?? "–" : node.textContent.trim().replace(/\s+/g, " ");
        if (c.pick) text = (text.match(new RegExp(c.pick)) || [, "–"])[1];
        return text.replace(/ -> /g, " → ");
    }

    function renderChips(t) {
        const item = T.chips.find(c => t >= c.from - FADE && t < c.to + FADE);
        if (!item) { chips.style.opacity = "0"; return; }
        if (chips.dataset.key !== String(T.chips.indexOf(item))) {
            chips.dataset.key = String(T.chips.indexOf(item));
            chips.className = `reel-chips place-${item.place || "right"}`;
            chips.innerHTML = item.items.map(c => `<div class="chip${c.accent ? " accent" : ""}"><span class="k">${esc(c.label)}</span><span class="v"></span></div>`).join("");
        }
        [...chips.children].forEach((node, i) => {
            const c = item.items[i], text = chipText(c);
            node.lastElementChild.innerHTML = glyphs(esc(text));
            if (c.from !== undefined) node.style.opacity = ease((t - c.from) / .4).toFixed(3);
        });
        chips.style.opacity = opacity(t, item.from, item.to).toFixed(3);
    }

    // Page elements hidden until a moment (things that "appear"), and marked ones.
    function renderPageStyles(t) {
        for (const h of T.hides) {
            if (t < h.from || t > h.until + .6) continue;
            const k = ease((t - h.until) / .45);
            document.querySelectorAll(h.selector).forEach(node => { node.style.opacity = k >= 1 ? "" : k.toFixed(3); });
        }
        // Marks add a class for their window: reel-hit (node ring), reel-warn, reel-edge (lit
        // edge), reel-plain (an edge drawn plain, hiding a tool highlight until its moment), reel-row.
        for (const m of T.marks) {
            const cls = `reel-${m.tone || "hit"}`, on = t >= m.from && t < m.to;
            const held = () => T.marks.some(o => o !== m && (o.tone || "hit") === (m.tone || "hit") && o.selector === m.selector && t >= o.from && t < o.to);
            document.querySelectorAll(m.selector).forEach(node => {
                if (on) node.classList.add(cls);
                else if (node.classList.contains(cls) && !held()) node.classList.remove(cls);
            });
        }
    }

    /* ----------------------------------------------------------------- api ---- */

    function init(data, name) {
        T = data; page = name; W = T.W; H = T.H;
        const focus = HTMLElement.prototype.focus;
        HTMLElement.prototype.focus = function (options) { focus.call(this, { ...options, preventScroll: true }); };
        Element.prototype.scrollIntoView = function () {};
        main = document.querySelector("main");
        root = document.createElement("div");
        root.id = "reel-root";
        document.body.appendChild(root);
        if (T.vertical) root.classList.add("vertical");
        spot = el("div", "reel-spot");
        veil = el("div", "reel-veil");
        if (T.vertical) { band = el("div", "reel-band"); foot = el("div", "reel-foot"); }
        chips = el("div", "reel-chips");
        mark = el("div", "reel-mark", T.mark);
        T.cards.forEach(makeCard);
        caption = el("div", "reel-caption");
        dip = el("div", "reel-dip");
        if (T.vertical) {
            const e = T.end;
            end = el("div", "reel-end", `<div class="kicker">${esc(e.kicker)}</div><h1>${e.title}</h1><div class="rule"></div>` +
                `<div class="formula">${glyphs(e.line)}</div><div class="list">${glyphs(e.list)}</div><div class="url">${esc(e.url)}</div><div class="small">${esc(e.small)}</div>`);
        }
    }

    function act(action) {
        if (action.unless && new Function(`return (${action.unless})`)()) return "skipped";
        if (action.act === "run") return new Function(`return (${action.fn})`)()(...(action.args || []));
        const node = document.querySelector(action.target);
        if (!node) throw new Error(`reel action target missing: ${action.target}`);
        if (action.act === "click") node.click();
        if (action.act === "set") {
            node.value = String(action.value);
            node.dispatchEvent(new Event("input", { bubbles: true }));
            node.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return "ok";
    }

    function hash(text) {
        let h = 2166136261;
        for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
        return (h >>> 0).toString(36);
    }

    function frame(t) {
        if (scrollX || scrollY) scrollTo(0, 0);
        renderPageStyles(t);
        camera(t);
        renderVeil(t);
        cards.forEach(card => renderCard(card, t));
        renderCaption(t);
        renderChips(t);
        if (T.vertical) renderEnd(t);
        else mark.style.opacity = (Math.min(ease((t - T.INTRO) / .8), ease((T.DURATION - T.OUTRO - t) / .8)) * .9).toFixed(3);
        return `${hash(document.body.innerHTML)}:${window.__reelDraws || 0}`;
    }

    window.__reel = { init, frame, act, setMeasured: values => { measured = values; } };
})();
