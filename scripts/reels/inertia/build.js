"use strict";

/*
 * Moment of Inertia Lab reel: a calm ~62 s vertical explainer filmed on the real page.
 *
 *   node scripts/reels/inertia/build.js                     full render -> scripts/reels/out/
 *   node scripts/reels/inertia/build.js --stills 3,12,35    framing check stills only
 *   node scripts/reels/inertia/build.js --audio-only        rebuild the soundtrack
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { build } = require("./timeline");
const { record } = require("./record");
const { writeSoundtrack } = require("./music");

const REELS = path.resolve(__dirname, "..");
const FRAMES = path.join(REELS, "frames", "inertia-reel");
const OUT = path.join(REELS, "out");

function ffmpeg(args) {
    const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`ffmpeg failed:\n${result.stderr}`);
}

async function main() {
    const args = process.argv.slice(2);
    const timeline = build();
    const log = message => console.log(`[inertia-reel] ${message}`);
    fs.mkdirSync(OUT, { recursive: true });
    if (args.includes("--stills")) {
        const times = args[args.indexOf("--stills") + 1].split(",").map(Number);
        await record(timeline, path.join(FRAMES, "stills"), { only: times, log });
        log(`stills in ${path.join(FRAMES, "stills")}`);
        return;
    }
    fs.mkdirSync(FRAMES, { recursive: true });
    const wav = path.join(FRAMES, "soundtrack.wav");
    writeSoundtrack(timeline, wav);
    log(`soundtrack ${wav}`);
    if (args.includes("--audio-only")) return;
    fs.readdirSync(FRAMES).filter(name => /^\d{5}\.png$/.test(name)).forEach(name => fs.unlinkSync(path.join(FRAMES, name)));
    await record(timeline, FRAMES, { log });
    const silent = path.join(OUT, "inertia-reel.silent.mp4");
    const final = path.join(OUT, "inertia-reel.mp4");
    ffmpeg(["-framerate", String(timeline.FPS), "-i", path.join(FRAMES, "%05d.png"),
        "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-profile:v", "high", "-level", "4.1",
        "-movflags", "+faststart", "-an", silent]);
    ffmpeg(["-i", silent, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final]);
    ffmpeg(["-ss", "2", "-i", silent, "-frames:v", "1", "-q:v", "2", path.join(OUT, "inertia-reel.cover.jpg")]);
    log(`done: ${final}`);
}

main().catch(error => { console.error(error); process.exit(1); });
