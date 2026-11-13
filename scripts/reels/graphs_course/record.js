"use strict";

/*
 * Films a section on the real tool pages at 1280×720 CSS px × 1.5 = 1920×1080
 * (a vertical reel at 540×960 × 2 = 1080×1920), adapted from optics/record.js. Every page named by the section is opened up
 * front with a paused fake clock; the active page (the one the current shot is
 * on) advances 1/30 s per frame, the others stay frozen until they are on camera.
 *
 * A screenshot is only taken when the frame signature changes (the overlay hashes
 * the page DOM and counts canvas draws); unchanged frames extend the previous
 * still's hold, and the concat list says how long each still is held.
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const EPOCH = new Date("2026-11-01T12:00:00Z").getTime();
const DIP = 0.45; // must match overlay.js

// Counts canvas drawing calls, so a canvas that redraws changes the frame signature.
function countDraws() {
    window.__reelDraws = 0;
    const proto = CanvasRenderingContext2D.prototype;
    for (const name of ["clearRect", "fillRect", "strokeRect", "fill", "stroke", "fillText", "drawImage", "putImageData"]) {
        const original = proto[name];
        proto[name] = function (...args) { window.__reelDraws++; return original.apply(this, args); };
    }
}

async function openPage(context, origin, timeline, name, spec, log) {
    const page = await context.newPage();
    const allowed = new Set(["127.0.0.1", "fonts.googleapis.com", "fonts.gstatic.com"]);
    await page.route("**/*", route => (allowed.has(new URL(route.request().url()).hostname) ? route.continue() : route.abort()));
    page.errors = [];
    page.on("pageerror", error => { page.errors.push(error.message); log(`${name}: page error: ${error.message}`); });
    await page.addInitScript(countDraws);
    await page.clock.install({ time: EPOCH });
    await page.goto(origin + spec.path, { waitUntil: "load" });
    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(Math.max(EPOCH + 2000, now + 50));
    await page.addStyleTag({ path: path.join(__dirname, "overlay.css") });
    if (timeline.vertical) await page.addStyleTag({ path: path.join(__dirname, "reel.css") });
    if (spec.css) await page.addStyleTag({ content: spec.css });
    await page.addScriptTag({ path: path.join(__dirname, "overlay.js") });
    await page.evaluate(([data, n]) => window.__reel.init(data, n), [timeline, name]);
    await page.evaluate(() => Promise.all(["400 20px 'IBM Plex Sans'", "500 20px 'IBM Plex Sans'", "600 40px 'IBM Plex Sans'", "400 20px 'IBM Plex Mono'", "500 20px 'IBM Plex Mono'"]
        .map(font => document.fonts.load(font, "Aa01·"))).then(() => document.fonts.ready));
    // Off the record: the starting state.
    for (const action of spec.setup || []) {
        await page.evaluate(a => window.__reel.act(a), { ...action, fn: action.fn && action.fn.toString() });
        await page.clock.runFor(60);
    }
    await page.clock.runFor(400);
    page.measured = {};
    page.readings = {};
    for (const m of spec.measure || []) page.measured[m.name] = await measure(page, m, log);
    page.game = 0;
    page.clockTime = 0;
    return page;
}

/*
 * How long a run takes in page time: start it, advance the clock until `until`
 * (a page expression) is true, then put the page back with `reset`. A rate window
 * then stretches the run to exactly fill its slot in the video.
 */
async function measure(page, m, log) {
    await page.evaluate(a => window.__reel.act(a), { act: "click", target: m.start });
    let elapsed = 0;
    while (!(await page.evaluate(m.until)) && elapsed < (m.max || 120000)) { await page.clock.runFor(20); elapsed += 20; }
    if (!(await page.evaluate(m.until))) throw new Error(`measure ${m.name}: "${m.until}" never became true`);
    if (m.check && !(await page.evaluate(m.check))) throw new Error(`measure ${m.name}: check "${m.check}" failed after the run`);
    if (m.read) page.readings[m.name] = await page.evaluate(m.read);
    await page.evaluate(a => window.__reel.act(a), { act: "click", target: m.reset });
    await page.clock.runFor(300);
    log(`measured ${m.name}: ${elapsed} ms of page time${m.read ? `, read ${JSON.stringify(page.readings[m.name])}` : ""}`);
    return elapsed;
}

