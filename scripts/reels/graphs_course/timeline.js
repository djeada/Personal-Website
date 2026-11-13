"use strict";

/*
 * Turns a section definition (sections/NN.js) plus one narration clip per beat
 * into an absolute timeline: when each beat starts, when its voice plays, and
 * where every shot, action, card event and caption falls.
 *
 * Times inside a beat are written relative to it:
 *   0.4                      a fraction of the beat (0 = start, 1 = end)
 *   "prices"                 the moment a word or phrase is spoken in this beat
 *   { word, nth, offset }    the nth occurrence, shifted by `offset` seconds
 *   { s: 2 } / { s: -1.5 }   seconds after the beat starts / before it ends
 *   { beat: 2, at: ... }     any of the above, in another beat
 *
 * placeBeat() is shared with the vertical reels (reel.js), which reuse a
 * section's beats with their own, shorter timing.
 */

const { timeWords, findWord, captionChunks } = require("./script");

const FPS = 30;
const INTRO = 4.2;        // title card before the first beat
const LEAD = 0.45;        // picture before the voice starts in each beat
const TAIL = 0.8;         // picture after the voice ends
const OUTRO = 3.0;        // hold and fade after the last beat, under the "Next" card
const OUTRO_PLAIN = 1.6;  // the same without the card: a fade to dark
const MAX_LENGTH = 300;   // sections stay within five minutes
const MIN_TAIL = 0.3;     // the tightest automatic fit

/* Beat spans from the voice clips: each beat is its speech plus `lead` before and `tail` after. */
function layout(section, beats, clips, tail) {
    let cursor = INTRO;
    const spans = beats.map((beat, i) => {
        const clip = clips[i], spec = section.beats[i];
        const speech = clip.speechEnd - clip.speechStart;
        const start = cursor, voiceAt = start + (spec.lead ?? LEAD);
        const end = Math.max(voiceAt + speech + (spec.tail ?? tail), start + (spec.minDuration ?? 0));
        cursor = end;
        return { n: beat.n, start, end, voiceAt, clipOffset: voiceAt - clip.speechStart, words: timeWords(beat.narration, voiceAt, voiceAt + speech) };
    });
    return { spans, end: cursor };
}

/*
 * A resolver for one beat's relative times. `spans` are { n, start, end, words };
 * `index` maps a section beat number to its span (a reel only has some beats).
 * A reference to a beat that is not there is clamped to this beat's start or end.
 */
function resolver(spans, index = n => n - 1) {
    const resolve = (ref, home) => {
        const span = spans[home];
        if (ref && typeof ref === "object" && ref.beat !== undefined) {
            const other = index(ref.beat);
            if (other === undefined || other < 0 || !spans[other]) return ref.beat > span.n ? span.end : span.start;
            return resolve(ref.at ?? 0, other);
        }
        if (typeof ref === "number") return span.start + ref * (span.end - span.start);
        if (typeof ref === "string") ref = { word: ref };
        if (ref && ref.s !== undefined) return ref.s >= 0 ? span.start + ref.s : span.end + ref.s;
        if (ref && ref.word) {
            const t = findWord(span.words, ref.word, ref.nth, ref.pick);
            if (t === null) throw new Error(`beat ${span.n}: the word "${ref.word}" is not in its narration`);
            return t + (ref.offset ?? 0);
        }
        throw new Error(`beat ${span.n}: cannot resolve time ${JSON.stringify(ref)}`);
    };
    return resolve;
}

/* Every `at` / `until` inside a card's event lists (marks, labels, rows, ops, ...) becomes an absolute time. */
function resolveEvents(value, at) {
    if (Array.isArray(value)) return value.map(v => resolveEvents(v, at));
    if (!value || typeof value !== "object") return value;
    const out = {};
    for (const [key, v] of Object.entries(value)) {
        if ((key === "at" || key === "until") && v !== undefined) out[key] = at(v);
        else out[key] = resolveEvents(v, at);
    }
    return out;
}

