# Outclick the Oracle promo

A 26 s, 1080×1920, 30 fps vertical edit in the black-and-white phonk "edit" style: hard cuts on the beat, punch zooms, slammed captions, flashes, grain, and a tape-stop ending. It films the **real game page**. Nothing is mocked up.

```bash
node scripts/reels/oracle/build.js                    # full render (~3.5 min)
node scripts/reels/oracle/build.js --stills 4.2,8.4   # framing check at given seconds
node scripts/reels/oracle/build.js --audio-only       # rebuild soundtrack.wav only
```

| output | use |
| --- | --- |
| `scripts/reels/out/oracle-promo.mp4` | the edit with its soundtrack, loudness-normalized to -12 LUFS |
| `scripts/reels/out/oracle-promo.silent.mp4` | same picture with no audio, for layering platform audio |

| file | role |
| --- | --- |
| `timeline.js` | beat grid (120 BPM), click times, captions, camera shots, B&W and slow-mo ranges. Replays the game with `model.js` so captions quote real numbers. |
| `record.js` | Playwright with a paused fake clock, one screenshot per frame at 540×960 @2x |
| `overlay.js` / `overlay.css` | injected into the page: camera, captions, flashes, shake, grain, end card. Steps paused CSS animations frame by frame. |
| `music.js` | original synthesized soundtrack: pitched cowbell riff, 808 with slides, clap, hats, risers, impacts, and a re-voiced game SFX layer. No samples. |

The run: six Orbit clicks to make the Oracle confident, then every click picks the symbol the live network rates least likely. It is 86% sure before move 7 and gets beaten for +93. The run ends on a 24-move escape streak and 2,058 points. If `model.js` or the brain version changes, re-run `node scripts/reels/oracle/timeline.js` and check that the captions still match.

Anton is loaded from Google Fonts for the captions. Offline, the overlay falls back to Inter Display Black.
