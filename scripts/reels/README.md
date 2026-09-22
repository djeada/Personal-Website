# Reel pipeline

Turns the site's four visualizers into vertical short-form videos: 1080×1920,
H.264, 30fps, ~5–11s, with a synthesized SFX bed.

| tool | what it films |
| --- | --- |
| [data_structures](../../src/tools/data_structures/) | 12 structures × 4 operations |
| [sorting](../../src/tools/sorting/) | bubble, selection, insertion, merge, quick, heap, radix |
| [searching](../../src/tools/searching/) | linear, binary, jump, interpolation |
| [graphs](../../src/tools/graphs/) | DFS, BFS, Dijkstra, A\* on a grid maze |

```bash
npm run reels                      # every scene
npm run reels -- bst-search        # one scene
npm run reels -- --list            # scene ids and hooks
npm run reels -- --frames-only     # stills only, no ffmpeg
npm run reels -- --theme light     # record on the light theme
```

Outputs land in `out/` (gitignored), two files per scene:

| file | use |
| --- | --- |
| `<id>.silent.mp4` | post this and add trending platform audio in-app |
| `<id>.mp4` | same cut with the SFX bed baked in |

Reach on Reels/TikTok is tied to trending audio, so the silent cut is usually the
one to post. The muxed cut is for places where the file has to stand alone.

Requires `ffmpeg` (with `libx264` and `aac`) and the repo's Playwright install. A
static server for `src/` is started automatically unless port 8000 is already
answering.

## LeetCode coverage

The scene set targets the standard top-20 interview pattern list. What the site can
visualize today:

| # | Pattern | Scene |
| --- | --- | --- |
| 1 | Arrays & Hashing | `hash-o1`, `linear-vs-hash` |
| 4 | Binary Search | `binary-search` |
| 5 | Stack | *(lab covers it; no scene yet)* |
| 6 | Linked List | *(lab covers it; no scene yet)* |
| 7 | Tree DFS / BFS | `bst-search`, `dfs-maze`, `bfs-maze` |
| 8 | Binary Search Tree | `bst-search` |
| 9 | Heap / Priority Queue | `heap-priority` |
| 10 | Trie | `trie-autocomplete` |
| 12 | Graph DFS / BFS | `bfs-frontier`, `bfs-maze`, `dfs-maze` |
| 15 | Shortest Path | `dijkstra-maze` |
| — | Sorting algorithms | `quicksort`, `merge-sort`, `bubble-sort` |

**Not covered, because nothing on the site visualizes them yet:** two pointers,
sliding window, backtracking, topological sort, union-find, 1-D DP, 2-D DP, greedy,
intervals, bit manipulation. Those need new visualizers before they can be filmed —
the recorder only drives what already exists.

## How it works

```
scenes.js ──▶ render.js ──▶ frames/<id>/*.png + timeline.json
              adapters.js          │
                                   ├──▶ audio.js   ──▶ sfx.wav
                                   └──▶ compose.js ──▶ out/<id>.mp4, out/<id>.silent.mp4
                                                 │
                                                 └──▶ verify.js (gate)
```

`render.js` drives the real tool pages rather than re-implementing any
visualization, so the reels can never drift from what the site actually shows.

[`adapters.js`](./adapters.js) holds what differs per tool. There are two drive
models:

- **`clock`** — the Data Structure Lab animates on its own timers and has no "one
  more step" control, so the mocked clock is paused and ticked forward until the
  rendered state changes.
- **`step`** — sorting, searching and graphs are built on a credit-based engine that
  blocks in a checkpoint until `#step` hands it a credit. The recorder clicks that
  button and lets real time run, which is simpler and more exact than simulating
  their timers.

Three more decisions shape the rest:

**One frame per visual state, not per wall-clock frame.** Playwright's clock is
mocked and paused, then advanced in 40 ms ticks. Whenever the page's state
signature changes — status text, comparison bubble, and every node's class list —
that settled frame is written out with the duration it should hold. The concat
demuxer expands those stills into constant-framerate video. A 9s reel costs ~12
screenshots instead of ~270, and no frame is ever captured mid-transition.

