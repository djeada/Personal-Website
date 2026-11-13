"use strict";

/*
 * Narration audio, one clip per beat.
 *
 *   scratch voice   Kokoro (tts.py) per beat, cached by a hash of voice + text, so a
 *                   re-render only synthesizes the beats whose narration changed.
 *   recorded voice  one WAV per section, beats separated by ~1 s of silence. ffmpeg
 *                   silencedetect finds the gaps and the take is cut into exactly
 *                   as many clips as there are beats, or the build stops.
 *
 * Every clip is described by { file, duration, speechStart, speechEnd } (seconds,
 * within the clip), so beats can be timed from the speech rather than the file.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const PYTHON = path.join(os.homedir(), ".local/share/soi-tts/bin/python");
const TTS = path.join(__dirname, "tts.py");

function run(cmd, args, options = {}) {
    const result = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28, ...options });
    if (result.status !== 0) throw new Error(`${cmd} failed:\n${(result.stderr || "").slice(-2000)}`);
    return result;
}

function duration(file) {
    return Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).stdout.trim());
}

/* Silent stretches as [start, end] pairs, from ffmpeg's silencedetect log. */
function silences(file, db, min) {
    const log = run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", `silencedetect=noise=${db}dB:d=${min}`, "-f", "null", "-"]).stderr;
    const out = [];
    let start = null;
    for (const line of log.split("\n")) {
        const s = line.match(/silence_start: (-?[\d.]+)/), e = line.match(/silence_end: ([\d.]+)/);
        if (s) start = Math.max(0, Number(s[1]));
        if (e && start !== null) { out.push([start, Number(e[1])]); start = null; }
    }
    if (start !== null) out.push([start, Infinity]);
    return out;
}

function describeClip(file) {
    const length = duration(file);
    const gaps = silences(file, -42, 0.12);
    const lead = gaps.find(([a]) => a < 0.02);
    const tail = gaps.find(([, b]) => b >= length - 0.02);
    return { file, duration: length, speechStart: lead ? lead[1] : 0, speechEnd: tail ? Math.min(length, tail[0]) : length };
}

function scratchVoice(beats, { voice, speed = 1, cache, log }) {
    const dir = path.join(cache, voice);
    fs.mkdirSync(dir, { recursive: true });
    const files = beats.map(b => path.join(dir, crypto.createHash("sha1").update(`${voice}|${speed}|${b.narration}`).digest("hex").slice(0, 16) + ".wav"));
    const jobs = beats.map((b, i) => ({ text: b.narration, out: files[i] })).filter(job => !fs.existsSync(job.out));
    if (jobs.length) {
        log(`kokoro ${voice}: synthesizing ${jobs.length} of ${beats.length} beats`);
        const spec = path.join(dir, "jobs.json");
        fs.writeFileSync(spec, JSON.stringify({ voice, speed, jobs }));
        run(PYTHON, ["-I", TTS, spec], { env: { ...process.env, HF_HUB_OFFLINE: "1" }, stdio: ["ignore", "inherit", "pipe"] });
    }
    return files.map(describeClip);
}

/*
 * Cut a recorded take on its long pauses. Leading and trailing silence is
 * ignored; the gaps between beats must be the only pauses at least `min` seconds
 * long, so a stray long pause inside a beat (or a missing one) fails the build.
 */
function recordedVoice(take, beats, { workDir, db = -38, min = 0.8, log }) {
    if (!fs.existsSync(take)) throw new Error(`voice file not found: ${take}`);
    const length = duration(take);
    const interior = silences(take, db, min).filter(([a, b]) => a > 0.05 && b < length - 0.05);
    if (interior.length !== beats.length - 1) {
        const where = interior.map(([a, b]) => `${a.toFixed(1)}–${b.toFixed(1)}s`).join(", ") || "none";
        throw new Error(`${path.basename(take)}: found ${interior.length + 1} chunks separated by pauses of ${min}s or more at ${db} dB, ` +
            `but the script has ${beats.length} beats. Pauses: ${where}. ` +
            `Adjust --silence-min / --silence-db, or re-record with a clear second of silence between beats only.`);
    }
    fs.mkdirSync(workDir, { recursive: true });
    const cuts = [0, ...interior.flatMap(([a, b]) => [a, b]), length];
    return beats.map((beat, i) => {
        const from = Math.max(0, cuts[2 * i] - (i ? 0.15 : 0)), to = Math.min(length, cuts[2 * i + 1] + 0.15);
        const out = path.join(workDir, `beat-${String(beat.n).padStart(2, "0")}.wav`);
        run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", take, "-ss", from.toFixed(3), "-to", to.toFixed(3), "-ac", "1", "-ar", "48000", out]);
        const clip = describeClip(out);
        log(`beat ${beat.n}: ${(clip.speechEnd - clip.speechStart).toFixed(1)}s of speech`);
        return clip;
    });
}

/* Decode a clip to mono float samples at `rate`. */
function samples(file, rate) {
    const raw = run("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(rate), "-f", "f32le", "-"], { encoding: "buffer" }).stdout;
    return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

module.exports = { scratchVoice, recordedVoice, samples, duration, run };
