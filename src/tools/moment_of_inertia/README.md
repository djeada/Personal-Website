# Moment of Inertia Lab

An interactive mechanics lesson at `/tools/moment_of_inertia/`. Start with a physical question, change a body, and connect its mass distribution to its response under equal torque. The live explorer, guided experiments, worked explanations, numerical integration, and motion graph all use the same physics model. It follows the existing standalone `index.html` / `style.css` / `app.js` tool convention and uses the site's navigation, theme, and searchable tools directory.

## Page structure

The lab uses the shared physics-tool template (`src/tools/shared/optics/TEMPLATE.md`):
- the stylesheet order `resources/style.css`, `shared/base.css`, `shared/simulation.css`, `style.css`, `shared/array-visualizer-theme.css`, `shared/optics-lab-theme.css`
- the body classes `tool-page tool-simulation tool-array-visualizer tool-optics-lab`
- `tool-header`, `stats-bar`, an `options-sidebar` with `option-card`s, and `canvas-container` cards
- `OpticsUI` for DPR-aware canvases (`setupCanvas`), plots (`plot`), number boxes on every slider (`enhanceAllSliders`), loops (`createLoop`) and theme changes
- the "Learn with this tool" section with exercises

Canvases are always dark, as in the other labs. `style.css` only holds lab-specific pieces and uses the theme's tokens.

The page is written for beginners:

1. **What is moment of inertia?** I is the spinning version of mass (τ = Iα next to F = ma).
   - A ball on a light arm can be dragged with the pointer or moved with the arrow keys. Its area grows with its mass.
   - r² is drawn as a square rotating with the arm.
   - "Twist both" races the ball against a faint 1 kg ball at 0.50 m under the same 1 N·m torque.
   - The panel explains why distance counts twice (a = rα and τ = rF), then goes from one ball to Σmr² to ∫r²dm.
2. **Explore a body.** The sidebar holds experiments, body, axis and view controls.
   - Drag any 3D view to turn the shared camera; arrow keys work too. A click without a drag picks a piece.
   - Dot area is proportional to each piece's mass.
   - Panels show the selected piece's r⊥²Δm and a mass-versus-inertia band chart.
   - A live explanation reports how I changed and why.
3. **Build the integral.** The pieces are added in nested-sum order, outermost first:
   - rod or hoop: one sum
   - disk or ring: rings, then pieces around a ring
   - plate: strips, then pieces along a strip
   - cylinder or sphere: slices, then rings, then pieces
   Each Σ has its own colored nested box with a counter, a partial sum and the totals of finished groups. The canvas uses the same colors. Play/Pause, +1 piece, Finish ring/strip, Finish slice, To the end and Reset control the build, which starts by itself the first time it scrolls into view. A colored nested Σ formula turns into the ∫ form, and a table shows Σ approaching ∫ as the pieces shrink. Another table lists every shape's coordinates, dm, integral count and symmetry shortcut.
4. **Same twist race.** Two bodies get equal torque from rest, shown with a scrubbable timeline and a speed-versus-time plot. Guided experiments select their comparison body. Outside an experiment, the reference follows the selected shape, mass and dimensions with a centered z axis (β = 0°, d = 0). The reference selector can switch to this automatic comparison during an experiment. Pinning a body preserves its complete configuration until a different reference is selected.
5. **Off-center axes.** The parallel-axis theorem is shown as two motions:
   - an animated view along the axis, with the center's circle (M d²) and an arrow showing the body turning about its own center (I_CM)
   - an I(d) parabola whose dot can be dragged
   - a stacked bar of the two parts and the cross-term derivation
