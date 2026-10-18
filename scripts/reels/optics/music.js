"use strict";

/*
 * Calm, original soundtrack for the optics reels, synthesized from scratch at
 * 75 BPM: warm pads, a soft bass, a quiet pluck pattern and a light pulse, plus
 * cues placed from the timeline. A click when a preset loads, a soft swell under
 * every slider sweep, a chime on each reveal and a bell chord under the end card.
 * Each tool gets its own key, so the three series sound related but distinct.
 */

const fs = require("fs");
const { reseed, SR, bus, mix, pad, pluck, bell, bass, kick, shaker, click, swell, reverb, wav } = require("../synth");

// Imaj9, vi9, IVmaj7, V6 in C; `key` transposes the whole progression.
const CHORDS = [
    { root: 36, pad: [48, 52, 55, 59, 62], arp: [72, 76, 79, 83] },
    { root: 33, pad: [45, 48, 52, 55, 59], arp: [69, 72, 76, 79] },
    { root: 29, pad: [41, 45, 48, 52, 57], arp: [69, 72, 76, 77] },
    { root: 31, pad: [43, 47, 50, 52, 55], arp: [67, 71, 74, 76] }
];
const ARP = [[0, 2, 1, 3, 2, 1, 3, 2], [0, 1, 2, 3, 2, 1, 0, 2], [3, 2, 0, 1, 2, 0, 1, 3]];

function writeSoundtrack(timeline, file) {
    const { DURATION, BEAT } = timeline;
    const key = timeline.music.key, pattern = ARP[timeline.music.pattern % ARP.length];
    const BAR = BEAT * 4;
    reseed(timeline.music.seed);
    const music = bus(DURATION + 3), cues = bus(DURATION + 3);
    const bars = Math.ceil(DURATION / BAR);
    for (let b = 0; b < bars; b++) {
        const t0 = b * BAR, chord = CHORDS[b % CHORDS.length];
        const last = t0 >= timeline.endCard;
        mix(music, pad(chord.pad.map(n => n + key), BAR + 1.2), t0, .5);
        if (t0 >= BAR) {
            mix(music, bass(chord.root + key, BEAT * 2.4), t0, .55);
            mix(music, bass(chord.root + key, BEAT * 1.6), t0 + BEAT * 2.5, .4);
        }
        if (t0 >= BAR * 2 && !last) {
            mix(music, kick(), t0, .45);
            mix(music, kick(), t0 + BEAT * 2, .32);
            pattern.forEach((p, k) => mix(music, pluck(chord.arp[p] + key - 12), t0 + k * BEAT / 2, .12, k % 2 ? .35 : -.35));
        }
        if (t0 >= BAR * 3 && !last) for (let k = 0; k < 8; k++) mix(music, shaker(), t0 + (k + .5) * BEAT / 2, k % 2 ? .08 : .13, .3);
    }
    for (const action of timeline.actions) if (action.sound === "click") mix(cues, click(), action.t, .45);
    for (const sweep of timeline.sweeps) {
        mix(cues, swell(sweep.to - sweep.from + .6), sweep.from - .2, .3);
        mix(cues, pluck(67 + key, .8), sweep.from, .22, -.3);
        mix(cues, pluck(74 + key, .8), sweep.to, .22, .3);
    }
    for (const caption of timeline.captions) {
        if (caption.chime) [72, 76, 79].forEach((n, k) => mix(cues, bell(n + key), caption.t + k * .09, .24, (k - 1) * .4));
        else if (caption.bell) mix(cues, bell(67 + key), caption.t, .26);
    }
    [48, 55, 60, 64, 67].forEach((n, k) => mix(cues, bell(n + key, 3), timeline.endCard + .3 + k * .1, .2, (k - 2) * .3));

    const wet = reverb(music.map((ch, c) => ch.map((x, i) => x + cues[c][i] * .6)), .28);
    const length = Math.round(DURATION * SR);
    const master = wet.map(ch => {
        const out = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            const t = i / SR;
            out[i] = ch[i] * Math.min(1, t / .6) * Math.min(1, (DURATION - t) / 2.4);
        }
        return out;
    });
    const peak = Math.max(...master.map(ch => ch.reduce((m, x) => Math.max(m, Math.abs(x)), 0))) || 1;
    const final = master.map(ch => ch.map(x => Math.tanh(x / peak * 1.2) / Math.tanh(1.2) * .85));
    fs.writeFileSync(file, wav(final));
}

module.exports = { writeSoundtrack };
