"use strict";

/*
 * Synthesis primitives shared by the calm explainer reels: oscillators, envelopes,
 * a two-pole lowpass, a small Schroeder reverb and a 16-bit stereo WAV writer.
 * No samples. Noise is seeded, so every render is byte-identical.
 */

const SR = 48000;
const TAU = Math.PI * 2;
const midi = n => 440 * 2 ** ((n - 69) / 12);

function bus(seconds) {
    const n = Math.ceil(seconds * SR);
    return [new Float32Array(n), new Float32Array(n)];
}

function mix(target, signal, start, gain = 1, pan = 0) {
    const offset = Math.round(start * SR);
    const left = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, right = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
    for (let i = 0; i < signal.length; i++) {
        const j = offset + i;
        if (j < 0 || j >= target[0].length) continue;
        target[0][j] += signal[i] * gain * left;
        target[1][j] += signal[i] * gain * right;
    }
}

function lowpass(data, cutoff) {
    const a = 1 - Math.exp(-TAU * cutoff / SR);
    const out = new Float32Array(data.length);
    let y1 = 0, y2 = 0;
    for (let i = 0; i < data.length; i++) { y1 += a * (data[i] - y1); y2 += a * (y1 - y2); out[i] = y2; }
    return out;
}

function render(seconds, fn) {
    const out = new Float32Array(Math.ceil(seconds * SR));
    for (let i = 0; i < out.length; i++) out[i] = fn(i / SR);
    return out;
}

const envelope = (t, length, attack, release) => Math.min(1, t / attack) * Math.min(1, Math.max(0, (length - t) / release));

function pad(notes, length) {
    const voices = notes.map((note, k) => {
        const f = midi(note);
        return render(length, t => {
            const env = envelope(t, length, .7, 1.1);
            const tri = p => 2 * Math.abs(2 * (p % 1) - 1) - 1;
            return env * (tri(f * t) + tri(f * 1.004 * t + k * .13) + .5 * Math.sin(TAU * f * .5 * t)) / 2.5;
        });
    });
    const sum = new Float32Array(voices[0].length);
    voices.forEach(v => v.forEach((x, i) => { sum[i] += x / notes.length; }));
    return lowpass(sum, 1500);
}

function pluck(note, length = .6) {
    const f = midi(note);
    return lowpass(render(length, t => Math.min(1, t / .004) * Math.exp(-t * 6) * (Math.sin(TAU * f * t) + .35 * Math.sin(TAU * 2 * f * t) + .12 * Math.sin(TAU * 3 * f * t))), 4200);
}

function bell(note, length = 2.2) {
    const f = midi(note);
    return render(length, t => Math.min(1, t / .003) * (Math.sin(TAU * f * t) * Math.exp(-t * 1.6) + .45 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t * 3) + .25 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t * 5)));
}

function bass(note, length) {
    const f = midi(note);
    return render(length, t => envelope(t, length, .02, .3) * Math.exp(-t * .9) * (Math.sin(TAU * f * t) + .15 * Math.sin(TAU * 2 * f * t)));
}

function kick() {
    let phase = 0;
    return render(.45, t => { phase += (48 + 70 * Math.exp(-t * 28)) / SR; return Math.sin(TAU * phase) * Math.exp(-t * 9); });
}

let seed = 7;
const reseed = value => { seed = value >>> 0; };
const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };

function shaker() {
    const raw = render(.09, t => noise() * Math.exp(-t * 55));
    const hp = new Float32Array(raw.length);
    for (let i = 1; i < raw.length; i++) hp[i] = .9 * (hp[i - 1] + raw[i] - raw[i - 1]);
    return hp;
}

function click() {
    return render(.05, t => Math.sin(TAU * 1800 * t) * Math.exp(-t * 120) + .3 * noise() * Math.exp(-t * 200));
}

function swell(length) {
    return lowpass(render(length, t => noise() * Math.sin(Math.PI * t / length) ** 2 * .5), 900);
}

function reverb(stereo, wet = .3) {
    const combs = [1557, 1617, 1491, 1422, 1277, 1356], allpasses = [225, 556, 441];
    return stereo.map((data, channel) => {
        const out = new Float32Array(data.length);
        combs.forEach(length => {
            const size = length + channel * 23, buffer = new Float32Array(size);
            let index = 0, store = 0;
            for (let i = 0; i < data.length; i++) {
                const y = buffer[index];
                store = y * .7 + store * .3;
                buffer[index] = data[i] + store * .84;
                index = (index + 1) % size;
                out[i] += y / combs.length;
            }
        });
        allpasses.forEach(length => {
            const buffer = new Float32Array(length);
            let index = 0;
            for (let i = 0; i < out.length; i++) {
                const delayed = buffer[index], y = -out[i] + delayed;
                buffer[index] = out[i] + delayed * .5;
                index = (index + 1) % length;
                out[i] = y;
            }
        });
        return data.map((x, i) => x + out[i] * wet);
    });
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

module.exports = { reseed, SR, TAU, midi, bus, mix, lowpass, render, envelope, pad, pluck, bell, bass, kick, shaker, click, swell, reverb, wav };
