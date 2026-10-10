# Moment of Inertia Lab reel

A calm, 62 s, 1080×1920, 30 fps vertical explainer filmed on the **real lab page** in dark mode. Nothing is mocked up. It is built to be easy to follow:
- one short sentence on screen at a time, held for 4–6 s
- eased camera moves between nearby shots; far jumps dip briefly to dark instead of sweeping past the rest of the page, and a spotlight dims everything around the formula
- no shake, flashes or hard cuts
- the physics slowed down where it matters

```bash
node scripts/reels/inertia/build.js                        # full render
node scripts/reels/inertia/build.js --stills 2,21,34,54    # framing check at given seconds
node scripts/reels/inertia/build.js --audio-only           # rebuild soundtrack.wav only
```

| output | use |
| --- | --- |
| `scripts/reels/out/inertia-reel.mp4` | the reel with its soundtrack, loudness-normalized to -16 LUFS |
| `scripts/reels/out/inertia-reel.silent.mp4` | same picture with no audio, for platform audio or a voice-over |
| `scripts/reels/out/inertia-reel.cover.jpg` | cover frame |

## Story

| time | on screen | caption |
| --- | --- | --- |
| 0–14 s | the race: a solid disk and a thin hoop, same twist, played at half speed | “A solid disk and a thin hoop.” → “Give both the same twist.” → “The disk wins: it spins up 2× faster.” |
| 14–28 s | one ball on a light arm slides from 0.5 m to 1.0 m, and the r² square grows | “Why? Distance from the axis.” → “Move it twice as far…” → “…and it is 4× harder to spin.” |
| 28–48 s | the integral builder adds a disk cut into 32 pieces, 3 per second: close-up on the rings, then the nested Σ boxes, then the formula | “A real body is many small pieces.” → “First add the pieces around one ring.” → “Then add up all the rings.” → “A sum inside a sum = a double integral.” |
| 48–56 s | the axis slides 1 m off-center in the view along the axis | “Spin it off-center?” → “Harder again: add M·d².” |
| 56–62 s | end card with the URL | |

## Files

| file | role |
| --- | --- |
| `timeline.js` | captions, camera shots, page actions (click, relabel, builder setup), slider sweeps, slow-motion ranges and builder piece times. Numbers come from `model.js`. Run it directly to print the caption schedule. |
| `record.js` | Playwright with a paused fake clock, one screenshot per frame at 540×960 @2x. Before recording it shows the builder once, so its auto-start fires and is reset off camera. |
| `overlay.js` / `overlay.css` | injected into the page: hides everything the reel does not film, eased camera, captions, a finger on the dragged ball, and the end card |
| `music.js` | original synthesized soundtrack at 75 BPM: pads, soft bass, plucks, a click on the twist, chimes on reveals, and a rising note for every builder piece. No samples. |

If the lab's layout or ids change, run `--stills` and check the framing before a full render.
