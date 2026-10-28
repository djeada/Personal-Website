document.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id),
        canvas = $("searching-canvas"),
        ctx = canvas.getContext("2d");
    const ui = {
        algorithm: $("algorithm"),
        target: $("search-target"),
        size: $("array-size"),
        speed: $("speed"),
        values: $("array-values"),
        start: $("start"),
        pause: $("pause"),
        step: $("step"),
        reset: $("reset"),
        random: $("randomize"),
        apply: $("apply-values"),
        upload: $("upload-array"),
        file: $("array-file"),
        defaults: $("reset-defaults"),
        operation: $("operation-label")
    };
    const names = {
        linear: "Linear",
        binary: "Binary",
        jump: "Jump",
        interpolation: "Interpolation"
    };
    const fallbackPalette = {
        canvas: "#ffffff",
        grid: "rgba(14, 18, 24, 0.08)",
        rule: "#dce1e8",
        ruleStrong: "#9aa6b5",
        ink2: "#3a4452",
        ink3: "#5b6676",
        gold: "#1f4fd1",
        verdigris: "#137a55",
        moon: "#6d4fd0"
    };
    const palette = () => Object.assign({}, fallbackPalette, window.ToolShared?.palette?.() || {});
    const toast = window.ToolShared?.showToast || ((message) => console.info(message));
    window.ToolShared?.initCardToggles();

    class SearchVisualizer {
        constructor() {
            this.array = [];
            this.original = [];
            this.runId = 0;
            this.running = false;
            this.paused = false;
            this.manual = false;
            this.credits = 0;
            this.visited = new Set();
            this.comparisons = 0;
            this.started = 0;
            this.randomize(false);
            this.bind();
            this.algorithmChanged();
        }
        bind() {
            ui.start.onclick = () => this.start();
            ui.pause.onclick = () => this.togglePause();
            ui.step.onclick = () => this.step();
            ui.reset.onclick = () => this.restore();
            ui.random.onclick = () => this.randomize();
            ui.apply.onclick = () => this.apply();
            ui.upload.onclick = () => ui.file.click();
            ui.file.onchange = () => this.upload();
            ui.algorithm.onchange = () => {
                this.stop();
                this.algorithmChanged();
                this.restore(false)
            };
            ui.size.onchange = () => this.randomize();
            ui.defaults.onclick = () => {
                ui.algorithm.value = "linear";
                ui.size.value = 24;
                ui.speed.value = 5;
                ui.target.value = "";
                this.algorithmChanged();
                this.randomize()
            };
            document.querySelectorAll("[data-preset]").forEach(b => b.onclick = () => this.preset(b.dataset.preset));
            document.addEventListener("keydown", e => {
                if (e.code === "Space" && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
                    e.preventDefault();
                    this.running ? this.togglePause() : this.start()
                }
            });
        }
        valid(values) {
            return values.length >= 2 && values.length <= 60 && values.every(v => Number.isInteger(v) && v >= 0 && v <= 999)
        }
        parse(text, json = false) {
            if (json) {
                const p = JSON.parse(text);
                return (Array.isArray(p) ? p : p?.values || []).map(Number)
            }
            return text.trim().split(/[\s,;]+/).filter(Boolean).map(Number)
        }
        setData(values, message) {
            this.stop();
            this.array = values.slice();
            this.original = values.slice();
            ui.size.value = values.length;
            ui.values.value = values.join(", ");
            this.clear();
            this.draw();
            if (message) toast(message, "info")
        }
        apply() {
            const v = this.parse(ui.values.value);
            if (!this.valid(v)) {
                toast("Enter 2–60 whole numbers from 0 to 999", "error");
                return
            }
            this.setData(v, "Custom values applied")
        }
        async upload() {
            const f = ui.file.files[0];
            if (!f) return;
            try {
                const v = this.parse(await f.text(), f.name.toLowerCase().endsWith(".json"));
                if (!this.valid(v)) throw Error();
                this.setData(v, `${f.name} loaded`)
            } catch {
                toast("Could not read this array. Use 2–60 whole numbers from 0 to 999.", "error")
            }
            ui.file.value = ""
        }
        randomize(notify = true) {
            const n = Math.max(4, Math.min(60, Number(ui.size.value) || 24));
            this.setData(Array.from({
                length: n
            }, () => 5 + Math.floor(Math.random() * 95)), notify ? "New random dataset" : "")
        }
        preset(kind) {
            const n = Math.max(4, Math.min(60, Number(ui.size.value) || 24));
            let v;
            if (kind === "sorted") v = Array.from({
                length: n
            }, (_, i) => Math.round(5 + 94 * i / Math.max(1, n - 1)));
            else if (kind === "clustered") v = Array.from({
                length: n
            }, () => Math.floor(Math.random() * 20) + (Math.random() > .5 ? 20 : 70));
            else v = Array.from({
                length: n
            }, () => [15, 30, 45, 60, 75, 90][Math.floor(Math.random() * 6)]);
            this.setData(v, `${kind[0].toUpperCase()+kind.slice(1)} dataset loaded`)
        }
        restore(notify = true) {
            this.stop();
            this.array = this.original.slice();
            this.clear();
            this.draw();
            if (notify) toast("Original dataset restored", "info")
        }
        stop() {
            this.runId++;
            this.running = false;
            this.paused = false;
            this.manual = false;
            this.credits = 0;
            ui.pause.innerHTML = 'Pause'
        }
        clear() {
            this.visited.clear();
            this.comparisons = 0;
            this.started = 0;
            this.stats();
            ui.operation.textContent = "Ready"
        }
        algorithmChanged() {
            $("algorithm-name").textContent = names[ui.algorithm.value]
        }
        stats() {
            $("comparisons-count").textContent = this.comparisons;
            $("elapsed-time").textContent = this.started ? `${Date.now()-this.started}ms` : "0ms"
        }
        resize() {
            const wrap = canvas.closest(".canvas-wrapper"),
                s = Math.max(260, Math.min(760, wrap.clientWidth - 24)),
                r = Math.min(devicePixelRatio || 1, 2);
            canvas.style.width = `${s}px`;
            canvas.style.height = `${s}px`;
            canvas.width = s * r;
            canvas.height = s * r;
            ctx.setTransform(r, 0, 0, r, 0, 0);
            this.width = s;
            this.height = s
        }
        draw(current = -1, found = -1, range = null, message) {
            if (!this.width) this.resize();
            this.lastFrame = [current, found, range];
            const c = palette(),
                w = this.width,
                h = this.height,
                n = this.array.length,
                p = Math.max(18, w * .045),
                top = Math.max(42, h * .1),
                base = h - p,
                max = Math.max(...this.array, 1),
                slot = (w - p * 2) / n,
                gap = Math.min(5, Math.max(1, slot * .14)),
                bw = Math.max(2, slot - gap);
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = c.canvas;
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = c.grid;
            ctx.lineWidth = 1;
            for (let i = 1; i < 5; i++) {
                const y = Math.round(top + (base - top) * i / 5) + .5;
                ctx.beginPath();
                ctx.moveTo(p, y);
                ctx.lineTo(w - p, y);
                ctx.stroke()
            }
            this.array.forEach((v, i) => {
                const bh = Math.max(3, (base - top) * v / max),
                    x = p + i * slot + gap / 2,
                    y = base - bh;
                let fill = c.ink3,
                    alpha = .42;
                if (this.visited.has(i))[fill, alpha] = [c.moon, .85];
                if (range && (i < range[0] || i > range[1]))[fill, alpha] = [c.rule, 1];
                if (i === current)[fill, alpha] = [c.gold, 1];
                if (i === found)[fill, alpha] = [c.verdigris, 1];
                ctx.globalAlpha = alpha;
                ctx.fillStyle = fill;
                ctx.fillRect(x, y, bw, bh);
                ctx.globalAlpha = 1;
                if (slot >= 24 || n <= 16) {
                    ctx.fillStyle = i === current ? c.gold : i === found ? c.verdigris : c.ink2;
                    ctx.font = `500 ${Math.max(10,Math.min(13,slot*.36))}px "IBM Plex Mono", ui-monospace, monospace`;
                    ctx.textAlign = "center";
                    ctx.fillText(String(v), x + bw / 2, y - 7)
                }
            });
            ctx.strokeStyle = c.ruleStrong;
            ctx.beginPath();
            ctx.moveTo(p, Math.round(base) + .5);
            ctx.lineTo(w - p, Math.round(base) + .5);
            ctx.stroke();
            if (message) ui.operation.textContent = message
        }
        async check(index, range, message) {
            if (!this.running) return false;
            this.comparisons++;
            this.draw(index, -1, range, message);
            this.stats();
            while (this.running && (this.paused || (this.manual && this.credits === 0))) await new Promise(r => setTimeout(r, 24));
            if (!this.running) return false;
            if (this.manual) this.credits--;
            await new Promise(r => setTimeout(r, 230 - Number(ui.speed.value) * 22));
            this.visited.add(index);
            return this.running
        }
        togglePause() {
            if (!this.running) return;
            this.manual = false;
            this.paused = !this.paused;
            ui.pause.innerHTML = this.paused ? 'Resume' : 'Pause'
        }
        step() {
            if (!this.running) {
                this.manual = true;
                this.start(true)
            } else {
                this.manual = true;
                this.paused = false;
                this.credits++
            }
        }
        async start(step = false) {
            if (this.running) return;
            let target = Number(ui.target.value);
            if (ui.target.value.trim() === "") target = this.array[Math.floor(Math.random() * this.array.length)];
            if (!Number.isInteger(target)) {
                toast("Enter a whole-number target", "error");
                return
            }
            ui.target.value = target;
            $("target-value").textContent = target;
            this.array = this.original.slice();
            const requiresSorted = ui.algorithm.value !== "linear";
            if (requiresSorted) this.array.sort((a, b) => a - b);
            ui.values.value = this.original.join(", ");
            this.visited.clear();
            this.comparisons = 0;
            this.started = Date.now();
            this.running = true;
            this.paused = false;
            this.manual = step;
            this.credits = step ? 1 : 0;
            const id = ++this.runId,
                algo = ui.algorithm.value;
            if (requiresSorted) toast(`${names[algo]} search uses a sorted view of your array`, "info");
            const found = await this[algo](target);
            if (!this.running || id !== this.runId) return;
            this.running = false;
            this.manual = false;
            this.stats();
            if (found >= 0) {
                this.draw(-1, found, null, `Found ${target} at index ${found}`);
                toast(`Found after ${this.comparisons} comparisons`, "success")
            } else {
                this.draw(-1, -1, [1, 0], `${target} was not found`);
                toast(`Not found after ${this.comparisons} comparisons`, "warning")
            }
        }
        async linear(t) {
            for (let i = 0; i < this.array.length; i++) {
                if (!await this.check(i, null, `Check index ${i}: ${this.array[i]}`)) return -1;
                if (this.array[i] === t) return i
            }
            return -1
        }
        async binary(t) {
            let l = 0,
                r = this.array.length - 1;
            while (l <= r) {
                const m = (l + r) >> 1;
                if (!await this.check(m, [l, r], `Check middle index ${m}`)) return -1;
                if (this.array[m] === t) return m;
                if (this.array[m] < t) l = m + 1;
                else r = m - 1
            }
            return -1
        }
        async jump(t) {
            const n = this.array.length,
                jump = Math.max(1, Math.floor(Math.sqrt(n)));
            let prev = 0,
                next = jump;
            while (prev < n && this.array[Math.min(next, n) - 1] < t) {
                const i = Math.min(next, n) - 1;
                if (!await this.check(i, [prev, n - 1], `Jump to index ${i}`)) return -1;
                prev = next;
                next += jump
            }
            for (let i = prev; i < Math.min(next, n); i++) {
                if (!await this.check(i, [prev, Math.min(next, n) - 1], `Scan block at index ${i}`)) return -1;
                if (this.array[i] === t) return i
            }
            return -1
        }
        async interpolation(t) {
            let l = 0,
                r = this.array.length - 1;
            while (l <= r && t >= this.array[l] && t <= this.array[r]) {
                let pos = this.array[l] === this.array[r] ? l : l + Math.floor((r - l) * (t - this.array[l]) / (this.array[r] - this.array[l]));
                pos = Math.max(l, Math.min(r, pos));
                if (!await this.check(pos, [l, r], `Estimate index ${pos}`)) return -1;
                if (this.array[pos] === t) return pos;
                if (this.array[pos] < t) l = pos + 1;
                else r = pos - 1
            }
            return -1
        }
    }
    const visualizer = new SearchVisualizer(),
        resize = () => {
            visualizer.resize();
            visualizer.draw(...(visualizer.lastFrame || []))
        };
    new ResizeObserver(resize).observe(canvas.closest(".canvas-wrapper"));
    window.addEventListener("resize", resize);
    window.ToolShared?.onThemeChange?.(() => visualizer.draw(...(visualizer.lastFrame || [])));
});