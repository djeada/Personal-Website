# Graphs for LeetCode: section renderer

Renders each section of the long-form course ([PLAN.md](./PLAN.md)) as a 1920×1080, 30 fps, H.264 + AAC video, filmed on the real tool pages ([graphs](../../../src/tools/graphs/) and [data_structures](../../../src/tools/data_structures/)). It reuses the optics approach ([`../optics/`](../optics/)): Playwright with a paused fake clock, an injected overlay that draws the camera moves, spotlight, captions and cards, the shared synth ([`../synth.js`](../synth.js)) for the music, and ffmpeg to put it together. The look is the site's Technical Editorial dark theme ([`docs/design-system.md`](../../../docs/design-system.md)).

```bash
node scripts/reels/graphs_course/build.js 01 --list                  # beat timings only (synthesizes missing voice); any of 01 to 08
node scripts/reels/graphs_course/build.js 01 --stills 10,52,120      # framing check stills at these seconds
node scripts/reels/graphs_course/build.js 01                         # full render
node scripts/reels/graphs_course/build.js 01 --voice ~/rec/01-reading-graph-problems.wav
node scripts/reels/graphs_course/build.js 01 --audio-only            # remix the soundtrack onto the last frames
node scripts/reels/graphs_course/build.js 01 --no-next               # no "Next: Part 2" end card
node scripts/reels/graphs_course/reel.js 01                          # vertical reel -> reel-01.mp4 (see "Reels")
node scripts/reels/graphs_course/join.js                             # the full video + chapters.txt (see "The full video")
node scripts/reels/graphs_course/preview.js words fix                # stills of overlay cards, no section needed
```

Section 1 with the owner's take: `node scripts/reels/graphs_course/build.js 01 --voice scripts/reels/graphs_course/voice/01-reading-graph-problems.mp3 --silence-min 2` (the take has long breaths inside beats, so only pauses of 2 s or more split it).

| flag | effect |
| --- | --- |
| `--voice <wav>` | use a recorded take (WAV or MP3) instead of the Kokoro scratch voice (see below) |
| `--no-next` | leave out the 3 s "Next: Part N" end card; the section ends on a 1.6 s fade to dark instead |
| `--gap <s>` | seconds of picture between one beat's last word and the next beat's first (0.45 s before the voice, the rest after). Default 1.25 s, tightened automatically if needed (below) |
| `--no-music` | voice only |
| `--no-captions` | no lower-third subtitles in the picture (the `.srt` is still written) |
| `--tts-voice <id>` | Kokoro voice, default `bm_george` (`am_michael` also works) |
| `--tts-speed <x>` | Kokoro speaking rate, default 1 |
| `--silence-min <s>`, `--silence-db <dB>` | how a recorded take is cut into beats, default 0.8 s at -38 dB |
| `--port <n>` | first port to try for the local server, default 8123 |

All eight sections are defined (`sections/01.js` to `08.js`). Outputs go to `scripts/reels/out/graphs-course/` (gitignored): `section-0N.mp4`, `section-0N.srt`, `section-0N.cover.jpg` and `section-0N.json` (timing for `join.js`).

**Five minutes at most.** Without `--gap`, a section that would run past 4:59 gets a tighter gap between beats, evenly across all of them, down to 0.75 s; `--list` prints the gap used. The voice itself is never cut or sped up. Section 1 with the owner's take is 5:03 at the default gap and 4:59 at 0.83 s; without the end card the gap can stay at about 1.0 s. Sections can render in parallel; give each its own `--port`. Working files (frames, voice cache, the mix) are in `scripts/reels/frames/graphs-course/`.

The build serves this checkout's `src/` itself, on 8123 or the next free port, so it never films another checkout that happens to be on :8000. A full render of section 1 takes about five minutes: unchanged frames are not re-captured, only held longer.

## Narration

Each section script (`scripts/NN-*.md`) is split into `## Beat N` blocks. In a beat, the `On screen ...` line, bullet lines and code fences are on-screen material; every other paragraph is narration, which is spoken and captioned. The sections reuse the material too: section 1's problem cards come from beat 1's bullets, its code panel from beat 4's code fence and its labels from beat 10's quoted strings, so editing the script edits the video.

