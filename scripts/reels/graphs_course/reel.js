"use strict";

/*
 * Vertical reels (1080×1920, 30 fps) for the course, in the calm captioned style
 * of the optics reels: one short sentence at a time in a band above the filmed
 * tool, readouts under it, a music bed and no voice.
 *
 *   node scripts/reels/graphs_course/reel.js 01               render reels/01.js -> out/graphs-course/reel-01.mp4
 *   node scripts/reels/graphs_course/reel.js 01 --list        caption schedule only
 *   node scripts/reels/graphs_course/reel.js 01 --stills 3,20 framing check stills
 *   node scripts/reels/graphs_course/reel.js 01 --no-music    picture only (the .silent.mp4 is always written)
 *
 * A reel is a list of clips. Each clip replays one beat of a section (its page,
 * shot targets, spotlight, actions, marks and readout chips) for `length`
 * seconds. The beat's word cues are spread over the clip (or over `narration:
 * [from, to]` seconds), and `override` replaces any part of the beat's spec, so
 * a run can be paced for the reel. Every event is kept inside its clip. Section
 * cards are left out (they are laid out for 16:9); boxes become the reel's film
 * window.
 */

const fs = require("fs");
const path = require("path");
const { parseScript, timeWords } = require("./script");
const { placeBeat, resolver, finish, serializePages, fmt, FPS } = require("./timeline");
const { writeBed } = require("./music");
const { record } = require("./record");
const { serve, mixdown, loudness, ffmpeg, OUT, WORK } = require("./build");

const FILM = [.02, .258, .98, .81];      // between the caption band (236 px) and the chips in the foot (from 780 px) of 960
const FILM_TALL = [.02, .258, .98, .9];  // a clip without chips uses the foot too, down to the watermark
const END = 6;                            // end card, as in the optics reels
const strip = html => html.replace(/<[^>]+>/g, "");

function loadSection(id, cache) {
    if (!cache[id]) {
        const module_ = require(`./sections/${id}.js`);
        const beats = parseScript(path.join(__dirname, "scripts", module_.script));
        cache[id] = { ...module_.build(beats), script: beats };   // .beats: the shot list; .script: the parsed beats
    }
    return cache[id];
}

/* Captions: each clip's sentences share its length unless they give `at` / `for` (seconds into the clip). */
function captionsFor(clip, start) {
    const list = clip.captions || [], slot = clip.length / Math.max(1, list.length);
    // Inside a clip the sentences follow each other with no gap (the overlay swaps them);
    // the last one ends just before the clip's dip to the next.
    return list.map((c, k) => {
        const t = start + (c.at ?? (k ? k * slot : .4));
        const nextAt = list[k + 1] ? start + (list[k + 1].at ?? (k + 1) * slot) : null;
        const end = c.for !== undefined ? t + c.for : nextAt ?? start + clip.length - .15;
        return { t, end, lines: c.lines, sub: c.sub };
    });
}

/* Keeps a clip's events inside [start, end]: windows are clamped, late actions and shots dropped. */
function confine(part, start, end) {
    const clamp = t => Math.min(end, Math.max(start, t));
    part.shots = part.shots.filter(s => s.t < end - .05).map(s => ({ ...s, t: clamp(s.t) }));
    part.actions = part.actions.filter(a => a.t <= end && a.t >= start - 1e-6);
    part.marks = part.marks.filter(m => m.from < end).map(m => ({ ...m, from: clamp(m.from), to: clamp(m.to) }));
    part.hides = part.hides.map(h => ({ ...h, from: clamp(h.from), until: clamp(h.until) }));
    part.chips = part.chips.filter(c => c.from < end).map(c => ({ ...c, from: clamp(c.from), to: clamp(c.to),
        items: c.items.map(item => (item.from === undefined ? item : { ...item, from: clamp(item.from) })) }));
    part.rates = part.rates.map(r => ({ ...r, from: clamp(r.from), to: clamp(r.to) }));
    part.veils = part.veils.map(v => ({ ...v, t: clamp(v.t) }));
    return part;
}

