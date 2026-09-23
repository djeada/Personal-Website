# TODO: university-level optics visualization suite

Audit date: 2026-09-21. This is an implementation backlog; unchecked items are proposed work, not completed features.

Progress (2026-09-23): M0 P0 repairs landed for all seven tools. Pure models live in `src/tools/shared/optics/` with numerical regressions in `tests/optics/` (`npm run test:optics`).

## Goal and scope

Turn the seven existing optics demonstrations into quantitative learning tools, then fill the gaps needed for an undergraduate optics course and an advanced undergraduate photonics course. Students should be able to predict an outcome, change an experiment, measure the result, and explain discrepancies using the stated model and its limits.

The current collection covers selected wave phenomena, but does not yet provide a complete university curriculum. Geometrical optics, imaging, Fourier optics, coherence experiments, Gaussian beams, passive resonators, optical materials, and guided waves need substantial additions. Use [MIT 2.71 Optics](https://ocw.mit.edu/courses/2-71-optics-spring-2014/pages/lecture-notes/) as a classical-optics coverage reference. Use [MIT Fundamentals of Photonics](https://ocw.mit.edu/courses/6-974-fundamentals-of-photonics-quantum-electronics-spring-2006/pages/lecture-notes/) to guide the beams, resonators, waveguides, and laser extensions. The implementation designs below are proposals for this repository, not requirements imposed by those courses.

Priority definitions:

- **P0 — correctness:** fix results or explanations that teach the wrong physics.
- **P1 — common foundation:** make existing tools measurable, readable, accessible, and testable.
- **P2 — classical optics:** complete the core undergraduate learning path.
- **P3 — photonics:** complete advanced undergraduate coverage.
- **P4 — specialist extensions:** optional follow-on work after the core is trustworthy.

## Audit evidence and limits

Reviewed `app.js` and the relevant controls/explanations in `index.html` for all seven tools, the shared optics styling, shared canvas utilities, and the existing test suite. Opened all seven tools in local Chromium at a 1440 px desktop width, and checked diffraction, Fresnel, laser cavity, and polarization at 390 px and 768 px. External page requests were blocked during these local browser checks. This is not an exhaustive cross-browser or accessibility certification.

Confirmed examples:

| Check | Current result | Why it matters |
| --- | --- | --- |
| Double slit, default settings | `d = 50 nm`, `λ = 500 nm`, `L = 100 mm`; rendered fringe scale is 20 px | With `d/λ = 0.1`, the far-field path difference cannot reach even `λ/2`. The displayed model must not imply ordinary multiple Young fringes for these units. |
| Laser, “At Threshold” preset | Status is “Lasing!”; `gain / totalLoss = 0.6 / 0.21 ≈ 2.86` | The named preset contradicts the tool's own model. |
| Polarization, `ψ = 0°`, `δ = 90°` | Status is “Elliptical” | One field component is zero, so the state is linear. |
| Four checked tools at 390 px | A 700 px backing canvas is displayed at 320 CSS px | An 11 px canvas label becomes approximately 5 CSS px. Avoiding page overflow does not make the plot readable. |
| Desktop canvases | 700 px backing width displayed at 760 CSS px | Graphics are enlarged without matching backing resolution; high-DPI displays need additional scaling. |
| Existing tests | No optics-specific matches in `tests/` | Current physics and interactions have no dedicated regression coverage. |

## 1. Fix the existing tools

### 1.1 Double-slit experiment — P0

Evidence: [app.js](src/tools/double_slit/app.js), especially `updateStats`, `getFringeScale`, `drawBarrier`, `drawIntensityPattern`, and `drawIntensityPlot`; [explanation](src/tools/double_slit/index.html).

**Physics and substance problems**

- Slit separation is labeled in nanometres and defaults to 50 nm while the wavelength is 500 nm. The small-angle fringe formula is applied without checking whether its predicted orders are physically possible.
- `getFringeScale()` uses an arbitrary `0.02` pixel factor and a minimum of 6 px. `updateStats()` introduces another factor of 1000, so its fringe count is not calculated from the same pattern or physical screen extent.
- The diffraction envelope uses `scale * (slitSeparation / wavelength) * 0.25`, with no slit-width parameter. This expression cancels wavelength and separation out of the envelope scale. Real finite-slit diffraction depends on slit width and wavelength.
- The quantum explanation claims each unmeasured particle passes through one slit at a time. That asserts a definite path the experiment has not measured. “Observer effect” wording also needs an explanation in terms of path distinguishability and loss of coherence.

**Visualization problems**

- The default screen pattern is essentially a central line, while most space is allocated to overlapping arcs. Neither the arcs nor the 55 px intensity strip let a student measure fringe separation.
- `drawBarrier()` places the lower opening, its highlighted edge, and source position inconsistently. For small separations, the central barrier height becomes negative. Geometry must come from the same aperture definition used by the field calculation.

**Implementation tasks**

- [x] Store all lengths in metres internally. Provide independent slit width `a`, centre separation `d`, wavelength `λ`, and distance `L`; use realistic micrometre/millimetre defaults and enforce non-overlapping slits.
- [x] Implement the equal-amplitude coherent Fraunhofer baseline `I/Imax = sinc²(π a sinθ/λ) cos²(π d sinθ/λ)`, with `sinc(u) = sin(u)/u` and `θ = atan(y/L)`. State the far-field assumptions; using an exact screen angle does not make this a near-field solver.
- [x] Derive the readouts, detector image, envelope, and line plot from one sampled physical intensity array. Report actual screen extent, fringe spacing, orders, and visibility instead of a capped estimate.
- [x] Add an aperture view, a large detector view, and an intensity-versus-position plot with a cursor. Keep the ray/wavefront schematic explicitly marked as not to scale.
- [x] Add relative phase, unequal illumination, single-slit blocking, and partial coherence after the baseline is correct.
- [x] Rewrite the quantum paragraph to describe probability amplitudes and path information; label the current solver as classical scalar optics.

**Acceptance:** with `λ = 500 nm`, `d = 0.25 mm`, `a = 0.05 mm`, and `L = 1 m`, the paraxial interference spacing is 2 mm and the envelope's first zero is 10 mm. Blocking a slit leaves its single-slit envelope. A subwavelength-separation case must not invent impossible off-axis orders.

### 1.2 Single-slit and circular diffraction — P0/P1

Evidence: [app.js](src/tools/diffraction/app.js), especially `getPatternScale`, `airyIntensity`, `drawHuygensWavelets`, and `drawIntensityPlot`; [explanation](src/tools/diffraction/index.html).

**Physics and substance problems**

- The single-slit curve has the expected sinc-squared shape, but `getPatternScale()` converts a physical length into pixels using an unexplained factor of 1.8.
- `airyIntensity()` divides its argument by an extra `0.82`. This puts the circular first zero almost at the slit first zero for equal displayed aperture size, suppressing the expected approximately 1.22 ratio when comparing circular diameter with slit width.
- The page declares a far-field simulation without a regime check. At the allowed `a = 200 μm`, `λ = 380 nm`, `L = 50 mm`, the Fresnel number using half-width `b = a/2` is `b²/(λL) ≈ 0.53`, not much less than one.

**Visualization problems**

- “Airy disk” is shown as a one-dimensional strip/profile, not a two-dimensional disk and rings.
- Seven sets of wavelet arcs dominate the scene. They are illustrative construction lines, not a computed propagated field, and are not linked quantitatively to the detector.
- Default sidelobes are difficult to inspect; there is no calibrated detector axis, dynamic-range control, or power normalization choice. The screen's minimum opacity makes nominally dark regions nonzero visually.

**Implementation tasks**

- [x] Use physical detector coordinates. Evaluate slit `sinc²(π a sinθ/λ)` and circular `[2 J1(u)/u]²`, where `u = π D sinθ/λ`; define `a` as slit width and `D` as circular diameter.
- [x] Show a 2D detector with a linked line cut, annotated minima, and linear/log intensity options. Label log floors and normalized versus absolute quantities.
- [x] Show Fresnel number with its aperture-size convention. Warn or switch models when the far-field approximation is inappropriate.
- [x] Keep wavelets as an optional explanatory overlay. Add actual numerical propagation in N5 below.
- [x] Fix reset ordering: currently `applyPreset()` redraws before the wavelet/intensity checkboxes are restored, so reset can leave the paused canvas inconsistent with checked controls.

**Acceptance:** for `λ = 550 nm`, `L = 1 m`, and width/diameter `100 μm`, the slit first zero is approximately 5.50 mm and the circular first dark ring approximately 6.71 mm. Both central limits are finite and equal to one when peak-normalized. The 2D circular result is radially symmetric.

### 1.3 Interference and beating — P0/P1

Evidence: [app.js](src/tools/interference/app.js), especially `drawWave`, `drawResultantWave`, `drawPhasorDiagram`, and `updateStats`.

- **Physics:** the “Beating” preset changes spatial wavenumber but both waves retain the same temporal phase `w`. At a fixed position their relative phase does not evolve, so the advertised temporal beating is absent. The phasor view ignores `waveRatio` altogether.
- **Substance:** no detector averaging, coherence, or polarization overlap connects field addition to observed intensity. Broad phase bins label nearby states “Constructive” or “Destructive” without reporting the quantitative result.
- **Visuals:** axes have no numerical scale, coincident component waves obscure each other, and the resultant changes color between wave and phasor views. The phasor view lacks calibrated axes and a probe position linked to the spatial plot.

- [x] Use `E_j(x,t) = A_j cos(k_j x − ω_j t + φ_j)` with a declared medium and dispersion relation; distinguish spatial interference from temporal beats.
- [x] Add synchronized spatial field, fixed-position time trace, detector intensity, and phasor views. For different frequencies, use instantaneous rotating vectors at the probe position or explain why a single stationary phasor sum is unavailable.
- [ ] Implement `I = I1 + I2 + 2 sqrt(I1 I2) Re(γ12 exp(iΔφ))` for a stated scalar/co-polarized model; add polarization overlap when connected to the polarization tool. *(Partial: real |γ| only; polarization overlap not yet linked.)*
- [x] Add detector integration time and visibility `V = (Imax − Imin)/(Imax + Imin)`. Use shared colors, numerical axes, and adaptive plot bounds.

**Acceptance:** equal coherent waves cancel at phase π and give four times a single wave's intensity at phase zero. Unequal amplitudes leave a nonzero minimum. Two frequencies separated by `Δf` produce an intensity beat at `|Δf|`; sufficiently long detector integration averages that cross term away.

### 1.4 Fresnel reflection and refraction — P0/P1

Evidence: [app.js](src/tools/fresnel/app.js), especially `calculateFresnelCoefficients`, `drawRays`, `drawWaveFronts`, and `drawEFields`.

- **Preserve:** the propagating, real-index branch already distinguishes electric-field transmission amplitude from power transmission using the flux factor. Do not replace it with `T = |t|²`.
- **Physics:** total internal reflection returns fixed real amplitudes `r_s = −1`, `r_p = 1`, and zero transmitted field. Unit reflected power is correct for a lossless interface; the angle-dependent complex reflection phases and nonzero evanescent field are missing.
- **Visuals:** ray widths always use the average of s and p power, even in a selected single-polarization mode. A reflected ray retains a minimum width at zero power. Wavefront spacing is the same in both media, and field phase is assigned by arbitrary diagram positions rather than `k·r − ωt`.
- **Readability:** light-mode text can be drawn dark on the forced dark canvas; the desktop Fresnel medium labels and coefficient-panel heading are difficult to read. This is a shared theme/state problem, not just a choice of ray color.

- [x] Return explicit complex `r_s`, `r_p`, `t_s`, `t_p`, alongside real power coefficients `R_s`, `R_p`, `T_s`, `T_p`. Document field bases and time convention.
- [x] Handle TIR using the physical complex transmitted normal wavevector; show reflection phase and evanescent decay. Distinguish zero normal transmitted power from zero electric field.
- [x] Link ray brightness/width to the selected polarization. Hide or explicitly mark zero-power rays; preserve a schematic direction guide separately if useful.
- [x] Add plots of R/T and reflection phase versus angle, with a cursor linked to the geometry, Brewster angle, and critical angle.
- [x] Show conserved frequency and `λ_medium = λ0/n`; make field samples obey the same boundary solution. Scope the first version to lossless isotropic nonmagnetic media; add absorption later through N4.

**Acceptance:** air-to-glass at normal incidence gives `R = 0.04`, `T = 0.96`; `R + T = 1` for both polarizations in the lossless model; p reflection vanishes at `atan(1.5) ≈ 56.31°`. Glass-to-air critical angle is approximately 41.81°. TIR has unit reflected power, angle-dependent phase, and a decaying transmitted field.

### 1.5 Polarization — P0/P2

Evidence: [app.js](src/tools/polarization/app.js), especially `updateStats`, `drawAxes2D`, `drawWave3D`, and `drawAll`; [background material](src/tools/polarization/index.html).

- **Physics:** classification misses the single-component linear states at `ψ = 0°` or `90°`. Approximate angular thresholds silently call near-circular/near-linear states exact.
- **Substance:** Malus's law, birefringence, and Stokes parameters appear in explanatory text but cannot be explored. There are no optical elements or partially polarized states.
- **Visuals:** the transverse plot labels its axes `x` and `y`, although they represent field components. The fixed oblique “3D” view does not establish the observer's direction or a handedness convention. A redraw while paused omits the 2D instantaneous vector because it is conditional on animation running.

- [x] Classify from the field/Jones or Stokes state, including degenerate cases; show ellipticity, orientation, and an explicit tolerance for “approximately” linear/circular.
- [x] Label axes `Ex/E0` and `Ey/E0`, show propagation direction and viewing convention, and retain the instantaneous vector during pause, reset, and parameter changes.
- [ ] Add an ordered optical-element bench: polarizer, analyzer, half-wave plate, quarter-wave plate, and general retarder. Show the Jones matrix and resulting field after each element. *(Partial: one element at a time implemented; ordered multi-element bench pending.)*
- [ ] Add Stokes parameters, degree of polarization, and a linked Poincaré sphere; use coherency matrices or Mueller calculus for partial/unpolarized light. A single Jones vector cannot represent those states. *(Partial: Stokes/DoP readouts and coherency-matrix model done; Poincaré sphere and partial-polarization input pending.)*
- [ ] Explain birefringent retardance `δ = 2π Δn d/λ`; visualize ordinary/extraordinary behavior with declared crystal geometry before adding more general anisotropic propagation. *(Partial: formula and prose done; o/e crystal visualization pending.)*

**Acceptance:** single-component states are linear for every relative phase; equal amplitudes with ±π/2 phase are circular. An ideal analyzer obeys Malus's law, a quarter-wave plate at the appropriate orientation converts linear to circular, and ideal retarders preserve intensity and degree of polarization.

### 1.6 Standing waves — P0/P1

Evidence: [app.js](src/tools/standing_waves/app.js), especially `incidentWave`, `reflectedWave`, `findNodes`, `findAntinodes`, and `drawEnvelope`; [explanation](src/tools/standing_waves/index.html).

- **Physics/substance:** the code enforces reflection at the right boundary with `k = ω = 2π frequency` in normalized coordinates, yet labels frequency in Hz without defining a physical length or wave speed. The page then discusses two-ended resonant modes, although the left boundary is not constrained for arbitrary slider settings.
- The explanation says standing waves only form at resonant frequencies. Counterpropagating coherent waves can form a standing pattern without a two-ended resonator; discrete allowed frequencies follow from applying both resonator boundaries.
- A generic dielectric interface is not a perfectly reflecting “free end.” Optical reflection amplitude and phase depend on the media and polarization.
- **Technical/visual:** nodes, antinodes, and envelopes are repeatedly estimated by sampling 20 times at about 1000 positions. Their locations should follow an analytic envelope and should not drift with global phase or a sampling threshold.

- [x] Offer explicit modes: a wave reflecting from one boundary, and a finite resonator with two declared boundary conditions.
- [x] Set physical `L`, medium index/speed, frequency, and complex reflection coefficient; alternatively label a fully normalized model consistently. Show optical time with a separate animation slow-down factor.
- [x] Derive the envelope from the complex field sum and compute extrema analytically where possible; cache parameter-dependent results.
- [ ] For optical mode, display complementary E/H standing patterns and energy flow; connect resonance mode number to the passive resonator tool N9. *(Partial: E/H patterns and energy flow done; N9 link pending.)*
- [x] Rewrite formulas around the same origin and boundary position as the implementation, including reflection phase.

**Acceptance:** a perfect electric conductor enforces zero tangential electric field at its surface. A two-perfect-mirror, nondispersive cavity gives `νm = m c/(2nL)`. Changing only global temporal phase does not move nodes. Partial reflection produces the correct nonzero minima and standing-wave ratio.

### 1.7 Laser cavity — P0, then P3

Evidence: [app.js](src/tools/laser_cavity/app.js), especially `getParams`, threshold presets, `updateSimulation`, `drawCavity`, and `drawIntensityGraph`; [equations](src/tools/laser_cavity/index.html).

- **Physics:** `gain = pump * 1.5` and additive mirror loss feed an arbitrary relaxation to `(gain − loss) * 10`. This is an illustrative animation, not a coupled population/photon model. Length affects animation rates but not the threshold calculation.
- The “At Threshold” preset is approximately 2.86 times threshold under that model. Output brightness depends on intracavity intensity without the output-coupler transmission, allowing a visible output beam even at 100% output-mirror reflectivity.
- Atom excitation and animated photon counts do not determine the plotted intensity. Stimulated events choose random direction rather than representing emission into the stimulating mode; spontaneous decay does not itself create the illustrated photon.
- The two-level picture omits the pumping/relaxation mechanism needed for the claimed inversion. The text mixes additive gain and multiplicative gain, and its “round trip” equation labels gain as single-pass while using only one pass factor.
- **Visuals/technical:** the graph says “Time (round trips)” but stores one value per animation frame, with no physical timestamps or numerical ticks. Photon turning points at normalized 0.1/0.9 do not coincide with the drawn mirrors at 0/1.

- [x] Immediately correct the preset and output-coupling behavior and explicitly label the current model as qualitative until replaced.
- [x] Define single-pass intensity gain/loss coefficients `g, α` in inverse metres. For a uniform linear cavity use round-trip multiplier `M = R1 R2 exp[2(g − α)L]`; threshold satisfies `M = 1`, hence `g_th = α + ln(1/(R1 R2))/(2L)`. If the gain medium occupies only part of the cavity, use its actual length in the gain exponent.
- [x] Replace independent animations with a documented three-/four-level rate-equation model, or an explicitly derived effective inversion/photon-number model. Include pump rate, upper-state lifetime, stimulated emission, spontaneous-emission coupling, and photon lifetime.
- [x] Derive intracavity power and transmitted output from the same state; `Pout = T2 Pcirc` at the output mirror, with `T2 = 1 − R2` only for a lossless mirror.
- [x] Use numerical integration with a controlled time step and convergence checks. Derive threshold presets from the model parameters rather than hardcoding percentages.
- [ ] Plot inversion, intracavity photons/power, output power, and gain versus loss against physical time. Add a pump sweep and relaxation oscillations where the selected model supports them. *(Partial: gain and output vs physical time with relaxation oscillations done; pump sweep and intracavity plot pending.)*
- [ ] Make photons/atoms illustrative views of that state; align mirror collisions with geometry. Link longitudinal/transverse mode selection to N9 instead of implying that particle dots establish coherence. *(Partial: state-driven, mirror-aligned, labelled illustrative; N9 mode link pending.)*

**Acceptance:** the threshold preset evaluates to threshold within the declared tolerance; below/above threshold behavior matches the rate model; zero output-mirror transmission gives zero transmitted output; numerical results converge as the time step decreases. Changing cavity length affects round-trip time and the physically defined threshold/lifetime consistently.

## 2. Shared visualization, teaching, and engineering work — P1

### Visualization and interaction

- [ ] Give each experiment a clear hierarchy: apparatus/schematic, measured detector or field plot, and linked numerical readouts. Let the important data plot occupy useful space instead of reserving most of the canvas for decoration.
- [ ] Distinguish instantaneous signed field, field magnitude, phase, time-averaged intensity, and photon counts. Use diverging colors for signed fields, cyclic phase colors, and sequential intensity colors with labeled legends.
- [ ] Put units, ticks, scale bars, normalization, and approximation labels on plots. Distinguish physical coordinates from schematic placement. Include a probe/cursor, zoom, and a numeric data table where measurement is the learning objective.
- [ ] Offer fixed-scale and auto-scale modes so comparisons are meaningful. Keep color limits fixed during a comparison; explain gamma/log display mappings and any floor that makes zero intensity appear nonzero.
- [ ] Fix light/dark theme contrast using one palette source. Some tools read tokens from `documentElement` although tool tokens live on `body`; shared optics CSS also forces dark surfaces in light mode. Keep renderer and DOM theme updates synchronized.
- [ ] Reflow views for small screens instead of shrinking 700 px artwork. Keep labels at readable CSS-pixel sizes and move legends/controls outside crowded plots. At 390 px, show detector and curve as separate panels or tabs.
- [ ] Add keyboard-operable numeric inputs alongside sliders, visible focus, canvas descriptions, text summaries, and non-color cues. Respect reduced motion; keep pause, single-step, speed, and reset available.
- [ ] Make presets reproducible experiments with an expected observation, not just attractive starting values. Add URL state sharing, JSON configuration export, CSV measurements, and a labeled SVG/PNG figure export.

### Scientific model and code structure

- [ ] Preserve the static HTML/CSS/JavaScript delivery model. Introduce browser ES modules for physics and rendering incrementally; retain existing page URLs.
- [ ] Create `src/tools/shared/optics/` with focused modules for units/constants, complex arithmetic, physical coordinates, numerical methods, and domain models. Extract existing correct code rather than rewriting every page first.
- [ ] Keep models as pure functions without DOM/canvas access, e.g. `fresnel(params)`, `doubleSlitIntensity(params, y)`, `propagate(field, grid, z)`, and `laserDerivative(t, state, params)`.
- [ ] Define conventions centrally: SI internally; vacuum versus medium wavelength; degrees only at the UI boundary; phasor sign; s/p bases; Jones handedness; ray vector convention; amplitude versus power normalization.
- [ ] Drive controls, formulas, readouts, and plots from one validated state. Handle zero, critical-angle limits, forbidden geometry, and numerical singularities explicitly instead of hiding errors behind arbitrary clamps.
- [ ] Reuse or adapt `ToolShared.fitCanvasToDisplay` in [base.js](src/tools/shared/base.js). The optics pages currently cache `cw/ch` once; update layout coordinates when resizing and use a device-pixel-ratio backing store without changing physical sampling.
- [ ] Replace frame-count time with elapsed timestamps. Maintain one cancellable animation loop; rapid start/stop/start should not leave two pending loops. Pause background work when the page is hidden.
- [ ] Cache stationary detector patterns, envelopes, transforms, and angle scans. Use workers for expensive grids and cancel obsolete jobs when inputs change; keep rendering responsive while computations finish.
- [ ] Specify FFT sampling, padding, phase conventions, coordinate mapping, and error checks before adding propagation. Reuse a vetted, license-compatible FFT implementation or a tested small implementation; do not begin with a framework migration.
- [ ] Use deterministic seeds for illustrative stochastic simulations and Monte Carlo detection. Make sampling error visible where it is part of the experiment.

### Teaching content

- [ ] Add prerequisites, two or three learning objectives, a concise model derivation, defined symbols, assumptions, and validity limits to each tool. Keep detailed derivations expandable.
- [ ] Add prediction → experiment → measurement → explanation exercises, with a worked example and at least one limiting-case challenge per tool.
- [ ] Separate what the solver actually models from related applications mentioned in prose. A classical field animation is not evidence that quantum measurement, laser coherence, or detector physics has been simulated.
- [ ] Update [the tools catalogue](src/core/tools.html) into an ordered optics learning path with prerequisites and links between related experiments. Keep “Fresnel interface coefficients” distinct from “Fresnel diffraction.”

## 3. Missing tools and how to implement them

The entries below are new tools unless explicitly marked as an extension. Build reusable models so a concept is not implemented differently on several pages.

### N1. Geometrical optics and optical-system bench — P2

**Coverage:** Fermat's principle, reflection/refraction, thin/thick lenses, spherical mirrors, principal planes, real/virtual images, magnification, stops/pupils, numerical aperture, telescopes, microscopes, and aberrations.

- [ ] Build an SVG/Canvas bench with draggable sources, spherical/planar surfaces, lenses, mirrors, apertures, and a detector. Show construction rays, a ray fan, and object/image coordinates.
- [ ] Start with paraxial ABCD matrices under one declared ray convention. Add exact ray–surface intersections and vector Snell/reflection for comparison with paraxial predictions; account for refractive-index changes and total internal reflection.
- [ ] Add multi-element presets, cardinal planes, aperture/field stops and entrance/exit pupils. Use a spot diagram and wavelength-dependent materials to reveal spherical/chromatic aberration, coma, astigmatism, field curvature, and distortion as scope expands.
- [ ] Connect pupil/NA to the diffraction-imaging model N6 so students see why geometrical focus is insufficient to predict resolution.

**Acceptance:** a thin lens with `f = 100 mm` and object distance `300 mm` gives image distance `150 mm` and magnification `−0.5` under the declared sign convention. Handle virtual images and an image at infinity without numerical explosions; exact and paraxial rays agree near the axis.

**Dependencies:** units, coordinates, matrix operations; basic Fresnel/Snell utilities. Start with a 2D meridional bench; label which aberrations require a fuller ray bundle.

### N2. Electromagnetic waves and energy flow — P2

**Coverage:** Maxwell plane waves, transverse E/H fields, wave impedance, phase velocity, and the Poynting vector.

- [ ] Animate synchronized E, H, and propagation/energy-flow directions with spatial and temporal cross-sections. Clearly distinguish vector directions from drawn wave trajectories.
- [ ] Evaluate analytic plane-wave solutions in homogeneous isotropic media, with `H = (1/η) k̂ × E`; calculate instantaneous and time-averaged energy flux using a declared peak/RMS convention.
- [ ] Add reflection superposition and standing-wave energy exchange using the existing interface model. Start with analytic solutions; a general Maxwell grid solver is unnecessary for this learning objective.

**Acceptance:** E and H are transverse, the Poynting vector points along propagation, and peak electric amplitude gives average intensity `n ε0 c |E0|²/2` in a lossless nonmagnetic medium.

**Dependencies:** complex fields, conventions, repaired Fresnel and standing-wave models.

### N3. Interferometers and coherence — P2

**Coverage:** Michelson, Mach–Zehnder, optical path length, beam-splitter phase, temporal/spatial coherence, fringe visibility, and displacement measurement.

- [ ] Provide editable arms, mirrors, beam splitters, phase shifters, and two detector ports. Show path phasors and fringes side by side.
- [ ] Propagate complex fields through a consistent unitary beam-splitter convention; include optical path and reflection phases. Add finite source bandwidth by integrating spectral intensities with declared weights.
- [ ] Let students scan mirror displacement, source size, polarization overlap, and arm imbalance. Plot visibility against path difference and connect coherence functions to the source spectrum.

**Acceptance:** moving a Michelson mirror by `λ/2` cycles one fringe; an ideal lossless two-port model conserves total output power; increasing path mismatch reduces visibility for a finite-bandwidth source according to the chosen spectrum.

**Dependencies:** repaired interference, Jones fields, complex matrices; FFT only for broader coherence analysis.

### N4. Thin films and multilayer coatings — P2

**Coverage:** phase on reflection, film interference, anti-reflection coatings, dielectric mirrors, spectral filtering, and absorption.

- [ ] Build an ordered layer editor with thickness, refractive index, optional extinction coefficient, and incident/substrate media. Plot R/T/A versus wavelength or angle for s and p polarization, plus the internal field profile.
- [ ] Implement characteristic/transfer matrices with an explicit convention. Use a numerically stable scattering formulation when thick absorbing layers make transfer products ill-conditioned.
- [ ] Add quarter-wave anti-reflection, Bragg mirror, and film-thickness scan presets. Explain coherent versus incoherent thick layers rather than mixing their formulas.

**Acceptance:** removing all films recovers one-interface Fresnel results; lossless stacks give `R + T = 1`; an ideal normal-incidence quarter-wave film with `nfilm = sqrt(nincident nsubstrate)` suppresses reflection at its design wavelength.

**Dependencies:** complex Fresnel coefficients and power-flux normalization.

### N5. Near-/far-field diffraction and aperture propagation — P2; extend `diffraction`

**Coverage:** Fresnel diffraction, Fraunhofer limit, Huygens–Fresnel construction, rectangular/circular/annular apertures, edges, Fresnel zones, and the Poisson spot.

- [ ] Add a 2D amplitude/phase aperture editor and a propagation-distance control. Show aperture, propagated intensity, phase, and linked line cuts; phase is undefined at zero amplitude and should be masked there.
- [ ] Implement FFT angular-spectrum propagation, with an explicit treatment of evanescent spatial frequencies, and a paraxial Fresnel option. Compare to analytic Fraunhofer patterns where applicable.
- [ ] Display wavelength, physical grid pitch/extent, Fresnel number, and sampling limitations. Use padding and a band-limiting policy to reduce periodic wraparound and aliasing; report when the chosen grid is inadequate.

**Acceptance:** circular/slit far fields converge to their analytic solutions, the zero-distance result reproduces the input within the chosen band limit, and increasing grid extent/resolution demonstrates convergence. Account for power leaving a cropped detector instead of renormalizing it away.

**Dependencies:** shared field grids, complex FFT, worker jobs; repaired analytic diffraction is the reference case.

### N6. Fourier optics, imaging, and resolution — P2

**Coverage:** lens Fourier transforms, a 4f system, spatial filtering, coherent/incoherent imaging, point-spread function (PSF), optical transfer function (OTF), modulation transfer function (MTF), numerical aperture, and aberrations.

- [ ] Show linked object, pupil/Fourier plane, filter, image, PSF, and MTF views. Include two-point objects, sinusoidal targets, and adjustable point separation.
- [ ] Propagate complex amplitude for coherent imaging. For incoherent imaging, convolve object intensity with the intensity PSF; never interchange those operations silently.
- [ ] Model pupil amplitude and phase; add defocus and low-order Zernike aberrations with explicit normalization. Show the tradeoff between aperture, resolution, depth of focus, and throughput.

**Acceptance:** a circular pupil gives the Airy PSF; changing NA changes resolution consistently; the incoherent cutoff in air is `2 NA/λ0`, while the coherent amplitude cutoff is `NA/λ0`. A flat pupil phase reproduces the unaberrated reference.

**Dependencies:** N1 and N5, FFT grids, pupil definitions.

### N7. Diffraction gratings and spectroscopy — P2

**Coverage:** N-slit interference, grating orders, missing orders, angular dispersion, resolving power, finite slit width, and spectral overlap.

- [ ] Add number of illuminated slits, pitch, width, incidence angle, and a multi-line spectrum. Show angular intensity, detector position, and a calibrated wavelength scale.
- [ ] Sum complex aperture contributions or evaluate stable analytic array factors multiplied by the single-slit envelope. Handle removable singularities at principal maxima and exclude orders with impossible propagation angles.
- [ ] Add a simple spectrometer with a finite entrance slit and detector sampling; distinguish ideal grating resolving power from instrument resolution.

**Acceptance:** normal incidence obeys `d sinθm = mλ`; the finite-width envelope suppresses the correct orders; ideal resolving power approaches `mN` under its stated assumptions; two spectral lines change from resolved to unresolved as illuminated slit count changes.

**Dependencies:** repaired diffraction/double slit, optional N1 for detector geometry.

### N8. Gaussian beams and beam transformation — P3

**Coverage:** paraxial Gaussian modes, waist, Rayleigh range, divergence, wavefront curvature, Gouy phase, focusing, and mode matching.

- [ ] Show longitudinal beam radius, transverse intensity/phase, and wavefront curvature, linked to movable lenses and waist markers.
- [ ] Implement `zR = π n w0²/λ0`, `w(z)`, `R(z)`, Gouy phase, and complex `q`; propagate with `qout = (A qin + B)/(C qin + D)` using compatible matrix conventions.
- [ ] Define `w` as the 1/e² intensity radius. Add power-conserving normalization and a clear paraxial validity indicator. Treat empirical `M²` beam width as an extension, not a complete coherent field solution.

**Acceptance:** `w(zR) = sqrt(2) w0`, beam power is conserved in ideal propagation, and lens transformations agree with direct paraxial propagation. Handle the planar wavefront at the waist without displaying an erroneous finite curvature.

**Dependencies:** N1 matrices; N5 provides numerical cross-checks.

### N9. Passive optical resonators and Fabry–Pérot — P3

**Coverage:** longitudinal modes, free spectral range, linewidth, finesse, buildup, photon lifetime, cavity stability, and transverse modes.

- [ ] Show transmission/reflection spectra, intracavity standing fields, and the `g1–g2` stability diagram. Keep gain disabled so passive cavity behavior can be understood independently of laser dynamics.
- [ ] Sum the round-trip complex field geometrically or reuse multilayer/scattering models; derive losses and photon lifetime from the same round-trip power survival factor.
- [ ] Use a round-trip ABCD matrix to solve the self-consistent Gaussian `q` and transverse-mode frequency shifts. Distinguish stable interiors from marginal stability boundaries.

**Acceptance:** a nondispersive linear cavity has `FSR = c/(2nL)`; in a dispersive cavity use the group optical length. A symmetric lossless Fabry–Pérot reaches unit resonant transmission. Resonator stability follows the round-trip matrix criterion, with boundary degeneracies explained.

**Dependencies:** standing waves, N4 and N8. Feed this model into the laser rewrite.

### N10. Optical materials, dispersion, and pulses — P3

**Coverage:** refractive index, absorption, material dispersion, phase/group velocity, pulse bandwidth, chirp, and group-velocity dispersion.

- [ ] Start with transparent-material Sellmeier data and a declared validity interval; add a Lorentz-oscillator model to connect resonances, dispersion, and absorption. Cite each coefficient dataset and its units.
- [ ] Show `n(λ)`, absorption, a pulse envelope/carrier, and its spectrum/phase. Propagate spectral components using complex `k(ω)` and an FFT; expose phase, group delay, and second-order dispersion separately.
- [ ] Add prism dispersion and pulse-broadening examples. Keep spectral bandwidth within the material model's valid domain and state the limitations of interpreting group velocity near strong absorption.

**Acceptance:** nondispersive propagation delays the pulse without broadening; known quadratic spectral phase reproduces analytic Gaussian broadening; inverse propagation restores the initial pulse in the lossless, adequately sampled case.

**Dependencies:** complex FFT and material-index interfaces shared with N1/N4.

### N11. Waveguides and optical fibres — P3

**Coverage:** confinement, evanescent tails, TE/TM slab modes, effective index, cutoff, numerical aperture, fibre V-number, and modal dispersion.

- [ ] Begin with a symmetric dielectric slab: solve TE/TM dispersion relations using bracketed root finding, and plot normalized fields across core/cladding with the propagation constant.
- [ ] Add a weakly guiding step-index fibre mode using Bessel functions and explicitly labeled LP-mode approximations. Link the ray/TIR picture to the computed wave solution.
- [ ] Plot modes versus wavelength/core size, guided power fraction, and effective/group index. Add evanescent coupling between two guides as a later extension.

**Acceptance:** guided modes satisfy `nclad k0 < β < ncore k0` and the correct boundary continuity conditions. The ideal weakly guiding step-index fibre is single-mode below the next-mode cutoff `V ≈ 2.405`; explain the model and avoid applying that cutoff to arbitrary waveguides.

**Dependencies:** Fresnel/TIR, material dispersion, root finding and Bessel functions.

### N12. Radiometry, throughput, and detection — P2 baseline; P3 noise

**Coverage:** optical power, irradiance, radiance, solid angle, étendue, detector responsivity, photon counts, shot noise, and signal-to-noise ratio. Add photometry with a sourced luminosity function as an extension.

- [ ] Show a source–aperture–lens–detector experiment with an explicit power budget and geometric collection cone. Connect aperture and NA changes to both collected power and resolution.
- [ ] Implement analytic collection cases first, then numerical angular integration. Distinguish radiance from irradiance; use the appropriate `n²` factors for refractive systems and state assumptions behind étendue conservation.
- [ ] Add detector responsivity/quantum efficiency, exposure time, dark counts/current, and read noise. Generate seeded count distributions and distinguish physical noise from Monte Carlo sampling noise.

**Acceptance:** detector energy/photon conversion is dimensionally correct, e.g. `Ndet = η P t λ0/(hc)` for monochromatic light; doubling power doubles expected counts; ideal Poisson shot noise has variance equal to its mean. In ideal lossless geometrical transport, reduced radiance `Lradiance/n²` is conserved along a ray; account for transmission losses explicitly.

**Dependencies:** N1 for collection geometry; common units and reproducible random sampling.

## 4. Specialist extensions — P4

These complete a broader university offering but should not delay the classical core or the P0 repairs.

- [ ] **Holography and phase retrieval:** record `|Eobject + Ereference|²`, then reconstruct with N5/N6. Show off-axis order separation, twin-image effects, sampling, and reference-angle tradeoffs. Validate reconstruction against a known synthetic object and distinguish amplitude from intensity recording.
- [ ] **Nonlinear optics:** start with second-harmonic generation and phase matching using coupled complex-amplitude ODEs; display conversion efficiency versus length and phase mismatch. Add pump depletion only with a consistent energy normalization. Validate the undepleted limit and Manley–Rowe photon-flux relations; later add Kerr/self-phase modulation with a converged split-step solver.
- [ ] **Quantum optics and detection statistics:** add explicitly separate single-photon interference, which-path distinguishability, photon-number statistics, and idealized `g²(τ)` experiments. Use states/density matrices and stated detector models; validate normalization and ideal coherent/thermal statistics. Do not describe random samples from a classical image as a complete quantum simulation.
- [ ] **Electro-/acousto-optic modulation and coupled devices:** model a Pockels phase modulator/Mach–Zehnder modulator with Jones/complex fields, then an acousto-optic frequency-shift example and directional coupler. Validate modulation transfer curves, sideband spacing, and power balance under the declared model.

## 5. Delivery order and completion gates

| Milestone | Work | Exit condition |
| --- | --- | --- |
| M0: stop teaching incorrect results | P0 repairs for all seven tools and misleading explanatory text | Reproductions in this audit pass; remaining qualitative models and approximation limits are visible. |
| M1: measurable common interface | P1 shared state, units, plots, responsive rendering, accessibility, and model extraction | Existing tools provide readable plots, consistent controls, and quantitative data on desktop/mobile. |
| M2: complete classical optics | Polarization bench; N1–N7; N12 power/throughput baseline | Ray optics → fields/interfaces → polarization/coherence → interference/diffraction → imaging/detection has a continuous learning path with exercises. |
| M3: advanced undergraduate photonics | N8–N11; full laser replacement; N12 detector/noise extension | Beams → resonators → lasers, and materials → pulses → guided waves are quantitatively connected and validated. |
| M4: specialist topics | Selected P4 extensions | Each extension states its prerequisites, model scope, and independent validation cases. |

Build P0 corrections and their focused numerical regressions before broad visual redesign. Extract the units/state/plot foundation alongside those fixes. Within M2, N3/N4/N7 can follow the repaired wave tools while N1 develops; N6 depends on the pupil/ray and propagation work. Within M3, N8 precedes N9, which supplies the passive cavity model for the laser rewrite; N10 supplies dispersive materials for N11.

### Definition of done for each tool

- [ ] The equations, controls, numerical model, diagrams, and prose describe the same experiment and use the same units/conventions.
- [ ] Add pure numerical tests under a proposed `tests/optics/` directory and a dedicated command that can run independently of browser tests. Test analytic benchmarks, conservation laws, symmetry, limiting cases, and meaningful numerical convergence, not copies of implementation formulas.
- [ ] Add focused Playwright interaction checks for presets, invalid inputs, reset/pause, synchronized readouts, theme changes, and responsive layouts. Test at least 390, 768, and 1440 px plus high-DPI rendering; visually inspect exported plots and canvas labels.
- [ ] Validate the *rendered* result as well as helper outputs: units, actual minima/peaks, physical field of view, and exported coordinates must agree. Screenshot comparisons alone cannot verify physics.
- [ ] Document tolerances appropriate to each method: analytic formulas near machine precision away from singularities, numerical solvers with demonstrated convergence, and rendered measurements within the stated sampling/pixel resolution.
- [ ] Provide keyboard access, text equivalents for quantitative results, readable labels, non-color distinctions, and reduced-motion behavior. Check canvas accessibility explicitly; the four mobile-audited canvases currently have no accessible label or fallback text.
- [ ] Include one worked university-level example, prediction/measurement exercises, references, and a short explanation of when the model fails.
- [ ] Register the tool and its prerequisites in `src/core/tools.html`; preserve existing links, add related-tool navigation, and update the sitemap through the repository's existing workflow when pages are added.

Completion means students can use the suite for quantitative coursework across the stated curriculum. Attractive animation alone does not satisfy these gates.
