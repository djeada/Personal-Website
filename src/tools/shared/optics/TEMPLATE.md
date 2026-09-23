# Optics tool developer guide

This guide covers the shared foundation for the optics tools: `core.js` (numerics), `ui.js` (browser helpers) and the classes in `../optics-lab-theme.css`. Read the header comment of each file for the full API. Physics models stay pure and DOM-free. Everything else is page glue.

## 1. Page skeleton

Copy `src/tools/fresnel/index.html` into `src/tools/<tool>/index.html` and keep these parts verbatim, changing only the text:

- `<head>`: the adsbygoogle `<script async>` (first line), `<title>`, meta description and keywords, icon, font preconnects, the stylesheets **in this order**: `../../resources/style.css`, `../shared/base.css`, `../shared/simulation.css`, `style.css`, `../shared/array-visualizer-theme.css`, `../shared/optics-lab-theme.css`, then the viewport meta, the canonical link `https://adamdjellouli.com/tools/<tool>/` and the JSON-LD `structured-data` block.
- `<body class="tool-page tool-simulation tool-array-visualizer tool-optics-lab">`, the whole `<nav>` (including `#dark-mode-button` and the Google CSE), and the whole `<footer>`, which contains the copyright script and `<script src="/app.js">`. `/app.js` adds `body.dark-mode` from the cookie and runs the theme toggle.
- Do not use a `<nav>` element inside `<main>` (e.g. for related-tool links): the site-wide `nav` styles apply to it and break layout. Use `<section class="optics-related">` or `<div role="navigation">`.
- `<main class="tool-main">` → `header.tool-header`, `.stats-bar`, then `section.tool-content` with `aside.options-sidebar` (controls) and `div.canvas-area` (plots), then `.help-box` and the teaching and explanation sections.
- Scripts at the end of `<body>`, after the footer, in this order:

```html
<script src="../shared/base.js"></script>
<script src="../shared/optics/core.js"></script>      <!-- window.OpticsModels.core -->
<script src="../shared/optics/ui.js"></script>        <!-- window.OpticsUI -->
<script src="../shared/optics/<model>.js"></script>   <!-- window.OpticsModels.<model> -->
<script src="app.js"></script>
```

A model that needs core should use `const core = (typeof require === "function" && typeof module === "object") ? require("./core.js") : self.OpticsModels.core;` inside its UMD factory. Load core.js before the model.

## 2. Plot panels

```html
<div class="optics-plot-grid">                     <!-- 2 cols; add .cols-3; stacks < 760 px -->
  <div class="optics-panel wide">                  <!-- .wide / .span-all = full row -->
    <h3 class="optics-panel-title">Detector line cut <span class="optics-badge">paraxial</span></h3>
    <canvas id="cutCanvas" class="optics-canvas"></canvas>
    <p class="optics-caption">What is plotted, normalisation, what is schematic.</p>
  </div>
</div>
<p class="optics-warning" id="regimeWarn" hidden>Fresnel number ≈ 0.5: far-field model not valid.</p>
<dl class="optics-readouts"><div><dt>Fringe spacing</dt><dd id="rSpacing">—</dd></div></dl>
<div class="optics-table-scroll"><table class="optics-data-table">…</table></div>
<div id="exportHost"></div>
```

- Use `class="optics-canvas"` on new canvases. Do not use a bare `.canvas-container > canvas`: the legacy rule caps it at 760 px with margins. Canvases are **always dark** in both site themes. Draw them with `OpticsUI.palette().canvas` (`CANVAS_PALETTE`), never with DOM text tokens.
- `setupCanvas` calls `draw` **immediately**, so declare everything `draw` reads (state, describeCanvas handles) before you call it.

```js
const UI = OpticsUI, core = OpticsModels.core;
let map;
const cut = UI.setupCanvas(document.getElementById("cutCanvas"), { aspect: 2.2, minHeight: 220, draw(ctx, w, h) {
  map = UI.plot(ctx, { x: 0, y: 0, w, h }, { x: { min: -15, max: 15, label: "y", unit: "mm" }, y: { min: 0, max: 1.05, label: "I/I₀" },
    series: [{ xs, ys, label: "model" }, { xs, ys: ref, label: "reference", dash: [7, 4] }], cursor: { x: cx, label: "…" }, markers: [{ x: y1, label: "1st zero" }] });
}});
canvas.addEventListener("pointermove", e => { const r = canvas.getBoundingClientRect(); const px = e.clientX - r.left;
  if (map.contains(px, e.clientY - r.top)) { cx = map.pxToX(px); cut.redraw(); } });
```

Keep the plot data in the units of the axis labels (for example mm). Convert from SI at that boundary.

## 3. Controls, state, export, accessibility

```js
UI.enhanceAllSliders(document.querySelector(".options-sidebar"));   // or UI.enhanceSlider(el, {unit:"nm", format, parse})
const ctl = UI.bindControls({ lambda: "#lambdaSlider", n2: "#n2Slider", pol: "radio:pol", log: "#logBox" }, () => { url.update(); render(); });
const url = UI.urlState({ get: ctl.get, set: ctl.set });            // restores in a microtask; url.ready is a Promise
UI.addExportBar(document.getElementById("exportHost"), { name: "fresnel", url, getState: ctl.get,
  getCSV: () => ({ headers: ["theta (deg)", "Rs", "Rp"], rows }), canvases: [cut.canvas], caption: () => "n1 = 1, n2 = 1.5" });
const desc = UI.describeCanvas(canvas, "summary text", { label: "Short name of the figure" }); desc.update("Quantitative summary …");
const loop = UI.createLoop((dt, t) => { phase += omegaDisplay * dt; draw(); }, { onChange: running => setButton(running) });
if (UI.prefersReducedMotion()) { /* do not autostart; keep Start + Step (loop.stepOnce()) + Reset */ }
UI.onThemeChange(() => { /* redraw DOM-coloured things */ });
```

