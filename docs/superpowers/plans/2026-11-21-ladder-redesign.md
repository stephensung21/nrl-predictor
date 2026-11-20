# Ladder Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the tipping ladder page as a sharper scoreboard (gap and margin columns, the Model as a divider, Hot/Cold call-outs, a round heatmap, bragging-rights tiles).

**Architecture:** One pure helper, `formFor`, in `web/lib/comp-stats.ts` computes Hot/Cold from the `LadderEntry[]` both the live and sample comps already produce. The page `web/app/tipping/ladder/page.tsx` derives everything else (gap, divider position, heatmap tint) from the same entries. No database, scoring or `LadderView` changes.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 4 (tokens in `web/app/globals.css`), vitest.

**Spec:** `docs/superpowers/specs/2026-11-21-ladder-redesign-design.md`

## Global Constraints

- `DESIGN.md` tokens only: no new palette, typeface or component style. Model colour is the existing `series-model` (#3987e5).
- Text ≥ 11px; WCAG AA contrast everywhere, including tinted heatmap cells.
- No side-stripe accents: your row is a full `bg-lime-wash` tint.
- No changes to `lib/scoring.ts`, `lib/comp.ts`'s `LadderView`, SQL or migrations.
- Keep the existing screen-reader text (table caption, "Not ranked", per-cell round details).
- Run from `web/`. Node is at `C:\Program Files\nodejs` (prepend it to PATH).

## Review Focus

- A Model that leads everyone: divider sits above row 1, and the summary line says "behind the Model".
- A Model level on points with tippers: divider goes after the tippers on equal points (the Model never outranks a tied human visually).
- Ties on points and margin (`=4`): both rows show `=4`, the same gap, and their own margin score.
- Early season (rounds 1–2, or a round in progress): no Hot/Cold anywhere; the heatmap shows partial-round cells without breaking width.
- Many rounds (late season, ~27): the heatmap scrolls sideways with the name column sticky, at 390px.

---

### Task 1: Hot/Cold helper

**Files:**
- Modify: `web/lib/comp-stats.ts` (add after `tagsFor`)
- Create: `web/tests/comp-stats.test.ts`

**Interfaces:**
- Produces: `export function formFor(entries: LadderEntry[]): Map<string, "hot" | "cold">` keyed by `tipper.id`.

Rule: use each human tipper's rounds with `partial === false`; if fewer than 3, return an empty map. Score = sum of `correct + bonus` over the last 3 such rounds. The single highest scorer is `"hot"`, the single lowest `"cold"`; a tie at the top (or bottom) means no entry for it. Model entries are ignored. Fewer than 3 human tippers → empty map (same as `tagsFor`).

- [ ] **Step 1: Write the failing tests** in `web/tests/comp-stats.test.ts`, with a local helper `entry(id: string, perRound: number[], opts?: { model?: boolean; partialLast?: boolean }): LadderEntry` building `RoundScore`s (`games: 8, bonus: 0, autoTips: 0, marginScore: 0`).
  - `"hot and cold from the last three finished rounds"`: A `[0,0,8,8,8]`, B `[8,8,4,4,4]`, C `[8,8,1,1,1]` → `{A: "hot", C: "cold"}`, B absent (A wins despite fewer total points: only the last three count).
  - `"no call-out before three finished rounds"`: three tippers with two rounds, plus a third round marked partial → empty map.
  - `"a tie means no call-out"`: A `[5,5,5]`, B `[5,5,5]`, C `[1,1,1]` → only `{C: "cold"}`.
  - `"the Model is never hot or cold"`: Model `[8,8,8]` plus A `[6,6,6]`, B `[4,4,4]`, C `[2,2,2]` → `{A: "hot", C: "cold"}`.
  - `"fewer than three tippers: none"`: A, B only → empty map.

- [ ] **Step 2: Run to verify they fail**
  Run: `npx vitest run tests/comp-stats.test.ts`
  Expected: FAIL, `formFor` is not exported.

- [ ] **Step 3: Implement `formFor`** in `web/lib/comp-stats.ts` per the rule above, with a doc comment matching `tagsFor`'s style.

- [ ] **Step 4: Run to verify they pass**
  Run: `npx vitest run tests/comp-stats.test.ts`
  Expected: 5 passed.

- [ ] **Step 5: Commit**
  `git add web/lib/comp-stats.ts web/tests/comp-stats.test.ts && git commit -m "Ladder: Hot and Cold form call-outs (formFor)"`

### Task 2: Design system master file

**Files:**
- Create: `design-system/MASTER.md` (repo root)

- [ ] **Step 1:** Invoke the `ui-ux-pro-max:ui-ux-pro-max` skill with `--design-system --persist`, seeded from `DESIGN.md`'s tokens and `PRODUCT.md`. The output must carry `DESIGN.md`'s palette, typefaces and components unchanged and say at the top that `DESIGN.md` wins conflicts; it adds UX, accessibility and Next.js/Tailwind guidance only.
- [ ] **Step 2: Verify:** `grep -c "oklch(0.91 0.2 126)" design-system/MASTER.md` ≥ 1 (lime carried over) and no hex/oklch colour in it that isn't in `DESIGN.md`.
- [ ] **Step 3: Commit:** `git add design-system/MASTER.md && git commit -m "Design system master file, derived from DESIGN.md"`

### Task 3: The page

**Files:**
- Modify: `web/app/tipping/ladder/page.tsx` (`Ladder`, `LadderTable`, `RoundGrid`, `Stats`; `LadderPage`/`LiveLadder` unchanged)

**Interfaces:**
- Consumes: `formFor(entries)` from Task 1; existing `tagsFor`, `seasonStats`, `ordinal`, `TeamBadge`, `ModelBadge`.

Decisions the code must follow (from the spec):
- **Columns:** position (Saira, 22px; 1st in `text-lime-fg`; `=` prefix on ties; small `Movement` beside it), tipper (badge, name, `YOU` tag, `HOT` in `text-lime-fg` / `COLD` in `text-miss`, banter tag as second line), points (Saira ~26px bold), gap (`gapToFirst = topHumanPoints − e.points`, rendered `–` when 0 else `−N` with U+2212), margin score (Saira, `text-ink-3`). Header labels: Pts, Gap, Margin.
- **Model divider:** a `<tr>` spanning all five columns, placed after the last human with `points >= model.points`, i.e. before the first human with fewer points (top of the table if none). Content: dashed rules either side of `The Model · {points} · {marginScore}` in `series-model` colour, with `sr-only` "The Model, not ranked:". Remove the Model's normal row from the table.
- **Your row:** `bg-lime-wash`, no inset/side border.
- **Summary line:** existing copy, inside a `bg-raised rounded-lg px-3 py-2.5` panel, the position and both gaps in `font-semibold text-ink`.
- **Heatmap:** each round cell gets background `oklch(0.91 0.2 126 / a)` with `a = 0.06 + 0.64 × (correct + bonus) / games`; cells with `a ≥ 0.4` use `text-lime-ink`, others `text-ink`. Keep bold for the round's best, `+`, `*`, sticky name column, `overflow-x-auto`. Model row keeps `bg-raised-2` cells (no tint).
- **Bragging rights:** a 3-column grid of `bg-raised rounded-lg` tiles (1 column under 360px is not needed; 3 fit at 390px). Big Saira figure, label, detail line: streak → `{length}` / "Longest streak" / "{name}, ended round N" or "and counting"; upset → `{modelChance%}` / "Biggest upset" / "{name}: {team} over {opponent}, round N"; perfect → `{count}` / "Perfect rounds" / names or "Nobody yet."

- [ ] **Step 1:** Implement the above.
- [ ] **Step 2: Verify:** `npm run lint` clean; `npx tsc --noEmit` clean; `npm test` all pass.
- [ ] **Step 3: Verify in the browser** (dev server on sample data) with `design-taste-frontend`'s headless checks at 1440, 768 and 390px for `/tipping/ladder?state=recap`, `?state=open`, `?state=live`: no horizontal overflow outside the heatmap, divider placed above Mick (Model 44 leads), Jacko and Tom both `=4`.
- [ ] **Step 4: Commit:** `git add web/app/tipping/ladder/page.tsx && git commit -m "Ladder: sharper scoreboard, Model divider, heatmap, bragging-rights tiles"`

### Task 4: Polish gate

- [ ] **Step 1:** Run `/impeccable polish` on `web/app/tipping/ladder/page.tsx`; fix every finding.
- [ ] **Step 2: Verify:** impeccable's check reports zero violations for the page; rerun `npm test`.
- [ ] **Step 3: Commit** any fixes: `git commit -am "Ladder: impeccable polish fixes"`
