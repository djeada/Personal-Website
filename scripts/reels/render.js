"use strict";

/*
 * Frame recorder.
 *
 * Drives one of the site's live visualizers and captures one PNG per *visual state*
 * rather than per wall-clock frame, plus a timeline saying how long each frame should
 * be held. The composer expands those stills into constant-framerate video. No frame
 * is ever captured mid-transition, and a 9s reel costs ~15 screenshots, not ~270.
 *
 * Two drive models, selected by the scene's tool adapter (see adapters.js):
 *
 *   clock  the visualizer animates on its own timers, so the mocked clock is paused
 *          and ticked forward until the rendered state changes.
 *   step   the visualizer blocks in a checkpoint waiting for its #step button, so the
 *          recorder clicks it and lets real time run.
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");
const { adapterFor } = require("./adapters");

const VIEWPORT = { width: 540, height: 960 };
const SCALE = 2; // 540x960 CSS -> 1080x1920 captured
const LAB_SPEED = "260"; // the lab's "Fast" preset; fewer clock ticks to simulate
const TICK_MS = 40;
const MAX_SIM_MS = 12_000;
const CLOCK_EPOCH = new Date("2026-01-01T12:00:00Z");

// Per-step settle for the canvas tools: their checkpoints poll every 24ms for a
// credit and then sleep 230 - speed*22 ms, which is 10ms at the speed the adapter
// sets. 90ms clears both with room to spare.
const STEP_SETTLE_MS = 90;
const MAX_STEP_BEATS = 90;

// Beat durations in seconds. Short and even is what reads as "fast paced"; the
// payoff beats get room so the viewer can actually land on the answer.
const HOLD = {
    hook: 1.5,
    title: 0.62,
    step: 0.3,
    // Canvas algorithms emit far more states than a lab operation does, and that churn
    // is the appeal, so their frames go by quicker.
    frame: 0.14,
    result: 1.15,
    outro: 1.5
};

const BLOCKED_HOSTS = [
    "pagead2.googlesyndication.com",
    "googlesyndication.com",
    "cse.google.com",
    "googletagmanager.com",
    "google-analytics.com",
    "raw.githubusercontent.com"
];

function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Scene copy allows <em> and <b> for emphasis; everything else is escaped.
function richText(value) {
    return escapeHtml(value)
        .replace(/&lt;em&gt;/g, "<em>")
        .replace(/&lt;\/em&gt;/g, "</em>")
        .replace(/&lt;b&gt;/g, "<b>")
        .replace(/&lt;\/b&gt;/g, "</b>");
}

/*
 * The lab's comparison bubble is written for a desktop tooltip. Re-voice it for a
 * caption strip, and drop the beats that carry no new information - the bookend
 * "starting"/"complete" states just cost the viewer half a second each.
 */
function reelCaption(bubble) {
    if (/starting|traversal complete|match confirmed|write committed/i.test(bubble)) return null;
    const inspecting = bubble.match(/^Inspecting\s+(.+)$/i);
    if (inspecting) return `Checking <b>${inspecting[1]}</b>`;
    if (/direct operation/i.test(bubble)) return "Nothing to scan — <b>straight to the slot</b>";
    return bubble;
}

/* -------------------------------------------------------------- page scripts ---- */

function buildShell(stageSelector) {
    const root = document.createElement("div");
    root.id = "reel-root";
    // Plain divs on purpose: <header>, <footer> and <h1> would pick up the site's own
    // element-level typography and colours, which are tuned for an article page.
    root.innerHTML = `
        <div class="reel-head">
            <div class="reel-kicker"></div>
            <div class="reel-hook"></div>
        </div>
        <div class="reel-stage-slot"></div>
        <div class="reel-foot">
            <div class="reel-caption"></div>
            <div class="reel-chips">
                <span class="reel-chip" id="reel-steps"></span>
                <span class="reel-chip" id="reel-growth"></span>
            </div>
        </div>`;
    document.body.appendChild(root);
    const stage = document.querySelector(stageSelector);
    if (!stage) throw new Error(`Reel stage "${stageSelector}" not found on the page`);
    root.querySelector(".reel-stage-slot").appendChild(stage);
}

