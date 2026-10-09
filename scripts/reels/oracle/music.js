"use strict";

/*
 * Original phonk-style soundtrack, synthesized from scratch (no samples, nothing
 * licensed): distorted pitched cowbell riff, sliding 808, clap, hats, risers and
 * impacts. Sections and hits are placed from the same timeline as the picture, so
 * every game click, caption slam and cut has a sound on the grid.
 */

const fs = require("fs");

const SR = 48000;
const TAU = Math.PI * 2;
let seed = 1337;
const noise = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
};
const midi = n => 440 * 2 ** ((n - 69) / 12);

function bus(seconds) {
    const n = Math.ceil(seconds * SR);
    return [new Float32Array(n), new Float32Array(n)];
}

function mix(target, signal, start, gain = 1, pan = 0) {
    const offset = Math.round(start * SR);
    const left = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, right = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
    const stereo = Array.isArray(signal);
    const length = stereo ? signal[0].length : signal.length;
    for (let i = 0; i < length; i++) {
        const j = offset + i;
        if (j < 0 || j >= target[0].length) continue;
        target[0][j] += (stereo ? signal[0][i] : signal[i]) * gain * left;
        target[1][j] += (stereo ? signal[1][i] : signal[i]) * gain * right;
    }
}

// RBJ biquad; `cutoff` may be a function of the sample index for sweeps.
function biquad(data, type, cutoff, q = .707) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const out = new Float32Array(data.length);
    let coeffs = null, lastF = -1;
    for (let i = 0; i < data.length; i++) {
        const f = Math.min(SR * .45, Math.max(20, typeof cutoff === "function" ? cutoff(i) : cutoff));
        if (Math.abs(f - lastF) > .5 || !coeffs) {
            lastF = f;
            const w = TAU * f / SR, alpha = Math.sin(w) / (2 * q), c = Math.cos(w);
            let b0, b1, b2;
            if (type === "lowpass") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
            else if (type === "highpass") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
            else { b0 = alpha; b1 = 0; b2 = -alpha; }
            const a0 = 1 + alpha;
            coeffs = [b0 / a0, b1 / a0, b2 / a0, -2 * c / a0, (1 - alpha) / a0];
        }
        const [b0, b1, b2, a1, a2] = coeffs;
        const y = b0 * data[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = data[i]; y2 = y1; y1 = y;
        out[i] = y;
    }
    return out;
}

function render(seconds, fn) {
    const out = new Float32Array(Math.ceil(seconds * SR));
    for (let i = 0; i < out.length; i++) out[i] = fn(i / SR, i);
    return out;
}

/* ---------- instruments ---------- */

function cowbell(note, length = .2, detune = 0) {
    const f = midi(note) * 2 ** (detune / 1200);
    let p1 = 0, p2 = 0;
    const raw = render(length, t => {
        p1 += f / SR; p2 += f * 1.4836 / SR;
        const square = (p1 % 1 < .5 ? 1 : -1) * .6 + (p2 % 1 < .5 ? 1 : -1) * .4;
        const env = Math.min(1, t / .002) * (Math.exp(-t / .05) * .7 + Math.exp(-t / .16) * .3);
        return square * env;
    });
    const shaped = biquad(raw, "bandpass", f * 1.7, 1.1);
    return shaped.map(x => Math.tanh(x * 5) * .55);
}

function eightOhEight(note, length, glideTo = null) {
    let phase = 0;
    const f0 = midi(note), f1 = glideTo === null ? f0 : midi(glideTo);
    return render(length + .05, t => {
        const slide = glideTo === null ? 0 : Math.min(1, Math.max(0, (t - length * .45) / (length * .5)));
        const f = (f0 + (f1 - f0) * slide) * (1 + 1.6 * Math.exp(-t * 38));
        phase += TAU * f / SR;
        const env = Math.min(1, t / .004) * Math.min(1, Math.max(0, (length + .05 - t) / .05)) * (.55 + .45 * Math.exp(-t * 2.2));
        return Math.tanh((Math.sin(phase) + .25 * Math.sin(2 * phase)) * 2.6) * env;
    });
}

