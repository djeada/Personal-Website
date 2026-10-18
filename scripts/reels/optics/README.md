# Optics explainer reels

Nine calm, captioned, 1080×1920, 30 fps vertical explainers, three per tool. Each one is filmed on the **real tool page** in dark mode, and nothing is mocked up. The style follows the [inertia reel](../inertia/): one short sentence at a time held for 4–6 s, eased camera moves, a dip to dark for far jumps, and a spotlight on the filmed canvas.

```bash
node scripts/reels/optics/build.js --list                     # ids and caption schedules
node scripts/reels/optics/build.js --jobs 3                   # render all nine, three at a time
node scripts/reels/optics/build.js fresnel-tir em-light       # selected reels
node scripts/reels/optics/build.js go-image --stills 2,9,20   # framing check at given seconds
node scripts/reels/optics/build.js --audio-only               # rebuild the soundtracks only
```

Each reel writes three files to `scripts/reels/out/`:

| file | use |
| --- | --- |
| `<id>.mp4` | the reel with its soundtrack, loudness-normalized to -16 LUFS |
| `<id>.silent.mp4` | the same picture with no audio, for platform audio or a voice-over |
| `<id>.cover.jpg` | cover frame |

## Reels

| id | tool | length | what it explains |
| --- | --- | --- | --- |
| `go-image` | [geometric_optics](../../../src/tools/geometric_optics/) | 52 s | The object walks from 3f to inside f. The image goes from real and small, to real and large, to infinity, to virtual and upright (a magnifier). Ends on 1/sₒ + 1/sᵢ = 1/f. |
| `go-telescope` | geometric_optics | 56 s | Keplerian telescope: parallel in, parallel out, a star tilt magnified 4× and inverted. Galilean: upright view in a shorter tube. Compound microscope: 8× × 10× = 80×. |
| `go-aberrations` | geometric_optics | 52 s | A thick BK7 lens shows spherical aberration (on the bench and on the longitudinal plot) and colour splitting. A BK7/F2 achromat cuts the blue-to-red focus gap from 1.5% of f to 0.2%. |
| `em-light` | [em_waves](../../../src/tools/em_waves/) | 52 s | E and H at 90° and in step, S = E × H pulsing twice per cycle around I = ½ε₀cE₀², E/H = 377 Ω, and the wave squeezing as it enters glass. |
| `em-polarization` | em_waves | 52 s | Linear polarization and its azimuth, circular (a quarter-cycle delay, constant \|E\|, steady S), elliptical, and cinema 3D glasses. |
| `em-mirror` | em_waves | 52 s | A perfect mirror makes a standing wave: fixed nodes every λ/2, zero net flow, energy sloshing between E and H. Glass reflects 4%, and the envelope dips or peaks at the surface depending on the side. |
| `fresnel-angle` | [fresnel](../../../src/tools/fresnel/) | 52 s | 4% straight on, rising toward 100% at grazing (a lake at sunset). For p light, zero at Brewster's 56.3°, which is why glare is s-polarized. |
| `fresnel-tir` | fresnel | 52 s | Light leaving glass bends away from the normal, grazes at 41.8°, then totally reflects (fibres). The evanescent field reaches ~120 nm into the air, and an absorber there frustrates the reflection (ATR). |
| `fresnel-metal` | fresnel | 50 s | Absorption raises reflectance. A gold-like ñ = 0.20 + 3.09i reflects 93% with a 33 nm field depth. p light dips only to 0.87 at the pseudo-Brewster angle. |

Every number in a caption is computed by the same shared model the page runs (`geometricOptics.js`, `emWaves.js`, `fresnel.js`). The readout chips under the canvas copy the page's own stat fields live, frame by frame.

## Files

| file | role |
| --- | --- |
| `reels/<id>.js` | One reel: setup actions, captions, camera shots, page actions (preset clicks, selects, checkboxes), slider sweeps, the on-screen slider (`huds`) and live readout chips (`chips`). |
| `reels/common.js` | Per-tool watermark, end card and soundtrack key. `reel()` fills in defaults and refuses a timeline whose captions overlap, are up too briefly for their word count, or run into the end card. |
| `record.js` | Playwright with a paused fake clock, one screenshot per frame at 540×960 @2x. The tools' `requestAnimationFrame` loops only advance when a frame is taken, so captures are deterministic. Any page error fails the reel. |
| `overlay.js` / `overlay.css` | Injected into the page. They hide everything the reel does not film and draw the eased camera, captions, spotlight, slider HUD with a finger on the knob, readout chips and end card. |
| `music.js` | Original soundtrack synthesized at 75 BPM from [`../synth.js`](../synth.js), the primitives shared with the inertia reel. Pads, bass, plucks, a click on each preset change, a swell under each sweep, chimes on reveals. Each tool has its own key. |

If a tool's layout or ids change, run `--stills` on its reels and check the framing before a full render.