function buildReel(def) {
    const sections = {}, pages = {};
    const ns = (sec, name) => `${sec}:${name}`;
    const use = (sec, name) => {
        const section = loadSection(sec, sections);
        if (!section.pages[name]) throw new Error(`reel ${def.id}: section ${sec} has no page "${name}"`);
        pages[ns(sec, name)] = section.pages[name];
    };
    (def.pages || []).forEach(([sec, name]) => use(sec, name));

    let cursor = 0;
    const spans = def.clips.map(clip => {
        const section = loadSection(clip.section, sections), beat = section.script[clip.beat - 1];
        if (!beat) throw new Error(`reel ${def.id}: section ${clip.section} has no beat ${clip.beat}`);
        const start = cursor, end = start + clip.length;
        const [a, b] = clip.narration || [.3, clip.length - .3];
        cursor = end;
        return { n: clip.beat, section: clip.section, start, end, words: timeWords(beat.narration, start + a, start + b) };
    });
    const endCard = cursor, DURATION = Math.ceil((endCard + END) * FPS) / FPS;

    const timeline = {
        id: `reel-${def.id}`, FPS, W: 540, H: 960, SCALE: 2, vertical: true, DURATION, INTRO: 0, OUTRO: END, endCard,
        title: def.title, mark: "GRAPHS FOR LEETCODE · ADAMDJELLOULI.COM", end: def.end,
        pages: {}, captionsOn: true, captions: [], beats: spans.map(({ words, ...rest }) => rest),
        shots: [], actions: [], cards: [], veils: [{ t: 0, level: 0 }], marks: [], hides: [], chips: [], rates: [], cues: []
    };
    def.clips.forEach((clip, i) => {
        const spec = sectionSpec(sections[clip.section], clip);
        use(clip.section, spec.page);
        // {beat: n} references reach other clips of the same section only.
        const index = n => { const k = def.clips.findIndex(c => c.section === clip.section && c.beat === n); return k < 0 ? undefined : k; };
        const at = ref => resolver(spans, index)(ref, i);
        const part = { shots: [], actions: [], cards: [], veils: [], marks: [], hides: [], chips: [], rates: [], cues: [], pages: {} };
        placeBeat(part, { ...spec, page: ns(clip.section, spec.page) }, at, { first: i === 0, veilAt: spans[i].start, cards: false, veil: clip.veil ?? 0 });
        confine(part, spans[i].start, spans[i].end);
        // Every clip opens on its first shot, through dark when it follows another clip.
        if (part.shots.length) part.shots[0] = { ...part.shots[0], t: i === 0 ? 0 : spans[i].start, dip: i > 0 };
        for (const key of ["shots", "actions", "veils", "marks", "hides", "chips", "rates"]) timeline[key].push(...part[key]);
        timeline.captions.push(...captionsFor(clip, spans[i].start));
        if (i) timeline.cues.push({ t: spans[i].start, kind: "pluck" });
    });
    timeline.pages = serializePages(pages);
    timeline.cover = def.cover ?? timeline.captions[0].t + 1.5;
    timeline.captions.forEach((c, i) => {
        const words = strip(c.lines.join(" ")).split(/\s+/).length, need = Math.max(3, 1.2 + words * .32);
        if (c.end - c.t < need) throw new Error(`reel ${def.id}: caption "${strip(c.lines.join(" "))}" is up ${(c.end - c.t).toFixed(1)} s; needs ${need.toFixed(1)} s`);
        if (i && c.t < timeline.captions[i - 1].end - 1e-6) throw new Error(`reel ${def.id}: caption at ${c.t.toFixed(1)} s overlaps the previous one`);
        if (c.end > endCard + 1e-6) throw new Error(`reel ${def.id}: caption at ${c.t.toFixed(1)} s runs into the end card`);
    });
    return finish(timeline);
}