function kick(gain = 1) {
    let phase = 0;
    return render(.32, t => {
        phase += TAU * (48 + 130 * Math.exp(-t * 32)) / SR;
        const click = t < .004 ? noise() * (1 - t / .004) * .6 : 0;
        return (Math.tanh(Math.sin(phase) * 2.2) * Math.exp(-t * 9) + click) * gain;
    });
}

function clap() {
    const raw = render(.32, t => {
        const bursts = [0, .011, .022].reduce((sum, at) => sum + (t >= at ? Math.exp(-(t - at) * (at === .022 ? 18 : 140)) : 0), 0);
        return noise() * bursts;
    });
    const body = render(.12, t => Math.sin(TAU * 185 * t) * Math.exp(-t * 30) * .5);
    const out = biquad(raw, "bandpass", 1500, .8);
    body.forEach((x, i) => { out[i] += x; });
    return out.map(x => Math.tanh(x * 2.2) * .7);
}

function hat(open = false) {
    const raw = render(open ? .22 : .05, t => noise() * Math.exp(-t * (open ? 16 : 75)));
    return biquad(raw, "highpass", 7500, .9);
}

function crash(length = 1.8) {
    const raw = render(length, t => noise() * Math.exp(-t * 2.6) * Math.min(1, t / .002));
    return biquad(raw, "highpass", 3800, .7).map(x => x * .7);
}

function riser(length) {
    const n = Math.ceil(length * SR);
    const raw = render(length, t => noise() * (t / length) ** 2.4);
    return biquad(raw, "bandpass", i => 300 * 2 ** (5.5 * i / n), 1.6);
}

function boom(gain = 1) {
    let phase = 0;
    const tone = render(1.6, t => {
        phase += TAU * (38 + 110 * Math.exp(-t * 14)) / SR;
        return Math.tanh(Math.sin(phase) * 3) * Math.exp(-t * 2.4);
    });
    const hit = biquad(render(.4, t => noise() * Math.exp(-t * 14)), "lowpass", 2400);
    hit.forEach((x, i) => { tone[i] += x * .7; });
    return tone.map(x => x * gain);
}

function whoosh(length = .3, up = true) {
    const n = Math.ceil(length * SR);
    const raw = render(length, t => noise() * Math.sin(Math.PI * t / length) ** 2);
    return biquad(raw, "bandpass", i => (up ? 400 * 2 ** (3.2 * i / n) : 3600 * 2 ** (-3.2 * i / n)), 2.2);
}

function blip(freq, length = .05, type = "sine") {
    let phase = 0;
    return render(length, t => {
        phase += freq / SR;
        const wave = type === "saw" ? 2 * (phase % 1) - 1 : Math.sin(TAU * phase);
        return wave * Math.exp(-t / (length / 4));
    });
}

function denied() {
    let phase = 0;
    const raw = render(.28, t => {
        phase += (120 - 60 * t / .28) / SR;
        return (2 * (phase % 1) - 1) * Math.min(1, t / .005) * Math.exp(-t * 7);
    });
    return biquad(raw, "lowpass", 1100).map(x => Math.tanh(x * 3) * .6);
}

function sparkle() {
    const out = new Float32Array(Math.ceil(.5 * SR));
    [0, 7, 12, 19].forEach((step, k) => {
        const tone = blip(midi(84 + step), .22);
        const offset = Math.round(k * .035 * SR);
        tone.forEach((x, i) => { if (offset + i < out.length) out[offset + i] += x * .5; });
    });
    return out;
}

/* ---------- effects ---------- */