// Fit the drawing to the stage band, scaling up as well as down: the lab caps its own
// node pitch for desktop use, which leaves a 9:16 frame half empty otherwise, while
// the canvas tools render oversized on purpose so they can be downsampled. Static
// transforms rasterize at their composited scale, so both directions stay sharp.
//
// "inner" mode wraps the drawing first, because the lab centres its children: a row
// wider than the stage overflows left as well as right, and scrollWidth only ever
// reports the right-hand overflow. Measuring the wrapper's own box is the only
// reading that sees the whole thing.
function fitStage(options) {
    const slot = document.querySelector(".reel-stage-slot");
    const room = { width: slot.clientWidth - 36, height: slot.clientHeight - 40 };

    let target;
    let sizeHolder = null;
    if (options.mode === "inner") {
        const inner = document.querySelector(options.innerSelector);
        if (!inner || !inner.firstChild) return;
        target = inner.querySelector(":scope > .reel-fit");
        if (!target) {
            target = document.createElement("div");
            target.className = "reel-fit";
            while (inner.firstChild) target.appendChild(inner.firstChild);
            inner.appendChild(target);
        }
        sizeHolder = inner;
    } else {
        target = slot.firstElementChild;
        if (!target) return;
    }

    target.style.transform = "";
    if (sizeHolder) sizeHolder.style.height = "";
    const natural = { width: target.offsetWidth, height: target.offsetHeight };
    if (!natural.width || !natural.height) return;

    const scale = Math.min(options.maxUpscale, room.width / natural.width, room.height / natural.height);
    target.style.transformOrigin = "center center";
    target.style.transform = `scale(${scale.toFixed(4)})`;
    if (sizeHolder) sizeHolder.style.height = `${Math.round(natural.height * scale)}px`;
}

function paintShell(overlay) {
    const root = document.getElementById("reel-root");
    root.classList.toggle("is-hook", Boolean(overlay.hookCard));
    root.querySelector(".reel-kicker").innerHTML = overlay.kicker || "";
    root.querySelector(".reel-hook").innerHTML = overlay.headline || "";
    root.querySelector(".reel-caption").innerHTML = overlay.caption || "";

    const left = document.getElementById("reel-steps");
    const right = document.getElementById("reel-growth");
    left.innerHTML = overlay.chipLeft || "";
    left.style.display = overlay.chipLeft ? "" : "none";
    right.innerHTML = overlay.chipRight || "";
    right.style.display = overlay.chipRight ? "" : "none";
    right.className = `reel-chip${overlay.tone === "hot" ? " is-hot" : overlay.tone === "cold" ? " is-cold" : ""}`;
}

function clickById(id) {
    const element = document.getElementById(id);
    if (!element) return false;
    element.click();
    return true;
}

/* ------------------------------------------------------------------ recorder ---- */

class Recorder {
    constructor(page, frameDir, fitOptions) {
        this.page = page;
        this.frameDir = frameDir;
        this.fitOptions = fitOptions;
        this.beats = [];
    }

    async capture(kind, overlay, sfx) {
        await this.page.evaluate(paintShell, overlay);
        await this.page.evaluate(fitStage, this.fitOptions);
        const index = this.beats.length;
        const file = path.join(this.frameDir, `${String(index).padStart(4, "0")}.png`);
        await this.page.screenshot({ path: file, animations: "disabled" });
        this.beats.push({
            file: path.basename(file),
            kind,
            duration: overlay.hold ?? HOLD[kind] ?? HOLD.step,
            sfx: sfx || null,
            caption: overlay.caption || overlay.headline || ""
        });
    }
}

async function openPage(adapter, options) {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: SCALE,
        colorScheme: "dark",
        reducedMotion: "no-preference"
    });
    await context.addCookies([
        { name: "darkMode", value: options.theme === "light" ? "false" : "true", domain: "127.0.0.1", path: "/" }
    ]);
    await context.route("**/*", (route) => {
        const url = route.request().url();
        return BLOCKED_HOSTS.some((host) => url.includes(host)) ? route.abort() : route.continue();
    });

    const page = await context.newPage();
    const failures = [];
    page.on("pageerror", (error) => failures.push(String(error)));

    if (adapter.drive === "clock") {
        // Fixed epoch so the mocked clock is deterministic run to run; pauseAt must not
        // travel backwards from the installed time.
        await page.clock.install({ time: CLOCK_EPOCH });
    }
    await page.goto(`${options.baseUrl}${adapter.path}`, { waitUntil: "load" });
    await page.addStyleTag({ content: fs.readFileSync(path.join(__dirname, "capture.css"), "utf8") });
    if (adapter.css) await page.addStyleTag({ content: adapter.css });
    await page.evaluate(buildShell, adapter.stage);
    if (adapter.drive === "clock") {
        // Real time keeps elapsing between install() and the pause, and pauseAt()
        // refuses to travel backwards, so aim a little ahead of the installed epoch.
        await page.clock.pauseAt(new Date(CLOCK_EPOCH.getTime() + 60_000));
    }

    const fitOptions = {
        mode: adapter.fit,
        innerSelector: adapter.innerSelector,
        maxUpscale: adapter.maxUpscale
    };
    return { browser, page, failures, fitOptions };
}

