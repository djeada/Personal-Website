"use strict";

/*
 * Shared defaults for the optics reels: frame rate, tempo, the per-tool watermark,
 * end card and soundtrack key, and a checker that keeps the pacing calm.
 */

const FPS = 30;
const BPM = 75;
const BEAT = 60 / BPM;

const TOOLS = {
    geometric_optics: {
        mark: "GEOMETRICAL OPTICS BENCH · ADAMDJELLOULI.COM",
        end: {
            title: "Geometrical<br>Optics Bench",
            formula: "1/s<sub>o</sub> + 1/s<sub>i</sub> = 1/f",
            list: "Drag lenses, mirrors and stops<br>trace exact rays · see every aberration",
            url: "adamdjellouli.com/tools/geometric_optics"
        },
        key: 0
    },
    em_waves: {
        mark: "ELECTROMAGNETIC WAVES · ADAMDJELLOULI.COM",
        end: {
            title: "Electromagnetic<br>Waves",
            formula: "S = E × H",
            list: "Watch E and H travel together<br>polarization · mirrors · standing waves",
            url: "adamdjellouli.com/tools/em_waves"
        },
        key: 2
    },
    fresnel: {
        mark: "FRESNEL EQUATIONS · ADAMDJELLOULI.COM",
        end: {
            title: "Fresnel<br>Equations",
            formula: "R + T = 1",
            list: "Any angle, any polarization<br>Brewster · total internal reflection · metals",
            url: "adamdjellouli.com/tools/fresnel"
        },
        key: -3
    }
};

const strip = html => html.replace(/<[^>]+>/g, "");

/*
 * Fills in the defaults and fails loudly if the pacing rules are broken: captions
 * must not overlap, each one stays up long enough to read, and nothing runs into
 * the end card.
 */
function reel(spec) {
    const tool = TOOLS[spec.tool];
    const timeline = {
        FPS, BPM, BEAT,
        mark: tool.mark,
        end: tool.end,
        css: "",
        setup: [],
        actions: [],
        sweeps: [],
        huds: [],
        chips: [],
        slow: [],
        ...spec,
        music: { key: tool.key, pattern: 0, seed: 7, ...(spec.music || {}) }
    };
    timeline.endCard = timeline.DURATION - 6;
    timeline.actions = [...timeline.actions].sort((a, b) => a.t - b.t);
    const captions = timeline.captions;
    captions.forEach((c, i) => {
        const words = strip(c.lines.join(" ")).split(/\s+/).length;
        const need = Math.max(3, 1.2 + words * .32);
        if (c.end - c.t < need) throw new Error(`${spec.id}: caption "${strip(c.lines.join(" "))}" is up ${(c.end - c.t).toFixed(1)} s; needs ${need.toFixed(1)} s`);
        if (i && c.t < captions[i - 1].end - 1e-6) throw new Error(`${spec.id}: caption at ${c.t} s overlaps the previous one`);
        if (c.end > timeline.endCard + 1e-6) throw new Error(`${spec.id}: caption at ${c.t} s runs into the end card`);
    });
    return timeline;
}

function describe(timeline) {
    const lines = [`${timeline.id}  (${timeline.tool}, ${timeline.DURATION} s)  ${timeline.hook || ""}`];
    for (const c of timeline.captions) lines.push(`  ${c.t.toFixed(1).padStart(5)}–${c.end.toFixed(1).padEnd(5)} ${(c.end - c.t).toFixed(1)}s  ${strip(c.lines.join(" "))}  |  ${strip(c.sub || "")}`);
    return lines.join("\n");
}

module.exports = { reel, describe, FPS, BEAT };