- The number box syncs when code does `slider.value = x`, because `enhanceSlider` wraps the setter. Committing a value in the box fires `input` and `change` on the slider, so existing listeners keep working.
- URL keys are the `bindControls` keys, so keep them short and stable. State lives in the query string, which leaves `#anchors` free.
- Put the export bar and readouts **outside** the canvas. Every plotted quantity needs a text equivalent through describeCanvas or readouts.

## 4. Teaching section (markup and classes)

```html
<section class="optics-teaching" aria-labelledby="learn-h">
  <h2 id="learn-h">Learn with this tool</h2>
  <div class="optics-teaching-grid">
    <div class="optics-objectives"><h3>Learning objectives</h3><ul><li>…</li></ul></div>
    <div class="optics-prereqs"><h3>Prerequisites</h3><ul><li><a href="../fresnel/">Fresnel coefficients</a></li></ul></div>
  </div>
  <div class="optics-model"><h3>Model</h3><p>…</p>
    <dl class="optics-symbols"><dt>λ₀</dt><dd>vacuum wavelength</dd></dl>
    <details class="optics-derivation"><summary>Derivation</summary>…</details></div>
  <div class="optics-exercise-list">
    <article class="optics-exercise"><h4>Exercise 1 — …</h4>
      <ol class="optics-steps">
        <li class="optics-step" data-step="predict">…</li><li class="optics-step" data-step="test">…</li>
        <li class="optics-step" data-step="measure">…</li><li class="optics-step" data-step="explain">…</li>
      </ol>
      <details class="optics-answer"><summary>Show answer</summary>…</details></article>
  </div>
  <div class="optics-worked-example"><h3>Worked example</h3>…</div>
  <div class="optics-limits"><h3>When the model fails</h3>…</div>
  <div class="optics-references"><h3>References</h3>…</div>
</section>
```

Include at least one limiting-case exercise. State what the solver models and what the prose only mentions.

## 5. Conventions (identical across all tools)

- **SI internally** (m, s, rad, W). Convert nm, mm and degrees only at the UI boundary with `core.units`, and format output with `core.formatSI(v, "m")`.
- **Time convention** `E(r,t) = Re{E₀ exp[i(k·r − ωt)]}`. A decaying wave has `Im k > 0`, and a principal `complex.sqrt` with the `Im kz ≥ 0` branch is chosen explicitly (see fresnel.js). λ always means the vacuum wavelength λ₀. The medium wavelength is `λ₀/n`, and the frequency is the same in every medium.
- **s/p bases** (fresnel.js): s means E ∥ ŷ; p means H ∥ ŷ with `ê_p = (ŷ × k̂)`, so `r_p = −r_s` at normal incidence. The interface is z = 0 and the plane of incidence is x–z. Power transmission uses the flux factor: `T = Re(kz2)/kz1 · |t|²`.
- **Jones/Stokes** (polarization.js): `J = [Ex, Ey]`, `S3 = 2 Im(Ex* Ey)`. `S3 > 0` means counter-clockwise rotation when looking toward the source. This tool calls it *right-handed* (IEEE/helicity). Say so wherever you name a handedness. A retarder adds phase `e^{iΓ}` on the slow axis, and global phases are dropped.
- **Beams**: `w` is the 1/e² intensity radius, `zR = π n w0²/λ0`, and `q = z + i zR`. ABCD for rays `[y, θ]` uses `core.mat2`, and `mat2.chain([Mlast, …, Mfirst])` is the product as written.
- **Amplitudes**: fields are peak phasor amplitudes, so the time-averaged intensity is `I = n ε0 c |E0|²/2`. Label any RMS value explicitly. Label every plot as peak-normalised, power-normalised or absolute.
- **FFT**: forward `Σ x e^{−2πikn/N}` is unnormalised and inverse has 1/N (numpy). Use `fftFreq(N, dx)` in unshifted order, and apply `fftshift` only for display. 2D arrays are row-major `a[iy*nx+ix]`. `imageFromArray` draws iy = 0 at the **bottom** by default.
- **Colour**: `viridis` or `inferno` for intensity, `diverging` for signed fields (use symmetric ±max), and `twilight`/`hsv` for phase, with NaN masking where the amplitude is ≈ 0. Always draw a colourbar. With log scaling, give the floor in the label.
- **Randomness**: use `core.createRng(seed)`, never `Math.random`, for anything shown as a result.

## 6. Tests and checks

- Pure tests go in `tests/optics/<tool>.test.js` (node:test and assert/strict, requiring `../../src/tools/shared/optics/<model>.js`). Test analytic benchmarks, conservation, symmetry, limits and convergence, not copies of the formulas. Run them with `npm run test:optics`, which must stay green.
- Check the browser with Playwright (`@playwright/test` is installed, and the server is `python3 -m http.server 8000 --directory src`). Test at 390, 768 and 1440 px and at deviceScaleFactor 2 in both themes: set the cookie `darkMode=true` for dark. Check for no console errors, no horizontal scroll (`scrollWidth ≤ clientWidth`), and `canvas.width ≈ clientWidth × dpr`. Also check presets, reset and pause, URL restore, and that readouts match the rendered minima and peaks. Look at the screenshots.
- `npx playwright test tests/tool-layout.spec.js` must still pass.
- **Do not edit `src/core/tools.html` or the sitemap.** The lead registers new tools there.
