document.addEventListener("DOMContentLoaded", function() {
    // Fallback getCookie function if not defined in parent app.js
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

    const inputCanvas = document.getElementById('inputCanvas');
    const filteredCanvas = document.getElementById('filteredCanvas');
    const inputCtx = inputCanvas.getContext('2d');
    const filteredCtx = filteredCanvas.getContext('2d');

    const waveformSelect = document.getElementById('waveform');
    const amplitudeSlider = document.getElementById('amplitude');
    const frequencySlider = document.getElementById('frequency');
    const phaseSlider = document.getElementById('phase');
    const filterSelect = document.getElementById('filter');
    const cutoffFrequencySlider = document.getElementById('cutoffFrequency');
    const centerFrequencySlider = document.getElementById('centerFrequency');
    const bandwidthSlider = document.getElementById('bandwidth');
    const filterQSlider = document.getElementById('filterQ');
    const velocitySlider = document.getElementById('velocity');

    const amplitudeValue = document.getElementById('amplitudeValue');
    const frequencyValue = document.getElementById('frequencyValue');
    const phaseValue = document.getElementById('phaseValue');
    const cutoffFrequencyValue = document.getElementById('cutoffFrequencyValue');
    const centerFrequencyValue = document.getElementById('centerFrequencyValue');
    const bandwidthValue = document.getElementById('bandwidthValue');
    const filterQValue = document.getElementById('filterQValue');
    const velocityValue = document.getElementById('velocityValue');

    const filterParameters = document.getElementById('filterParameters');
    const singleCutoff = document.getElementById('singleCutoff');
    const bandParameters = document.getElementById('bandParameters');
    const filterQControl = document.getElementById('filterQControl');

    // Stats display elements
    const waveformDisplay = document.getElementById('waveform-display');
    const amplitudeDisplay = document.getElementById('amplitude-display');
    const frequencyDisplay = document.getElementById('frequency-display');
    const filterDisplay = document.getElementById('filter-display');

    // Buttons
    const pauseBtn = document.getElementById('pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    const screenshotBtn = document.getElementById('screenshot-btn');
    const resetDefaults = document.getElementById('reset-defaults');
    const presetButtons = document.querySelectorAll('.preset-option');
    const toastContainer = document.getElementById('toast-container');

    let amplitude = parseFloat(amplitudeSlider.value);
    let frequency = parseFloat(frequencySlider.value);
    let phase = parseFloat(phaseSlider.value);
    let cutoffFrequency = parseFloat(cutoffFrequencySlider.value);
    let centerFrequency = parseFloat(centerFrequencySlider.value);
    let bandwidth = parseFloat(bandwidthSlider.value);
    let filterQ = parseFloat(filterQSlider.value);
    let velocity = parseFloat(velocitySlider.value);

    let time = 0;
    let isPaused = false;
    let animationId = null;

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
    }

    let filter = new Filter(filterSelect.value, cutoffFrequency || centerFrequency, filterQ);

    // Toast notification function
    function showToast(message, type = "info") {
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;

        const icons = {
            success: "✅",
            error: "❌",
            info: "ℹ️",
            warning: "⚠️"
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

    function getColorForMode(colorLight, colorDark) {
        const darkModeValue = getCookie("darkMode");
        return darkModeValue && darkModeValue.toLowerCase() === "true" ? colorDark : colorLight;
    }

    function drawAxes(ctx, width, height) {
        const axisColor = getColorForMode('#e2e8f0', '#475569');
        const labelColor = getColorForMode('#64748b', '#94a3b8');

        ctx.strokeStyle = axisColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, height);
        ctx.stroke();

        ctx.fillStyle = labelColor;
        ctx.font = '12px system-ui, -apple-system, sans-serif';
        ctx.fillText('Time', width - 35, height / 2 + 15);
        ctx.save();
        ctx.translate(15, height / 2 + 30);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Amplitude', 0, 0);
        ctx.restore();
    }

    function generateSignal(t, dt) {
        let y = 0;
        const omega = 2 * Math.PI * frequency;
        const phi = phase;

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
                const period = 1 / frequency;
                const timeInPeriod = ((t + phi / omega) % period + period) % period;
                y = (timeInPeriod < dt) ? amplitude : 0;
                break;
            default:
                y = 0;
        }

        return y;
    }

    function animate() {
        if (isPaused) {
            animationId = requestAnimationFrame(animate);
            return;
        }

        inputCtx.clearRect(0, 0, inputCanvas.width, inputCanvas.height);
        filteredCtx.clearRect(0, 0, filteredCanvas.width, filteredCanvas.height);

        const width = inputCanvas.width;
        const height = inputCanvas.height;
        const midY = height / 2;
        const numPoints = width;
        const timeScale = 0.005;

        drawAxes(inputCtx, width, height);
        drawAxes(filteredCtx, width, height);

        inputCtx.beginPath();
        filteredCtx.beginPath();

        const dt = timeScale;

        const inputWaveColor = getColorForMode('#10b981', '#4ade80');
        const filteredWaveColor = getColorForMode('#ea8400', '#fbbf24');

        for (let x = 0; x < numPoints; x++) {
            const t = time - (numPoints - x) * dt;
            const y = generateSignal(t, dt);
            const filteredY = filter.apply(y, dt);

            const plotYInput = midY - y * ((height / 2 - 20) / amplitudeMax());
            const plotYFiltered = midY - filteredY * ((height / 2 - 20) / amplitudeMax());

            if (x === 0) {
                inputCtx.moveTo(x, plotYInput);
                filteredCtx.moveTo(x, plotYFiltered);
            } else {
                inputCtx.lineTo(x, plotYInput);
                filteredCtx.lineTo(x, plotYFiltered);
            }
        }

        inputCtx.strokeStyle = inputWaveColor;
        inputCtx.lineWidth = 2.5;
        inputCtx.stroke();

        filteredCtx.strokeStyle = filteredWaveColor;
        filteredCtx.lineWidth = 2.5;
        filteredCtx.stroke();

        time -= (velocity / 60);
        animationId = requestAnimationFrame(animate);
    }

    function amplitudeMax() {
        switch (waveformSelect.value) {
            case 'sawtooth':
                return Math.max(Math.abs(amplitude), 2);
            default:
                return Math.max(Math.abs(amplitude), 1);
        }
    }

    function updateStats() {
        const waveformNames = {
            'sine': 'Sine',
            'square': 'Square',
            'triangle': 'Triangle',
            'sawtooth': 'Sawtooth',
            'pulse': 'Pulse'
        };
        const filterNames = {
            'none': 'None',
            'lowpass': 'Low-Pass',
            'highpass': 'High-Pass',
            'bandpass': 'Band-Pass',
            'bandstop': 'Band-Stop'
        };

        waveformDisplay.textContent = waveformNames[waveformSelect.value] || 'Sine';
        amplitudeDisplay.textContent = amplitude.toFixed(2);
        frequencyDisplay.textContent = frequency.toFixed(2) + ' Hz';
        filterDisplay.textContent = filterNames[filterSelect.value] || 'None';
    }

    function updateValues() {
        amplitude = parseFloat(amplitudeSlider.value);
        frequency = parseFloat(frequencySlider.value);
        phase = parseFloat(phaseSlider.value);
        velocity = parseFloat(velocitySlider.value);

        amplitudeValue.textContent = amplitude.toFixed(2);
        frequencyValue.textContent = frequency.toFixed(2);
        phaseValue.textContent = phase.toFixed(2);
        velocityValue.textContent = velocity.toFixed(2);

        updateStats();
    }

    function updateFilterValues() {
        const filterType = filterSelect.value;

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

    // Presets
    const presets = {
        sine: {
            waveform: 'sine',
            amplitude: 1,
            frequency: 1,
            phase: 0,
            velocity: 1,
            filter: 'none'
        },
        square: {
            waveform: 'square',
            amplitude: 0.8,
            frequency: 0.5,
            phase: 0,
            velocity: 1,
            filter: 'lowpass',
            cutoff: 2,
            filterQ: 1
        },
        complex: {
            waveform: 'sawtooth',
            amplitude: 0.7,
            frequency: 1.5,
            phase: 1.57,
            velocity: 1.5,
            filter: 'bandpass',
            centerFrequency: 2,
            bandwidth: 1
        }
    };

    function applyPreset(presetName) {
        const preset = presets[presetName];
        if (!preset) return;

        waveformSelect.value = preset.waveform;
        amplitudeSlider.value = preset.amplitude;
        frequencySlider.value = preset.frequency;
        phaseSlider.value = preset.phase;
        velocitySlider.value = preset.velocity;
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

        presetButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === presetName);
        });

        showToast(`${presetName.charAt(0).toUpperCase() + presetName.slice(1)} preset applied`, 'success');
    }

    // Card toggle functionality
    document.querySelectorAll('.card-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const expanded = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', !expanded);
        });
    });

    // Event listeners
    waveformSelect.addEventListener('change', updateValues);
    amplitudeSlider.addEventListener('input', updateValues);
    frequencySlider.addEventListener('input', updateValues);
    phaseSlider.addEventListener('input', updateValues);
    velocitySlider.addEventListener('input', updateValues);

    filterSelect.addEventListener('change', updateFilterValues);
    cutoffFrequencySlider.addEventListener('input', updateFilterValues);
    centerFrequencySlider.addEventListener('input', updateFilterValues);
    bandwidthSlider.addEventListener('input', updateFilterValues);
    filterQSlider.addEventListener('input', updateFilterValues);

    // Preset buttons
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            applyPreset(btn.dataset.preset);
        });
    });

    // Reset defaults
    resetDefaults.addEventListener('click', () => {
        applyPreset('sine');
    });

    // Pause/Play
    pauseBtn.addEventListener('click', () => {
        isPaused = !isPaused;
        pauseBtn.innerHTML = isPaused 
            ? '<span class="btn-icon">▶️</span><span class="btn-text">Resume</span>'
            : '<span class="btn-icon">⏸️</span><span class="btn-text">Pause</span>';
        showToast(isPaused ? 'Animation paused' : 'Animation resumed', 'info');
    });

    // Reset animation
    resetBtn.addEventListener('click', () => {
        time = 0;
        filter.reset();
        showToast('Animation reset', 'success');
    });

    // Screenshot
    screenshotBtn.addEventListener('click', () => {
        const combinedCanvas = document.createElement('canvas');
        combinedCanvas.width = inputCanvas.width;
        combinedCanvas.height = inputCanvas.height * 2 + 20;
        const ctx = combinedCanvas.getContext('2d');

        // Background
        ctx.fillStyle = getColorForMode('#ffffff', '#1e293b');
        ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);

        // Draw both canvases
        ctx.drawImage(inputCanvas, 0, 0);
        ctx.drawImage(filteredCanvas, 0, inputCanvas.height + 20);

        // Add labels
        ctx.fillStyle = getColorForMode('#1e293b', '#f1f5f9');
        ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
        ctx.fillText('Input Signal', 10, 20);
        ctx.fillText('Filtered Output', 10, inputCanvas.height + 40);

        const link = document.createElement('a');
        link.download = 'signal-visualization.png';
        link.href = combinedCanvas.toDataURL();
        link.click();

        showToast('Screenshot saved! 📷', 'success');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Check if user is focused on an interactive element
        const activeElement = document.activeElement;
        const isInteractiveElement = activeElement.tagName === 'INPUT' || 
                                     activeElement.tagName === 'SELECT' || 
                                     activeElement.tagName === 'TEXTAREA' ||
                                     activeElement.isContentEditable;
        
        if (e.code === 'Space' && !isInteractiveElement) {
            e.preventDefault();
            pauseBtn.click();
        }
    });

    // Initialize
    updateValues();
    updateFilterValues();
    animate();
});