6. **The math for this body, step by step**, then "Learn with this tool": objectives, model, four predict/test/measure/explain exercises, a worked triple-integral example, limits and references.
7. **Formula sheet** at the bottom, as static HTML and MathML. It has 15 bodies and axes (the lab's seven shapes plus a point mass, a thin-walled tube and a spherical shell) and the parallel- and perpendicular-axis theorems. Each row shows:
   - the result
   - what to plug into I = ∫ r⊥² dm: the material’s total length, area or volume gives its uniform density (λ, σ or ρ), and the tiny piece’s size gives dm; the row also gives r⊥. An introduction derives the density rule from M = ∫ dm and explains units and the hoop’s arc length.
   - the integral worked out, with its integral count
   - for bodies in the lab, a "Load" button. A test checks that each loaded body's I equals the formula at the default sizes.

   On phones the rows become cards.

## Physics model

`model.js` is a pure module exported to both the browser and CommonJS tests.

Body coordinates: rods lie along x; disks, hoops and plates lie in xy; cylinders extend along z; spheres are centered at the origin. The axis unit vector is `n = (sin β, 0, cos β)`. Its point nearest the center is `a = d(cos β, 0, −sin β)`, so `|d|` is the perpendicular offset, including for tilted axes. For a sample at `(x,y,z)`,

```
r_perp² = (x cos β − z sin β − d)² + y²
I_CM = Ix sin² β + Iz cos² β
I = I_CM + M d²
```

The six standard bodies are symmetric about their coordinate planes, so the mixed centered moments vanish. Exact principal moments are the standard uniform-body integrals. Thin bodies neglect thickness; an ideal rod about its own longitudinal axis has zero inertia. The UI explains this limit and disables torque playback for zero-inertia bodies instead of inventing a finite acceleration.

The adjustable ring is also symmetric. For inner radius `a = hollow × R`, its centered moments are `Iz = M(R² + a²)/2` and `Ix = Iy = Iz/2`. Sampling uses annular areas between `a` and `R`. At `hollow = 0` it matches the disk; at `hollow = 1` it uses hoop sampling and linear density, avoiding a division by zero in the vanishing-area limit. Intermediate shapes redistribute the same total mass instead of cutting mass away.

Every sampled piece records `idx`, its position in the nested sum (outermost first), and `evaluate` returns `build`, the pieces in that order. The builder relies on these indices and on contiguous groups.

Numerical integration uses line/rectangle midpoint elements, polar annular-area elements for disks, volume slices for cylinders, and interior disk slices for spheres. Circular element weights follow their annular areas; dots do not necessarily have equal mass. Sphere slice volumes are approximated and all weights normalized to the chosen total mass. These are finite midpoint approximations, so the displayed numerical sum may differ from the exact result. Refinement from 4 to 8 to 16 partitions per direction approaches the integral. The exact result, complete numerical sum, partial sum, and relative numerical error are separately labeled. A hoop's angular quadrature can already match its exact quadratic moment at coarse resolution.

The distance-band chart uses its own fine partition (80 line, 40 area, 20 volume divisions), binned from zero to the body's true maximum perpendicular distance. Coarse dots would alias into empty bands, such as a gap in a solid disk. A sphere's bands are measured about a transverse axis through the same offset: the sphere is symmetric, and this avoids aligning the axis with its sampling slices.

Rotation is about a fixed, constrained axis, with the applied net torque component τ and no friction. The comparison uses exact inertia and `α = τ/I`, `ω = αt`, `θ = αt²/2`, starting at rest. Rodrigues rotation moves the body around the actual shifted axis; perpendicular distances stay invariant. The marked point is the body's point farthest from the axis, found on its extreme points because r⊥ is convex. With its trail, it makes rotation visible on symmetric bodies, and it never sits on the axis (for example, at the pivot of a rod turning about its end). A sphere is drawn with its true circular silhouette. Both motion diagrams share a physical scale and are drawn at their displayed pixel size, so labels stay legible on phones; the charts are laid out the same way. The explorer keeps a fixed scale for normal size changes, zooming out only when needed for large shifted configurations. Canvas sizing keeps annotations legible at phone widths. Changing the body, reference, or torque resets both bodies to rest; refining the numerical partition preserves the motion state. Hiding the page pauses motion and stops the sum animation.

## Verification

```
npm ci
npx playwright install chromium
npx playwright test tests/moment-of-inertia.spec.js
```

The tests cover the physics model (standard moments, parallel axis, scaling, convergence, nested-sum order, distance bands, the farthest point) and the browser behaviour: the shared template and theme, dragging the ball and the 3D views, the nested builder for a triple integral and a plate, its auto-start, the off-center section and its draggable curve, the formula sheet's Load buttons against each formula, the race, the experiments and explanations, every shape and axis at 320–1280 px without overflow, canvas resolution, both themes with external requests blocked, and discovery from the tools directory. `tests/tool-layout.spec.js` also passes.

References: OpenStax [Calculating moments of inertia](https://openstax.org/books/university-physics-volume-1/pages/10-5-calculating-moments-of-inertia) and [Newton's second law for rotation](https://openstax.org/books/university-physics-volume-1/pages/10-7-newtons-second-law-for-rotation).