function reverb(stereo, wet = .25) {
    const combs = [1557, 1617, 1491, 1422, 1277, 1356], allpasses = [225, 556, 441];
    return stereo.map((data, channel) => {
        const out = new Float32Array(data.length);
        combs.forEach(length => {
            const size = length + channel * 23, buffer = new Float32Array(size);
            let index = 0, store = 0;
            for (let i = 0; i < data.length; i++) {
                const y = buffer[index];
                store = y * .8 + store * .2;
                buffer[index] = data[i] + store * .82;
                index = (index + 1) % size;
                out[i] += y / combs.length;
            }
        });
        allpasses.forEach(length => {
            const buffer = new Float32Array(length);
            let index = 0;
            for (let i = 0; i < out.length; i++) {
                const delayed = buffer[index];
                const y = -out[i] + delayed;
                buffer[index] = out[i] + delayed * .5;
                index = (index + 1) % length;
                out[i] = y;
            }
        });
        return data.map((x, i) => x + out[i] * wet);
    });
}

function tapeStop(stereo, start, length) {
    const from = Math.round(start * SR), n = Math.round(length * SR);
    return stereo.map(data => {
        const source = data.slice(from, from + n * 2);
        let position = 0;
        for (let i = 0; i < n && from + i < data.length; i++) {
            const rate = Math.max(0, 1 - i / n) ** 1.6;
            const k = Math.floor(position), frac = position - k;
            data[from + i] = ((source[k] || 0) * (1 - frac) + (source[k + 1] || 0) * frac) * Math.min(1, (n - i) / (SR * .02));
            position += rate;
        }
        data.fill(0, from + n);
        return data;
    });
}

/* ---------- arrangement ---------- */

const ROOT = 73; // C#5 for the cowbell; the 808 sits three octaves lower
const RIFF = [
    [[0, 0], [2, 0], [3, 12], [5, 0], [6, 10], [8, 7], [10, 8], [11, 7], [13, 3], [14, 5]],
    [[0, 0], [2, 0], [3, 12], [5, 0], [6, 10], [8, 15], [10, 12], [11, 10], [13, 8], [14, 1]]
];
const BASS = [[0, 0, 6], [6, 0, 4], [10, -4, 4], [14, -2, 2, 0]];

