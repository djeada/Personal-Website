# Moment of Inertia Lab

An interactive mechanics lesson at `/tools/moment_of_inertia/`. Start with a physical question, change a body, and connect its mass distribution to its response under equal torque. The live explorer, guided experiments, worked explanations, numerical integration, and motion graph all use the same physics model. It follows the existing standalone `index.html` / `style.css` / `app.js` tool convention and uses the site's navigation, theme, and searchable tools directory.

## Learning flow

The page is written for beginners and moves from the idea to the math:

- **01 What is moment of inertia?** I is the spinning version of mass (τ = Iα next to F = ma). A ball on a light arm lets you change r and m; r² is drawn as a real square, and a meter shows I. The panel explains why distance counts twice: a = rα and τ = rF give τ = (mr²)α. It then goes from one ball (mr²) to many balls (Σ m r²) to a solid body (∫ r² dm), and ends with a short glossary.
- **04 Single, double or triple integral?** You need one ∫ for each number it takes to locate a tiny piece: a line needs 1, a surface 2, a solid 3. A table lists every shape with its coordinates, dm, integral count and symmetry shortcut; choosing a row loads that shape. The derivation card shows the full integral first, then the symmetry shortcut (for example, adding whole rings of a disk), so the missing ∫ signs are explained.
- **05 What if the axis isn't through the center?** The parallel-axis theorem is shown as two motions: the center circles the axis (M d²) while the body spins about its center (I_CM). A d slider (synced with the main one), a stacked bar and an I(d) parabola show both parts. A collapsible section explains why the cross term vanishes. The motion view draws the center of mass's circle whenever d ≠ 0.

The interactive explorer then works as follows:

1. Choose one of five guided experiments: disk/hoop, moving mass outward, rod center/end, disk normal/diameter, or sphere symmetry. Each starts with a concrete question and a reference body. The experiment stays active while you follow its instructions; switching shape leaves it, and "Reset body & axis" returns to its starting body.
2. Build a thin rod, solid disk, adjustable ring, thin hoop, rectangular plate, solid cylinder, or solid sphere. Adjust mass, dimensions, axis tilt, and perpendicular axis shift. A live explanation reports how I changed (before → after and the ratio) and why. For a dimension change, it says whether every perpendicular distance scaled (the full k² rule), only part of I depends on that dimension, or the dimension runs along the axis and I is unchanged.
3. In the adjustable ring, grow the inner radius from zero (a disk) to the outer radius (the ideal thin-hoop limit). Total mass and outer radius stay fixed, so density increases as material moves outward.
4. Tap a dot or use the keyboard-accessible mass-element slider beside the explorer to inspect its position, mass, perpendicular distance, contribution, and shares of total mass and inertia. Animate the numerical sum from the nearest pieces outward, or scrub the included fraction. This reveals contributions without removing material from the physical body.
5. Apply equal torque for two seconds from rest. Compare inertia bars, acceleration, speed, angle, and the synchronized speed-versus-time graph. Pause, resume, reset, or scrub to any instant. Pin any body and axis as the reference. Reduced-motion mode shows the final state immediately and still supports manual scrubbing.
6. Compare numerical and exact inertia, refine the partition, and read the distance-band chart or equivalent HTML table. The bands describe the physical body, using a fine partition independent of the dots on screen. Follow the native MathML derivation through density, the centered z-axis integral, orientation, and the parallel-axis theorem. No external math renderer or runtime dependency is needed.

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

Numerical integration uses line/rectangle midpoint elements, polar annular-area elements for disks, volume slices for cylinders, and interior disk slices for spheres. Circular element weights follow their annular areas; dots do not necessarily have equal mass. Sphere slice volumes are approximated and all weights normalized to the chosen total mass. These are finite midpoint approximations, so the displayed numerical sum may differ from the exact result. Refinement from 4 to 8 to 16 partitions per direction approaches the integral. The exact result, complete numerical sum, partial sum, and relative numerical error are separately labeled. A hoop's angular quadrature can already match its exact quadratic moment at coarse resolution.

The distance-band chart uses its own fine partition (80 line, 40 area, 20 volume divisions), binned from zero to the body's true maximum perpendicular distance. Coarse dots would alias into empty bands, such as a gap in a solid disk. A sphere's bands are measured about a transverse axis through the same offset: the sphere is symmetric, and this avoids aligning the axis with its sampling slices.

Rotation is about a fixed, constrained axis, with the applied net torque component τ and no friction. The comparison uses exact inertia and `α = τ/I`, `ω = αt`, `θ = αt²/2`, starting at rest. Rodrigues rotation moves the body around the actual shifted axis; perpendicular distances stay invariant. The marked point is the body's point farthest from the axis, found on its extreme points because r⊥ is convex. With its trail, it makes rotation visible on symmetric bodies, and it never sits on the axis (for example, at the pivot of a rod turning about its end). A sphere is drawn with its true circular silhouette. Both motion diagrams share a physical scale and are drawn at their displayed pixel size, so labels stay legible on phones; the charts are laid out the same way. The explorer keeps a fixed scale for normal size changes, zooming out only when needed for large shifted configurations. Canvas sizing keeps annotations legible at phone widths. Changing the body, reference, or torque resets both bodies to rest; refining the numerical partition preserves the motion state. Hiding the page pauses motion and stops the sum animation.

## Verification

```
npm ci
npx playwright install chromium
npx playwright test tests/moment-of-inertia.spec.js
```

The tests cover standard moments, the parallel-axis theorem, mass and dimension scaling, conservation of sampled mass and center, numerical convergence, full-axis distance and rotation invariance, solid-sphere volume sampling, annulus limits and intermediate mass distributions, torque kinematics and energy, invalid input handling, all shapes and axis views at phone and desktop widths, element inspection and animated partial sums, reference pinning, zero-inertia behavior, motion scrubbing and resuming, graph/readout synchronization, partition changes during motion, visual scale consistency, contextual explanations, reduced motion, both themes, external-request independence, keyboard interaction, and tools-directory discovery. The existing GitHub Actions browser job includes the suite.

References: OpenStax [Calculating moments of inertia](https://openstax.org/books/university-physics-volume-1/pages/10-5-calculating-moments-of-inertia) and [Newton's second law for rotation](https://openstax.org/books/university-physics-volume-1/pages/10-7-newtons-second-law-for-rotation).