/*
 * One beat's shots, actions, marks, hides, chips, rates and cards, placed with
 * `at` (a relative-time resolver for this beat). Options: `first` (the opening
 * beat, whose shot at 0 starts the film), `veilAt` (when its veil level starts),
 * `cards: false` (reels drop cards), `veil` (override the beat's veil level).
 */
function placeBeat(timeline, spec, at, { page = spec.page, first = false, veilAt, cards = true, veil } = {}) {
    timeline.veils.push({ t: veilAt, level: veil ?? spec.veil ?? 0 });
    if (veil === undefined) (spec.veils || []).forEach(v => timeline.veils.push({ t: at(v.at), level: v.level }));
    (spec.shots || []).forEach(shot => timeline.shots.push({ page, ...shot, t: first && shot.at === 0 ? 0 : at(shot.at) }));
    (spec.actions || []).forEach(a => {
        // `count` clicks spread evenly from `at` to `until` (stepping a search, for example).
        const times = a.count ? Array.from({ length: a.count }, (_, k) => at(a.at) + (a.count > 1 ? k * (at(a.until) - at(a.at)) / (a.count - 1) : 0)) : [at(a.at)];
        times.forEach(t => timeline.actions.push({ page, ...a, t, fn: a.fn && a.fn.toString() }));
    });
    (spec.marks || []).forEach(m => timeline.marks.push({ ...m, from: at(m.from), to: at(m.to ?? 1) }));
    (spec.hides || []).forEach(h => timeline.hides.push({ ...h, from: at(h.from ?? 0), until: at(h.until) }));
    (spec.chips || []).forEach(c => timeline.chips.push({ ...c, from: at(c.from ?? 0), to: at(c.to ?? 1),
        items: c.items.map(item => (item.from === undefined ? item : { ...item, from: at(item.from) })) }));
    (spec.rates || []).forEach(r => timeline.rates.push({ page, ...r, from: at(r.from), to: at(r.to) }));
    if (!cards) return;
    (spec.cards || []).forEach(card => {
        const { from, to, show, steps, notes, typing, ...rest } = card;
        const out = { ...resolveEvents(rest, at), from: at(from ?? 0), to: at(to ?? 1) };
        // `show`, `steps` and `notes` are plain lists of times (null keeps an item hidden).
        const when = e => (e === null ? null : at(e && typeof e === "object" && e.at !== undefined ? e.at : e));
        if (show) out.show = show.map(when);
        if (steps) out.steps = steps.map(when);
        if (notes) out.notes = notes.map(when);
        const range = r => ({ from: at(r.from), to: at(r.to) });
        if (typing) out.typing = Array.isArray(typing) ? typing.map(range) : range(typing);
        timeline.cards.push(out);
        if (card.cue !== false) (out.show || [out.from]).filter(t => t !== null).forEach(t => timeline.cues.push({ t, kind: "pluck" }));
    });
}

function finish(timeline) {
    for (const list of ["shots", "actions", "veils", "cues"]) timeline[list].sort((a, b) => a.t - b.t);
    if (!timeline.shots.length || timeline.shots[0].t > 0) throw new Error(`${timeline.id}: the first beat needs a shot at 0`);
    timeline.shots.forEach(s => { if (!timeline.pages[s.page]) throw new Error(`shot at ${s.t.toFixed(1)}s uses unknown page "${s.page}"`); });
    return timeline;
}

const serializePages = pages => Object.fromEntries(Object.entries(pages).map(([name, spec]) =>
    [name, { ...spec, setup: (spec.setup || []).map(a => ({ ...a, fn: a.fn && a.fn.toString() })) }]));

/*
 * options: captions (default true), next (the "Next: Part N" end card, default
 * true), gap (seconds between one beat's last word and the next beat's first,
 * default LEAD + TAIL = 1.25), maxLength (default 300 s). Without an explicit
 * gap, a section that would run past maxLength gets a tighter gap, down to
 * LEAD + MIN_TAIL; the voice itself is never touched.
 */
