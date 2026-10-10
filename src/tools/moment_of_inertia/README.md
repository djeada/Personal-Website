# Moment of Inertia Lab

An interactive mechanics lesson at `/tools/moment_of_inertia/`. Build a uniform body, inspect its mass elements, change the rotation axis, and compare its response with another body under equal torque. It follows the existing standalone `index.html` / `style.css` / `app.js` tool convention and uses the site's navigation, theme, and searchable tools directory.

## Learning flow

1. Choose a thin rod, solid disk, thin hoop, rectangular plate, solid cylinder, or solid sphere. Adjust total mass and the relevant dimensions in SI units.
2. Tilt the fixed axis between z and x, or shift it perpendicular to itself. The axis, selected piece, and shortest distance to the axis are drawn in an orthographic perspective or a view along the axis.
3. Build the midpoint sum from the nearest pieces outward. Select a dot or use the keyboard-accessible mass-element slider to inspect its position, mass, perpendicular distance, and contribution. Compare mass share with inertia share in distance bands; an HTML table supplies the same data.
4. Read the native MathML derivation: mass density, centered z-axis integral, orientation, and the parallel-axis theorem. No external math renderer or runtime dependency is needed.
5. Apply equal torque for two seconds from rest. Pin any body and axis as a reference, or use the disk/hoop, rod center/end, disk normal/diameter, and sphere symmetry experiments. Pause, resume, or reset the animation. Reduced-motion mode shows the final state immediately.

## Physics model

`model.js` is a pure module exported to both the browser and CommonJS tests.

Body coordinates: rods lie along x; disks, hoops and plates lie in xy; cylinders extend along z; spheres are centered at the origin. The axis unit vector is `n = (sin β, 0, cos β)`. Its point nearest the center is `a = d(cos β, 0, −sin β)`, so `|d|` is the perpendicular offset, including for tilted axes. For a sample at `(x,y,z)`,

```
r_perp² = (x cos β − z sin β − d)² + y²
I_CM = Ix sin² β + Iz cos² β
I = I_CM + M d²
```

All six bodies are symmetric about their coordinate planes, so the mixed centered moments vanish. Exact principal moments are the standard uniform-body integrals. Thin bodies neglect thickness; an ideal rod about its own longitudinal axis has zero inertia. The UI explains this limit and disables torque playback for zero-inertia bodies instead of inventing a finite acceleration.

Numerical integration uses line/rectangle midpoint elements, polar annular-area elements for disks, volume slices for cylinders, and interior disk slices for spheres. Circular element weights follow their annular areas; dots do not necessarily have equal mass. Sphere slice volumes are approximated and all weights normalized to the chosen total mass. These are finite midpoint approximations, so the displayed numerical sum may differ from the exact result. Refinement from 4 to 8 to 16 partitions per direction approaches the integral. The exact result, complete numerical sum, partial sum, and relative numerical error are separately labeled. A hoop's angular quadrature can already match its exact quadratic moment at coarse resolution.

Rotation is about a fixed, constrained axis, with the applied net torque component τ and no friction. The comparison uses exact inertia and `α = τ/I`, `ω = αt`, `θ = αt²/2`, starting at rest. Rodrigues rotation moves the body around the actual shifted axis; perpendicular distances stay invariant. A marked point makes rotation visible on symmetric bodies. Diagrams fit each body's extent independently; the numerical values use the same physical units. Changing the body, reference, or torque resets both bodies to rest. Hiding the page pauses playback.

## Verification

```
npm ci
npx playwright install chromium
npx playwright test tests/moment-of-inertia.spec.js
```

The tests cover standard moments, the parallel-axis theorem, mass and dimension scaling, conservation of sampled mass and center, numerical convergence, full-axis distance and rotation invariance, solid-sphere volume sampling, torque kinematics and energy, invalid input handling, all shapes and axis views at phone and desktop widths, element inspection and partial sums, reference pinning, zero-inertia behavior, animation controls, reduced motion, both themes, external-request independence, keyboard interaction, and tools-directory discovery. The existing GitHub Actions browser job includes the suite.

References: OpenStax [Calculating moments of inertia](https://openstax.org/books/university-physics-volume-1/pages/10-5-calculating-moments-of-inertia) and [Newton's second law for rotation](https://openstax.org/books/university-physics-volume-1/pages/10-7-newtons-second-law-for-rotation).
