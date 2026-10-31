const { test, expect } = require("@playwright/test");

// Cross-tool checks for the optics suite (todo.md §5 "Definition of done").
// Physics is covered by the node tests in tests/optics/ (`npm run test:optics`).
const OPTICS_TOOLS = [
  "geometric_optics",
  "em_waves",
  "fresnel",
  "polarization",
  "interference",
  "standing_waves",
  "interferometers",
  "thin_films",
  "double_slit",
  "diffraction",
  "aperture_propagation",
  "diffraction_grating",
  "fourier_optics",
  "radiometry",
  "gaussian_beams",
  "fabry_perot",
  "laser_cavity",
  "dispersion_pulses",
  "waveguides",
  "holography",
  "nonlinear_optics",
  "quantum_optics",
  "electro_optics",
];

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844, deviceScaleFactor: 2 },
  { name: "tablet", width: 768, height: 1024, deviceScaleFactor: 1 },
  { name: "desktop", width: 1440, height: 900, deviceScaleFactor: 1 },
];

const EXTERNAL = /googlesyndication|google\.com|googleapis|gstatic|googletagmanager|doubleclick/;

async function openTool(browser, tool, viewport, colorScheme = "dark") {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    colorScheme,
  });
  const page = await context.newPage();
  // Formula layout and the simulator must work with every external request blocked.
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/tools/${tool}/`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  return { context, page, errors };
}

for (const tool of OPTICS_TOOLS) {
  test.describe(`optics: ${tool}`, () => {
    for (const viewport of VIEWPORTS) {
      test(`renders readable, error-free and without overflow on ${viewport.name}`, async ({ browser }) => {
        const { context, page, errors } = await openTool(browser, tool, viewport);

        const report = await page.evaluate(() => {
          const canvases = [...document.querySelectorAll("main canvas")].filter((c) => c.offsetParent !== null);
          return {
            viewport: document.documentElement.clientWidth,
            pageWidth: document.documentElement.scrollWidth,
            dpr: window.devicePixelRatio,
            readouts: [...document.querySelectorAll('.optics-readouts > div')].map(card => {
              const label = card.querySelector('dt'), value = card.querySelector('dd');
              if (!label || !value) return null;
              return { labelBottom: label.getBoundingClientRect().bottom, valueTop: value.getBoundingClientRect().top };
            }).filter(Boolean),
            canvases: canvases.map((c) => ({
              id: c.id,
              cssWidth: c.clientWidth,
              backingWidth: c.width,
              labelled: c.getAttribute("role") === "img" && !!c.getAttribute("aria-label"),
            })),
          };
        });

        expect(errors, "page errors").toEqual([]);
        expect(report.pageWidth).toBeLessThanOrEqual(report.viewport + 1);
        expect(report.canvases.length).toBeGreaterThan(0);
        for (const readout of report.readouts) {
          expect(readout.valueTop, 'readout value is below its label').toBeGreaterThanOrEqual(readout.labelBottom);
        }
        for (const canvas of report.canvases) {
          expect(canvas.labelled, `canvas #${canvas.id} has an accessible label`).toBe(true);
          expect(canvas.cssWidth, `canvas #${canvas.id} fits the viewport`).toBeLessThanOrEqual(report.viewport);
          // Backing store follows the CSS size and device pixel ratio (no stretched 700 px artwork).
          expect(Math.abs(canvas.backingWidth - canvas.cssWidth * report.dpr), `canvas #${canvas.id} backing size`).toBeLessThanOrEqual(2);
        }
        await context.close();
      });
    }

    test("has keyboard numeric inputs, export bar, teaching content and related links", async ({ browser }) => {
      const { context, page, errors } = await openTool(browser, tool, VIEWPORTS[2], "light");

      const report = await page.evaluate(() => ({
        ranges: document.querySelectorAll('main input[type="range"]').length,
        numbers: document.querySelectorAll("main .optics-num-input").length,
        exportBar: !!document.querySelector(".optics-export-bar"),
        teaching: !!document.querySelector(".optics-teaching"),
        exercises: document.querySelectorAll(".optics-exercise").length,
        related: [...document.querySelectorAll("main a[href^='../']")].map((a) => a.getAttribute("href")),
        equations: document.querySelectorAll('.optics-equation math').length,
        missingMath: [...document.querySelectorAll('[data-tex]')].filter(el => !el.querySelector('math')).length,
        mathErrors: document.querySelectorAll('math merror').length,
      }));

      expect(errors).toEqual([]);
      if (report.ranges > 0) expect(report.numbers).toBeGreaterThan(0);
      expect(report.exportBar).toBe(true);
      expect(report.teaching).toBe(true);
      expect(report.exercises).toBeGreaterThanOrEqual(2);
      expect(report.related.length).toBeGreaterThan(0);
      expect(report.equations, 'key equations are typeset while offline').toBeGreaterThan(0);
      expect(report.missingMath).toBe(0);
      expect(report.mathErrors).toBe(0);
      await context.close();
    });

    test("survives a theme toggle", async ({ browser }) => {
      const { context, page, errors } = await openTool(browser, tool, VIEWPORTS[2], "light");
      const toggle = page.locator("#dark-mode-button");
      if (await toggle.count()) {
        await toggle.first().click();
        await page.waitForTimeout(200);
        await toggle.first().click();
        await page.waitForTimeout(200);
      }
      expect(errors).toEqual([]);
      await context.close();
    });
  });
}