/* The page on camera at t: the current shot's, or during a dip to a new page, the old one until it is dark. */
function pageAt(timeline, t) {
    const shots = timeline.shots;
    let i = 0;
    while (i + 1 < shots.length && shots[i + 1].t <= t) i++;
    return i > 0 && shots[i - 1].page !== shots[i].page && t - shots[i].t < DIP ? shots[i - 1].page : shots[i].page;
}

async function record(timeline, frameDir, { origin, only = null, log = () => {} }) {
    fs.mkdirSync(frameDir, { recursive: true });
    const browser = await chromium.launch();
    const holds = [];
    try {
        const context = await browser.newContext({ viewport: { width: timeline.W, height: timeline.H }, deviceScaleFactor: timeline.SCALE || 1.5, colorScheme: "dark", reducedMotion: "no-preference" });
        await context.addCookies([{ name: "darkMode", value: "true", url: origin }]);
        const pages = {};
        for (const [name, spec] of Object.entries(timeline.pages)) pages[name] = await openPage(context, origin, timeline, name, spec, log);
        // Values read during setup (`measure.read`), available to every page's chips.
        const readings = Object.assign({}, ...Object.values(pages).map(p => p.readings));
        for (const page of Object.values(pages)) await page.evaluate(values => window.__reel.setMeasured(values), readings);

        const total = Math.round(timeline.DURATION * timeline.FPS);
        const targets = only ? new Set(only.map(t => Math.round(t * timeline.FPS))) : null;
        const last = only ? Math.min(total - 1, Math.max(...targets)) : total - 1;
        let fired = 0, lastSig = null, shots = 0;
        for (let f = 0; f <= last; f++) {
            const t = f / timeline.FPS;
            while (fired < timeline.actions.length && timeline.actions[fired].t <= t + 1e-6) {
                const action = timeline.actions[fired++];
                await pages[action.page].evaluate(a => window.__reel.act(a), action);
            }
            const name = pageAt(timeline, t), page = pages[name];
            const window_ = timeline.rates.find(r => r.page === name && t >= r.from && t < r.to);
            const rate = !window_ ? 1 : window_.rate ?? page.measured[window_.measure] / ((window_.to - window_.from) * 1000);
            page.game += (1000 / timeline.FPS) * rate;
            const step = Math.round(page.game) - page.clockTime;
            if (step > 0) { await page.clock.runFor(step); page.clockTime += step; }
            const sig = name + (await page.evaluate(time => window.__reel.frame(time), t));
            if (only) {
                if (targets.has(f)) await page.screenshot({ path: path.join(frameDir, `still-${t.toFixed(2)}.png`) });
                continue;
            }
            if (sig !== lastSig) {
                const file = `${String(shots++).padStart(5, "0")}.png`;
                await page.screenshot({ path: path.join(frameDir, file) });
                holds.push({ file, frames: 1 });
                lastSig = sig;
            } else holds[holds.length - 1].frames++;
            if (f % 300 === 0) log(`frame ${f}/${total}, ${shots} stills`);
        }
        const errors = Object.values(pages).flatMap(p => p.errors);
        if (errors.length) throw new Error(`${errors.length} page error(s), first: ${errors[0]}`);
    } finally {
        await browser.close();
    }
    if (only) return null;
    // Concat demuxer list: each still held for its frame count; the last entry repeats (ffmpeg drops its duration).
    const list = holds.map(h => `file '${h.file}'\nduration ${(h.frames / timeline.FPS).toFixed(6)}`).join("\n") + `\nfile '${holds[holds.length - 1].file}'\n`;
    fs.writeFileSync(path.join(frameDir, "frames.txt"), list);
    log(`${holds.length} stills for ${holds.reduce((n, h) => n + h.frames, 0)} frames`);
    return path.join(frameDir, "frames.txt");
}

module.exports = { record };