/* The section beat, with boxes moved to the reel's film window and the clip's overrides on top. */
function sectionSpec(section, clip) {
    const beat = section.beats[clip.beat - 1];
    if (!beat) throw new Error(`section ${clip.section} has no beat ${clip.beat}`);
    const spec = { ...beat, ...(clip.override || {}) };
    // A beat that keeps the previous beat's camera has no shots of its own: reuse the section's last shot on its page.
    if (!(spec.shots || []).length) {
        const earlier = section.beats.slice(0, clip.beat - 1).flatMap(b => (b.shots || []).map(shot => ({ page: b.page, ...shot }))).filter(shot => shot.page === spec.page);
        if (!earlier.length) throw new Error(`section ${clip.section} beat ${clip.beat}: no shot on page "${spec.page}" to reuse; give the clip override.shots`);
        const { page, ...last } = earlier[earlier.length - 1];
        spec.shots = [{ ...last, at: 0 }];
    }
    if (clip.chips === false) spec.chips = [];
    // `frame` replaces the framing of every shot (for example the lab graph's nodes, `union: true`).
    const box = clip.box || ((spec.chips || []).length ? FILM : FILM_TALL);
    spec.shots = (spec.shots || []).map(s => ({ ...s, ...(clip.frame || {}), box, maxZoom: (clip.frame || {}).maxZoom ?? s.maxZoom ?? 2.4 }));
    return spec;
}

function describe(timeline) {
    const lines = [`${timeline.id}: ${timeline.title}  ${fmt(timeline.DURATION)}`];
    timeline.beats.forEach(b => lines.push(`  clip  part ${b.section} beat ${b.n}  ${fmt(b.start)}–${fmt(b.end)}`));
    timeline.captions.forEach(c => lines.push(`    ${c.t.toFixed(1).padStart(5)}–${c.end.toFixed(1).padEnd(5)} ${strip(c.lines.join(" "))}${c.sub ? `  |  ${strip(c.sub)}` : ""}`));
    lines.push(`  end card ${fmt(timeline.endCard)}`);
    return lines.join("\n");
}

async function main() {
    const args = process.argv.slice(2);
    const flag = name => args.includes(name);
    const value = name => args[args.indexOf(name) + 1];
    const id = args.find((a, i) => /^\d+$/.test(a) && !(i && args[i - 1].startsWith("--")));
    if (!id) throw new Error("usage: reel.js <reel number> [--list] [--stills 3,20] [--no-music] [--port 8190]");
    const key = id.padStart(2, "0");
    const timeline = buildReel({ id: key, ...require(`./reels/${key}.js`) });
    console.log(describe(timeline));
    if (flag("--list")) return;
    const log = message => console.log(`[reel ${key}] ${message}`);
    const work = path.join(WORK, `reel-${key}`);
    fs.mkdirSync(work, { recursive: true });
    fs.mkdirSync(OUT, { recursive: true });
    const { server, origin } = await serve(Number(flag("--port") ? value("--port") : 8190));
    try {
        if (flag("--stills")) {
            const dir = path.join(work, "stills");
            fs.rmSync(dir, { recursive: true, force: true });
            await record(timeline, dir, { origin, only: value("--stills").split(",").map(Number), log });
            log(`stills in ${dir}`);
            return;
        }
        const frames = path.join(work, "video");
        fs.rmSync(frames, { recursive: true, force: true });
        await record(timeline, frames, { origin, log });
        const name = `reel-${key}`, mp4 = path.join(OUT, `${name}.mp4`), silent = path.join(OUT, `${name}.silent.mp4`);
        const video = ["-f", "concat", "-safe", "0", "-i", path.join(frames, "frames.txt")];
        const encode = ["-vf", `fps=${FPS},format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-level", "4.1", "-t", timeline.DURATION.toFixed(3), "-movflags", "+faststart"];
        ffmpeg([...video, "-an", ...encode, silent]);
        if (!flag("--no-music")) {
            const bed = path.join(work, "bed.wav"), mix = path.join(work, "mix.wav");
            writeBed(timeline, bed, { under: 1 });
            mixdown(null, bed, mix);
            ffmpeg(["-i", silent, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", timeline.DURATION.toFixed(3), "-movflags", "+faststart", mp4]);
        } else fs.copyFileSync(silent, mp4);
        ffmpeg(["-ss", String(timeline.cover), "-i", mp4, "-frames:v", "1", "-q:v", "2", path.join(OUT, `${name}.cover.jpg`)]);
        const l = flag("--no-music") ? null : loudness(mp4);
        log(`done: ${mp4} (${timeline.DURATION.toFixed(1)} s${l ? `, ${l.I} LUFS, true peak ${l.peak} dBFS` : ""}), ${silent}`);
    } finally {
        server.close();
    }
}

if (require.main === module) main().catch(error => { console.error(error.message || error); process.exit(1); });

module.exports = { buildReel };
