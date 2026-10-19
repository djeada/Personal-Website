# Design system

Two layers. The site is modernist: flat, typographic, grid-aligned. The tools
use the same skeleton with a dark-fantasy dressing on top, a "scholar's
instrument" look rather than a sinister one.

## Rules for every page

- No rounded corners. `border-radius: 0`. The only exception is something that
  is a circle by meaning: a dot, a graph node, a radio button, a status light.
- No gradients in UI: none on backgrounds, text, borders or buttons. Data
  colour scales drawn on a canvas, like heatmaps and spectra, are fine.
- No drop shadows and no glows. Separate things with space and 1px rules.
- No glassmorphism and no `backdrop-filter`.
- No emoji used as icons or decoration in the UI chrome. Use text labels, or
  small geometric marks drawn in CSS.
- No bouncy "spring" easing, no hover lift (`translateY`), no scale-on-hover.
  Hover changes colour, underline or border, nothing else. Transitions run
  120 to 180ms and are linear or `ease`.
- Headings are left-aligned unless the content around them is centred.
- Colours come from tokens. Do not hard-code hex values in components.
- Every style must work in light and in dark mode. Dark mode is
  `.dark-mode` on `<html>` and `<body>`.

## Site layer (`src/resources/assets/*.css`)

Type: IBM Plex Sans for text and UI, IBM Plex Mono for labels, numbers and
code. Both load once, from `01_general.css`.

| token | light | dark | use |
| --- | --- | --- | --- |
| `--surface-0` | `#ffffff` | `#0e0e0e` | page |
| `--surface-1` | `#f4f4f2` | `#161616` | quiet band, code, table head |
| `--surface-2` | `#e9e9e6` | `#1f1f1f` | hover fill |
| `--text-primary` | `#111111` | `#f0f0ee` | ink |
| `--text-secondary` | `#444444` | `#b4b4af` | body copy |
| `--text-muted` | `#6b6b6b` | `#8c8c87` | meta, captions |
| `--border-default` | `#e2e2df` | `#2a2a28` | hairline |
| `--border-hover` | `#bdbdb8` | `#4a4a46` | hover hairline |
| `--rule-strong` | `#111111` | `#f0f0ee` | 2px section rules |
| `--accent` | `#d4371c` | `#ff5a3c` | one signal colour (vermilion) |

The accent is rare: active nav item, link hover, the section number, focus
ring. It is never a large fill.

Patterns:

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

## Tool layer ("grimoire", `src/tools/shared/grimoire.css`)

The base is the same, with these additions:

- Display type: Cormorant Garamond 600 for tool titles and panel headings.
  Panel headings are small caps with 0.08em tracking. Body and controls stay
  in Plex Sans, and readouts stay in Plex Mono.
- Palette: night ink with candle gold in dark mode, vellum with iron-gall ink
  in light mode. Verdigris marks success or a second series. Moonlight marks
  info or a third series. Ember is for warnings and a muted rose for errors.
  No blood red and no purple-neon.
- Ornament: panels get small gold corner clasps (L-shaped ticks at two
  opposite corners). Section dividers are a hairline with a small diamond
  `◆` in the middle. Tool titles get a diamond rule below them.
- The emoji hero icon is replaced by a sigil: an outlined diamond with a dot.
- Optics canvases stay dark in both themes. They use the night palette from
  `shared/optics/ui.js`.
- Range thumbs are small square or diamond shapes. Tracks are a 2px line.
- Canvas and SVG drawings read their colours from the `--g-*` tokens through
  `getComputedStyle`, so drawings follow the theme.

| token | dark (night) | light (vellum) |
| --- | --- | --- |
| `--g-bg` | `#0c0d10` | `#f4f0e6` |
| `--g-panel` | `#121318` | `#fbf8f1` |
| `--g-panel-2` | `#181a20` | `#efe9dc` |
| `--g-rule` | `#2a2b31` | `#d8d0bf` |
| `--g-rule-strong` | `#5a4f39` | `#a8946a` |
| `--g-ink` | `#e9e4d8` | `#1c1a17` |
| `--g-ink-2` | `#a7a294` | `#4f4a40` |
| `--g-ink-3` | `#85806f` | `#6c6557` |
| `--g-gold` | `#c8a55a` | `#8a6620` |
| `--g-verdigris` | `#6fb3a3` | `#2e6e62` |
| `--g-moon` | `#9fb4d4` | `#3d5a85` |
| `--g-ember` | `#d0843c` | `#a4511f` |
| `--g-rose` | `#c9716a` | `#9e3b36` |

The older `--tool-*` tokens in `shared/base.css` are aliases of these.

### How the tool layer is wired

- `shared/base.css` (first tool sheet on every tool page) defines the `--g-*`
  tokens and the `--tool-*` aliases.
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
    `.header-icon` sigil, `.stats-bar`, `.options-sidebar`, `.option-card`,
    `.canvas-container`, `.section-header`, `.explanation-card`,
    `.formula-box`, `.help-box`, buttons, inputs, selects, ranges, toggles,
    `kbd` and toasts;
  - hides the emoji icon spans `.stat-icon`, `.card-icon`,
    `.sidebar-header .icon`, `.canvas-title .icon` and `.section-header .icon`.
- Helpers for tool CSS: `.g-panel` (a panel with clasps), `.g-button`,
  `.g-round`, `var(--g-clasp)` (corner-tick background layers, used as
  `background: var(--g-clasp), var(--g-panel)`), `var(--g-mask-rule)` and
  `var(--g-mask-sigil)` (SVG masks: set `background: var(--g-gold)` and
  `mask: var(--g-mask-rule) center / contain no-repeat`).
- Helpers for tool JS: `ToolShared.palette()` returns the current `--g-*`
  colours as camelCase keys (`gold`, `ink2`, `ruleStrong`, `canvas`, `grid`,
  and so on). `ToolShared.onThemeChange(cb)` calls `cb(palette)` when dark
  mode flips, so canvases can redraw.
- The corner-tick `linear-gradient` inside `--g-clasp` is the only allowed
  gradient in UI chrome, because its hard stops draw solid lines.
