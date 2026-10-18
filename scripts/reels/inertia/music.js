"use strict";

/*
 * A calm, original soundtrack synthesized from scratch (no samples): warm pads,
 * a soft bass and a quiet pluck pattern at 75 BPM, plus cues placed from the
 * timeline. A click on the twist, a chime on each reveal, and a rising note for
 * every piece the integral builder adds, with a bell when a ring is complete.
 */

const fs = require("fs");
const { SR, bus, mix, pad, pluck, bell, bass, kick, shaker, click, swell, reverb, wav } = require("../synth");

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

module.exports = { writeSoundtrack };