test("tools catalogue lists every optics tool", async ({ page }) => {
  await page.route(EXTERNAL, (route) => route.abort());
  await page.goto("/core/tools.html", { waitUntil: "domcontentloaded" });
  const hrefs = await page.locator("a.tool-card").evaluateAll((links) => links.map((a) => a.getAttribute("href")));
  for (const tool of OPTICS_TOOLS) {
    expect(hrefs).toContain(`../tools/${tool}/index.html`);
  }
});

test('polarization presets show the values their notes promise and URL values snap to the sliders', async ({ browser }) => {
  const { context, page, errors } = await openTool(browser, 'polarization', VIEWPORTS[2]);
  const preset = async (name) => { await page.click(`[data-preset="${name}"]`); await expect(page.locator(`[data-preset="${name}"]`)).toHaveAttribute('aria-pressed', 'true'); };
  await preset('elliptical');
  await expect(page.locator('#stat-orient')).toHaveText('20.4°');
  await expect(page.locator('#stat-chi')).toHaveText('24.3°');
  await expect(page.locator('#rType')).toHaveText('Elliptical, right (CCW)');
  await preset('malus');
  await expect(page.locator('#rI')).toHaveText('0.7500');
  await preset('three');
  await expect(page.locator('#rI')).toHaveText('0.1250');
  await expect(page.locator('#rTheta')).toHaveText('90.0°');
  await preset('qwp');
  await expect(page.locator('#stat-hand')).toHaveText('Left (CW)');
  await preset('quartz');
  await expect(page.locator('#stat-hand')).toHaveText('Right (CCW)');
  await expect(page.locator('#rSel')).toHaveText('1: Quartz c=45° d=17.39 µm');
  await preset('depol');
  await expect(page.locator('#rDop')).toHaveText('0.4000');
  // vertical light reads +90°, whichever sign round-off gives S₂
  await page.goto('/tools/polarization/?psi=0&dl=0&b=H~-45&s=0', { waitUntil: 'load' });
  await expect(page.locator('#rTheta')).toHaveText('90.0°');
  await expect(page.locator('#rSel')).toHaveText('1: HWP −45°');
  // off-grid URL values snap to the sliders, so the readouts describe what the sliders show (ψ = 31°, not 30.5°)
  await page.goto('/tools/polarization/?psi=30.5&dl=60&b=P~30.3&s=-1', { waitUntil: 'load' });
  await expect(page.locator('#psiSlider')).toHaveValue('31');
  await expect(page.locator('#stepBody tr').first()).toContainText('21.6°');
  await expect(page.locator('#rSel')).toHaveText('none');
  await expect(page.locator('#stepBody tr').nth(1)).toContainText('Pol 30.5°');
  // a 360° retarder is drawn as a full-wave quartz plate, not a zero-thickness one
  await page.goto('/tools/polarization/?b=R~10~360&s=0', { waitUntil: 'load' });
  await expect(page.locator('#crystalCanvas-summary')).toContainText('thickness 69.56 µm');
  expect(errors).toEqual([]);
  await context.close();
});