**Scratch voice.** By default each beat's narration is synthesized with Kokoro ([`tts.py`](./tts.py), run with `~/.local/share/soi-tts/bin/python -I`, offline). Clips are cached by a hash of voice + speed + text in `frames/graphs-course/voice-cache/`, so changing one beat only re-synthesizes that beat. `bm_george` is the default because it says "LeetCode" correctly; `am_michael` says "Leat code". Both transcribe cleanly with Whisper.

**Recorded voice.** Record one file per section, reading each beat as one take with about a second of silence between beats (PLAN.md has the details). `--voice` finds those pauses with ffmpeg `silencedetect` and cuts the file into exactly as many clips as the script has beats. If the count is wrong it stops and lists every pause it found, with times. Usually a long breath inside a beat (raise `--silence-min`) or a quiet room tone (raise `--silence-db`, for example `-32`). Each beat then lasts as long as its speech, plus 0.45 s before and 0.8 s after. Everything placed by word or fraction moves with it, so no shot needs retiming for a new take.

Word times are estimated by spreading each beat's speech span over its words in proportion to their length, with a little extra after commas and full stops. That is good to a few tenths of a second, which is enough for cards and captions. If a cue lands visibly early or late, nudge it with `offset`.

**Captions** show one sentence at a time. A sentence too long for two lines (over 96 characters) is split at the comma nearest its middle. The same chunks are written to the `.srt`.

## Audio

The voice is levelled to -18 LUFS. The music bed ([`music.js`](./music.js): pads, soft bass and sparse plucks at 68 BPM in D, no drums, a faint pluck when a card appears) sits about 17 dB below the voice and is ducked a few dB further by a sidechain compressor keyed on the speech. The final mix is two-pass loudness-normalized to -16 LUFS with a -1.5 dBTP ceiling. The bed plays louder under the title card and the "Next" card at the end.

## How a section is defined

`sections/NN.js` exports the script file name and `build(beats)`, which returns:

```js
{
    part: 1, title: "Reading a graph problem", next: "Part 2 · Breadth-first search",
    pages: {                       // every tool page the section films, opened once up front
        lab:  { path: "/tools/data_structures/", setup: [{ act: "run", fn: labSelect, args: ["graph"] }] },
        maze: { path: "/tools/graphs/?algo=bfs&size=16&density=30&seed=2&speed=10", css: "...", measure: [...] }
    },
    beats: [ /* one object per "## Beat N", in order */ ]
}
```

A beat:

