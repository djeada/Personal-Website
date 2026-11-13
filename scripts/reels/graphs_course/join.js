"use strict";

/*
 * The full video: every rendered section, in order, joined into one file, plus
 * a YouTube chapters list from the section start times.
 *
 *   node scripts/reels/graphs_course/join.js                  -> out/graphs-course/graphs-for-leetcode.mp4 + chapters.txt
 *   node scripts/reels/graphs_course/join.js --chapters-only  chapters.txt only (no encode)
 *
 * Works with whatever section-NN.mp4 files exist (each needs the section-NN.json
 * that build.js writes beside it). Every section opens on its own title card
 * ("Part N · title" over dark), which is the card at each boundary. A section
 * rendered with its "Next: Part N" end card is cut just before that card, with a
 * short fade, so the full video never announces the part that is about to
 * start; one rendered with --no-next is used whole.
 */

const fs = require("fs");
const path = require("path");
const { run } = require("./voice");
const { ffmpeg, loudness, OUT } = require("./build");
const { FPS } = require("./timeline");

const FADE = 0.6;
const stamp = s => { const t = Math.floor(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const probe = file => Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).stdout.trim());

function sections() {
    return fs.readdirSync(OUT).filter(f => /^section-\d\d\.mp4$/.test(f)).sort().map(f => {
        const file = path.join(OUT, f), meta = path.join(OUT, f.replace(".mp4", ".json"));
        if (!fs.existsSync(meta)) throw new Error(`${meta} is missing: re-render ${f} with build.js, which writes it`);
        const info = JSON.parse(fs.readFileSync(meta, "utf8"));
        // Cut where the "Next" card starts to appear (it fades in from lastBeatEnd + 0.5 s).
        const length = info.next ? Math.floor((info.lastBeatEnd + .5) * FPS) / FPS : probe(file);
        return { file, ...info, length, trimmed: Boolean(info.next) };
    });
}

function main() {
    const args = process.argv.slice(2);
    const list = sections();
    if (!list.length) throw new Error(`no section-NN.mp4 in ${OUT}`);
    let t = 0;
    const lines = list.map(s => { const line = `${stamp(t)} Part ${s.part} · ${s.title}`; t += s.length; return line; });
    const chapters = path.join(OUT, "chapters.txt");
    fs.writeFileSync(chapters, lines.join("\n") + "\n");
    list.forEach(s => console.log(`  ${path.basename(s.file)}  ${s.length.toFixed(2)} s${s.trimmed ? " (end card cut)" : ""}  voice: ${s.voice}`));
    console.log(`chapters (${stamp(t)} in all) -> ${chapters}\n${lines.join("\n")}`);
    if (args.includes("--chapters-only")) return;

    const inputs = list.flatMap(s => ["-i", s.file]);
    const parts = list.map((s, i) => {
        const fade = s.trimmed ? `,fade=t=out:st=${(s.length - FADE).toFixed(3)}:d=${FADE}` : "";
        const afade = s.trimmed ? `,afade=t=out:st=${(s.length - FADE).toFixed(3)}:d=${FADE}` : "";
        return `[${i}:v]trim=0:${s.length.toFixed(3)},setpts=PTS-STARTPTS${fade}[v${i}];[${i}:a]atrim=0:${s.length.toFixed(3)},asetpts=PTS-STARTPTS${afade}[a${i}]`;
    });
    const graph = `${parts.join(";")};${list.map((s, i) => `[v${i}][a${i}]`).join("")}concat=n=${list.length}:v=1:a=1[v][a]`;
    const out = path.join(OUT, "graphs-for-leetcode.mp4");
    ffmpeg([...inputs, "-filter_complex", graph, "-map", "[v]", "-map", "[a]", "-r", String(FPS),
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", out]);
    const l = loudness(out);
    console.log(`done: ${out} (${probe(out).toFixed(1)} s, ${l.I} LUFS, true peak ${l.peak} dBFS)`);
}

try { main(); } catch (error) { console.error(error.message || error); process.exit(1); }
