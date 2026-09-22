"use strict";

/*
 * SFX bed.
 *
 * Builds one WAV per reel from the timeline, entirely from ffmpeg oscillators - no
 * sample library, nothing licensed. Each beat gets a cue placed at its start offset;
 * comparison steps walk up a pentatonic scale so a long scan *sounds* expensive and
 * a one-probe hash lookup sounds instant, which is the whole point of the reel.
 */

const { spawnSync } = require("child_process");

const SAMPLE_RATE = 48_000;
const MAKEUP_GAIN = 2.4;
const PEAK_CEILING = 0.92;

// Minor pentatonic from A4 - any subset lands in tune, so scans never sour.
const SCALE = [440.0, 523.25, 587.33, 659.26, 783.99, 880.0, 1046.5, 1174.66];

function sine(frequency, duration) {
    return `sine=frequency=${frequency.toFixed(2)}:duration=${duration.toFixed(3)}:sample_rate=${SAMPLE_RATE}`;
}

// A plucked blip: instant attack, exponential tail. `expr` sources are mono, so every
// cue is up-mixed to stereo before the mix.
function pluck(frequency, duration, gain, decayAt = 0.015) {
    return {
        source: sine(frequency, duration),
        chain: `afade=t=out:st=${decayAt.toFixed(3)}:d=${(duration - decayAt).toFixed(3)}:curve=exp,volume=${gain}`
    };
}

function sweep(from, to, duration, gain) {
    // phase(t) = 2*PI*(f0*t + (k/2)*t^2) with k the linear frequency slope.
    const slope = (to - from) / duration;
    const expr = `sin(2*PI*(${from.toFixed(3)}*t+${(slope / 2).toFixed(3)}*t*t))`;
    return {
        source: `aevalsrc=${expr}:d=${duration.toFixed(3)}:s=${SAMPLE_RATE}`,
        chain: `afade=t=out:st=${(duration * 0.55).toFixed(3)}:d=${(duration * 0.45).toFixed(3)},volume=${gain}`
    };
}

function noise(duration, gain, colour = "pink") {
    return {
        source: `anoisesrc=d=${duration.toFixed(3)}:c=${colour}:r=${SAMPLE_RATE}`,
        chain: `afade=t=in:st=0:d=${(duration * 0.6).toFixed(3)},afade=t=out:st=${(duration * 0.6).toFixed(3)}:d=${(duration * 0.4).toFixed(3)},volume=${gain}`
    };
}

// One beat cue -> zero or more oscillator voices.
function cuesFor(sfx) {
    if (!sfx) return [];
    switch (sfx.type) {
        case "blip": {
            // The rhythmic backbone of the reel, so it carries the most level.
            const frequency = SCALE[Math.min(sfx.index || 0, SCALE.length - 1)];
            return [pluck(frequency, 0.2, 1.5, 0.012), pluck(frequency * 2, 0.1, 0.38, 0.006)];
        }
        case "hit":
            // Root + fifth + octave: unmistakably "found it".
            return [
                pluck(659.26, 0.5, 1.15),
                pluck(987.77, 0.5, 0.78, 0.02),
                pluck(1318.51, 0.4, 0.45, 0.02)
            ];
        case "miss":
            return [pluck(233.08, 0.42, 1.15), pluck(277.18, 0.42, 0.7)];
        case "tick":
            return [pluck(1567.98, 0.07, 0.6, 0.004), noise(0.1, 0.16)];
        case "riser":
            return [sweep(180, 720, 0.9, 0.13), noise(0.9, 0.05)];
        case "drop":
            return [sweep(140, 42, 0.75, 0.14)];
        default:
            return [];
    }
}

function buildFilterGraph(timeline) {
    const inputs = [];
    const filters = [];
    const mixLabels = [];

    // Silent bed pins the track to the exact video length.
    inputs.push("-f", "lavfi", "-t", String(timeline.duration), "-i", `anullsrc=r=${SAMPLE_RATE}:cl=stereo`);
    mixLabels.push("[0:a]");

    let offset = 0;
    let inputIndex = 1;
    for (const beat of timeline.beats) {
        for (const cue of cuesFor(beat.sfx)) {
            inputs.push("-f", "lavfi", "-i", cue.source);
            const delay = Math.max(0, Math.round(offset * 1000));
            const label = `c${inputIndex}`;
            filters.push(
                `[${inputIndex}:a]${cue.chain},aformat=sample_fmts=fltp:sample_rates=${SAMPLE_RATE}:channel_layouts=stereo,adelay=${delay}|${delay}[${label}]`
            );
            mixLabels.push(`[${label}]`);
            inputIndex += 1;
        }
        offset += beat.duration;
    }

    // normalize=0 keeps the cue levels as designed, the makeup gain lifts the whole
    // bed to posting level, and the limiter goes last so it actually catches the
    // overlaps instead of being undone by gain applied after it.
    filters.push(
        `${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=first:normalize=0,` +
        `volume=${MAKEUP_GAIN},alimiter=level_in=1:limit=${PEAK_CEILING}:attack=2:release=60[out]`
    );
    return { inputs, filterGraph: filters.join(";") };
}

function buildSfx(timeline, outputPath) {
    const { inputs, filterGraph } = buildFilterGraph(timeline);
    const args = [
        "-hide_banner", "-loglevel", "error", "-y",
        ...inputs,
        "-filter_complex", filterGraph,
        "-map", "[out]",
        "-t", String(timeline.duration),
        "-c:a", "pcm_s16le",
        outputPath
    ];
    const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
    if (result.status !== 0) {
        throw new Error(`ffmpeg failed building SFX:\n${result.stderr || result.stdout}`);
    }
    return outputPath;
}

module.exports = { buildSfx, cuesFor };
