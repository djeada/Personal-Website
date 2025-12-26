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

let amplitude = parseFloat(amplitudeSlider.value);
let frequency = parseFloat(frequencySlider.value);
let phase = parseFloat(phaseSlider.value);
let cutoffFrequency = parseFloat(cutoffFrequencySlider.value);
let centerFrequency = parseFloat(centerFrequencySlider.value);
let bandwidth = parseFloat(bandwidthSlider.value);
let filterQ = parseFloat(filterQSlider.value);
let velocity = parseFloat(velocitySlider.value);

let time = 0;

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

function getColorForMode(colorLight, colorDark) {
    const darkModeValue = getCookie("darkMode");
    return darkModeValue && darkModeValue.toLowerCase() === "true" ? colorDark : colorLight;
}

function drawAxes(ctx, width, height) {
    const axisColor = getColorForMode('#ccc', '#444');
    const labelColor = getColorForMode('#000', '#fff');

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
    ctx.font = '12px Arial';
    ctx.fillText('Time', width - 30, height / 2 + 15);
    ctx.save();
    ctx.translate(15, 120);
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

    const inputWaveColor = getColorForMode('#000', '#00ff00');
    const filteredWaveColor = getColorForMode('#00f', '#ff4500');

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
    inputCtx.lineWidth = 2;
    inputCtx.stroke();

    filteredCtx.strokeStyle = filteredWaveColor;
    filteredCtx.lineWidth = 2;
    filteredCtx.stroke();

    time -= (velocity / 60);
    requestAnimationFrame(animate);
}

function amplitudeMax() {

    switch (waveformSelect.value) {
        case 'sawtooth':
            return Math.max(Math.abs(amplitude), 2);
        default:
            return Math.max(Math.abs(amplitude), 1);
    }
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
}

function updateFilterValues() {
    const filterType = filterSelect.value;

    if (filterType === 'none') {
        filterParameters.style.display = 'none';
    } else {
        filterParameters.style.display = 'block';

        if (filterType === 'lowpass' || filterType === 'highpass') {
            singleCutoff.style.display = 'block';
            bandParameters.style.display = 'none';
            cutoffFrequency = parseFloat(cutoffFrequencySlider.value);
            cutoffFrequencyValue.textContent = cutoffFrequency.toFixed(2);
            filterQControl.style.display = 'block';
            filterQ = parseFloat(filterQSlider.value);
            filterQValue.textContent = filterQ.toFixed(2);
            filter.updateParameters(filterType, cutoffFrequency, filterQ);
        } else if (filterType === 'bandpass' || filterType === 'bandstop') {
            singleCutoff.style.display = 'none';
            bandParameters.style.display = 'block';
            filterQControl.style.display = 'none';
            centerFrequency = parseFloat(centerFrequencySlider.value);
            bandwidth = parseFloat(bandwidthSlider.value);
            centerFrequencyValue.textContent = centerFrequency.toFixed(2);
            bandwidthValue.textContent = bandwidth.toFixed(2);
            filterQ = centerFrequency / bandwidth;
            filterQValue.textContent = filterQ.toFixed(2);
            filter.updateParameters(filterType, centerFrequency, filterQ);
        }
    }
}

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

updateValues();
updateFilterValues();
animate();