"use strict";

/*
 * Composer.
 *
 * Turns the recorded frames plus their timeline into two deliverables per scene:
 *
 *   <id>.silent.mp4  - post this and layer trending platform audio on top
 *   <id>.mp4         - the same cut with the synthesized SFX bed baked in
 *
 * Both are 1080x1920 / 30fps / H.264 High / yuv420p with faststart, which is what
 * Instagram, TikTok and YouTube Shorts all accept without re-encoding surprises.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { buildSfx } = require("./audio");

const FPS = 30;

function run(args, what) {
    const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
    if (result.status !== 0) {
        throw new Error(`ffmpeg failed (${what}):\n${result.stderr || result.stdout}`);
    }
}

// The concat demuxer holds each still for an exact duration, so beat timing is
// frame-accurate without ever encoding a duplicate frame by hand.
function writeConcatList(timeline, frameDir, listPath) {
    const lines = [];
    for (const beat of timeline.beats) {
        lines.push(`file '${path.resolve(frameDir, beat.file).replace(/'/g, "'\\''")}'`);
        lines.push(`duration ${beat.duration.toFixed(3)}`);
    }
    // The demuxer ignores the final entry's duration unless the file is repeated.
    const last = timeline.beats[timeline.beats.length - 1];
    lines.push(`file '${path.resolve(frameDir, last.file).replace(/'/g, "'\\''")}'`);
    fs.writeFileSync(listPath, `${lines.join("\n")}\n`);
}

function composeScene(timeline, options) {
    const frameDir = path.join(options.workDir, timeline.id);
    const listPath = path.join(frameDir, "concat.txt");
    const sfxPath = path.join(frameDir, "sfx.wav");
    const silentPath = path.join(options.outDir, `${timeline.id}.silent.mp4`);
    const finalPath = path.join(options.outDir, `${timeline.id}.mp4`);

    fs.mkdirSync(options.outDir, { recursive: true });
    writeConcatList(timeline, frameDir, listPath);

    run([
        "-f", "concat", "-safe", "0", "-i", listPath,
        "-vf", `fps=${FPS},format=yuv420p`,
        "-c:v", "libx264", "-preset", "slow", "-crf", "18",
        "-profile:v", "high", "-level", "4.1",
        "-r", String(FPS), "-movflags", "+faststart",
        "-an", silentPath
    ], `video for ${timeline.id}`);

    buildSfx(timeline, sfxPath);

    run([
        "-i", silentPath, "-i", sfxPath,
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-shortest", "-movflags", "+faststart",
        finalPath
    ], `mux for ${timeline.id}`);

    return { silentPath, finalPath, sfxPath };
}

function probe(file) {
    const result = spawnSync("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration:stream=width,height,codec_name,avg_frame_rate",
        "-of", "json", file
    ], { encoding: "utf8" });
    if (result.status !== 0) return null;
    return JSON.parse(result.stdout);
}

module.exports = { composeScene, probe, FPS };
