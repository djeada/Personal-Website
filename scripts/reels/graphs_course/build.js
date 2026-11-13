"use strict";

/*
 * Graphs for LeetCode: renders one section of the long-form course video.
 *
 *   node scripts/reels/graphs_course/build.js 01                    full render -> scripts/reels/out/graphs-course/
 *   node scripts/reels/graphs_course/build.js 01 --list             beat timings, no render
 *   node scripts/reels/graphs_course/build.js 01 --stills 5,40,90   framing check stills only
 *   node scripts/reels/graphs_course/build.js 01 --voice take.wav   use a recorded voice instead of Kokoro
 *   node scripts/reels/graphs_course/build.js 01 --audio-only       remix the soundtrack onto the last frames
 *
 * Other flags: --no-next (no "Next: Part N" end card), --gap 1.25 (seconds between
 * beats; by default tightened automatically if the section would pass 5:00),
 * --no-music, --no-captions, --tts-voice am_michael, --tts-speed 1.0,
 * --silence-min 0.8 and --silence-db -38 (recorded voice splitting), --port 8123.
 *
 * Reels: reel.js. The full video: join.js.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const { parseScript } = require("./script");
const { scratchVoice, recordedVoice, samples, run } = require("./voice");
const { buildTimeline, describe, srt } = require("./timeline");
const { writeBed } = require("./music");
const { record } = require("./record");
const { wav } = require("../synth");

const REELS = path.resolve(__dirname, "..");
const ROOT = path.resolve(REELS, "../..");
const OUT = path.join(REELS, "out", "graphs-course");
const WORK = path.join(REELS, "frames", "graphs-course");
const SR = 48000;

const ffmpeg = args => run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);

/* This worktree's src/ on a free local port, so another checkout on :8000 is never filmed. */
function serve(port) {
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon" };
    const base = path.join(ROOT, "src");
    const server = http.createServer((req, res) => {
        let file = path.join(base, decodeURIComponent(new URL(req.url, "http://x").pathname));
        if (!file.startsWith(base)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
        fs.readFile(file, (error, data) => {
            if (error) { res.writeHead(404); res.end(); return; }
            res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
            res.end(data);
        });
    });
    return new Promise((resolve, reject) => {
        const attempt = p => {
            server.once("error", error => (error.code === "EADDRINUSE" && p < port + 20 ? attempt(p + 1) : reject(error)));
            server.listen(p, "127.0.0.1", () => resolve({ server, origin: `http://127.0.0.1:${p}` }));
        };
        attempt(port);
    });
}

function voiceTrack(timeline, clips, file) {
    const track = new Float32Array(Math.round(timeline.DURATION * SR));
    timeline.beats.forEach((beat, i) => {
        const data = samples(clips[i].file, SR), offset = Math.round(beat.clipOffset * SR);
        for (let k = 0; k < data.length && offset + k < track.length; k++) if (offset + k >= 0) track[offset + k] += data[k];
    });
    fs.writeFileSync(file, wav([track, track]));
}

const loudness = file => {
    const log = run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr;
    const summary = log.slice(log.lastIndexOf("Summary:"));
    const pick = re => Number((summary.match(re) || [])[1]);
    return { I: pick(/I:\s+(-?[\d.]+) LUFS/), LRA: pick(/LRA:\s+(-?[\d.]+) LU/), peak: pick(/Peak:\s+(-?[\d.]+) dBFS/) };
};

/*
 * Voice levelled to -18 LUFS, music ~17 dB under it (~20 dB once ducked) and ducked by a sidechain on
 * the speech, then the whole mix two-pass loudness-normalized to -16 LUFS.
 */
function mixdown(voice, bed, out) {
    const inputs = [...(voice ? ["-i", voice] : []), ...(bed ? ["-i", bed] : [])];
    const voiceChain = "[0:a]pan=mono|c0=c0,loudnorm=I=-18:TP=-3:LRA=9,aresample=48000,pan=stereo|c0=c0|c1=c0";
    let graph = `${voiceChain}[v]`;
    if (!voice) graph = "[0:a]anull[v]";   // a reel: the music bed alone
    else if (bed) {
        const gain = -35 - loudness(bed).I;
        graph = `${voiceChain},asplit=2[v][key];[1:a]volume=${gain.toFixed(2)}dB[m];` +
            `[m][key]sidechaincompress=threshold=0.02:ratio=4:attack=60:release=700[md];[v][md]amix=inputs=2:normalize=0:duration=first[v2];[v2]anull[v]`;
    }
    const measure = run("ffmpeg", ["-hide_banner", "-nostats", ...inputs, "-filter_complex", `${graph};[v]loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[o]`, "-map", "[o]", "-f", "null", "-"]).stderr;
    const m = JSON.parse(measure.slice(measure.lastIndexOf("{")));
    const norm = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
    ffmpeg([...inputs, "-filter_complex", `${graph};[v]${norm},aresample=48000[o]`, "-map", "[o]", "-c:a", "pcm_s16le", out]);
}

async function main() {
    const args = process.argv.slice(2);
    const flag = name => args.includes(name);
    const value = (name, fallback = null) => (flag(name) ? args[args.indexOf(name) + 1] : fallback);
    const id = args.find((a, i) => /^\d+$/.test(a) && !(i && args[i - 1].startsWith("--")));
    if (!id) throw new Error("usage: build.js <section number> [--stills 5,40] [--voice take.wav] [--no-music] [--no-captions] [--list]");
    const key = id.padStart(2, "0");
    const module_ = require(`./sections/${key}.js`);
    const beats = parseScript(path.join(__dirname, "scripts", module_.script));
    const section = { id: key, ...module_.build(beats) };
    const work = path.join(WORK, `section-${key}`);
    const log = message => console.log(`[section ${key}] ${message}`);

    const clips = flag("--voice")
        ? recordedVoice(path.resolve(value("--voice")), beats, { workDir: path.join(work, "voice"), min: Number(value("--silence-min", 0.8)), db: Number(value("--silence-db", -38)), log })
        : scratchVoice(beats, { voice: value("--tts-voice", "bm_george"), speed: Number(value("--tts-speed", 1)), cache: path.join(WORK, "voice-cache"), log });
    const timeline = buildTimeline(section, beats, clips, {
        captions: !flag("--no-captions"), next: !flag("--no-next"),
        gap: flag("--gap") ? Number(value("--gap")) : undefined
    });
    console.log(describe(timeline, beats));
    if (flag("--list")) return;

    fs.mkdirSync(OUT, { recursive: true });
    fs.mkdirSync(work, { recursive: true });
    const name = `section-${key}`;
    const { server, origin } = await serve(Number(value("--port", 8123)));
    log(`serving ${path.join(ROOT, "src")} at ${origin}`);
    try {
        if (flag("--stills")) {
            const dir = path.join(work, "stills");
            fs.rmSync(dir, { recursive: true, force: true });
            await record(timeline, dir, { origin, only: value("--stills").split(",").map(Number), log });
            log(`stills in ${dir}`);
            return;
        }
        const frames = path.join(work, "video");
        if (!flag("--audio-only")) {
            fs.rmSync(frames, { recursive: true, force: true });
            await record(timeline, frames, { origin, log });
        }
        const voice = path.join(work, "voice.wav"), bed = flag("--no-music") ? null : path.join(work, "bed.wav"), mix = path.join(work, "mix.wav");
        voiceTrack(timeline, clips, voice);
        if (bed) writeBed(timeline, bed);
        mixdown(voice, bed, mix);
        const mp4 = path.join(OUT, `${name}.mp4`);
        ffmpeg(["-f", "concat", "-safe", "0", "-i", path.join(frames, "frames.txt"), "-i", mix, "-map", "0:v", "-map", "1:a",
            "-vf", `fps=${timeline.FPS},format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-level", "4.1",
            "-c:a", "aac", "-b:a", "192k", "-t", timeline.DURATION.toFixed(3), "-movflags", "+faststart", mp4]);
        fs.writeFileSync(path.join(OUT, `${name}.srt`), srt(timeline.captions));
        // For join.js: where the narration ends and whether an end card follows it.
        fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify({
            part: timeline.part, title: timeline.title, duration: timeline.DURATION, next: timeline.next,
            lastBeatEnd: timeline.beats[timeline.beats.length - 1].end, outro: timeline.OUTRO, voice: flag("--voice") ? path.basename(value("--voice")) : "scratch"
        }, null, 2) + "\n");
        ffmpeg(["-ss", String(timeline.cover), "-i", mp4, "-frames:v", "1", "-q:v", "2", path.join(OUT, `${name}.cover.jpg`)]);
        const l = loudness(mp4);
        log(`done: ${mp4} (${timeline.DURATION.toFixed(1)} s, ${l.I} LUFS, LRA ${l.LRA} LU, true peak ${l.peak} dBFS)`);
    } finally {
        server.close();
    }
}

if (require.main === module) main().catch(error => { console.error(error.message || error); process.exit(1); });

module.exports = { serve, mixdown, loudness, ffmpeg, REELS, ROOT, OUT, WORK };
