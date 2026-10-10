"use strict";

/*
 * Films the real Moment of Inertia Lab at 30fps, frame by frame, in dark mode.
 *
 * The page clock is faked and paused, so the lab's own animation loops (the race,
 * the integral builder, the off-center orbit) only move when a frame is taken.
 * The capture is deterministic and does not depend on screenshot speed.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const { chromium } = require("@playwright/test");

const ROOT = path.resolve(__dirname, "../../..");
const VIEWPORT = { width: 540, height: 960 };
const EPOCH = new Date("2026-10-10T12:00:00Z").getTime();

function serverUp() {
    return new Promise(resolve => {
        http.get("http://127.0.0.1:8000/", res => { res.resume(); resolve(true); }).on("error", () => resolve(false));
    });
}

async function ensureServer() {
    if (await serverUp()) return null;
    const child = spawn("python3", ["-m", "http.server", "8000", "--directory", path.join(ROOT, "src")], { stdio: "ignore" });
    for (let i = 0; i < 50 && !(await serverUp()); i++) await new Promise(r => setTimeout(r, 100));
    return child;
}

/* `only` (optional): times in seconds to capture as named stills instead of a full run. */
async function record(timeline, frameDir, { only = null, log = () => {} } = {}) {
    fs.mkdirSync(frameDir, { recursive: true });
    const server = await ensureServer();
    const browser = await chromium.launch();
    try {
        const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, colorScheme: "dark", reducedMotion: "no-preference" });
        await context.addCookies([{ name: "darkMode", value: "true", url: "http://127.0.0.1:8000" }]);
        const page = await context.newPage();
        await page.route("**/*", route => (new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort()));
        page.on("pageerror", error => log(`page error: ${error.message}`));
        await page.clock.install({ time: EPOCH });
        await page.goto("http://127.0.0.1:8000/tools/moment_of_inertia/", { waitUntil: "load" });
        await page.clock.pauseAt(EPOCH + 2000);
        await page.addStyleTag({ path: path.join(__dirname, "overlay.css") });
        await page.addScriptTag({ path: path.join(__dirname, "overlay.js") });
        await page.evaluate(data => window.__reel.init(data), timeline);
        await page.evaluate(() => document.fonts.ready);
        // The builder starts itself the first time it is seen. Let that happen now,
        // off the record, and reset it so the timeline's Play is the only start.
        await page.evaluate(() => window.__reel.placement({ target: "#builder", zoom: 1, y: .5 }));
        await page.clock.runFor(300);
        await page.evaluate(() => document.getElementById("build-reset").click());
        await page.clock.runFor(100);

        const total = Math.round(timeline.DURATION * timeline.FPS);
        const targets = only ? new Set(only.map(t => Math.round(t * timeline.FPS))) : null;
        const last = only ? Math.max(...targets) : total - 1;
        let fired = 0, gameTime = 0, clockTime = 0;
        const rate = t => (timeline.slow.find(([a, b]) => t >= a && t < b) || [0, 0, 1])[2];
        for (let f = 0; f <= last; f++) {
            const t = f / timeline.FPS;
            while (fired < timeline.actions.length && timeline.actions[fired].t <= t + 1e-6) {
                await page.evaluate(action => window.__reel.act(action), timeline.actions[fired]);
                fired++;
            }
            gameTime += (1000 / timeline.FPS) * rate(t);
            const step = Math.round(gameTime) - clockTime;
            if (step > 0) { await page.clock.runFor(step); clockTime += step; }
            await page.evaluate(time => window.__reel.frame(time), t);
            if (!targets || targets.has(f)) {
                const name = only ? `still-${t.toFixed(2)}.png` : `${String(f).padStart(5, "0")}.png`;
                await page.screenshot({ path: path.join(frameDir, name) });
                if (!only && f % 150 === 0) log(`frame ${f}/${total}`);
            }
        }
    } finally {
        await browser.close();
        if (server) server.kill();
    }
}

module.exports = { record };
