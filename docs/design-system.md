# Design system

Technical Editorial: modern software documentation crossed with a research
notebook. It should read as precise, intelligent and understated, never as a
SaaS landing page or a hacker terminal. Light mode is paper, ink and cobalt;
dark mode is graphite and ice blue. The site and the tools share one palette
and one type family.

## Rules for every page

- No rounded corners. `border-radius: 0`. The only exception is something that
  is a circle by meaning: a dot, a graph node, a radio button, a status light.
- No gradients in UI: none on backgrounds, text, borders or buttons. Data
  colour scales drawn on a canvas, like heatmaps and spectra, are fine.
- No drop shadows and no glows. Separate things with space and 1px rules.
- No glassmorphism and no `backdrop-filter`.
- No emoji used as icons or decoration in the UI chrome. Use text labels,
  short mono glyphs (`>_`, `SQL`, `µ`), or small marks drawn in CSS or SVG.
- No luxury ornament: no gold, no serif display type, no corner clasps, no
  diamonds. Technical details instead: numbered sections (`01 / SUBJECTS`),
  mono metadata, ruler ticks, registration marks, notation used where it
  means something.
- Motion is restrained. Hover changes colour, underline or border. Cards and
  tiles that lead somewhere may also rise 2px (`translateY(-2px)`) and their
  arrow may move 2px; nothing scales, bounces or springs. Transitions run 120
  to 180ms and are linear or `ease`. Respect `prefers-reduced-motion`.
- Headings are left-aligned unless the content around them is centred.
- Colours come from tokens. Do not hard-code hex values in components.
- Every style must work in light and in dark mode. Dark mode is
  `.dark-mode` on `<html>` and `<body>`, driven by the `darkMode` cookie.

## Type

IBM Plex Sans for headings, text and UI; IBM Plex Mono for labels, numbers,
metadata, glyphs and code. Both load once, from `01_general.css`. Headings are
Plex Sans 600 with tight tracking (-0.01em to -0.025em). Section labels and
eyebrows are small uppercase Plex Mono with 0.08em tracking.

Google's Latin subset of Plex Mono covers ASCII and Latin-1 only, so glyphs
and labels stick to those characters (`±`, `µ`, `>_`). Arrows and other
symbols are drawn as SVG masks, not typed, so they never fall back to another
font.

## Palette

The site tokens (`src/resources/assets/01_general.css`) and the tool tokens
(`src/tools/shared/base.css`) describe the same palette.

| site token | tool token | light | dark | use |
| --- | --- | --- | --- | --- |
| `--surface-0` | `--g-bg` | `#f7f8fa` | `#0e1218` | page |
| | `--g-panel` | `#ffffff` | `#171e27` | panels, tiles |
| `--surface-1` | `--g-panel-2` | `#eef1f5` | `#171e27` / `#1e2732` | quiet band, code, table head |
| `--surface-2` | | `#e3e8ef` | `#1e2732` | hover fill |
| `--text-primary` | `--g-ink` | `#0e1218` | `#e9eef5` | ink |
| `--text-secondary` | `--g-ink-2` | `#3a4452` | `#b3bfcd` | body copy |
| `--text-muted` | `--g-ink-3` | `#5b6676` | `#8794a6` | meta, captions |
| `--border-default` | `--g-rule` | `#dce1e8` | `#263241` / `#303c4c` | hairline |
| `--border-hover` | `--g-rule-strong` | `#b4bdc9` / `#9aa6b5` | `#3d4b5e` / `#4b5b70` | hover hairline, ticks |
| `--accent` | `--g-accent` | `#1f4fd1` | `#8ac2ff` | cobalt / ice blue |
| | `--g-verdigris` | `#137a55` | `#63c79c` | success, second series |
| | `--g-moon` | `#6d4fd0` | `#b9a8ff` | info, third series |
| | `--g-ember` | `#b25a0c` | `#f0a35a` | warning, numbers in code |
| | `--g-rose` | `#c23b3b` | `#ff8f8f` | error |

The accent is rare: active nav item, link hover, section numbers, the focus
ring, the selected tile, the primary button. It is never a large fill.

Syntax highlighting (`11_code_block.css`, and `learning.css` for the quiz and
flashcard apps): keywords in the accent, strings green, numbers orange,
functions violet on the site and bold ink in the apps, comments muted.

## Site layer (`src/resources/assets/*.css`)

`style.css` is a bundle of the assets folder; rebuild it with
`cd scripts && python bundle_css.py` after editing any asset.

