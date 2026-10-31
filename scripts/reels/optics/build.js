"use strict";

/*
 * Optics explainer reels: three calm, captioned vertical videos per tool, each
 * filmed on the real page.
 *
 *   node scripts/reels/optics/build.js --list                   ids, tools and caption schedules
 *   node scripts/reels/optics/build.js                          every reel -> scripts/reels/out/
 *   node scripts/reels/optics/build.js fresnel-tir em-light     selected reels
 *   node scripts/reels/optics/build.js --jobs 3                 render three reels at a time
 *   node scripts/reels/optics/build.js go-image --stills 2,9,20 framing check stills only
 *   node scripts/reels/optics/build.js --audio-only             rebuild the soundtracks only
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn, spawnSync } = require("child_process");
const { record } = require("./record");
const { writeSoundtrack } = require("./music");
const { describe } = require("./reels/common");

const REELS = path.resolve(__dirname, "..");
const ROOT = path.resolve(REELS, "../..");
const OUT = path.join(REELS, "out");
const ORDER = ["go-image", "go-telescope", "go-aberrations", "em-light", "em-polarization", "em-mirror", "fresnel-angle", "fresnel-tir", "fresnel-metal",
    "pol-three", "pol-waveplate", "pol-sphere", "int-cancel", "int-coherence", "int-beats", "sw-swr", "sw-cavity"];
const load = id => require(`./reels/${id}`).build();

function ffmpeg(args) {
    const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`ffmpeg failed:\n${result.stderr}`);
}

const serverUp = () => new Promise(resolve => {
    http.get("http://127.0.0.1:8000/", res => { res.resume(); resolve(true); }).on("error", () => resolve(false));
});

async function render(timeline, { stills, audioOnly }) {
    const id = timeline.id;
    const frames = path.join(REELS, "frames", id);
    const log = message => console.log(`[${id}] ${message}`);
    if (stills) {
        await record(timeline, path.join(frames, "stills"), { only: stills, log });
        log(`stills in ${path.join(frames, "stills")}`);
        return;
    }
    fs.mkdirSync(frames, { recursive: true });
    const wav = path.join(frames, "soundtrack.wav");
    writeSoundtrack(timeline, wav);
    if (audioOnly) { log(`soundtrack ${wav}`); return; }
    fs.readdirSync(frames).filter(name => /^\d{5}\.png$/.test(name)).forEach(name => fs.unlinkSync(path.join(frames, name)));
    await record(timeline, frames, { log });
    const silent = path.join(OUT, `${id}.silent.mp4`);
    const final = path.join(OUT, `${id}.mp4`);
    ffmpeg(["-framerate", String(timeline.FPS), "-i", path.join(frames, "%05d.png"),
        "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-profile:v", "high", "-level", "4.1",
        "-movflags", "+faststart", "-an", silent]);
    ffmpeg(["-i", silent, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final]);
    ffmpeg(["-ss", String(timeline.cover ?? 3), "-i", silent, "-frames:v", "1", "-q:v", "2", path.join(OUT, `${id}.cover.jpg`)]);
    log(`done: ${final}`);
}

async function main() {
    const args = process.argv.slice(2);
    const flag = name => args.includes(name);
    const value = name => (flag(name) ? args[args.indexOf(name) + 1] : null);
    const skip = new Set([value("--stills"), value("--jobs")].filter(Boolean));
    const ids = args.filter(a => !a.startsWith("--") && !skip.has(a));
    for (const id of ids) if (!ORDER.includes(id)) throw new Error(`unknown reel "${id}"; try --list`);
    const timelines = (ids.length ? ids : ORDER).map(load);
    if (flag("--list")) { timelines.forEach(t => console.log(describe(t) + "\n")); return; }
    fs.mkdirSync(OUT, { recursive: true });
    const options = { stills: value("--stills") && value("--stills").split(",").map(Number), audioOnly: flag("--audio-only") };
    let server = null;
    if (!options.audioOnly && !(await serverUp())) {
        server = spawn("python3", ["-m", "http.server", "8000", "--directory", path.join(ROOT, "src")], { stdio: "ignore" });
        for (let i = 0; i < 50 && !(await serverUp()); i++) await new Promise(r => setTimeout(r, 100));
    }
    try {
        const queue = [...timelines], failed = [];
        const worker = async () => {
            while (queue.length) {
                const timeline = queue.shift();
                try { await render(timeline, options); } catch (error) { failed.push(timeline.id); console.error(`[${timeline.id}] failed: ${error.message}`); }
            }
        };
        await Promise.all(Array.from({ length: Math.max(1, Number(value("--jobs")) || 1) }, worker));
        if (failed.length) throw new Error(`${failed.length} reel(s) failed: ${failed.join(", ")}`);
    } finally {
        if (server) server.kill();
    }
}

main().catch(error => { console.error(error); process.exit(1); });
