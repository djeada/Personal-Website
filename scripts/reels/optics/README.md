# Optics explainer reels

Seventeen calm, captioned, 1080×1920, 30 fps vertical explainers covering the first six tools of the optics learning path: three each for the first five, two for Standing Waves. Each one is filmed on the **real tool page** in dark mode, and nothing is mocked up. The style follows the [inertia reel](../inertia/): one short sentence at a time held for 4–6 s, eased camera moves, a dip to dark for far jumps, and a spotlight on the filmed canvas. The overlay uses the site's Technical Editorial look ([`docs/design-system.md`](../../../docs/design-system.md)): graphite and ice blue, IBM Plex, square shapes and 1px rules, with no gradients or glows.

```bash
node scripts/reels/optics/build.js --list                     # ids and caption schedules
node scripts/reels/optics/build.js --jobs 4                   # render all seventeen, four at a time
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
| `pol-three` | [polarization](../../../src/tools/polarization/) | 52 s | A polarizer halves unpolarized light, a second one follows Malus's cos²θ to black at 90°, a third at 45° between them lets 12.5% back through, and five in 22.5° steps pass 26.5%. |
| `pol-waveplate` | polarization | 52 s | A 17.4 µm quartz A-plate: fast and slow axes, a quarter wave of lag turns horizontal light circular, the circle squashes at 450 nm (0.35 wave), and a half-wave plate turns the light by twice its own angle with no loss. |
| `pol-sphere` | polarization | 52 s | The Poincaré sphere as a map: linear on the equator, circular at the poles, ellipses between, a quarter-wave plate as a rotation to a pole, and partly polarized light inside down to unpolarized at the centre. Field ellipse and sphere side by side. |
| `int-cancel` | [interference](../../../src/tools/interference/) | 52 s | Two equal waves in step give 4 I₁, half a cycle apart 0, a quarter cycle 2 I₁ (phasors). A half-strength wave cannot cancel (0.25 I₁, V = 0.8), which is why anti-reflection coatings match their two reflections. |
| `int-coherence` | interference | 52 s | Drifting phase swings the detector 4 → 0. Coherence |γ₁₂| → 0 flattens it to I₁ + I₂ (why lamps make no fringes); crossed polarizations do the same (Fresnel–Arago); an analyser at 45° brings V = 1 back. |
| `int-beats` | interference | 52 s | Two colours beat; closer colours beat slower (11 → 21 periods). Visible light beats at tens of THz, so a detector averaging two beat periods reads a steady I₁ + I₂. Lasers MHz apart beat slowly enough to count (heterodyne). |
| `sw-swr` | [standing_waves](../../../src/tools/standing_waves/) | 52 s | |r| from 0 to 1 on one reflector: a flat travelling-wave envelope (SWR 1), a ripple (SWR 3), nodes at zero (SWR ∞). The phase of r slides the nodes by λ/4. SWR 1.5 means |r| = 0.2, how antennas are matched. |
| `sw-cavity` | standing_waves | 52 s | Two mirrors 1.5 µm apart allow m half-waves (m × 99.93 THz), a comb whose teeth sharpen with mirror reflectance. A magnetic (PMC) mirror allows only odd quarter-waves (50, 150, 250, 350 THz), like a clarinet. |

Every number in a caption is computed by the same shared model the page runs (`geometricOptics.js`, `emWaves.js`, `fresnel.js`, `polarization.js`, `interference.js`, `standingWaves.js`). The readout chips under the canvas copy the page's own stat fields live, frame by frame.

## Files

| file | role |
| --- | --- |
| `reels/<id>.js` | One reel: setup actions, captions, camera shots, page actions (preset clicks, selects, checkboxes), slider sweeps, the on-screen slider (`huds`) and live readout chips (`chips`). A shot with `fit: <gutter px>` caps its zoom so the whole target width stays in frame. A chip reads a stat field (`source`), the value beside a readout label (`row`), or a regex group of either (`pick`). `css` hides or rearranges the panels a reel does not film. |
| `reels/common.js` | Per-tool watermark, end card and soundtrack key. `reel()` fills in defaults and refuses a timeline whose captions overlap, are up too briefly for their word count, or run into the end card. |
| `record.js` | Playwright with a paused fake clock, one screenshot per frame at 540×960 @2x. The tools' `requestAnimationFrame` loops only advance when a frame is taken, so captures are deterministic. Any page error fails the reel. Only local pages and the site's Google webfonts load. |
| `overlay.js` / `overlay.css` | Injected into the page. They hide everything the reel does not film and draw the eased camera, captions, spotlight, slider HUD with a finger on the knob, readout chips and end card. Tool pages zero `border-radius`, `box-shadow` and `text-shadow` on every element, so the spotlight dims with an `outline`, and focus calls never scroll the page under the camera. |
| `music.js` | Original soundtrack synthesized at 75 BPM from [`../synth.js`](../synth.js), the primitives shared with the inertia reel. Pads, bass, plucks, a click on each preset change, a swell under each sweep, chimes on reveals. Each tool has its own key. |

If a tool's layout or ids change, run `--stills` on its reels and check the framing before a full render.
