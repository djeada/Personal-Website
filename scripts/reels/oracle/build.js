"use strict";

/*
 * Outclick the Oracle promo: a ~26s vertical edit cut to a synthesized phonk beat.
 *
 *   node scripts/reels/oracle/build.js                 full render -> scripts/reels/out/
 *   node scripts/reels/oracle/build.js --stills 4,8.2  framing check stills only
 *   node scripts/reels/oracle/build.js --audio-only    rebuild the soundtrack
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { build } = require("./timeline");
const { record } = require("./record");
const { writeSoundtrack } = require("./music");

const REELS = path.resolve(__dirname, "..");
const FRAMES = path.join(REELS, "frames", "oracle-promo");
const OUT = path.join(REELS, "out");

function ffmpeg(args) {
    const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`ffmpeg failed:\n${result.stderr}`);
}

async function main() {
    const args = process.argv.slice(2);
    const timeline = build();
    const log = message => console.log(`[oracle-promo] ${message}`);
    const stills = args.includes("--stills") ? args[args.indexOf("--stills") + 1].split(",").map(Number) : null;
    fs.mkdirSync(OUT, { recursive: true });
    const wav = path.join(FRAMES, "soundtrack.wav");
    if (stills) {
        await record(timeline, path.join(FRAMES, "stills"), { only: stills, log });
        log(`stills in ${path.join(FRAMES, "stills")}`);
        return;
    }
    fs.mkdirSync(FRAMES, { recursive: true });
    writeSoundtrack(timeline, wav);
    log(`soundtrack ${wav}`);
    if (args.includes("--audio-only")) return;
    fs.readdirSync(FRAMES).filter(name => /^\d{5}\.png$/.test(name)).forEach(name => fs.unlinkSync(path.join(FRAMES, name)));
    await record(timeline, FRAMES, { log });
    const silent = path.join(OUT, "oracle-promo.silent.mp4");
    const final = path.join(OUT, "oracle-promo.mp4");
    ffmpeg(["-framerate", String(timeline.FPS), "-i", path.join(FRAMES, "%05d.png"),
        "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-profile:v", "high", "-level", "4.1",
        "-movflags", "+faststart", "-an", silent]);
    ffmpeg(["-i", silent, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
        "-af", "loudnorm=I=-12:TP=-1:LRA=9", "-ar", "48000", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", final]);
    ffmpeg(["-ss", "1.8", "-i", silent, "-frames:v", "1", "-q:v", "2", path.join(OUT, "oracle-promo.cover.jpg")]);
    log(`done: ${final}`);
}

main().catch(error => { console.error(error); process.exit(1); });
