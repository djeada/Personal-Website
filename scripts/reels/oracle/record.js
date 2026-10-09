"use strict";

/*
 * Films the real Outclick the Oracle page at 30fps, frame by frame.
 *
 * The page's clock is faked and paused, so requestAnimationFrame, timers and the
 * game's own canvas animation only move when a frame is taken. CSS animations are
 * paused and stepped by overlay.js. The result is a deterministic, judder-free
 * capture that does not depend on how fast this machine can take screenshots.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const { chromium } = require("@playwright/test");

const ROOT = path.resolve(__dirname, "../../..");
const VIEWPORT = { width: 540, height: 960 };
const EPOCH = new Date("2026-10-09T12:00:00Z").getTime();
const ALLOWED_HOSTS = ["127.0.0.1", "fonts.googleapis.com", "fonts.gstatic.com"];

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

/*
 * frameDir receives 00000.png ...; `only` (optional) is a list of times in seconds to
 * capture as named stills instead of a full run, for quick framing checks.
 */
async function record(timeline, frameDir, { only = null, log = () => {} } = {}) {
    fs.mkdirSync(frameDir, { recursive: true });
    const server = await ensureServer();
    const browser = await chromium.launch();
    try {
        const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, colorScheme: "dark", reducedMotion: "no-preference" });
        await context.addInitScript(() => { try { localStorage.setItem("neural-oracle-sound", "off"); } catch (_) { /* optional */ } });
        const page = await context.newPage();
        await page.route("**/*", route => (ALLOWED_HOSTS.includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort()));
        page.on("pageerror", error => log(`page error: ${error.message}`));
        await page.clock.install({ time: EPOCH });
        await page.goto(`http://127.0.0.1:8000/tools/neural_oracle/?challenge=${timeline.CHALLENGE}`, { waitUntil: "load" });
        await page.clock.pauseAt(EPOCH + 2000);
        await page.addStyleTag({ url: "https://fonts.googleapis.com/css2?family=Anton&display=block" }).catch(() => log("Anton unavailable, using fallback font"));
        await page.addStyleTag({ path: path.join(__dirname, "overlay.css") });
        await page.addScriptTag({ path: path.join(__dirname, "overlay.js") });
        await page.evaluate(() => document.fonts.load('76px "Anton"').catch(() => null));
        await page.evaluate(data => window.__promo.init(data), timeline);

        const total = Math.round(timeline.DURATION * timeline.FPS);
        const targets = only ? new Set(only.map(t => Math.round(t * timeline.FPS))) : null;
        const last = only ? Math.max(...targets) : total - 1;
        let fired = 0, gameTime = 0, clockTime = 0;
        const rate = t => (timeline.slow.find(([a, b]) => t >= a && t < b) || [0, 0, 1])[2];
        for (let f = 0; f <= last; f++) {
            const t = f / timeline.FPS;
            while (fired < timeline.moves.length && timeline.moves[fired].t <= t + 1e-6) {
                await page.keyboard.press(timeline.moves[fired].key);
                fired++;
            }
            const dt = (1000 / timeline.FPS) * rate(t);
            gameTime += dt;
            const step = Math.round(gameTime) - clockTime;
            if (step > 0) { await page.clock.runFor(step); clockTime += step; }
            await page.evaluate(([time, delta]) => window.__promo.frame(time, delta), [t, dt]);
            if (!targets || targets.has(f)) {
                const name = only ? `still-${t.toFixed(2)}.png` : `${String(f).padStart(5, "0")}.png`;
                await page.screenshot({ path: path.join(frameDir, name), animations: "allow" });
                if (!only && f % 60 === 0) log(`frame ${f}/${total}`);
            }
        }
    } finally {
        await browser.close();
        if (server) server.kill();
    }
}

module.exports = { record };
