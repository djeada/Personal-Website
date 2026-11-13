"use strict";

/*
 * A quiet bed for a teaching video, from the shared synth (../synth.js): slow
 * pads, a soft bass and a sparse pluck line at 68 BPM, with no drums. It plays a
 * little louder under the title and the end card and sits back under the voice;
 * build.js ducks it further with a sidechain compressor keyed on the speech.
 * Card appearances get a faint pluck, the title and end card a soft bell.
 */

const fs = require("fs");
const { reseed, SR, bus, mix, pad, pluck, bell, bass, reverb, wav } = require("../synth");

const BEAT = 60 / 68, BAR = BEAT * 4;
// Imaj9 – vi9 – IVmaj7 – V6 in D, each held for two bars.
const CHORDS = [
    { root: 38, pad: [50, 54, 57, 61, 64], arp: [74, 78, 81, 85] },
    { root: 35, pad: [47, 50, 54, 57, 61], arp: [71, 74, 78, 81] },
    { root: 31, pad: [43, 47, 50, 54, 59], arp: [71, 74, 78, 79] },
    { root: 33, pad: [45, 49, 52, 54, 57], arp: [69, 73, 76, 78] }
];

/* options.under: the bed level under narration (1 for a reel, which has no voice). */
function writeBed(timeline, file, { under = .45 } = {}) {
    const { DURATION, INTRO } = timeline;
    reseed(17);
    const music = bus(DURATION + 4), cues = bus(DURATION + 4);
    for (let b = 0; b * BAR < DURATION; b++) {
        const t0 = b * BAR, chord = CHORDS[Math.floor(b / 2) % CHORDS.length];
        if (b % 2 === 0) mix(music, pad(chord.pad, BAR * 2 + 1.4), t0, .5);
        mix(music, bass(chord.root, BEAT * 3.2), t0, .42);
        if (b >= 1) [0, 2, 3, 1].forEach((p, k) => { if ((b + k) % 3 !== 2) mix(music, pluck(chord.arp[p] - 12, .9), t0 + k * BEAT + BEAT / 2, .07, k % 2 ? .3 : -.3); });
    }
    for (const cue of timeline.cues) mix(cues, pluck(81, .7), cue.t, .1, .2);
    [62, 69, 74].forEach((n, k) => mix(cues, bell(n, 3), .5 + k * .12, .16, (k - 1) * .4));
    const endBell = timeline.endCard !== undefined ? timeline.endCard + .3 : DURATION - 2.6;
    [50, 57, 62, 66, 69].forEach((n, k) => mix(cues, bell(n, 3), endBell + k * .1, .14, (k - 2) * .3));

    const wet = reverb(music.map((ch, c) => ch.map((x, i) => x + cues[c][i] * .7)), .3);
    // Louder alone (title, end card), quieter under narration.
    const lastVoice = timeline.beats[timeline.beats.length - 1].end;
    const level = t => {
        if (t < INTRO - 1) return 1;
        if (t < INTRO) return 1 - (1 - under) * (t - (INTRO - 1));
        if (t < lastVoice) return under;
        return under + (1 - under) * Math.min(1, (t - lastVoice) / 1.2);
    };
    const length = Math.round(DURATION * SR);
    const master = wet.map(ch => {
        const out = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            const t = i / SR;
            out[i] = ch[i] * level(t) * Math.min(1, t / 1.2) * Math.min(1, (DURATION - t) / 2.5);
        }
        return out;
    });
    const peak = Math.max(...master.map(ch => ch.reduce((m, x) => Math.max(m, Math.abs(x)), 0))) || 1;
    fs.writeFileSync(file, wav(master.map(ch => ch.map(x => x / peak * .8))));
}

module.exports = { writeBed };