/* ------------------------------------------------- clock-driven (the DS lab) ---- */

async function driveStructures(page, adapter, command) {
    const result = await page.evaluate(adapter.pageFns.drive, command);
    if (result === "no-state") {
        throw new Error(
            "Could not seed the dataset: the lab no longer exposes `state`/`render()`. " +
            "Update driveStructures() in scripts/reels/adapters.js."
        );
    }
}

async function runLabStep(page, adapter, recorder, scene, step, stepIndex) {
    const structure = step.structure || scene.structure;
    await driveStructures(page, adapter, {
        structure: step.structure || undefined,
        dataset: step.dataset || undefined,
        speed: LAB_SPEED,
        operation: step.op,
        primary: step.primary ?? "",
        secondary: step.secondary ?? ""
    });

    const base = { kicker: richText(step.kicker || scene.kicker), headline: richText(step.title) };

    // Title beat: the operation is stated before anything moves.
    await recorder.capture("title", { ...base, caption: richText(step.caption || "") }, { type: "tick" });

    // Fire the operation without awaiting it; the mocked clock drives it forward.
    await driveStructures(page, adapter, { execute: true });

    let signature = null;
    let stepBeats = 0;
    let elapsed = 0;
    let settled = false;

    while (elapsed < MAX_SIM_MS) {
        await page.clock.runFor(TICK_MS);
        elapsed += TICK_MS;
        const next = await page.evaluate(adapter.pageFns.signature);
        if (next !== signature) {
            signature = next;
            const live = await page.evaluate(adapter.pageFns.read);
            if (/complete/i.test(live.status)) {
                settled = true;
                break;
            }
            const caption = live.bubble ? reelCaption(live.bubble) : null;
            if (caption) {
                const shown = live.steps.includes("/") ? live.steps.split("/")[0].trim() : live.steps;
                await recorder.capture(
                    "step",
                    { ...base, caption, chipLeft: `<b>${shown}</b> steps`, chipRight: live.growth },
                    { type: "blip", index: stepBeats }
                );
                stepBeats += 1;
            }
        }
    }

    // Let any post-animation commit and re-render settle before reading the result.
    await page.clock.runFor(200);
    const live = await page.evaluate(adapter.pageFns.read);
    await recorder.capture(
        "result",
        {
            ...base,
            caption: `<b>${richText(live.title)}</b>`,
            chipLeft: `<b>${live.steps}</b> steps`,
            chipRight: live.growth,
            tone: live.failure ? "cold" : "hot"
        },
        { type: live.failure ? "miss" : "hit" }
    );

    if (!settled) {
        process.stderr.write(`  ! step ${stepIndex + 1} (${structure}.${step.op}) never reported completion\n`);
    }
}

async function recordLabScene(scene, adapter, options, frameDir) {
    const { browser, page, failures, fitOptions } = await openPage(adapter, options);
    const recorder = new Recorder(page, frameDir, fitOptions);

    await driveStructures(page, adapter, { structure: scene.structure, dataset: scene.dataset, speed: LAB_SPEED });
    await recorder.capture(
        "hook",
        { kicker: richText(scene.kicker), headline: scene.hook.map(richText).join("<br>"), hookCard: true },
        { type: "riser" }
    );

    for (let index = 0; index < scene.steps.length; index += 1) {
        await runLabStep(page, adapter, recorder, scene, scene.steps[index], index);
    }

    const live = await page.evaluate(adapter.pageFns.read);
    await recorder.capture(
        "outro",
        {
            kicker: richText(scene.kicker),
            headline: scene.outro.map(richText).join("<br>"),
            chipLeft: `<b>${live.steps}</b> steps`,
            chipRight: live.growth,
            tone: "hot"
        },
        { type: "drop" }
    );

    await browser.close();
    return { beats: recorder.beats, failures };
}

/* -------------------------------------------- step-driven (the canvas tools) ---- */

