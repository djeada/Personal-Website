#!/usr/bin/env node
"use strict";

/*
 * Reel pipeline entry point.
 *
 *   node scripts/reels/build.js                 all scenes
 *   node scripts/reels/build.js bst-search      one scene
 *   node scripts/reels/build.js --list          show scene ids
 *   node scripts/reels/build.js --frames-only   record stills, skip ffmpeg
 *   node scripts/reels/build.js --theme light   record on the light theme
 *
 * Serves src/ on 127.0.0.1:8000 for the run unless something already answers there.
 */

const fs = require("fs");
const net = require("net");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { SCENES } = require("./scenes");
const { renderScene } = require("./render");
const { composeScene, probe } = require("./compose");
const { verifyScene } = require("./verify");

const ROOT = path.resolve(__dirname, "../..");
const PORT = 8000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const WORK_DIR = path.join(__dirname, "frames");
const OUT_DIR = path.join(__dirname, "out");

function parseArgs(argv) {
    const options = { theme: "dark", framesOnly: false, list: false, ids: [] };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--list") options.list = true;
        else if (arg === "--frames-only") options.framesOnly = true;
        else if (arg === "--theme") options.theme = argv[++i];
        else if (arg.startsWith("--")) throw new Error(`Unknown flag: ${arg}`);
        else options.ids.push(arg);
    }
    return options;
}

function portIsBusy(port) {
    return new Promise((resolve) => {
        const socket = net.connect({ port, host: "127.0.0.1" });
        socket.setTimeout(400);
        socket.on("connect", () => { socket.destroy(); resolve(true); });
        socket.on("error", () => resolve(false));
        socket.on("timeout", () => { socket.destroy(); resolve(false); });
    });
}

async function waitForPort(port, timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await portIsBusy(port)) return true;
        await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return false;
}

async function ensureServer() {
    if (await portIsBusy(PORT)) return null;
    const server = spawn("python3", ["-m", "http.server", String(PORT), "--directory", path.join(ROOT, "src")], {
        stdio: "ignore",
        detached: false
    });
    if (!(await waitForPort(PORT))) {
        server.kill();
        throw new Error(`Could not start a static server on ${PORT}.`);
    }
    return server;
}

function requireFfmpeg() {
    const result = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
    if (result.status !== 0) {
        throw new Error("ffmpeg is required. Install it (apt install ffmpeg) or pass --frames-only.");
    }
}

function formatBytes(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));

    if (options.list) {
        for (const scene of SCENES) console.log(`${scene.id.padEnd(20)} ${scene.hook.join(" ").replace(/<\/?em>/g, "")}`);
        return;
    }

    const selected = options.ids.length
        ? SCENES.filter((scene) => options.ids.includes(scene.id))
        : SCENES;
    if (!selected.length) {
        throw new Error(`No scene matched ${options.ids.join(", ")}. Try --list.`);
    }
    if (!options.framesOnly) requireFfmpeg();

    fs.mkdirSync(WORK_DIR, { recursive: true });
    const server = await ensureServer();
    const failed = [];

    try {
        for (const scene of selected) {
            const started = Date.now();
            process.stdout.write(`\n▶ ${scene.id}\n`);

            const timeline = await renderScene(scene, {
                baseUrl: BASE_URL,
                workDir: WORK_DIR,
                theme: options.theme
            });
            process.stdout.write(`  ${timeline.beats.length} beats · ${timeline.duration.toFixed(2)}s\n`);

            if (options.framesOnly) continue;

            const outputs = composeScene(timeline, { workDir: WORK_DIR, outDir: OUT_DIR });
            const { problems, duration, peak } = verifyScene(timeline, outputs, WORK_DIR);
            if (problems.length) {
                failed.push(scene.id);
                process.stdout.write(`  ✗ ${problems.join("\n  ✗ ")}\n`);
                continue;
            }
            const info = probe(outputs.finalPath);
            const video = info && info.streams.find((s) => s.width);
            process.stdout.write(
                `  ${path.relative(ROOT, outputs.finalPath)}  ${video ? `${video.width}x${video.height}` : "?"} · ` +
                `${duration.toFixed(2)}s · ${formatBytes(fs.statSync(outputs.finalPath).size)} · peak ${peak} dBFS\n`
            );
            process.stdout.write(`  ${path.relative(ROOT, outputs.silentPath)}  (drop trending audio on this one)\n`);
            process.stdout.write(`  done in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
        }
    } finally {
        if (server) server.kill();
    }

    if (failed.length) {
        throw new Error(`Verification failed for: ${failed.join(", ")}`);
    }
}

main().catch((error) => {
    process.stderr.write(`\n${error.stack || error.message}\n`);
    process.exit(1);
});
