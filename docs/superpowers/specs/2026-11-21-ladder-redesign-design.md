# Ladder page redesign

Date: 2026-11-21. Page: `web/app/tipping/ladder/page.tsx` (`/tipping/ladder`).

## Why

The owner finds the ladder plain and hard to read at a glance. A friend opening it on their phone should see in one look: who's top, where they sit, how far behind they are, whether anyone is beating the Model, and who's in form.

## Goals

- Standings readable at a glance on a 390px phone: big points, a gap-to-1st figure, your row unmistakable.
- The Model shown as the line everyone measures against, positioned by its points.
- Form visible: a Hot and a Cold call-out, and a round-by-round heatmap.
- Bragging rights as quick-read stat tiles.

## Non-goals

- No change to scoring, tiebreaks, the database, migrations or `lib/scoring.ts`.
- The empty pre-season state ("The ladder starts with Round 1.") and the sign-in/not-in-comp messages stay as they are.
- No new pages, routes or shared component kit.

## Anti-goals

- Not a leaderboard of avatars and cards: it stays a scoreboard table (the page's surface brief in `.impeccable/surfaces/web-app-tipping-ladder-page-tsx.md`).
- No new palette, typeface or component style: `DESIGN.md` tokens only.
- Ties must stay explainable: margin score stays visible.

## Approaches

1. **Rework the page and add Hot/Cold to `lib/comp-stats.ts` (chosen).** Live (`readLadder`) and sample (`lib/ladder.ts`) both produce `LadderEntry[]` with per-round scores, so everything new is derived in TypeScript; one change serves both.
2. Compute Hot/Cold in SQL: needs a migration and deploy for a cosmetic feature, and duplicates logic the site already has. Rejected.
3. A new separate component kit: more to keep in sync, nothing to reuse. Rejected.

## Design (decided with the owner)

Direction A "Sharper scoreboard" from the mockups, plus C's Hot/Cold call-outs and Bragging rights tiles.

**Table, five columns:** position · tipper · points · gap · margin score.
- Position in Saira, larger; 1st in lime. Ties shown as `=4`.
- Tipper: favourite-team badge, name, `YOU` tag, `HOT`/`COLD` call-out, and the existing banter tag (`tagsFor`) as a small second line.
- Points: the largest figure in the row.
- Gap: points behind the top-ranked tipper (`–` for the leader and anyone level with them, `−3` etc. otherwise).
- Margin score: kept as the fifth column (the tiebreaker), quieter than points.
- **Your row:** full lime-wash tint (no side stripe).
- **The Model:** not a ranked row but a dashed divider placed where its points fall in the order, labelled `The Model · 44 · 189`, in the Model's series blue. Above every tipper when it leads.

**Summary line** under the table, as now ("You're 3rd, 5 off the lead and 7 behind the Model."), in a raised panel with the key figures in bold.

**Hot and Cold:** from Round 3 on (three or more counted rounds), each tipper's points over the last three rounds (correct + bonus). The single highest is Hot, the single lowest is Cold. A tie for either means no call-out for it. The Model is never Hot or Cold.

**Round by round:** heatmap grid. Each cell shows the round's points; its lime tint scales with points ÷ games in that round. Keeps today's `+` (perfect-round bonus) and `*` (auto-tip) marks and the bold for the round's best. The Model's row stays in the grid, in its raised tint. Sticky name column and horizontal scroll once rounds outgrow the width.

**Bragging rights:** three stat tiles (longest streak, biggest upset tipped, perfect rounds), each with the big figure, the label and the detail line (who, and the specifics already in `seasonStats`). "Nobody yet." states stay.

## Constraints

- Text ≥ 11px, WCAG AA contrast on every cell including tinted heatmap cells (dark text on bright tints, ink on dim).
- Layout checked at 1440px, 768px and 390px (`design-taste-frontend`), then `/impeccable polish` with zero violations, per `CLAUDE.md`.
- `design-system/MASTER.md` generated from `DESIGN.md` before the build if it doesn't exist; `DESIGN.md` wins conflicts.
- Screen-reader text as today: the table caption, "Not ranked", round cell details.

## Left to the builder

- Exact sizes and spacing within the `DESIGN.md` ramp; the heatmap's tint steps.
- Movement arrows (places up/down since last round): my call is to keep them, small, next to the position.
- Unit tests for Hot/Cold in `web/tests/comp.test.ts` (ties, under three rounds, partial round).
