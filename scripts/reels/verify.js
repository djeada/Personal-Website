"use strict";

/*
 * Output gate.
 *
 * The frames, the timeline and the two MP4s are produced by three different tools, so
 * a mistake in any one of them shows up as a file that plays but is subtly wrong -
 * off-length, silent, clipped, or the wrong shape for the platform. Everything below
 * is checked against the timeline the recorder actually wrote, not against constants.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const EXPECTED = { width: 1080, height: 1920, fps: 30, codec: "h264", pixelFormat: "yuv420p" };
const DURATION_TOLERANCE = 0.2; // seconds
const MIN_PEAK_HEADROOM_DB = 0.1;

function ffprobe(file, args) {
    const result = spawnSync("ffprobe", ["-v", "error", ...args, "-of", "json", file], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`ffprobe failed on ${file}: ${result.stderr}`);
    return JSON.parse(result.stdout);
}

function peakDb(file) {
    const result = spawnSync(
        "ffmpeg",
        ["-hide_banner", "-i", file, "-af", "volumedetect", "-f", "null", "-"],
        { encoding: "utf8" }
    );
    const match = (result.stderr || "").match(/max_volume:\s*(-?[\d.]+) dB/);
    return match ? Number(match[1]) : null;
}

function verifyScene(timeline, paths, workDir) {
    const problems = [];
    const frameDir = path.join(workDir, timeline.id);

    if (!timeline.beats.length) problems.push("timeline has no beats");
    for (const beat of timeline.beats) {
        const frame = path.join(frameDir, beat.file);
        if (!fs.existsSync(frame)) problems.push(`missing frame ${beat.file}`);
        else if (fs.statSync(frame).size < 1024) problems.push(`frame ${beat.file} is suspiciously small`);
        if (!(beat.duration > 0)) problems.push(`beat ${beat.file} has a non-positive duration`);
    }

    const info = ffprobe(paths.finalPath, [
        "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,pix_fmt,avg_frame_rate"
    ]);
    const video = info.streams.find((stream) => stream.codec_type === "video");
    const audio = info.streams.find((stream) => stream.codec_type === "audio");

    if (!video) problems.push("no video stream");
    else {
        if (video.width !== EXPECTED.width || video.height !== EXPECTED.height) {
            problems.push(`expected ${EXPECTED.width}x${EXPECTED.height}, got ${video.width}x${video.height}`);
        }
        if (video.codec_name !== EXPECTED.codec) problems.push(`expected ${EXPECTED.codec}, got ${video.codec_name}`);
        if (video.pix_fmt !== EXPECTED.pixelFormat) problems.push(`expected ${EXPECTED.pixelFormat}, got ${video.pix_fmt}`);
        const [num, den] = String(video.avg_frame_rate).split("/").map(Number);
        const fps = den ? num / den : num;
        if (Math.abs(fps - EXPECTED.fps) > 0.5) problems.push(`expected ${EXPECTED.fps}fps, got ${fps.toFixed(2)}`);
    }

    if (!audio) problems.push("muxed file has no audio stream");

    const duration = Number(info.format.duration);
    if (Math.abs(duration - timeline.duration) > DURATION_TOLERANCE) {
        problems.push(`video is ${duration.toFixed(2)}s but the timeline says ${timeline.duration.toFixed(2)}s`);
    }

    const peak = peakDb(paths.sfxPath);
    if (peak === null) problems.push("could not measure the SFX peak");
    else if (peak > -MIN_PEAK_HEADROOM_DB) problems.push(`SFX peaks at ${peak} dBFS - clipping`);
    else if (peak < -30) problems.push(`SFX peaks at ${peak} dBFS - effectively silent`);

    const silent = ffprobe(paths.silentPath, ["-show_entries", "stream=codec_type"]);
    if (silent.streams.some((stream) => stream.codec_type === "audio")) {
        problems.push("the silent cut has an audio stream");
    }

    return { problems, duration, peak };
}

module.exports = { verifyScene };
