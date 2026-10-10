"use strict";

/*
 * A calm, original soundtrack synthesized from scratch (no samples): warm pads,
 * a soft bass and a quiet pluck pattern at 75 BPM, plus cues placed from the
 * timeline. A click on the twist, a chime on each reveal, and a rising note for
 * every piece the integral builder adds, with a bell when a ring is complete.
 */

const fs = require("fs");

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

// C major, gentle: Cmaj9, Am9, Fmaj7, G6 — one chord per bar.
const CHORDS = [
    { root: 36, pad: [48, 52, 55, 59, 62], arp: [72, 76, 79, 83] },
    { root: 33, pad: [45, 48, 52, 55, 59], arp: [69, 72, 76, 79] },
    { root: 29, pad: [41, 45, 48, 52, 57], arp: [69, 72, 76, 77] },
    { root: 31, pad: [43, 47, 50, 52, 55], arp: [67, 71, 74, 76] }
];
const PENTA = [0, 2, 4, 7, 9];

function writeSoundtrack(timeline, file) {
    const { DURATION, BEAT } = timeline;
    const BAR = BEAT * 4;
    const music = bus(DURATION + 3), cues = bus(DURATION + 3);
    const bars = Math.ceil(DURATION / BAR);
    for (let b = 0; b < bars; b++) {
        const t0 = b * BAR, chord = CHORDS[b % CHORDS.length];
        const last = t0 >= timeline.endCard;
        mix(music, pad(chord.pad, BAR + 1.2), t0, .5);
        if (t0 >= BAR) {
            mix(music, bass(chord.root, BEAT * 2.4), t0, .55);
            mix(music, bass(chord.root, BEAT * 1.6), t0 + BEAT * 2.5, .4);
        }
        if (t0 >= timeline.RACE_START - 1 && !last) {
            mix(music, kick(), t0, .55);
            mix(music, kick(), t0 + BEAT * 2, .4);
        }
        if (t0 >= 14 && !last) for (let k = 0; k < 8; k++) mix(music, shaker(), t0 + (k + .5) * BEAT / 2, k % 2 ? .1 : .16, .3);
        if (t0 >= BAR * 2 && !last) {
            const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
            pattern.forEach((p, k) => mix(music, pluck(chord.arp[p] - 12), t0 + k * BEAT / 2, .12, k % 2 ? .35 : -.35));
        }
    }
    // Cues from the timeline.
    mix(cues, click(), timeline.RACE_START, .5);
    mix(cues, swell(4.2), timeline.RACE_START, .45);
    const reveal = timeline.captions.find(c => /wins/.test(c.lines.join(" ")));
    [72, 76, 79].forEach((n, k) => mix(cues, bell(n), reveal.t + k * .09, .28, (k - 1) * .4));
    const harder = timeline.captions.find(c => /4× harder/.test(c.lines.join(" ")));
    mix(cues, bell(67), harder.t, .3);
    for (const piece of timeline.piecesAt) {
        const note = 60 + 12 * Math.floor(piece.ring / 2) + PENTA[(piece.piece + piece.ring * 2) % PENTA.length] + (piece.ring % 2) * 5;
        mix(cues, pluck(note, .5), piece.t, .3, (piece.piece / 7 - .5) * .6);
        if (piece.ringDone) mix(cues, bell(84 + piece.ring * 2, 1.6), piece.t + .05, .16);
    }
    const integral = timeline.captions.find(c => /double integral/.test(c.lines.join(" ")));
    [60, 67, 72, 76].forEach((n, k) => mix(cues, bell(n), integral.t + k * .12, .24, (k - 1.5) * .3));
    mix(cues, swell(2.6), timeline.sweeps[1].from, .35);
    [48, 55, 60, 64, 67].forEach((n, k) => mix(cues, bell(n, 3), timeline.endCard + .3 + k * .1, .2, (k - 2) * .3));

    const wet = reverb(music.map((ch, c) => ch.map((x, i) => x + cues[c][i] * .6)), .28);
    const length = Math.round(DURATION * SR);
    const master = wet.map(ch => {
        const out = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            const t = i / SR;
            const fade = Math.min(1, t / .6) * Math.min(1, (DURATION - t) / 2.4);
            out[i] = ch[i] * fade;
        }
        return out;
    });
    const peak = Math.max(...master.map(ch => ch.reduce((m, x) => Math.max(m, Math.abs(x)), 0))) || 1;
    const final = master.map(ch => ch.map(x => Math.tanh(x / peak * 1.2) / Math.tanh(1.2) * .85));
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
