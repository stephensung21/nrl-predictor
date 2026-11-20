# Design system master: rugbyleague-tipper

**`DESIGN.md` is the design system of record and wins every conflict.** This file adds UX, accessibility and stack guidance on top of it. It defines no colours, typefaces or components of its own: use the tokens in `DESIGN.md` (implemented in `web/app/globals.css`) and nothing else.

Derived 2026-11-21 from `DESIGN.md`, `PRODUCT.md` and the ui-ux-pro-max guideline database (`ux` domain, `nextjs` stack). Its generated palette and type (red/gold, Barlow) were discarded as conflicting with `DESIGN.md`.

## Carried from DESIGN.md (summary; read DESIGN.md for values)

- **Theme:** dark "under lights" by default; a light "Day Game" theme. Every new surface must work in both: use tokens, never raw colours, and check contrast in both themes.
- **Colour roles:** `ground` / `raised` / `raised-2` surfaces; `line` / `line-soft` rules; `ink` / `ink-2` / `ink-3` text; `lime` the only accent (you, your tips, primary actions, right calls), `lime-ink` for text on lime, `lime-fg` for lime used as a mark on the ground; `miss` for wrong calls; `live` for in-progress; `series-model` / `series-market` / `series-elo` for the three data series.
- **Type:** Saira Extra Condensed with tabular lining figures for display, headings and every score or number; Sofia Sans for body.
- **Form:** scoreboard tables and hairline rows, not cards and avatars. Plain-English call first, then the numbers.

## Users and context (PRODUCT.md)

A few invited friends in one private comp, mostly on phones: tipping Tuesday/Wednesday night, checking scores and the ladder during and after games. Pages must read at a glance at 390px wide.

## UX rules

1. **Contrast:** text ≥ 4.5:1 (large text, ≥ 24px or 19px bold, ≥ 3:1) against its actual background, including tinted rows and cells, in both themes. No grey-on-grey: `ink-3` only on `ground`/`raised`, never on a tint that lowers it below 4.5:1.
2. **Text size:** body 15px; nothing functional below 11px (labels, tags, table cells, meta rows).
3. **Colour is never the only signal:** pair it with a word, symbol or position (`HOT`/`COLD` labels, `+`/`*` marks, `=` on ties).
4. **Tables on mobile:** keep the main table within 390px with no horizontal scroll; wide secondary grids scroll inside their own `overflow-x-auto` container with a sticky first column. Numbers right-aligned in tabular figures.
5. **Touch:** interactive targets ≥ 44×44px with ≥ 8px between them.
6. **Focus:** visible `lime-fg` focus rings on every interactive element; never remove outlines.
7. **Motion:** 150–300ms, meaningful only; everything still under `prefers-reduced-motion`.
8. **Screen readers:** tables keep captions, header scopes and `sr-only` expansions of compressed figures ("5 of 8, plus a bonus point").
9. **Accents:** no side-stripe borders on rounded boxes; mark a row with a full tint instead.
10. **Layout checks:** every page at 1440px, 768px and 390px before moving on.

## Stack (Next.js 15 App Router, React 19, Tailwind 4)

- Server Components by default; fetch data in async pages (`lib/source.ts` picks database or sample). Client components only for interaction.
- Style with Tailwind utilities on the `globals.css` theme tokens (`bg-raised`, `text-ink-3`, `font-score`…). A computed value that needs a token (e.g. a tint strength) uses `color-mix()` or `oklch(from var(--color-…) …)` on the CSS variable, never a hard-coded colour, so the light theme follows.
- Pages render per request; no client-side fetching for initial data.

## Page overrides

Per-page notes live in `.impeccable/surfaces/` (one file per route). They refine this file; `DESIGN.md` still wins.