async function recordSteppedScene(scene, adapter, options, frameDir) {
    const { browser, page, failures, fitOptions } = await openPage(adapter, options);
    const recorder = new Recorder(page, frameDir, fitOptions);

    await page.evaluate(adapter.pageFns.setup, scene.config || {});
    await page.waitForTimeout(200); // let the ResizeObserver re-lay-out the canvas

    const base = { kicker: richText(scene.kicker), headline: richText(scene.title) };
    const chips = (live, tone) => ({
        chipLeft: adapter.chip ? adapter.chip(live) : "",
        chipRight: adapter.secondChip && adapter.secondChip(live) ? adapter.secondChip(live) : scene.growth || "",
        tone
    });

    await recorder.capture(
        "hook",
        { kicker: richText(scene.kicker), headline: scene.hook.map(richText).join("<br>"), hookCard: true },
        { type: "riser" }
    );

    // Opening frame: the untouched input, before a single comparison.
    let live = await page.evaluate(adapter.pageFns.read);
    await recorder.capture(
        "title",
        { ...base, caption: richText(scene.caption || ""), ...chips(live) },
        { type: "tick" }
    );

    // Each #step click releases exactly one checkpoint in the tool's engine. The
    // number of clicks and the number of captured frames are separate budgets: a BFS
    // flood needs to process every reachable cell to reach its goal, but only every
    // stride-th state is worth a frame. Tying the two together starves the algorithm.
    const stride = Math.max(1, scene.stride || 1);
    const budget = Math.min(scene.maxBeats || MAX_STEP_BEATS, MAX_STEP_BEATS);
    const maxSteps = scene.maxSteps || budget * stride;
    let captured = 0;
    let finished = false;

    for (let index = 0; index < maxSteps && captured < budget; index += 1) {
        if (!(await page.evaluate(clickById, "step"))) {
            throw new Error(`${adapter.path} has no #step button`);
        }
        await page.waitForTimeout(STEP_SETTLE_MS);
        live = await page.evaluate(adapter.pageFns.read);
        if (live.done) {
            finished = true;
            break;
        }
        if (index % stride !== 0) continue;
        await recorder.capture(
            "frame",
            { ...base, caption: richText(live.caption), ...chips(live) },
            { type: "blip", index: captured }
        );
        captured += 1;
    }

    await recorder.capture(
        "result",
        { ...base, caption: richText(live.caption), ...chips(live, "hot") },
        { type: "hit" }
    );
    await recorder.capture(
        "outro",
        {
            kicker: richText(scene.kicker),
            headline: scene.outro.map(richText).join("<br>"),
            ...chips(live, "hot")
        },
        { type: "drop" }
    );

    await browser.close();
    return { beats: recorder.beats, failures, finished };
}

/* ---------------------------------------------------------------- entry point --- */

async function renderScene(scene, options) {
    const adapter = adapterFor(scene.tool || "data_structures");
    const frameDir = path.join(options.workDir, scene.id);
    fs.rmSync(frameDir, { recursive: true, force: true });
    fs.mkdirSync(frameDir, { recursive: true });

    const record = adapter.drive === "clock" ? recordLabScene : recordSteppedScene;

    // The maze tools regenerate their grid randomly on reset, so a run can end with no
    // reachable goal - a reel with no payoff. Re-roll rather than ship one.
    const attempts = scene.requireDone ? 4 : 1;
    let beats;
    let failures;
    let finished = true;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        ({ beats, failures, finished = true } = await record(scene, adapter, options, frameDir));
        if (finished || !scene.requireDone) break;
        if (attempt < attempts) {
            process.stderr.write(`  ~ ${scene.id}: no path in that maze, re-rolling (${attempt}/${attempts - 1})\n`);
            fs.rmSync(frameDir, { recursive: true, force: true });
            fs.mkdirSync(frameDir, { recursive: true });
        }
    }
    if (scene.requireDone && !finished) {
        process.stderr.write(`  ! ${scene.id} never reached its goal in ${attempts} attempts\n`);
    }

    if (failures.length) throw new Error(`Page errors while recording ${scene.id}:\n${failures.join("\n")}`);

    const timeline = {
        id: scene.id,
        tool: scene.tool || "data_structures",
        width: VIEWPORT.width * SCALE,
        height: VIEWPORT.height * SCALE,
        duration: Number(beats.reduce((sum, beat) => sum + beat.duration, 0).toFixed(3)),
        beats
    };
    fs.writeFileSync(path.join(frameDir, "timeline.json"), `${JSON.stringify(timeline, null, 2)}\n`);
    return timeline;
}

module.exports = { renderScene, HOLD };