| key | meaning |
| --- | --- |
| `page` | which page is on camera; switching pages dips to dark |
| `veil` | how much the page is dimmed under cards (0 to 1); `veils: [{ at, level }]` changes it mid-beat |
| `shots` | `{ at, target, box, spot, pad, dim, maxZoom, dip, page, union, margin, hold }`: `page` films another of the section's pages from that moment (a cut through dark); `union: true` frames every element `target` matches (a graph's nodes rather than its padded canvas), with `margin` px around them; `hold: true` keeps the shot's first framing while the target changes size (a tall tree flattened by path compression). Otherwise the camera fits the element matched by `target` (a CSS selector) into `box` (`[x0, y0, x1, y1]` as fractions of the frame), and the spotlight dims everything outside `spot` (default the target, `false` for none) to `dim` (default 0.93; 1 hides it). Shots on the same page glide; `dip: true` cuts through dark instead. |
| `actions` | `{ at, act, ... }` on the beat's page: `click` / `set` with a `target` selector, or `run` with a page-side function `fn` and `args` ([`pages.js`](./pages.js) has the lab helpers). `count` with `until` repeats the action evenly from `at` to `until` (stepping a search); `unless` is a page expression that skips it, such as "the search is done", so an extra Step click never restarts a finished search. |
| `cards` | overlay cards, below |
| `hides` | `{ selector, until }`: page elements kept invisible until a moment, then faded in (beat 3's vertices and edges) |
| `marks` | `{ selector, from, to, tone }`: a class on page elements for a window. Tones: `hit` (accent ring on a node, the default), `warn` (ember ring), `edge` (a lit graph edge), `row` (a lit adjacency-list row) and `plain` (an edge drawn plain, which holds back a tool highlight until its moment, such as the lab's cycle edge in part 3) |
| `chips` | live readouts beside the shot (`place: "bottom"` for wide rows under it), copied from the page every frame: `source` selector with optional `attr`, `match` (the first matching element's text, such as one line of the lab's trace) and `pick` (a regex group). `value` is fixed text, `measured` a value read during setup (below), and an item's own `from` fades it in later. |
| `rates` | `{ from, to, measure }`: run the page clock so that a measured run (see `measure`) exactly fills this window |
| `lead`, `tail`, `minDuration` | per-beat padding overrides, in seconds |

**Times** inside a beat can be a fraction of the beat (`0.4`), a word or phrase from its narration (`"prices"`), `{ word, nth, pick, offset }` (`pick` is the index of a word inside the phrase), `{ s: 2 }` or `{ s: -1 }` (seconds after the start, or before the end), or `{ beat: 5, at: ... }` for a time in another beat, which lets a card run across beats.

**Cards** (`{ id, type, from, to, place, ... }`), drawn by [`overlay.js`](./overlay.js) and [`overlay.css`](./overlay.css):

| type | fields |
| --- | --- |
| `problems` | `items: [{ tag, title, text, keys }]` in a row (one item is centred, `place: "right"` puts it right). `show`: one time per item. `marks: [{ item, key, at }]` lights up `keys[key]`. `labels: [{ item, text, at }]` adds a tag under a card. |
| `code` | `lines`, `title`, `lang`. `typing`: one `{ from, to }`, or one per line. `highlights: [{ line, at, until }]`. `pairs: { label, items }` with `steps` (one time each) is a strip of input pairs where the current one is lit. `labels: [{ text, at }]` adds tags under the code. The card sizes itself to its longest line. |
| `checklist` | `title`, `items`, `show` (`null` keeps a line hidden), `active: [{ item, at }]`. Lines appear one by one. `place: "side"` (beside a tool shot), `"left-low"` (under a code card) or `"center"` (a recap). |
| `compare` | `columns: [{ title, items, at }]`, two side by side, each appearing at its time |
| `constraints` | `lines: [{ text, note }]`, `show`, `notes` (when each note appears) |
| `words` | Alien Dictionary: `tag`, `title`, `text`, `words`. `arrows: [{ at }]`, one per neighboring pair: the first letters that differ light up (the shared prefix dims) and the edge `t → f` appears beside the pair. `footer: { text, at }` (the letter order). |
| `fix` | a bug and its fix: `title`, `wrong: { text, at }` (struck through at `at`), `right: { text, at }`, `note: { text, at }`. Code is tinted like the code panel. `place: "low"` sits under a `compare` card placed `"high"`. |
| `deque` | 0-1 BFS: `heading`, starting `items`, `ops: [{ at, op: "front" \| "back" \| "pop", value, cost }]`. Cells slide in at either end, a pop slides out of the front, and the rule that applied (`rules`, three lines by default) lights up. |
| `big` | a statement in large type: `lines: [{ text, at }]` stacked with arrows; a line with `count: N` counts `{n}` in its text up to N (with thousands separators). `note: { text, at }`. |
| `sheet` | phrase → answer rows that build one by one: `rows: [{ text: "phrase → answer", at }]` (or `phrase` and `answer`), optional `kicker`, `heading`, `title` and `questions: { items, at }` (a strip above the table, the four questions of part 1). The newest row is lit (`focus: false` turns that off). `place: "side"` is a narrow column beside a tool shot and `limit: N` keeps only the newest N rows there, so the cheat sheet can build over clips; `"low"` sits under a problem card. Also used for the NP-complete card (part 7) and email ids (part 5). |
| `title`, `next` | added automatically: the section title over a dark frame before beat 1, and the next part after the last beat (`--no-next` drops it). A section with `closing: { title, url, small, hold }` ends on that card instead (part 8's link to the notes); it is kept with `--no-next`. |

Extensions to the cards above, used by parts 4 to 8: a `problems` item can have any number of `labels` (they stack under it, part 5's "fewer than n - 1 cables → -1" and "otherwise → components - 1"); a `compare` column can have a `tag` (a problem number, which also shrinks the title), a `sample` input in mono (a string or lines) and `notes: [{ text, at }]` (part 7's "n + 1 slots", "add both directions"); `place: "high"` lifts a compare card to make room for a `fix` card under it.

`preview.js` renders every one of these at 1920×1080 with the text the scripts for parts 4 to 8 ask for (`frames/graphs-course/preview/`), which doubles as a reference for their fields. Name cards to render only those (`words`, `shapes`, `bug`, `deque`, `dense`, `sheetSide`, `sheet`, `np`, `ids`, `cables`, `closing`).

Plex's Latin subset has no `→`, `≤` or superscript digits, so the overlay draws `→` and `≤` as SVG masks and turns `⁵` and friends into `<sup>`. Words joined by an en dash (Bellman–Ford) never break across lines.

**Framing is by selector**, never by pixel boxes on the page, so small layout changes in the tools are absorbed. The selectors section 1 relies on are `.graph-canvas`, `#visual-stage`, `.control-card:has(#model-view)` (the lab's adjacency list) and `.graph-node[data-value="X"]` in the lab, and `#maze-canvas` with its `data-state`, `data-visited` and `data-path-length` in the graphs tool. After a tool changes, run `--stills` at a few seconds per beat and look before a full render.

### Recorder details

- The viewport is 1280×720 CSS px at device scale 1.5, so screenshots are 1920×1080 and the tools lay out as on a desktop.
- Every page in `pages` is opened before frame 0 with its own paused clock. Only the page on camera advances, by 1/30 s per frame (or faster or slower in a `rates` window), so an off-camera page waits exactly where it was left.
- CSS transitions and animations inside the page are switched off: a paused clock cannot drive them, and they would tear. Motion comes from state changes and from the overlay's eased camera and fades.
- `scrollIntoView` and focus scrolling are disabled, so the tools cannot move the page under the camera.
- `measure` runs a page action off the record (for example, BFS to the end), counts how much page time it took, checks the result (`check`, such as "a path was found"), optionally keeps a value (`read`, a page expression), and resets. Section 3 opens a BFS page it never films, just to read the BFS path length it shows beside DFS's. Beat 6 uses it to stretch the BFS so the path lands on "like this". A seed with no path fails the build here, not in the finished video.
- A page error fails the build.
- The frame signature is a hash of the page DOM plus a count of canvas draw calls. A new screenshot is taken only when it changes, and ffmpeg's concat demuxer holds each still for the right number of frames.

## Sections 2 and 3

Both are defined and render like section 1. Their shot lists follow the "On screen" lines, with these choices:

- Every maze is the course maze from `pages.js` (`MAZE_PARAMS`: 15×15, 25% walls, seed 7), so parts 1, 2 and 3 search the same grid (BFS path 28, DFS path 48). Each configuration is its own page, set by URL (`algo`, `distances=1`, `sources=0,0;7,7;14,3`). Islands mode is pinned with `seed=4192` (12×12 at 55%), otherwise each render would get a random grid.
- Runs that should end on a word (BFS in part 2 beat 1, DFS in part 3 beat 1, the islands scan across part 3 beats 5–6) are paced with `measure` + `rates`. Stepped shots click `#step-level` (BFS rings, multi-source levels) or `#step` (single dequeues, DFS) at set times, guarded by `unless: DONE`. Part 3 beat 2 is timed so the first DFS dead ends (steps 36 to 47) land on "Watch it run into a dead end".
- The lab's traversal order comes from its own trace list (`#trace-list li`, picked by regex into chips), and the cycle in part 3 beat 8 is the lab's own `is-cycle-edge` highlight plus its trace note.

## Sections 4 to 8

Built on the tools that landed for Phase B. Each beat follows its "On screen" line; the cards are the types above.

- **Network mode** (parts 4, 6, 7, 8): one page per preset, `pages.js` `net("preset=…")`, framed on `#network-container` (graph, data panel and the one-line trace) with `NET`. Frames are precomputed, so `netStep(1)` at a word (or `count` of them between two words, guarded by `NET_DONE`) always lands on the same picture, and `steps=N` in the URL opens a page part-way (part 6's copy-off flights open at pass 2, `steps=6`). The step numbers each beat relies on are listed at the top of its section file.
- **Disjoint Set** (part 5): `?structure=dsu&preset=redundant|tall`, framed on `.dsu-view`; `dsuStep(1)` shows one animation frame and `dsuRun(n)` applies n queued edges at once (beat 6 merges 1-2, 2-3, 3-4 on their words, then steps 1-4 frame by frame to the answer). `DSU_CSS` hides the preset and step buttons, which the recorder never uses, and lifts the lab's 78vh cap on its stage: at the recorder's 720 px viewport that cap scrolled the tall preset's deepest node (5, where find starts) out of view. Beat 4's shot uses `hold: true`, so the camera does not re-zoom when compression flattens the tree.
- **Mud grid** (part 6 beat 1): BFS and Dijkstra on `size=15&density=25&mud=20&seed=82`, each run paced by `measure` + `rates`; the BFS steps and cost (28 and 56) are measured during setup and shown beside Dijkstra's live 36 and 36. Part 6 beat 5 uses the `deque` card rather than the grid's 0-1 BFS strip: the script asks for a card, and the tool's 0-1 BFS breaks walls, a different setup from "0-cost to the front, 1-cost to the back".
- **Cheat sheet** (part 8 beats 7 and 8): one `sheet` card placed `side` with `limit: 5` runs across both beats, a row per phrase, while the shot cuts to a clip of each row's tool (lab graph, multi-source BFS, islands, Kahn, the redundant edge, Dijkstra in the mud, Bellman–Ford, Floyd–Warshall, the 2-colored square, the spanning tree). Clip runs are paced to end just before the next cut. Beat 9 is the whole table under the four questions, and the section ends on its `closing` card with the notes' address instead of a "Next" card.

| part | scratch length | pages |
| --- | --- | --- |
| 4 · Topological sort | 3:44.8 | course-schedule (build=1, plain, cycle), diamond (colors=2, three colors, plus D→A) |
| 5 · Union-Find | 3:44.5 | Disjoint Set: redundant (twice), tall |
| 6 · Weighted shortest paths | 4:12.9 | mud grid (BFS, Dijkstra), network-delay, cheapest-flights (copy on, copy off from pass 2), floyd |
| 7 · Bipartite graphs and coloring | 3:27.1 | square, triangle, two-piece, flowers |
| 8 · Minimum spanning trees and the cheat sheet | 3:29.1 | mst (finished, Kruskal, Prim) and ten clip pages |

## Reels

`reel.js NN` renders `reels/NN.js` as a 1080×1920 reel in the optics-reel style ([`../optics/`](../optics/)): a caption band on top with one short sentence at a time (two lines, an accent word, a mono sub line), the filmed tool in the middle, readout chips and the watermark in the foot, and a 6 s end card. The film window runs from the caption band to just above the chips (to the watermark when a clip has no chips), the foot band starts where the current shot's window ends, and sentences inside a clip follow each other without a gap (a quick swap rather than a fade through an empty band). There is no voice: the soundtrack is the course's music bed at full level, loudness-normalized to -16 LUFS. Each reel writes `reel-NN.mp4`, `reel-NN.silent.mp4` (for platform audio) and `reel-NN.cover.jpg`. `--list` prints the caption schedule; `--stills 3,20` checks framing.

A reel is a list of clips, and each clip replays one beat of a section: its page (with the same URL, setup and `measure`), shot targets, spotlight, actions, marks, hides and chips. In the reel the tools lay out as on a phone (540 CSS px wide at 2x), and every shot box becomes the film window between the bands. A clip has:

| key | meaning |
| --- | --- |
| `section`, `beat` | the beat it replays (a beat that keeps the previous beat's camera reuses the section's last shot on its page) |
| `length` | seconds; the beat's word cues are spread over it (or over `narration: [from, to]` seconds into the clip) |
| `override` | replaces parts of the beat's spec, usually `actions`, `rates`, `marks` or `chips` re-timed with `{ s: 2 }` so a run lands on its caption |
| `chips: false`, `box`, `veil` | drop the readouts, use another film box, dim the page |
| `frame` | shot fields applied to every shot of the clip, for a tighter target on a phone layout: the lab graph's nodes (`{ target: ".graph-node", union: true, margin: 34 }`), network mode's canvas and panel, the Disjoint Set view. `reel.css` also hides the Disjoint Set's buttons, edge queue and legend in reels (its answer shows in its stats). |
| `captions` | `[{ lines: ["…", "…"], sub }]`, HTML with `<em>` (accent) and `<b>` (ember). They share the clip evenly unless they give `at` / `for` (seconds into the clip). `{name}` inserts a value measured during setup, so reel 3's "48 steps, where BFS needs 28" comes from the runs. |

Every event is kept inside its clip (windows are clamped, later actions dropped), each clip after the first opens through dark, and section cards are left out (they are laid out for 16:9). `pages: [["03", "bfsRef"]]` opens a page no clip films, for its measured values. As in the optics reels, a caption must stay up at least 1.2 s + 0.32 s per word (3 s minimum), captions must not overlap, and none may run into the end card; the build fails otherwise.

| reel | length | clips |
| --- | --- | --- |
| 1 · Four words that pick your algorithm | 50.5 s | part 1 beats 3 (directed), 6 (weighted), 8 (connected), 7 (tree) |
| 2 · Why BFS finds the shortest path | 48 s | part 2 beats 1 (the maze), 2 (rings), 4 (the queue), 1 (the run) |
| 3 · DFS found a path. Not the shortest one. | 42.5 s | part 3 beats 1 (DFS), 2 (backtracking), part 2 beat 1 (BFS) |
| 4 · Course Schedule in 40 seconds | 41 s | part 4 beats 2 (indegrees, the queue), 3 (Kahn), 5 (the cycle) |
| 5 · The edge that closes a cycle | 41 s | part 5 beats 2 (five roots), 3 (three unions), 6 (1-4 is the answer) |
| 6 · BFS ignores the mud | 37 s | part 6 beat 1 three times: BFS through the mud, Dijkstra around it, the verdict |
| 7 · Why a triangle can't be two-colored | 42 s | part 7 beats 2 (square), 3 (triangle), 5 (two pieces) |
| 8 · Six phrases, six algorithms | 52 s | part 2 beat 1, part 3 beat 5, part 4 beat 3, part 5 beat 6, part 6 beat 1, part 7 beat 2 |

## The full video

`join.js` joins every `section-NN.mp4` that exists, in order, into `graphs-for-leetcode.mp4`, and writes `chapters.txt` (YouTube chapters, `0:00 Part 1 · Reading a graph problem`, one line per section start). Each section already opens on its own title card, which is the card at each boundary. A section rendered with its "Next: Part N" card is cut where that card would appear, with a 0.6 s fade, so it is not repeated before the next part's title; one rendered with `--no-next` is used whole. `--chapters-only` writes the chapters without encoding. Re-render any section whose `section-NN.json` is missing. Joining sections 1 to 3 (12:30) takes about two minutes.

## Adding later sections

1. Put the script in `scripts/`, then create `sections/NN.js` exporting `{ script, build }` with one entry per beat. Start every beat with only `page` and one `shot`, render `--stills`, then add cards and actions.
2. Prefer URL parameters over driving controls. The graphs tool's are listed at the top of `src/tools/graphs/app.js`, and its finished signal is `#maze-canvas[data-state="done"]`. `data-visited`, `data-path-length`, `data-level` and `data-islands` make good chips.
3. When a run needs to end on a word, use `measure` + `rates`. When it needs to land visibly step by step, use timed `#step` / `#step-level` clicks. Pin every random input (seed) in the URL.
4. Lab helpers live in `pages.js` (`labSelect`, `labGraph`, `labOp`, `labTraversal`). `labOp` cancels a running animation first, because the lab disables Run while it animates. Use the lab's `#animation-speed` (850 / 500 / 260 ms) when two operations follow each other quickly.
5. Several pages can be open in one section, and a page switch dips to dark automatically. Pages that are never on camera can still be measured.

## Known limits

- Kokoro reads faster than a person, about 165 words per minute, so the sections run 3:47 to 3:55 with the scratch voice. The owner's take of section 1 has 4:44 of speech, more than the plan's 4:30 for the whole section, which is why the gap tightens to fit five minutes. Beats stretch to whatever the take needs.
- The lab dims every vertex a traversal has not reached yet while it animates (`.visual-stage.is-playing .selectable`). It was 28%, which made node C in part 3 beat 8 look dead; the lab now uses 55%, and C reads as "not visited yet".
- Network mode's container (graph, data panel, trace line) is about 974×760 CSS px, so in a 16:9 frame it is limited by height and fills about two thirds of the width.
- On a phone-width page (the reels), the Disjoint Set's `ra` and `rb` tags overlap the "size" label of the neighboring root while two adjacent roots are compared.
- The lab's "step N of M" status and "Inspecting X" bubble sit above the graph, where graph shots cropped them in half; `LAB_CSS` in `pages.js` hides them (visibility only, so the layout does not move).
- Word timing is an estimate, not a forced alignment. Checked against Whisper word timestamps on section 1's scratch voice, cue words land within 0.3 s, at worst 0.9 s. A recorded take with uneven pacing inside a beat will drift more; nudge with `offset`, or add forced alignment later (faster-whisper with `word_timestamps`).
- The lab's graph helpers (`labGraph`, `labOp` in `pages.js`) reach into the lab's top-level `state`, `render`, `setHighlight` and `cancelAnimation`, and its `#value-input`, `#secondary-input`, `[data-operation]` and `#execute-operation` controls. If those are renamed, `labGraph` throws with a pointer to `pages.js`.
