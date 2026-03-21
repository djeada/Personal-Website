document.addEventListener("DOMContentLoaded", function() {

    function getCookie(name) {
        if (typeof window.getCookie === 'function') {
            return window.getCookie(name);
        }
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    /* ── canvas refs ─────────────────────────────────────── */
    const inputCanvas = document.getElementById('inputCanvas');
    const filteredCanvas = document.getElementById('filteredCanvas');
    const spectrumCanvas = document.getElementById('spectrumCanvas');
    const responseCanvas = document.getElementById('responseCanvas');
    const inputCtx = inputCanvas.getContext('2d');
    const filteredCtx = filteredCanvas.getContext('2d');
    const spectrumCtx = spectrumCanvas.getContext('2d');
    const responseCtx = responseCanvas.getContext('2d');

    /* ── DOM controls ────────────────────────────────────── */
    const waveformSelect = document.getElementById('waveform');
    const amplitudeSlider = document.getElementById('amplitude');
    const frequencySlider = document.getElementById('frequency');
    const phaseSlider = document.getElementById('phase');
    const dutyCycleSlider = document.getElementById('dutyCycle');
    const filterSelect = document.getElementById('filter');
    const cutoffFrequencySlider = document.getElementById('cutoffFrequency');
    const centerFrequencySlider = document.getElementById('centerFrequency');
    const bandwidthSlider = document.getElementById('bandwidth');
    const filterQSlider = document.getElementById('filterQ');
    const velocitySlider = document.getElementById('velocity');

    const amplitudeValue = document.getElementById('amplitudeValue');
    const frequencyValue = document.getElementById('frequencyValue');
    const phaseValue = document.getElementById('phaseValue');
    const dutyCycleValue = document.getElementById('dutyCycleValue');
    const cutoffFrequencyValue = document.getElementById('cutoffFrequencyValue');
    const centerFrequencyValue = document.getElementById('centerFrequencyValue');
    const bandwidthValue = document.getElementById('bandwidthValue');
    const filterQValue = document.getElementById('filterQValue');
    const velocityValue = document.getElementById('velocityValue');

    const filterParameters = document.getElementById('filterParameters');
    const singleCutoff = document.getElementById('singleCutoff');
    const bandParameters = document.getElementById('bandParameters');
    const filterQControl = document.getElementById('filterQControl');
    const dutyCycleControl = document.getElementById('dutyCycleControl');

    const waveformDisplay = document.getElementById('waveform-display');
    const amplitudeDisplay = document.getElementById('amplitude-display');
    const frequencyDisplay = document.getElementById('frequency-display');
    const filterDisplay = document.getElementById('filter-display');
    const cutoffDisplay = document.getElementById('cutoff-display');
    const qDisplay = document.getElementById('q-display');

    const pauseBtn = document.getElementById('pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    const screenshotBtn = document.getElementById('screenshot-btn');
    const resetDefaults = document.getElementById('reset-defaults');
    const presetButtons = document.querySelectorAll('.preset-option');
    const toastContainer = document.getElementById('toast-container');

    /* ── state ────────────────────────────────────────────── */
    let amplitude = parseFloat(amplitudeSlider.value);
    let frequency = parseFloat(frequencySlider.value);
    let phase = parseFloat(phaseSlider.value);
    let dutyCycle = parseFloat(dutyCycleSlider.value);
    let cutoffFrequency = parseFloat(cutoffFrequencySlider.value);
    let centerFrequency = parseFloat(centerFrequencySlider.value);
    let bandwidth = parseFloat(bandwidthSlider.value);
    let filterQ = parseFloat(filterQSlider.value);
    let velocity = parseFloat(velocitySlider.value);

    let time = 0;
    let isPaused = false;
    let animationId = null;

    /* ── DPI-aware canvas sizing ─────────────────────────── */
    function resizeCanvas(canvas) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            const ctx = canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
    }

    function resizeAllCanvases() {
        [inputCanvas, filteredCanvas, spectrumCanvas, responseCanvas].forEach(resizeCanvas);
    }

    window.addEventListener('resize', resizeAllCanvases);
    resizeAllCanvases();

    /* ── Filter class (biquad IIR) ───────────────────────── */
    class Filter {
        constructor(type, cutoffFrequency, Q) {
            this.type = type;
            this.cutoffFrequency = cutoffFrequency;
            this.Q = Q;
            this.reset();
        }

        reset() {
            this.x1 = this.x2 = 0;
            this.y1 = this.y2 = 0;
        }

        updateParameters(type, cutoffFrequency, Q) {
            this.type = type;
            this.cutoffFrequency = cutoffFrequency;
            this.Q = Q || 1;
            this.reset();
        }

        apply(input, dt) {
            if (this.type === 'none') return input;

            const fs = 1 / dt;
            const f0 = this.cutoffFrequency;
            const Q = this.Q;

            const omega = 2 * Math.PI * f0 / fs;
            const sinOmega = Math.sin(omega);
            const cosOmega = Math.cos(omega);
            const alpha = sinOmega / (2 * Q);

            let b0, b1, b2, a0, a1, a2;

            switch (this.type) {
                case 'lowpass':
                    b0 = (1 - cosOmega) / 2;
                    b1 = 1 - cosOmega;
                    b2 = (1 - cosOmega) / 2;
                    a0 = 1 + alpha;
                    a1 = -2 * cosOmega;
                    a2 = 1 - alpha;
                    break;
                case 'highpass':
                    b0 = (1 + cosOmega) / 2;
                    b1 = -(1 + cosOmega);
                    b2 = (1 + cosOmega) / 2;
                    a0 = 1 + alpha;
                    a1 = -2 * cosOmega;
                    a2 = 1 - alpha;
                    break;
                case 'bandpass':
                    b0 = alpha;
                    b1 = 0;
                    b2 = -alpha;
                    a0 = 1 + alpha;
                    a1 = -2 * cosOmega;
                    a2 = 1 - alpha;
                    break;
                case 'bandstop':
                    b0 = 1;
                    b1 = -2 * cosOmega;
                    b2 = 1;
                    a0 = 1 + alpha;
                    a1 = -2 * cosOmega;
                    a2 = 1 - alpha;
                    break;
                default:
                    return input;
            }

            b0 /= a0;
            b1 /= a0;
            b2 /= a0;
            a1 /= a0;
            a2 /= a0;

            const output = b0 * input + b1 * this.x1 + b2 * this.x2 - a1 * this.y1 - a2 * this.y2;

            this.x2 = this.x1;
            this.x1 = input;
            this.y2 = this.y1;
            this.y1 = output;

            return output;
        }

        /** Compute magnitude response at a given frequency */
        magnitudeAt(f, fs) {
            if (this.type === 'none') return 1;

            const f0 = this.cutoffFrequency;
            const Q = this.Q;
            const omega0 = 2 * Math.PI * f0 / fs;
            const sinO = Math.sin(omega0);
            const cosO = Math.cos(omega0);
            const alpha = sinO / (2 * Q);

            let b0, b1, b2, a0, a1, a2;

            switch (this.type) {
                case 'lowpass':
                    b0 = (1 - cosO) / 2; b1 = 1 - cosO; b2 = (1 - cosO) / 2;
                    a0 = 1 + alpha; a1 = -2 * cosO; a2 = 1 - alpha;
                    break;
                case 'highpass':
                    b0 = (1 + cosO) / 2; b1 = -(1 + cosO); b2 = (1 + cosO) / 2;
                    a0 = 1 + alpha; a1 = -2 * cosO; a2 = 1 - alpha;
                    break;
                case 'bandpass':
                    b0 = alpha; b1 = 0; b2 = -alpha;
                    a0 = 1 + alpha; a1 = -2 * cosO; a2 = 1 - alpha;
                    break;
                case 'bandstop':
                    b0 = 1; b1 = -2 * cosO; b2 = 1;
                    a0 = 1 + alpha; a1 = -2 * cosO; a2 = 1 - alpha;
                    break;
                default:
                    return 1;
            }

            b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;

            const w = 2 * Math.PI * f / fs;
            const cosW = Math.cos(w);
            const cos2W = Math.cos(2 * w);
            const sinW = Math.sin(w);
            const sin2W = Math.sin(2 * w);

            const numReal = b0 + b1 * cosW + b2 * cos2W;
            const numImag = -(b1 * sinW + b2 * sin2W);
            const denReal = 1 + a1 * cosW + a2 * cos2W;
            const denImag = -(a1 * sinW + a2 * sin2W);

            const numMag = Math.sqrt(numReal * numReal + numImag * numImag);
            const denMag = Math.sqrt(denReal * denReal + denImag * denImag);

            return denMag > 0 ? numMag / denMag : 0;
        }
    }

    let filter = new Filter(filterSelect.value, cutoffFrequency || centerFrequency, filterQ);

    /* ── Toast notifications ─────────────────────────────── */
    function showToast(message, type) {
        type = type || "info";
        const toast = document.createElement("div");
        toast.className = "toast " + type;

        const icons = {
            success: "✅",
            error: "❌",
            info: "ℹ️",
            warning: "⚠️"
        };

        toast.innerHTML =
            '<span class="toast-icon">' + (icons[type] || icons.info) + '</span>' +
            '<span class="toast-message">' + message + '</span>';

        toastContainer.appendChild(toast);

        setTimeout(function() {
            toast.remove();
        }, 3000);
    }

    /* ── Color helpers ───────────────────────────────────── */
    function getColorForMode(colorLight, colorDark) {
        const darkModeValue = getCookie("darkMode");
        return darkModeValue && darkModeValue.toLowerCase() === "true" ? colorDark : colorLight;
    }

    /* ── Signal generation ───────────────────────────────── */
    function generateSignal(t, dt) {
        var y = 0;
        var omega = 2 * Math.PI * frequency;
        var phi = phase;

        switch (waveformSelect.value) {
            case 'sine':
                y = amplitude * Math.sin(omega * t + phi);
                break;
            case 'square':
                y = amplitude * Math.sign(Math.sin(omega * t + phi));
                break;
            case 'triangle':
                y = (2 * amplitude / Math.PI) * Math.asin(Math.sin(omega * t + phi));
                break;
            case 'sawtooth':
                y = (2 * amplitude / Math.PI) * (((omega * t + phi) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
                break;
            case 'pulse':
                var period = 1 / frequency;
                var timeInPeriod = ((t + phi / omega) % period + period) % period;
                y = (timeInPeriod < period * dutyCycle) ? amplitude : 0;
                break;
            default:
                y = 0;
        }
        return y;
    }

    /* ── Sample-buffer model ─────────────────────────────── */
    var BUFFER_SIZE = 1024;
    var WARMUP = 64;
    var timeScale = 0.005;

    function buildBuffers(numPoints) {
        var inputBuf = new Float64Array(WARMUP + numPoints);
        var filteredBuf = new Float64Array(WARMUP + numPoints);
        var dt = timeScale;

        /* fresh filter copy so frame history does not leak */
        var fCopy = new Filter(filter.type, filter.cutoffFrequency, filter.Q);

        for (var i = 0; i < WARMUP + numPoints; i++) {
            var t = time - (WARMUP + numPoints - i) * dt;
            inputBuf[i] = generateSignal(t, dt);
            filteredBuf[i] = fCopy.apply(inputBuf[i], dt);
        }

        return {
            input: inputBuf.subarray(WARMUP),
            filtered: filteredBuf.subarray(WARMUP)
        };
    }

    /* ── Simple FFT (radix-2 DIT, power-of-2 only) ──────── */
    function fft(re, im) {
        var n = re.length;
        if (n <= 1) return;

        /* bit-reversal permutation */
        for (var i = 1, j = 0; i < n; i++) {
            var bit = n >> 1;
            while (j & bit) { j ^= bit; bit >>= 1; }
            j ^= bit;
            if (i < j) {
                var tmp = re[i]; re[i] = re[j]; re[j] = tmp;
                tmp = im[i]; im[i] = im[j]; im[j] = tmp;
            }
        }

        for (var len = 2; len <= n; len <<= 1) {
            var ang = -2 * Math.PI / len;
            var wRe = Math.cos(ang);
            var wIm = Math.sin(ang);
            for (var i = 0; i < n; i += len) {
                var curRe = 1, curIm = 0;
                for (var jj = 0; jj < len / 2; jj++) {
                    var uRe = re[i + jj];
                    var uIm = im[i + jj];
                    var vRe = re[i + jj + len / 2] * curRe - im[i + jj + len / 2] * curIm;
                    var vIm = re[i + jj + len / 2] * curIm + im[i + jj + len / 2] * curRe;
                    re[i + jj] = uRe + vRe;
                    im[i + jj] = uIm + vIm;
                    re[i + jj + len / 2] = uRe - vRe;
                    im[i + jj + len / 2] = uIm - vIm;
                    var tRe = curRe * wRe - curIm * wIm;
                    curIm = curRe * wIm + curIm * wRe;
                    curRe = tRe;
                }
            }
        }
    }

    function computeMagnitudeSpectrum(buf) {
        if (buf.length < 2) return new Float64Array(1);
        /* zero-pad to next power of 2 */
        var n = 1;
        while (n < buf.length) n <<= 1;
        var re = new Float64Array(n);
        var im = new Float64Array(n);
        /* apply Hann window */
        var denom = buf.length - 1;
        for (var i = 0; i < buf.length; i++) {
            var w = 0.5 * (1 - Math.cos(2 * Math.PI * i / denom));
            re[i] = buf[i] * w;
        }
        fft(re, im);
        var half = n / 2;
        var scale = buf.length / 2;
        var mag = new Float64Array(half);
        for (var i = 0; i < half; i++) {
            mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / scale;
        }
        return mag;
    }

    /* ── Drawing helpers ─────────────────────────────────── */
    function cssWidth(canvas) {
        return canvas.getBoundingClientRect().width;
    }
    function cssHeight(canvas) {
        return canvas.getBoundingClientRect().height;
    }

    function getChartMetrics(canvas, padding) {
        var width = cssWidth(canvas);
        var height = cssHeight(canvas);
        var metrics = {
            width: width,
            height: height,
            left: padding.left,
            right: width - padding.right,
            top: padding.top,
            bottom: height - padding.bottom
        };
        metrics.plotWidth = Math.max(1, metrics.right - metrics.left);
        metrics.plotHeight = Math.max(1, metrics.bottom - metrics.top);
        metrics.midY = metrics.top + metrics.plotHeight / 2;
        return metrics;
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function getChartFontSizes(width) {
        return {
            axis: Math.max(13, Math.min(15, width / 36)),
            tick: Math.max(11, Math.min(13, width / 44)),
            marker: Math.max(11, Math.min(13, width / 42))
        };
    }

    function drawAxes(ctx, canvas) {
        var metrics = getChartMetrics(canvas, { left: 52, right: 18, top: 18, bottom: 28 });
        var axisColor = getColorForMode('#e2e8f0', '#475569');
        var labelColor = getColorForMode('#64748b', '#94a3b8');
        var fonts = getChartFontSizes(metrics.width);

        ctx.save();
        ctx.strokeStyle = axisColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(metrics.left, metrics.midY);
        ctx.lineTo(metrics.right, metrics.midY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(metrics.left, metrics.top);
        ctx.lineTo(metrics.left, metrics.bottom);
        ctx.stroke();

        ctx.fillStyle = labelColor;
        ctx.font = fonts.axis + 'px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('Time', metrics.right, metrics.height - 8);
        ctx.save();
        ctx.translate(18, metrics.top + metrics.plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Amplitude', 0, 0);
        ctx.restore();
        ctx.restore();
    }

    function drawSpectrumAxes(ctx, canvas) {
        var metrics = getChartMetrics(canvas, { left: 52, right: 18, top: 18, bottom: 34 });
        var axisColor = getColorForMode('#e2e8f0', '#475569');
        var labelColor = getColorForMode('#64748b', '#94a3b8');
        var fonts = getChartFontSizes(metrics.width);

        ctx.save();
        ctx.strokeStyle = axisColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(metrics.left, metrics.bottom);
        ctx.lineTo(metrics.right, metrics.bottom);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(metrics.left, metrics.top);
        ctx.lineTo(metrics.left, metrics.bottom);
        ctx.stroke();

        ctx.fillStyle = labelColor;
        ctx.font = fonts.axis + 'px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('Frequency', metrics.right, metrics.height - 8);
        ctx.save();
        ctx.translate(18, metrics.top + metrics.plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Magnitude', 0, 0);
        ctx.restore();
        ctx.restore();
    }

    function amplitudeMax() {
        switch (waveformSelect.value) {
            case 'sawtooth':
                return Math.max(Math.abs(amplitude), 2);
            default:
                return Math.max(Math.abs(amplitude), 1);
        }
    }

    /* ── Rendering ───────────────────────────────────────── */
    function drawTimeDomain(ctx, canvas, buf, color) {
        var metrics = getChartMetrics(canvas, { left: 52, right: 18, top: 18, bottom: 28 });
        var midY = metrics.midY;
        var yScale = Math.max(1, metrics.plotHeight / 2 - 12) / amplitudeMax();

        ctx.save();
        ctx.beginPath();
        for (var x = 0; x < buf.length; x++) {
            var px = metrics.left + (x / Math.max(1, buf.length - 1)) * metrics.plotWidth;
            var py = midY - buf[x] * yScale;
            if (x === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
    }

    function drawSpectrum(ctx, canvas, inputMag, filteredMag) {
        var metrics = getChartMetrics(canvas, { left: 52, right: 18, top: 18, bottom: 34 });
        var fonts = getChartFontSizes(metrics.width);
        var fs = 1 / timeScale;
        var n = inputMag.length;
        if (n < 2) return;
        var maxFreqBin = Math.min(n, Math.ceil(6 / (fs / (2 * n)) )); /* up to ~6 Hz */
        if (maxFreqBin < 2) maxFreqBin = n;

        /* find max magnitude for scaling */
        var maxMag = 0.001;
        for (var i = 1; i < maxFreqBin; i++) {
            if (inputMag[i] > maxMag) maxMag = inputMag[i];
            if (filteredMag[i] > maxMag) maxMag = filteredMag[i];
        }

        var inputColor = getColorForMode('#10b981', '#4ade80');
        var filteredColor = getColorForMode('#ea8400', '#fbbf24');
        var groupWidth = metrics.plotWidth / maxFreqBin;
        var barWidth = Math.max(2, groupWidth * 0.32);

        ctx.save();
        /* input bars */
        ctx.fillStyle = inputColor;
        ctx.globalAlpha = 0.6;
        for (var i = 1; i < maxFreqBin; i++) {
            var px = metrics.left + (i / maxFreqBin) * metrics.plotWidth;
            var barH = (inputMag[i] / maxMag) * metrics.plotHeight;
            ctx.fillRect(px - barWidth - 1, metrics.bottom - barH, barWidth, barH);
        }

        /* filtered bars */
        ctx.fillStyle = filteredColor;
        ctx.globalAlpha = 0.6;
        for (var i = 1; i < maxFreqBin; i++) {
            var px = metrics.left + (i / maxFreqBin) * metrics.plotWidth;
            var barH = (filteredMag[i] / maxMag) * metrics.plotHeight;
            ctx.fillRect(px + 1, metrics.bottom - barH, barWidth, barH);
        }
        ctx.globalAlpha = 1.0;

        /* frequency labels */
        var labelColor = getColorForMode('#64748b', '#94a3b8');
        ctx.fillStyle = labelColor;
        ctx.font = fonts.tick + 'px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var binHz = fs / (2 * n);
        for (var f = 1; f <= 5; f++) {
            var bin = Math.round(f / binHz);
            if (bin < maxFreqBin) {
                var lx = metrics.left + (bin / maxFreqBin) * metrics.plotWidth;
                ctx.fillText(f + ' Hz', lx, metrics.bottom + 14);
            }
        }
        ctx.restore();
    }

    function drawFilterResponse(ctx, canvas) {
        var metrics = getChartMetrics(canvas, { left: 58, right: 18, top: 18, bottom: 34 });
        var fonts = getChartFontSizes(metrics.width);
        var fs = 1 / timeScale;
        var maxFreq = 6;
        var numPoints = Math.round(metrics.plotWidth);

        var responseColor = getColorForMode('#8b5cf6', '#a78bfa');
        var markerColor = getColorForMode('#ea8400', '#fbbf24');
        var axisColor = getColorForMode('#e2e8f0', '#475569');
        var labelColor = getColorForMode('#64748b', '#94a3b8');

        ctx.save();
        /* axes */
        ctx.strokeStyle = axisColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(metrics.left, metrics.bottom);
        ctx.lineTo(metrics.right, metrics.bottom);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(metrics.left, metrics.top);
        ctx.lineTo(metrics.left, metrics.bottom);
        ctx.stroke();

        /* labels */
        ctx.fillStyle = labelColor;
        ctx.font = fonts.axis + 'px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('Frequency', metrics.right, metrics.height - 8);
        ctx.save();
        ctx.translate(18, metrics.top + metrics.plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Gain (dB)', 0, 0);
        ctx.restore();

        /* frequency tick labels */
        ctx.font = fonts.tick + 'px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (var f = 1; f <= 5; f++) {
            var lx = metrics.left + (f / maxFreq) * metrics.plotWidth;
            ctx.fillText(f + ' Hz', lx, metrics.bottom + 14);
        }

        /* dB range: 0 dB at top, -40 dB at bottom */
        var dbMin = -40;
        var dbMax = 6;
        var dbRange = dbMax - dbMin;

        /* dB gridlines */
        ctx.strokeStyle = axisColor;
        ctx.lineWidth = 0.5;
        for (var db = 0; db >= dbMin; db -= 10) {
            var gy = metrics.top + (1 - (db - dbMin) / dbRange) * metrics.plotHeight;
            ctx.beginPath();
            ctx.moveTo(metrics.left, gy);
            ctx.lineTo(metrics.right, gy);
            ctx.stroke();
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(db + ' dB', 4, gy);
        }

        /* response curve */
        if (filter.type !== 'none') {
            ctx.beginPath();
            for (var i = 0; i < numPoints; i++) {
                var f = (i / numPoints) * maxFreq + 0.001;
                var mag = filter.magnitudeAt(f, fs);
                var db = 20 * Math.log10(Math.max(mag, 1e-10));
                var px = metrics.left + (i / Math.max(1, numPoints - 1)) * metrics.plotWidth;
                var py = metrics.top + (1 - (db - dbMin) / dbRange) * metrics.plotHeight;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.strokeStyle = responseColor;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            /* cutoff / center marker */
            var markerFreq = filter.cutoffFrequency;
            var markerMag = filter.magnitudeAt(markerFreq, fs);
            var markerDb = 20 * Math.log10(Math.max(markerMag, 1e-10));
            var mx = metrics.left + (markerFreq / maxFreq) * metrics.plotWidth;
            var my = metrics.top + (1 - (markerDb - dbMin) / dbRange) * metrics.plotHeight;

            ctx.beginPath();
            ctx.arc(mx, my, 5, 0, 2 * Math.PI);
            ctx.fillStyle = markerColor;
            ctx.fill();
            ctx.strokeStyle = markerColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(mx, metrics.top);
            ctx.lineTo(mx, metrics.bottom);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = labelColor;
            ctx.font = 'bold ' + fonts.marker + 'px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            var markerLabelX = clamp(mx + 10, metrics.left + 6, metrics.right - 78);
            var markerLabelY = clamp(my - 8, metrics.top + 14, metrics.bottom - 18);
            ctx.fillText('fc=' + markerFreq.toFixed(1) + ' Hz', markerLabelX, markerLabelY);
            ctx.fillText(markerDb.toFixed(1) + ' dB', markerLabelX, markerLabelY + 14);
        } else {
            /* flat line at 0 dB */
            var py0 = metrics.top + (1 - (0 - dbMin) / dbRange) * metrics.plotHeight;
            ctx.beginPath();
            ctx.moveTo(metrics.left, py0);
            ctx.lineTo(metrics.right, py0);
            ctx.strokeStyle = responseColor;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            ctx.fillStyle = labelColor;
            ctx.font = fonts.tick + 'px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('No filter active (flat 0 dB)', metrics.left + metrics.plotWidth / 2, py0 - 12);
        }
        ctx.restore();
    }

    /* ── Animation loop ──────────────────────────────────── */
    function animate() {
        if (isPaused) {
            animationId = requestAnimationFrame(animate);
            return;
        }

        resizeAllCanvases();

        /* clear all canvases */
        var cW, cH;
        cW = cssWidth(inputCanvas); cH = cssHeight(inputCanvas);
        inputCtx.clearRect(0, 0, cW, cH);
        cW = cssWidth(filteredCanvas); cH = cssHeight(filteredCanvas);
        filteredCtx.clearRect(0, 0, cW, cH);
        cW = cssWidth(spectrumCanvas); cH = cssHeight(spectrumCanvas);
        spectrumCtx.clearRect(0, 0, cW, cH);
        cW = cssWidth(responseCanvas); cH = cssHeight(responseCanvas);
        responseCtx.clearRect(0, 0, cW, cH);

        /* build deterministic sample buffers */
        var numPoints = Math.max(256, Math.round(cssWidth(inputCanvas)));
        var bufs = buildBuffers(numPoints);

        /* time-domain plots */
        drawAxes(inputCtx, inputCanvas);
        drawTimeDomain(inputCtx, inputCanvas, bufs.input, getColorForMode('#10b981', '#4ade80'));

        drawAxes(filteredCtx, filteredCanvas);
        drawTimeDomain(filteredCtx, filteredCanvas, bufs.filtered, getColorForMode('#ea8400', '#fbbf24'));

        /* spectrum plot */
        drawSpectrumAxes(spectrumCtx, spectrumCanvas);
        var inputSpec = computeMagnitudeSpectrum(bufs.input);
        var filteredSpec = computeMagnitudeSpectrum(bufs.filtered);
        drawSpectrum(spectrumCtx, spectrumCanvas, inputSpec, filteredSpec);

        /* filter frequency response */
        drawFilterResponse(responseCtx, responseCanvas);

        /* advance time */
        time -= (velocity / 60);
        animationId = requestAnimationFrame(animate);
    }

    /* ── Stats / value updates ───────────────────────────── */
    function updateStats() {
        var waveformNames = {
            'sine': 'Sine', 'square': 'Square', 'triangle': 'Triangle',
            'sawtooth': 'Sawtooth', 'pulse': 'Pulse'
        };
        var filterNames = {
            'none': 'None', 'lowpass': 'Low-Pass', 'highpass': 'High-Pass',
            'bandpass': 'Band-Pass', 'bandstop': 'Band-Stop'
        };

        waveformDisplay.textContent = waveformNames[waveformSelect.value] || 'Sine';
        amplitudeDisplay.textContent = amplitude.toFixed(2);
        frequencyDisplay.textContent = frequency.toFixed(2) + ' Hz';
        filterDisplay.textContent = filterNames[filterSelect.value] || 'None';

        var ft = filterSelect.value;
        if (ft === 'none') {
            cutoffDisplay.textContent = '—';
            qDisplay.textContent = '—';
        } else if (ft === 'lowpass' || ft === 'highpass') {
            cutoffDisplay.textContent = cutoffFrequency.toFixed(2) + ' Hz';
            qDisplay.textContent = filterQ.toFixed(2);
        } else {
            cutoffDisplay.textContent = centerFrequency.toFixed(2) + ' Hz';
            qDisplay.textContent = (centerFrequency / bandwidth).toFixed(2);
        }
    }

    function updateValues() {
        amplitude = parseFloat(amplitudeSlider.value);
        frequency = parseFloat(frequencySlider.value);
        phase = parseFloat(phaseSlider.value);
        dutyCycle = parseFloat(dutyCycleSlider.value);
        velocity = parseFloat(velocitySlider.value);

        amplitudeValue.textContent = amplitude.toFixed(2);
        frequencyValue.textContent = frequency.toFixed(2);
        phaseValue.textContent = phase.toFixed(2);
        dutyCycleValue.textContent = (dutyCycle * 100).toFixed(0) + '%';
        velocityValue.textContent = velocity.toFixed(2);

        /* show/hide duty-cycle control */
        if (waveformSelect.value === 'pulse') {
            dutyCycleControl.classList.remove('hidden');
        } else {
            dutyCycleControl.classList.add('hidden');
        }

        updateStats();
    }

    function updateFilterValues() {
        var filterType = filterSelect.value;

        if (filterType === 'none') {
            filterParameters.classList.add('hidden');
        } else {
            filterParameters.classList.remove('hidden');

            if (filterType === 'lowpass' || filterType === 'highpass') {
                singleCutoff.classList.remove('hidden');
                bandParameters.classList.add('hidden');
                filterQControl.classList.remove('hidden');
                cutoffFrequency = parseFloat(cutoffFrequencySlider.value);
                cutoffFrequencyValue.textContent = cutoffFrequency.toFixed(2);
                filterQ = parseFloat(filterQSlider.value);
                filterQValue.textContent = filterQ.toFixed(2);
                filter.updateParameters(filterType, cutoffFrequency, filterQ);
            } else if (filterType === 'bandpass' || filterType === 'bandstop') {
                singleCutoff.classList.add('hidden');
                bandParameters.classList.remove('hidden');
                filterQControl.classList.add('hidden');
                centerFrequency = parseFloat(centerFrequencySlider.value);
                bandwidth = parseFloat(bandwidthSlider.value);
                centerFrequencyValue.textContent = centerFrequency.toFixed(2);
                bandwidthValue.textContent = bandwidth.toFixed(2);
                filterQ = centerFrequency / bandwidth;
                filterQValue.textContent = filterQ.toFixed(2);
                filter.updateParameters(filterType, centerFrequency, filterQ);
            }
        }

        updateStats();
    }

    /* ── Presets ──────────────────────────────────────────── */
    var presets = {
        sine: {
            waveform: 'sine', amplitude: 1, frequency: 1, phase: 0,
            velocity: 1, dutyCycle: 0.5, filter: 'none'
        },
        lowpass_demo: {
            waveform: 'square', amplitude: 0.8, frequency: 0.5, phase: 0,
            velocity: 1, dutyCycle: 0.5, filter: 'lowpass', cutoff: 1.5, filterQ: 1
        },
        highpass_demo: {
            waveform: 'sawtooth', amplitude: 0.7, frequency: 0.8, phase: 0,
            velocity: 1, dutyCycle: 0.5, filter: 'highpass', cutoff: 2, filterQ: 1
        },
        bandpass_demo: {
            waveform: 'sawtooth', amplitude: 0.7, frequency: 1.5, phase: 1.57,
            velocity: 1.5, dutyCycle: 0.5, filter: 'bandpass', centerFrequency: 2, bandwidth: 1
        },
        pulse_pwm: {
            waveform: 'pulse', amplitude: 0.9, frequency: 1, phase: 0,
            velocity: 1, dutyCycle: 0.25, filter: 'lowpass', cutoff: 2.5, filterQ: 0.7
        }
    };

    function formatPresetName(name) {
        return name.replace(/_/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
    }

    function applyPreset(presetName) {
        var preset = presets[presetName];
        if (!preset) return;

        waveformSelect.value = preset.waveform;
        amplitudeSlider.value = preset.amplitude;
        frequencySlider.value = preset.frequency;
        phaseSlider.value = preset.phase;
        velocitySlider.value = preset.velocity;
        dutyCycleSlider.value = preset.dutyCycle;
        filterSelect.value = preset.filter;

        if (preset.cutoff) {
            cutoffFrequencySlider.value = preset.cutoff;
        }
        if (preset.filterQ) {
            filterQSlider.value = preset.filterQ;
        }
        if (preset.centerFrequency) {
            centerFrequencySlider.value = preset.centerFrequency;
        }
        if (preset.bandwidth) {
            bandwidthSlider.value = preset.bandwidth;
        }

        updateValues();
        updateFilterValues();

        presetButtons.forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.preset === presetName);
        });

        showToast(formatPresetName(presetName) + ' preset applied', 'success');
    }

    /* ── Event listeners ─────────────────────────────────── */
    document.querySelectorAll('.card-toggle').forEach(function(toggle) {
        toggle.addEventListener('click', function() {
            var expanded = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', !expanded);
        });
    });

    waveformSelect.addEventListener('change', updateValues);
    amplitudeSlider.addEventListener('input', updateValues);
    frequencySlider.addEventListener('input', updateValues);
    phaseSlider.addEventListener('input', updateValues);
    dutyCycleSlider.addEventListener('input', updateValues);
    velocitySlider.addEventListener('input', updateValues);

    filterSelect.addEventListener('change', updateFilterValues);
    cutoffFrequencySlider.addEventListener('input', updateFilterValues);
    centerFrequencySlider.addEventListener('input', updateFilterValues);
    bandwidthSlider.addEventListener('input', updateFilterValues);
    filterQSlider.addEventListener('input', updateFilterValues);

    presetButtons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            applyPreset(btn.dataset.preset);
        });
    });

    resetDefaults.addEventListener('click', function() {
        applyPreset('sine');
    });

    pauseBtn.addEventListener('click', function() {
        isPaused = !isPaused;
        pauseBtn.innerHTML = isPaused ?
            '<span class="btn-icon">▶️</span><span class="btn-text">Resume</span>' :
            '<span class="btn-icon">⏸️</span><span class="btn-text">Pause</span>';
        showToast(isPaused ? 'Animation paused' : 'Animation resumed', 'info');
    });

    resetBtn.addEventListener('click', function() {
        time = 0;
        filter.reset();
        showToast('Animation reset', 'success');
    });

    screenshotBtn.addEventListener('click', function() {
        var dpr = window.devicePixelRatio || 1;
        var w = inputCanvas.width;
        var singleH = inputCanvas.height;
        var gap = Math.round(20 * dpr);
        var combinedCanvas = document.createElement('canvas');
        combinedCanvas.width = w;
        combinedCanvas.height = singleH * 4 + gap * 3;
        var ctx = combinedCanvas.getContext('2d');

        ctx.fillStyle = getColorForMode('#ffffff', '#1e293b');
        ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);

        ctx.drawImage(inputCanvas, 0, 0);
        ctx.drawImage(filteredCanvas, 0, singleH + gap);
        ctx.drawImage(spectrumCanvas, 0, (singleH + gap) * 2);
        ctx.drawImage(responseCanvas, 0, (singleH + gap) * 3);

        ctx.fillStyle = getColorForMode('#1e293b', '#f1f5f9');
        ctx.font = 'bold ' + Math.round(14 * dpr) + 'px system-ui, -apple-system, sans-serif';
        ctx.fillText('Input Signal', 10 * dpr, 20 * dpr);
        ctx.fillText('Filtered Output', 10 * dpr, singleH + gap + 20 * dpr);
        ctx.fillText('Frequency Spectrum', 10 * dpr, (singleH + gap) * 2 + 20 * dpr);
        ctx.fillText('Filter Response', 10 * dpr, (singleH + gap) * 3 + 20 * dpr);

        var link = document.createElement('a');
        link.download = 'signal-visualization.png';
        link.href = combinedCanvas.toDataURL();
        link.click();

        showToast('Screenshot saved! 📷', 'success');
    });

    document.addEventListener('keydown', function(e) {
        var activeElement = document.activeElement;
        var isInteractiveElement = activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable;

        if (e.code === 'Space' && !isInteractiveElement) {
            e.preventDefault();
            pauseBtn.click();
        }
    });

    /* ── Collapsible educational section ─────────────────── */
    var learnToggle = document.getElementById('learn-toggle');
    if (learnToggle) {
        learnToggle.addEventListener('click', function() {
            var expanded = learnToggle.getAttribute('aria-expanded') === 'true';
            learnToggle.setAttribute('aria-expanded', !expanded);
            var content = document.getElementById('explanation-content');
            if (content) {
                content.classList.toggle('collapsed', expanded);
            }
        });
    }

    /* ── Init ────────────────────────────────────────────── */
    updateValues();
    updateFilterValues();
    animate();
});
