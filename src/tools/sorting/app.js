document.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id);
    const canvas = $("sorting-canvas");
    const ctx = canvas.getContext("2d");
    const controls = {
        algorithm: $("algorithm"), size: $("array-size"), speed: $("speed"), values: $("array-values"),
        start: $("start"), pause: $("pause"), step: $("step"), reset: $("reset"), randomize: $("randomize"),
        apply: $("apply-values"), defaults: $("reset-defaults"), operation: $("operation-label")
    };
    const names = { bubble: "Bubble", selection: "Selection", insertion: "Insertion", merge: "Merge", quick: "Quick", heap: "Heap", radix: "Radix" };
    const color = (name, fallback) => getComputedStyle(document.body).getPropertyValue(`--visual-${name}`).trim() || fallback;
    const toast = window.ToolShared?.showToast || ((message) => console.info(message));
    window.ToolShared?.initCardToggles();

    class SortingVisualizer {
        constructor() {
            this.array = [];
            this.original = [];
            this.runId = 0;
            this.running = false;
            this.paused = false;
            this.stepCredits = 0;
            this.completed = new Set();
            this.swaps = 0;
            this.comparisons = 0;
            this.startedAt = 0;
            this.randomize(false);
            this.bind();
            this.updateAlgorithm();
        }

        bind() {
            controls.start.addEventListener("click", () => this.start());
            controls.pause.addEventListener("click", () => this.togglePause());
            controls.step.addEventListener("click", () => this.step());
            controls.reset.addEventListener("click", () => this.restore());
            controls.randomize.addEventListener("click", () => this.randomize());
            controls.apply.addEventListener("click", () => this.applyValues());
            controls.algorithm.addEventListener("change", () => { this.stop(); this.updateAlgorithm(); this.restore(false); });
            controls.size.addEventListener("change", () => this.randomize());
            controls.defaults.addEventListener("click", () => {
                controls.algorithm.value = "bubble"; controls.size.value = 24; controls.speed.value = 5;
                this.updateAlgorithm(); this.randomize();
            });
            document.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => this.preset(button.dataset.preset)));
            document.addEventListener("keydown", (event) => {
                if (event.code !== "Space" || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
                event.preventDefault(); this.running ? this.togglePause() : this.start();
            });
        }

        setData(values, message) {
            this.stop();
            this.array = values.slice(); this.original = values.slice(); controls.size.value = values.length;
            controls.values.value = values.join(", "); this.clearStats(); this.draw();
            if (message) toast(message, "info");
        }

        randomize(notify = true) {
            const size = Math.max(4, Math.min(60, Number(controls.size.value) || 24));
            this.setData(Array.from({ length: size }, () => 5 + Math.floor(Math.random() * 95)), notify ? "New random dataset" : "");
        }

        preset(kind) {
            const n = Math.max(4, Math.min(60, Number(controls.size.value) || 24));
            let values;
            if (kind === "reverse") values = Array.from({ length: n }, (_, i) => Math.round(5 + (94 * (n - i - 1)) / Math.max(1, n - 1)));
            else if (kind === "few") values = Array.from({ length: n }, () => [20, 40, 60, 80][Math.floor(Math.random() * 4)]);
            else {
                values = Array.from({ length: n }, (_, i) => Math.round(5 + (94 * i) / Math.max(1, n - 1)));
                for (let i = 0; i < Math.max(2, n / 6); i++) { const a = Math.floor(Math.random() * n), b = Math.floor(Math.random() * n); [values[a], values[b]] = [values[b], values[a]]; }
            }
            this.setData(values, `${kind === "few" ? "Few unique" : kind === "reverse" ? "Reverse" : "Nearly sorted"} dataset loaded`);
        }

        applyValues() {
            const tokens = controls.values.value.trim().split(/[\s,;]+/).filter(Boolean);
            const values = tokens.map(Number);
            if (values.length < 2 || values.length > 60 || values.some((v) => !Number.isInteger(v) || v < 0 || v > 999)) {
                toast("Enter 2–60 whole numbers from 0 to 999", "error"); return;
            }
            this.setData(values, "Custom values applied");
        }

        restore(notify = true) { this.stop(); this.array = this.original.slice(); this.clearStats(); this.draw(); if (notify) toast("Original dataset restored", "info"); }
        stop() { this.runId++; this.running = false; this.paused = false; this.stepCredits = 0; controls.pause.innerHTML = '<span class="btn-icon">⏸️</span> Pause'; }
        clearStats() { this.completed.clear(); this.swaps = 0; this.comparisons = 0; this.startedAt = 0; this.stats(); this.operation("Ready"); }
        updateAlgorithm() { $("algorithm-name").textContent = names[controls.algorithm.value]; }
        operation(text) { controls.operation.textContent = text; }
        stats() {
            $("swaps-count").textContent = this.swaps; $("comparisons-count").textContent = this.comparisons;
            $("elapsed-time").textContent = this.startedAt ? `${Date.now() - this.startedAt}ms` : "0ms";
        }

        resize() {
            const wrapper = canvas.closest(".canvas-wrapper");
            const cssSize = Math.max(260, Math.min(760, wrapper.clientWidth - 24));
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            canvas.style.width = `${cssSize}px`; canvas.style.height = `${cssSize}px`;
            canvas.width = Math.round(cssSize * ratio); canvas.height = Math.round(cssSize * ratio);
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0); this.width = cssSize; this.height = cssSize;
        }

        draw(active = [], special = [], message) {
            if (!this.width) this.resize();
            const w = this.width, h = this.height, n = this.array.length, pad = Math.max(18, w * .045), top = Math.max(42, h * .1), base = h - pad;
            ctx.clearRect(0, 0, w, h);
            const gradient = ctx.createLinearGradient(0, 0, 0, h); gradient.addColorStop(0, "rgba(56,198,194,.10)"); gradient.addColorStop(1, "rgba(56,198,194,.015)"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = color("grid", "rgba(148,163,184,.16)"); ctx.lineWidth = 1;
            for (let i = 1; i < 5; i++) { const y = top + ((base - top) * i) / 5; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke(); }
            const max = Math.max(...this.array, 1), slot = (w - pad * 2) / n, gap = Math.min(5, Math.max(1, slot * .14)), barW = Math.max(2, slot - gap);
            this.array.forEach((value, i) => {
                const barH = Math.max(3, ((base - top) * value) / max), x = pad + i * slot + gap / 2, y = base - barH;
                let fill = color("frontier", "#4aa3b5");
                if (this.completed.has(i)) fill = color("success", "#21a179");
                if (special.includes(i)) fill = color("pivot", "#a78bfa");
                if (active.includes(i)) fill = color("current", "#ffb547");
                ctx.shadowColor = fill; ctx.shadowBlur = active.includes(i) || special.includes(i) ? 14 : 3; ctx.fillStyle = fill;
                ctx.beginPath(); const radius = Math.min(5, barW / 2); ctx.roundRect(x, y, barW, barH, [radius, radius, 1, 1]); ctx.fill(); ctx.shadowBlur = 0;
                if (slot >= 24 || n <= 16) {
                    ctx.fillStyle = y > top + 22 ? "#fff" : color("text", "#dbeafe"); ctx.font = `700 ${Math.max(10, Math.min(14, slot * .38))}px system-ui`; ctx.textAlign = "center";
                    ctx.fillText(String(value), x + barW / 2, y > top + 22 ? y + 17 : y - 7);
                }
            });
            if (message) this.operation(message);
        }

        async checkpoint(active = [], special = [], message = "Comparing") {
            if (!this.running) return false;
            this.draw(active, special, message); this.stats();
            while (this.running && (this.paused || this.stepCredits === 0 && this.manualStep)) await new Promise((r) => setTimeout(r, 24));
            if (!this.running) return false;
            if (this.manualStep && this.stepCredits > 0) this.stepCredits--;
            const speed = Number(controls.speed.value); await new Promise((r) => setTimeout(r, 230 - speed * 22));
            return this.running;
        }

        togglePause() { if (!this.running) return; this.manualStep = false; this.paused = !this.paused; controls.pause.innerHTML = this.paused ? '<span class="btn-icon">▶️</span> Resume' : '<span class="btn-icon">⏸️</span> Pause'; }
        step() { if (!this.running) { this.manualStep = true; this.start(true); } else { this.manualStep = true; this.paused = false; this.stepCredits++; } }

        async start(stepStart = false) {
            if (this.running) return;
            this.running = true; this.paused = false; this.manualStep = stepStart; this.stepCredits = stepStart ? 1 : 0; this.completed.clear(); this.swaps = 0; this.comparisons = 0; this.startedAt = Date.now();
            const id = ++this.runId, algorithm = controls.algorithm.value; this.operation(`${names[algorithm]} sort running`);
            await this[`${algorithm}Sort`]();
            if (!this.running || id !== this.runId) return;
            this.running = false; this.manualStep = false; this.completed = new Set(this.array.map((_, i) => i)); this.draw([], [], "Sorted ✓"); this.stats(); controls.values.value = this.array.join(", ");
            toast(`Sorted with ${this.comparisons} comparisons and ${this.swaps} writes/swaps`, "success");
        }

        async bubbleSort() { const n = this.array.length; for (let end = n - 1; end > 0; end--) { let moved = false; for (let j = 0; j < end; j++) { this.comparisons++; if (!await this.checkpoint([j, j + 1], [], `Compare ${this.array[j]} and ${this.array[j + 1]}`)) return; if (this.array[j] > this.array[j + 1]) { [this.array[j], this.array[j + 1]] = [this.array[j + 1], this.array[j]]; this.swaps++; moved = true; } } this.completed.add(end); if (!moved) break; } }
        async selectionSort() { for (let i = 0; i < this.array.length; i++) { let min = i; for (let j = i + 1; j < this.array.length; j++) { this.comparisons++; if (!await this.checkpoint([j], [min], `Scan for the minimum after index ${i}`)) return; if (this.array[j] < this.array[min]) min = j; } if (min !== i) { [this.array[i], this.array[min]] = [this.array[min], this.array[i]]; this.swaps++; } this.completed.add(i); } }
        async insertionSort() { this.completed.add(0); for (let i = 1; i < this.array.length; i++) { const key = this.array[i]; let j = i - 1; while (j >= 0) { this.comparisons++; if (!await this.checkpoint([j], [j + 1], `Insert ${key} into the sorted prefix`)) return; if (this.array[j] <= key) break; this.array[j + 1] = this.array[j]; this.swaps++; j--; } this.array[j + 1] = key; this.swaps++; this.completed.add(i); } }
        async mergeSort(lo = 0, hi = this.array.length - 1) { if (lo >= hi || !this.running) return; const mid = (lo + hi) >> 1; await this.mergeSort(lo, mid); await this.mergeSort(mid + 1, hi); const left = this.array.slice(lo, mid + 1), right = this.array.slice(mid + 1, hi + 1); let a = 0, b = 0; for (let k = lo; k <= hi; k++) { if (a < left.length && b < right.length) this.comparisons++; if (b >= right.length || a < left.length && left[a] <= right[b]) this.array[k] = left[a++]; else this.array[k] = right[b++]; this.swaps++; if (!await this.checkpoint([k], Array.from({ length: hi - lo + 1 }, (_, x) => lo + x), `Merge positions ${lo + 1}–${hi + 1}`)) return; } }
        async quickSort(lo = 0, hi = this.array.length - 1) { if (lo >= hi || !this.running) { if (lo === hi) this.completed.add(lo); return; } const pivot = this.array[hi]; let i = lo; for (let j = lo; j < hi; j++) { this.comparisons++; if (!await this.checkpoint([j], [hi], `Compare ${this.array[j]} with pivot ${pivot}`)) return; if (this.array[j] <= pivot) { if (i !== j) { [this.array[i], this.array[j]] = [this.array[j], this.array[i]]; this.swaps++; } i++; } } [this.array[i], this.array[hi]] = [this.array[hi], this.array[i]]; this.swaps++; this.completed.add(i); await this.quickSort(lo, i - 1); await this.quickSort(i + 1, hi); }
        async heapSort() { const n = this.array.length; const heapify = async (size, root) => { while (this.running) { let largest = root, l = root * 2 + 1, r = l + 1; if (l < size) { this.comparisons++; if (this.array[l] > this.array[largest]) largest = l; } if (r < size) { this.comparisons++; if (this.array[r] > this.array[largest]) largest = r; } if (!await this.checkpoint([root, largest], [], "Restore the max heap")) return; if (largest === root) return; [this.array[root], this.array[largest]] = [this.array[largest], this.array[root]]; this.swaps++; root = largest; } }; for (let i = (n >> 1) - 1; i >= 0; i--) await heapify(n, i); for (let end = n - 1; end > 0 && this.running; end--) { [this.array[0], this.array[end]] = [this.array[end], this.array[0]]; this.swaps++; this.completed.add(end); await heapify(end, 0); } this.completed.add(0); }
        async radixSort() { let max = Math.max(...this.array); for (let exp = 1; Math.floor(max / exp) > 0 && this.running; exp *= 10) { const buckets = Array.from({ length: 10 }, () => []); for (let i = 0; i < this.array.length; i++) buckets[Math.floor(this.array[i] / exp) % 10].push(this.array[i]); const output = buckets.flat(); for (let i = 0; i < output.length; i++) { this.array[i] = output[i]; this.swaps++; if (!await this.checkpoint([i], [], `Place by ${exp === 1 ? "ones" : exp === 10 ? "tens" : "hundreds"} digit`)) return; } } }
    }

    const visualizer = new SortingVisualizer();
    const resize = () => { visualizer.resize(); visualizer.draw(); };
    new ResizeObserver(resize).observe(canvas.closest(".canvas-wrapper"));
    window.addEventListener("resize", resize);
});