- Section header: mono eyebrow with a number (`01 — Learn`), a large heading
  (Plex Sans 600, tight tracking), and a 2px `--rule-strong` line above the
  block.
- Card: no box. An image with a 1px hairline frame, a mono eyebrow, a title
  and one line of text. On hover the title turns accent and is underlined.
- List row: full-width, 1px hairline between rows, a mono meta column on the
  right.
- Button: rectangle, 1px `--text-primary` border, transparent fill. Hover
  inverts it (ink fill, page-colour text). The primary button starts filled.
- Inputs: rectangle, 1px `--border-hover`. On focus the border turns
  `--text-primary` and an accent outline appears.
- Banners: no stock photos. A typographic band with a big title and a hairline
  under it.

## Tool layer (`src/tools/shared/base.css` and `grimoire.css`)

The same palette and type, with a few instrument-like details:

- Tool titles are centred Plex Sans 600 over a small accent registration mark
  (`--g-mask-sigil`), with a ruler rule under the header (`--g-mask-rule`: a
  hairline with ticks every 10px and major ticks every 50px).
- Panels are plain 1px boxes on `--g-panel`. Panel headings are Plex Sans 600;
  control group labels are small uppercase.
- Range thumbs are small squares. Tracks are a 2px line.
- Optics canvases stay dark in both themes. They use the graphite palette from
  `shared/optics/ui.js`.
- Canvas and SVG drawings read their colours from the `--g-*` tokens through
  `getComputedStyle`, so drawings follow the theme.

### Quiz and flashcard apps (`shared/learning.css`)

- Sections are numbered `01 / SUBJECTS` in mono.
- Subject tiles show a mono glyph (the `glyph` field in the generated
  `categories.json`), a Plex Sans 600 name, a description, and a metadata row
  that ends in a small arrow. The selected tile has an accent border with a
  2px accent edge along the top.
- An unfinished session is a quiet strip with an accent left edge, a small
  primary Resume button and a text-only Discard button.

### How the tool layer is wired

- `shared/base.css` (first tool sheet on every tool page) defines the `--g-*`
  tokens. `--g-gold`, `--g-gold-soft` and `--g-on-gold` are historical names
  for the accent, kept as aliases because many tools use them; new code uses
  `--g-accent`, `--g-accent-soft` and `--g-on-accent`. The `--tool-*` tokens
  are aliases too. Aliases are redeclared under `.dark-mode` so they follow
  the theme.
- `shared/grimoire.css` is the **last** stylesheet on every tool page. It:
  - forces all the older token families (`--primary-color`,
    `--surface-color`, `--reference-*`, `--visual-*`, `--optics-*`,
    `--spectrum-*`, `--arcane-*`, `--math-*` and the site's `--surface-0`,
    `--text-primary`, `--accent` and the rest) onto `--g-*` with `!important`;
  - zeroes `border-radius`, `box-shadow`, `text-shadow` and `backdrop-filter`
    on every element, at zero specificity (`:where(body.tool-page) *`). A real
    circle needs `border-radius: 50% !important` in an ordinary selector, or
    the `.g-round` class;
  - styles the shared skeleton: `.tool-header` and its `h1`, the
    `.header-icon` mark, `.stats-bar`, `.options-sidebar`, `.option-card`,
    `.canvas-container`, `.section-header`, `.explanation-card`,
    `.formula-box`, `.help-box`, buttons, inputs, selects, ranges, toggles,
    `kbd` and toasts;
  - hides the emoji icon spans `.stat-icon`, `.card-icon`,
    `.sidebar-header .icon`, `.canvas-title .icon` and `.section-header .icon`.
- Helpers for tool CSS: `.g-panel`, `.g-button`, `.g-round`,
  `var(--g-mask-rule)` and `var(--g-mask-sigil)` (SVG masks: set
  `background: var(--g-accent)` or `var(--g-rule-strong)` and
  `mask: var(--g-mask-rule) center / contain no-repeat`). `var(--g-clasp)` is
  now an empty layer kept for compatibility; `background: var(--g-clasp),
  var(--g-panel)` still works.
- Helpers for tool JS: `ToolShared.palette()` returns the current `--g-*`
  colours as camelCase keys (`gold`, `ink2`, `ruleStrong`, `canvas`, `grid`,
  and so on). `ToolShared.onThemeChange(cb)` calls `cb(palette)` when dark
  mode flips, so canvases can redraw.