test('geometric optics keeps readouts and matrix correct when the focus goes through infinity', async ({ browser }) => {
  const { context, page, errors } = await openTool(browser, 'geometric_optics', VIEWPORTS[0]);
  await expect(page.locator('#rImage')).toContainText('150 mm');
  await expect(page.locator('#rMag')).toHaveText('−0.5 (inverted)');
  await expect(page.locator('#rAbcd math mtr')).toHaveCount(2);
  expect(await page.locator('#rAbcd math mn').allTextContents()).toEqual(['1', '0', '−0.01', '1']);
  const distance = async value => page.locator('#objDist').evaluate((el, value) => {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await distance(100);
  await expect(page.locator('#rImage')).toContainText('At infinity');
  await expect(page.locator('#rMagLabel')).toHaveText('Visual magnification');
  await expect(page.locator('#rAiry')).toContainText('Angular diameter');
  await distance(50);
  await expect(page.locator('#rImage')).toContainText('−100 mm');
  await expect(page.locator('#rImage .optics-readout-note').first()).toContainText('Virtual image');
  await expect(page.locator('#rMag')).toHaveText('2 (upright)');
  await expect(page.locator('#rMagLabel')).toHaveText('Magnification');
  await expect(page.locator('#rAiry .optics-readout-note')).toContainText('Wavelength:');
  await distance(300);
  await expect(page.locator('#rImage')).toContainText('150 mm');
  await expect(page.locator('#rImage .optics-readout-note').first()).toContainText('Real image');
  expect(errors).toEqual([]);
  await context.close();
});

test('geometric optics keeps sequential order with mirrors, refuses virtual detector planes and normalises slope errors by ρ³', async ({ browser }) => {
  const { context, page, errors } = await openTool(browser, 'geometric_optics', VIEWPORTS[2]);
  // adding a mirror puts it behind the detector, which moves to the returning path
  await page.click('[data-add="mirror"]');
  const order = await page.locator('#elSelect option').allTextContents();
  expect(order[order.length - 1]).toMatch(/^#3 Detector at z 150 mm$/);
  expect(order[2]).toMatch(/Mirror R −100 at z 190 mm/);
  // the magnifier image is virtual: the detector must not be moved onto it
  await page.click('[data-preset="magnifier"]');
  await page.click('#btnDetImage');
  await expect(page.locator('#warnBox')).toContainText('virtual');
  expect(await page.locator('#elSelect option').allTextContents()).toContain('#3 Detector at z 40 mm');
  // afocal telescope: slope errors are third order and the ideal lenses show exact zeros, not round-off
  await page.click('[data-preset="kepler"]');
  await expect(page.locator('#convRatioHead')).toHaveText('Error / ρ³');
  expect(await page.locator('#convTable tbody td:nth-child(3)').allTextContents()).toEqual(Array(6).fill('0 µrad'));
  await page.click('[data-preset="thick"]');
  await expect(page.locator('#convRatioHead')).toHaveText('Error / ρ²');
  expect(errors).toEqual([]);
  await context.close();
});

test('em waves reports standing-wave nodes cleanly and repairs invalid select values from the URL', async ({ browser }) => {
  const { context, page, errors } = await openTool(browser, 'em_waves', VIEWPORTS[2]);
  // H node of the PEC standing wave (z = −λ₁/4): ⟨u_H⟩ is round-off, so the ratio is ∞, not ~10³²
  await page.goto('/tools/em_waves/?bnd=pec&zp=-0.25&tph=0.1', { waitUntil: 'load' });
  await expect(page.locator('#rRatio')).toContainText('∞ (H node)');
  await expect(page.locator('#rRatio')).not.toContainText('e+');
  await page.goto('/tools/em_waves/?bnd=pec&zp=-0.5&tph=0.1', { waitUntil: 'load' });
  await expect(page.locator('#rRatio')).toContainText('= 0 (E node)');
  await page.goto('/tools/em_waves/?bnd=pec&zp=0.3', { waitUntil: 'load' });
  await expect(page.locator('#rRatio')).toHaveText('— (inside conductor)');
  await page.goto('/tools/em_waves/?pol=bogus&bnd=x&tph=0.2', { waitUntil: 'load' });
  await expect(page.locator('#polSelect')).toHaveValue('linear');
  await expect(page.locator('#bndSelect')).toHaveValue('none');
  await expect(page.locator('#tphSlider')).toHaveValue('0.2');
  expect(errors).toEqual([]);
  await context.close();
});

test('fresnel presets show the values their notes promise, the plot drag sets θ₁ and reset restores defaults', async ({ browser }) => {
  const { context, page, errors } = await openTool(browser, 'fresnel', VIEWPORTS[2]);
  const preset = async (name) => { await page.click(`[data-preset="${name}"]`); await expect(page.locator(`[data-preset="${name}"]`)).toHaveAttribute('aria-pressed', 'true'); };
  await preset('normal');
  await expect(page.locator('#stat-R')).toHaveText('0.040');
  await expect(page.locator('#ampTs')).toHaveText('0.800 ∠ 0.0°');
  await preset('brewster');
  await expect(page.locator('#ampRp')).toHaveText('0.000');
  await expect(page.locator('#rsValue')).toHaveText('14.8%');
  await expect(page.locator('#brewsterIndicator')).toHaveClass(/active/);
  // the phase of a vanishing r_p is reported as undefined, not as ±180°
  await expect(page.locator('#phaseCanvas-summary')).toContainText('arg rp = undefined');
  await preset('tir');
  await expect(page.locator('#ampRs')).toHaveText('1.000 ∠ -95.7°');
  await expect(page.locator('#ampRp')).toHaveText('1.000 ∠ -136.2°');
  await expect(page.locator('#factDecay')).toContainText('121.5 nm');
  await expect(page.locator('#canvas')).toHaveAttribute('data-tir', 'true');
  await preset('metal');
  await expect(page.locator('#stat-R')).toHaveText('0.927');
  await expect(page.locator('#factDecay')).toContainText('32.6 nm');
  await expect(page.locator('#stat-brewster')).toHaveText('70.63°');
  await preset('atr');
  await expect(page.locator('#rsValue')).toHaveText('94.4%');
  await expect(page.locator('#rpValue')).toHaveText('90.9%');

  const plot = page.locator('#plotCanvas');
  await plot.scrollIntoViewIfNeeded();
  const box = await plot.boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 40, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('#thetaSlider')).toHaveValue('89.9');
  await expect(page.locator('[data-preset="atr"]')).toHaveAttribute('aria-pressed', 'false');

  await page.click('#resetBtn');
  await expect(page.locator('#thetaSlider')).toHaveValue('45');
  await expect(page.locator('#stat-R')).toHaveText('0.050');
  expect(errors).toEqual([]);
  await context.close();
});

test('standing waves presets show the values their notes promise and unknown URL selects fall back to defaults', async ({ browser }) => {
  const { context, page, errors } = await openTool(browser, 'standing_waves', VIEWPORTS[2]);
  const preset = async (name) => { await page.click(`[data-preset="${name}"]`); await expect(page.locator(`[data-preset="${name}"]`)).toHaveAttribute('aria-pressed', 'true'); };
  const readout = (label) => page.locator('#modelReadout > div', { hasText: label }).locator('dd');
  await preset('pec');
  await expect(page.locator('#stat-swr')).toHaveText('∞');
  await expect(page.locator('#stat-nodes')).toHaveText('6');
  await expect(readout('Minimum spacing')).toHaveText('299.8 nm');
  await expect(readout('First minimum')).toHaveText('0 (at surface)');
  await preset('glass');
  await expect(page.locator('#stat-boundary')).toHaveText('0.20 ∠180°');
  await expect(page.locator('#stat-swr')).toHaveText('1.50');
  await expect(readout('Net power')).toHaveText('0.960');
  await preset('glassOut');
  await expect(page.locator('#stat-boundary')).toHaveText('0.20 ∠0°');
  await expect(page.locator('#stat-lambda')).toHaveText('399.7 nm');
  await expect(readout('First minimum')).toHaveText('99.93 nm');
  await preset('cavity4');
  await expect(page.locator('#stat-freq')).toHaveText('399.7 THz');
  await expect(readout('Antinodes / E nodes')).toHaveText('4 / 5');
  await expect(readout('Finesse')).toHaveText('29.8');
  await preset('quarter');
  await expect(page.locator('#stat-freq')).toHaveText('249.8 THz');
  await expect(readout('Antinodes / E nodes')).toHaveText('3 / 3');
  await preset('micro');
  await expect(readout('Exact Airy FWHM')).toHaveText('91.34 GHz');
  await expect(readout('Photon lifetime')).toHaveText('1.74 ps');
  // readout labels carry symbols (η, ν, τ, and r versus R), so they keep their case
  await expect(page.locator('#modelReadout dt').first()).toHaveCSS('text-transform', 'none');
  // an unknown select value from the URL falls back to the default instead of breaking the plot
  await page.goto('/tools/standing_waves/?mode=bogus&bnd=x&mir=y&L=2', { waitUntil: 'load' });
  await expect(page.locator('#modeSelect')).toHaveValue('single');
  await expect(page.locator('#boundaryType')).toHaveValue('pec');
  await expect(page.locator('#mirrorConfig')).toHaveValue('pec-pec');
  await expect(page.locator('#lengthSlider')).toHaveValue('2');
  await expect(page.locator('#stat-nodes')).toHaveText('7');
  expect(errors).toEqual([]);
  await context.close();
});

test('interference presets show the values their notes promise and labels keep their symbols', async ({ browser }) => {
  const { context, page, errors } = await openTool(browser, 'interference', VIEWPORTS[2]);
  const preset = async (name) => { await page.click(`[data-preset="${name}"]`); await expect(page.locator(`[data-preset="${name}"]`)).toHaveAttribute('aria-pressed', 'true'); };
  const readout = (label) => page.locator('#readout > div', { hasText: label }).locator('dd');
  await preset('constructive');
  await expect(page.locator('#stat-intensity')).toHaveText('4.000 I₁');
  await expect(page.locator('#stat-visibility')).toHaveText('1.000');
  await preset('destructive');
  await expect(page.locator('#stat-intensity')).toHaveText('0.000 I₁');
  await preset('quadrature');
  await expect(page.locator('#stat-intensity')).toHaveText('2.000 I₁');
  await preset('unequal');
  await expect(page.locator('#stat-intensity')).toHaveText('0.250 I₁');
  await expect(page.locator('#stat-visibility')).toHaveText('0.800');
  await preset('partial');
  await expect(readout('I_max')).toHaveText('3.000 / 1.000 I₁');
  await expect(page.locator('#stat-visibility')).toHaveText('0.500');
  await preset('gammaPhase');
  await expect(page.locator('#stat-intensity')).toHaveText('2.000 I₁');
  await preset('orthogonal');
  await expect(page.locator('#stat-visibility')).toHaveText('0.000');
  await expect(page.locator('#regimeWarn')).toContainText('Orthogonal polarizations');
  await preset('analyser');
  await expect(readout('I_max')).toHaveText('2.000 / 0.000 I₁');
  await expect(page.locator('#stat-visibility')).toHaveText('1.000');
  await preset('beating');
  await expect(readout('period')).toHaveText('0.0909 f₁, 11.00 T₁');
  await preset('slowDetector');
  await expect(page.locator('#stat-intensity')).toHaveText('2.000 I₁');
  // one beat period: the sinc zero reads 0.000, not -0.000
  await page.locator('#idint').evaluate((el) => { el.value = 11; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(readout('Averaging factor')).toHaveText('0.000');
  // uppercase labels must not turn γ into Γ or μ into M
  await expect(page.locator('#readout dt .sym').first()).toHaveCSS('text-transform', 'none');
  await expect(page.locator('.stat-label .sym').first()).toHaveCSS('text-transform', 'none');
  // an analyser crossed with both beams passes nothing: no fringes, not V = 1
  await page.goto('/tools/interference/?th=0&an=1&al=90', { waitUntil: 'load' });
  await expect(page.locator('#regimeWarn')).toContainText('blocks both beams');
  await expect(page.locator('#stat-visibility')).toHaveText('0.000');
  // a restored URL highlights the preset it matches
  await page.goto('/tools/interference/?ph=180', { waitUntil: 'load' });
  await expect(page.locator('[data-preset="destructive"]')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
  await context.close();
});
