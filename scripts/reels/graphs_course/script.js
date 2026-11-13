"use strict";

/*
 * Reads a section script (scripts/NN-*.md) into beats, and turns a beat's
 * narration into timed words and caption chunks.
 *
 * Inside "## Beat N": the "On screen ..." line, bullet lines and code fences are
 * on-screen material; every other non-empty line is narration, which is what is
 * spoken and captioned.
 */

const fs = require("fs");

function parseScript(file) {
    const beats = [];
    let beat = null, fence = null;
    for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
        const line = raw.trimEnd();
        const heading = line.match(/^##\s+Beat\s+(\d+)/i);
        if (heading) {
            beat = { n: Number(heading[1]), onScreen: "", bullets: [], code: [], paragraphs: [] };
            beats.push(beat);
            continue;
        }
        if (/^#{1,2}\s/.test(line)) { beat = null; continue; }
        if (!beat) continue;
        if (line.startsWith("```")) {
            if (fence) { beat.code.push(fence); fence = null; } else fence = { lang: line.slice(3).trim(), lines: [] };
            continue;
        }
        if (fence) { fence.lines.push(raw); continue; }
        if (!line.trim()) continue;
        if (/^On screen\b/i.test(line)) beat.onScreen = line;
        else if (/^\s*[-*]\s/.test(line)) beat.bullets.push(line.replace(/^\s*[-*]\s+/, "").replace(/^"(.*)"$/, "$1"));
        else beat.paragraphs.push(line.trim());
    }
    beats.forEach((b, i) => {
        if (b.n !== i + 1) throw new Error(`${file}: expected Beat ${i + 1}, found Beat ${b.n}`);
        if (!b.paragraphs.length) throw new Error(`${file}: Beat ${b.n} has no narration`);
        b.narration = b.paragraphs.join(" ");
    });
    if (!beats.length) throw new Error(`${file}: no "## Beat N" sections`);
    return beats;
}

/*
 * Word timing without a forced aligner: each word gets a share of the speech span
 * proportional to its length, plus a little extra after commas and sentence ends,
 * where a reader pauses. Good to a few tenths of a second, which is enough to
 * place cards and captions.
 */
function timeWords(text, start, end) {
    const words = text.split(/\s+/).filter(Boolean).map(word => {
        const pause = /[.!?]["']?$/.test(word) ? 7 : /[,;:]["']?$/.test(word) ? 3 : 0;
        return { word, weight: word.length + 1, pause };
    });
    const total = words.reduce((sum, w) => sum + w.weight + w.pause, 0);
    let cursor = 0;
    return words.map(w => {
        const t = start + (cursor / total) * (end - start);
        cursor += w.weight;
        const until = start + (cursor / total) * (end - start);
        cursor += w.pause;
        return { word: w.word, t, end: until };
    });
}

const bare = word => word.toLowerCase().replace(/[^a-z0-9⁰-⁹]+/g, "");

/* Time of the nth occurrence of a word or phrase (or of its `pick`th word) in a beat's timed words. */
function findWord(words, phrase, nth = 1, pick = 0) {
    const target = phrase.split(/\s+/).map(bare);
    let seen = 0;
    for (let i = 0; i + target.length <= words.length; i++) {
        if (target.every((w, k) => bare(words[i + k].word) === w) && ++seen === nth) return words[i + pick].t;
    }
    return null;
}

/*
 * Caption chunks: one sentence at a time, and a sentence too long for two lines
 * is split at the comma or colon closest to its middle (then again if needed).
 */
const MAX_CHARS = 96;

function splitLong(words) {
    const text = words.map(w => w.word).join(" ");
    if (text.length <= MAX_CHARS || words.length < 4) return [words];
    let best = -1, bestScore = Infinity, chars = 0;
    for (let i = 0; i < words.length - 1; i++) {
        chars += words[i].word.length + 1;
        const score = Math.abs(chars - text.length / 2) - (/[,;:]$/.test(words[i].word) ? 40 : /[.!?]$/.test(words[i].word) ? 60 : 0);
        if (i >= 1 && i <= words.length - 3 && score < bestScore) { bestScore = score; best = i; }
    }
    return [...splitLong(words.slice(0, best + 1)), ...splitLong(words.slice(best + 1))];
}

function captionChunks(words) {
    const sentences = [];
    let current = [];
    words.forEach(w => {
        current.push(w);
        if (/[.!?]["']?$/.test(w.word)) { sentences.push(current); current = []; }
    });
    if (current.length) sentences.push(current);
    return sentences.flatMap(splitLong).map(chunk => ({
        text: chunk.map(w => w.word).join(" "),
        t: chunk[0].t,
        end: chunk[chunk.length - 1].end
    }));
}

/* The quoted strings in a beat's "On screen" line (card text written in the script). */
const quotes = beat => (beat.onScreen.match(/"[^"]+"/g) || []).map(q => q.slice(1, -1));

module.exports = { quotes, parseScript, timeWords, findWord, captionChunks };