**CSS transitions are disabled during capture.** A mocked timer cannot drive a
wall-clock CSS transition, so tweening would tear across frames. Motion comes from
the state changes themselves plus the lab's static `scale()` on the focused node —
which also happens to be the punchy, hard-cut pacing short-form wants.

**The controls are driven in-page.** `capture.css` hides the host page, which makes
Playwright's actionability checks refuse to touch the hidden inputs. The adapters
instead set values and dispatch the events each tool listens for.

**The host page is hidden wholesale, not selector by selector.** `body > *` is hidden
and `#reel-root` exempted by id; since the stage is lifted into the shell, the same
skin sits on four tools that share no markup.

## Adding a scene

Append to `SCENES` in [`scenes.js`](./scenes.js):

```js
{
    id: "queue-fifo",
    kicker: "Queue",
    hook: ["Why a printer", "never <em>jumps the line</em>."],
    structure: "queue",
    dataset: ["A", "B", "C", "D", "E"],
    steps: [
        { title: "Take the next job", op: "special", caption: "Front out, back in. Nothing else moves." }
    ],
    outro: ["One pointer.", "<em>O(1) forever.</em>"]
}
```

`<em>` is the accent colour, `<b>` is the highlight inside a caption; everything
else is escaped. A step may override `structure` and `dataset` to switch mid-reel,
which is how `linear-vs-hash` puts an array and a hash table in the same video.

Keep datasets to **5–8 items**. Node size comes from the stage width, so a 7-item
structure fills a phone screen and a 15-item one is unreadable at arm's length.

A scene for one of the canvas tools looks different — it has no `steps`, because the
tool's own engine decides how many there are:

```js
{
    id: "heap-sort",
    tool: "sorting",
    kicker: "Heap sort",
    hook: ["Sorting with", "a <em>priority queue</em>."],
    title: "Build a heap, then drain it",
    caption: "The largest value is always one swap from its final slot.",
    growth: "O(n log n)",
    config: { algorithm: "heap", values: [38, 7, 91, 24, 55, 3, 70, 16] },
    maxBeats: 44,     // hard cap on captured frames
    stride: 1,        // capture every Nth checkpoint
    requireDone: true,
    outro: ["No extra array.", "<em>Sorted in place.</em>"]
}
```

`requireDone` matters for the maze scenes: the graphs tool regenerates its grid
randomly on reset, so a run can end with no reachable goal — a reel with no payoff.
The recorder re-rolls up to three times rather than shipping one. Keep grids around
15×15; larger ones blow the beat budget before the frontier reaches the goal.

## Pacing and audio

Beat durations live in `HOLD` in [`render.js`](./render.js): hook 1.5s, operation
title 0.62s, each comparison 0.3s, result 1.15s, outro 1.5s.

[`audio.js`](./audio.js) builds the bed from ffmpeg oscillators only — no sample
library, nothing licensed. Comparison steps walk up a minor pentatonic scale, so a
six-slot linear scan *sounds* expensive next to a one-probe hash lookup. Levels are
tuned to sit roughly 20 dB below peak so the bed survives being layered under
platform music; `verify.js` fails the build if the result clips or goes silent.

To add narration, render the reel, record over the silent cut, and mix externally —
there is no TTS dependency here on purpose.

## Verification

`verify.js` gates every scene on: all frames present and non-trivial, positive beat
durations, 1080×1920 / h264 / yuv420p / 30fps, video length within 0.2s of the
timeline, an audio stream in the muxed cut and none in the silent cut, and an SFX
peak that is neither clipping nor effectively silent. A failure exits non-zero and
names the scene.

## Coupling to the lab

`driveLab()` seeds datasets by assigning the lab's top-level `state` and calling
`render()`. That works because the lab is a classic script, and it fails loudly
with a pointer to this file if those bindings ever go away. `capture.css` also
targets the lab's class names. Both are checked by the normal
`tests/data-structures.spec.js` run indirectly — if the lab's structure changes,
build one scene and look at the frames.