function writeSoundtrack(timeline, file) {
    const { DURATION, BEAT, moves, captions } = timeline;
    const step = BEAT / 4, bar = BEAT * 4;
    const drums = bus(DURATION + 2), bells = bus(DURATION + 2), bass = bus(DURATION + 2), fx = bus(DURATION + 2), verb = bus(DURATION + 2);
    // Which parts play when. The gaps are the edit's breath points.
    const drumsOn = t => (t >= 4 && t < 7) || (t >= 8 && t < 18.75) || (t >= 19 && t < 22) || (t >= 23 && t < 25.5);
    const bassOn = t => drumsOn(t) || (t >= 22 && t < 23);
    const bellsOn = t => t < 3.75 || (t >= 4 && t < 25.5);
    const doubleTime = t => t >= 16 && t < 18.75;

    for (let b = 0; b * bar < DURATION; b++) {
        const barStart = b * bar;
        RIFF[b % 2].forEach(([s, n]) => {
            const t = barStart + s * step;
            if (!bellsOn(t)) return;
            mix(bells, cowbell(ROOT + n, .2, 6), t, .5, -.25);
            mix(bells, cowbell(ROOT + n, .2, -6), t, .5, .25);
            if (doubleTime(t) || (t >= 23 && t < 25.5)) mix(bells, cowbell(ROOT + n + 12, .14), t, .22, 0);
        });
        BASS.forEach(([s, n, len, glide]) => {
            const t = barStart + s * step;
            if (!bassOn(t)) return;
            mix(bass, eightOhEight(ROOT - 36 + n, len * step, glide === undefined ? null : ROOT - 36 + glide), t, .62);
            if (drumsOn(t)) mix(drums, kick(), t, .7);
        });
        for (let s = 0; s < 16; s++) {
            const t = barStart + s * step;
            if (!drumsOn(t)) continue;
            if (s === 4 || s === 12) { const c = clap(); mix(drums, c, t, .55); mix(verb, c, t, .35); }
            const roll = (s >= 14 && b % 2 === 1) || doubleTime(t);
            if (s % 2 === 0 || roll) mix(drums, hat(s === 10 && b % 2 === 0), t, s % 4 === 0 ? .2 : .13, .3);
            if (roll && s >= 14) for (let k = 1; k < 3; k++) mix(drums, hat(), t + k * step / 3, .1, .3);
        }
    }

    // The intro bells are muffled, and open up when the drop lands.
    const bellCut = i => {
        const t = i / SR;
        if (t < 3.75) return 700 + 1600 * (t / 3.75) ** 3;
        if (t >= 7 && t < 8) return 900;
        if (t >= 22 && t < 23) return 1200;
        return 16000;
    };
    for (let c = 0; c < 2; c++) bells[c] = biquad(bells[c], "lowpass", bellCut, .9);
    for (let c = 0; c < 2; c++) bells[c] = bells[c].map((x, i) => (i / SR >= 7 && i / SR < 8 ? x * .6 : x));

    // Impacts on the drops, risers into them, and booms under the intro words.
    [4, 8, 19, 23].forEach(t => { mix(fx, crash(), t, .5); mix(fx, boom(), t, .8); });
    mix(fx, riser(1.5), 2.4, .5); mix(fx, riser(.9), 7.1, .55); mix(fx, riser(.7), 22.3, .45);
    mix(fx, whoosh(.5, false), 18.5, .5);
    [7.0, 7.5].forEach(t => mix(fx, kick(1.3), t, .9));
    captions.filter(c => c.t < 4 || c.t >= 22).forEach(c => { mix(fx, boom(.55), c.t, .55); mix(fx, whoosh(.18), c.t - .12, .35); });

    // Game sounds, re-voiced from the in-browser SFX so the edit "plays" the game.
    moves.forEach((move, i) => {
        mix(fx, blip(2600, .025), move.t, .25);
        if (!move.escaped) mix(fx, denied(), move.t + .01, .5);
        else if (i === 6) { mix(fx, sparkle(), move.t, .5); mix(fx, whoosh(.45), move.t, .5); }
        else mix(fx, blip(midi(79 + Math.min(move.streak, 12)), .12), move.t + .02, .22, .4);
    });
    mix(fx, sparkle(), 18.5, .45);

    const wet = reverb(verb, 1);
    const master = [0, 1].map(c => {
        const out = new Float32Array(Math.ceil(DURATION * SR));
        for (let i = 0; i < out.length; i++) {
            const duck = Math.max(.55, 1 - .45 * (bass[c][i] ** 2) * 2);
            out[i] = drums[c][i] + bells[c][i] * duck + bass[c][i] + fx[c][i] + wet[c][i] * .35;
        }
        return out;
    });
    const stopped = tapeStop(master, 25.35, .6);
    // Scale so only the top 0.2% of samples reach the soft clipper; the rest stays clean.
    const sorted = Float32Array.from(stopped[0], Math.abs).sort();
    const level = sorted[Math.floor(sorted.length * .998)] || 1;
    const final = stopped.map(ch => ch.map(x => Math.tanh(x / level * 1.1) / Math.tanh(1.1) * .89));
    fs.writeFileSync(file, wav(final));
}

function wav([left, right]) {
    const n = left.length, buffer = Buffer.alloc(44 + n * 4);
    buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + n * 4, 4); buffer.write("WAVE", 8);
    buffer.write("fmt ", 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(2, 22);
    buffer.writeUInt32LE(SR, 24); buffer.writeUInt32LE(SR * 4, 28); buffer.writeUInt16LE(4, 32); buffer.writeUInt16LE(16, 34);
    buffer.write("data", 36); buffer.writeUInt32LE(n * 4, 40);
    for (let i = 0; i < n; i++) {
        buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4);
        buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + i * 4);
    }
    return buffer;
}

module.exports = { writeSoundtrack };