function buildTimeline(section, beats, clips, options = {}) {
    if (section.beats.length !== beats.length) {
        throw new Error(`sections/${section.id}.js defines ${section.beats.length} beats but the script has ${beats.length}`);
    }
    const closing = section.closing || null;
    const next = !closing && options.next !== false;
    const outro = closing ? closing.hold ?? 6 : next ? OUTRO : OUTRO_PLAIN;
    const maxLength = options.maxLength ?? MAX_LENGTH;
    let tail = options.gap !== undefined ? Math.max(0.1, options.gap - LEAD) : TAIL;
    let { spans, end } = layout(section, beats, clips, tail);
    if (options.gap === undefined && end + outro > maxLength - 1) {
        // Largest tail that fits, by bisection (minDuration beats make it non-linear).
        let lo = MIN_TAIL, hi = TAIL;
        for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (layout(section, beats, clips, mid).end + outro <= maxLength - 1) lo = mid; else hi = mid; }
        tail = lo;
        ({ spans, end } = layout(section, beats, clips, tail));
    }
    const DURATION = Math.ceil((end + outro) * FPS) / FPS;
    const resolve = resolver(spans);

    const timeline = {
        id: section.id, FPS, W: 1280, H: 720, SCALE: 1.5, DURATION, INTRO, OUTRO: outro, gap: LEAD + tail, next,
        part: section.part, title: section.title, mark: `GRAPHS FOR LEETCODE · PART ${section.part}`,
        pages: serializePages(section.pages),
        captionsOn: options.captions !== false,
        beats: spans.map(({ words, ...rest }) => rest),
        shots: [], actions: [], cards: [], veils: [{ t: 0, level: 1 }], marks: [], hides: [], chips: [], rates: [], cues: [],
        captions: options.captions === false ? [] : spans.flatMap(s => captionChunks(s.words))
    };
    section.beats.forEach((spec, i) => placeBeat(timeline, spec, ref => resolve(ref, i), { first: i === 0, veilAt: i === 0 ? INTRO - 0.6 : spans[i].start }));
    timeline.veils.push({ t: DURATION - outro + 0.6, level: 1 });
    timeline.cards.unshift({ id: "title", type: "title", from: 0, to: INTRO - 0.3, kicker: "GRAPHS FOR LEETCODE", part: section.part, title: section.title, cue: false });
    if (closing) timeline.cards.push({ id: "closing", type: "next", from: DURATION - outro + 0.5, to: DURATION + 1, kicker: closing.kicker || "GRAPHS FOR LEETCODE", text: closing.title, url: closing.url, small: closing.small });
    else if (next) timeline.cards.push({ id: "next", type: "next", from: DURATION - outro + 0.5, to: DURATION + 1, kicker: "NEXT", text: section.next || "" });
    timeline.cover = section.cover ?? INTRO * 0.6;
    return finish(timeline);
}

function describe(timeline, beats) {
    const extras = [`gap ${timeline.gap.toFixed(2)}s`, timeline.next ? "end card" : "no end card"];
    const lines = [`section ${timeline.id}: ${timeline.title}  ${fmt(timeline.DURATION)}  (${extras.join(", ")})`];
    timeline.beats.forEach((b, i) => lines.push(`  beat ${String(b.n).padStart(2)}  ${fmt(b.start)}–${fmt(b.end)}  ${(b.end - b.start).toFixed(1)}s  ${beats[i].onScreen.slice(0, 90)}`));
    if (timeline.DURATION > MAX_LENGTH) lines.push(`  WARNING: ${fmt(timeline.DURATION)} is over ${fmt(MAX_LENGTH)}`);
    return lines.join("\n");
}

const fmt = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

function srt(captions) {
    const stamp = s => {
        const ms = Math.round(s * 1000);
        const p = (n, w = 2) => String(n).padStart(w, "0");
        return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
    };
    return captions.map((c, i) => `${i + 1}\n${stamp(c.t)} --> ${stamp(Math.max(c.end, c.t + 1))}\n${c.text}\n`).join("\n");
}

module.exports = { buildTimeline, placeBeat, resolver, finish, serializePages, describe, srt, fmt, FPS, LEAD };
