# Home dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/` shows a signed-in tipper their to-dos and every comp at a glance.

**Architecture:** A pure `web/lib/dashboard.ts` turns the round view, the last man standing turn and the Dally M state into to-dos and panel figures; `web/components/dashboard.tsx` lays them out; `web/app/page.tsx` gathers the data (sample or live) and falls back to today's page for anyone without comps.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-home-dashboard-design.md`

## Global Constraints

- One raised board (To do); hairline sections otherwise; lime only for you, actions and right calls.
- No new database objects.
- The nav's first tab is "Home" (icon `House`), active on `/`, `/round/*` and `/match/*`.

## Review Focus

- All games tipped and nothing else open: "All done", no empty board.
- Out of last man standing in the shown group but still in another game: the pick to-do still shows (the page's `fields` logic).
- A round where every game has kicked off: no tips to-do, lamps still show.
- No Dally M round open: no Dally M to-do.
- Model not in a group's standings: the ladder panel copes without it.

---

### Task 1: The to-do rules

**Files:** Create `web/lib/dashboard.ts`; Test `web/tests/dashboard.test.ts`.

**Interfaces:** Produces `type Todo = { key: "tips" | "margin" | "lms" | "dallym"; done: boolean; title: string; note?: string; action?: { href: string; label: string } }` and `todos(input: { view: RoundView; now: Date; yourMargin?: number; lms: { round: number; alive: boolean; picked?: TeamName } | null; dallyM: { round: number; closes: string; voted: boolean } | null }): Todo[]` (open first, then done).

- [ ] Tests: tips open with count and next lockout; all tipped → done; margin missing before featured kickoff → open; lms alive no pick → open, picked → done, out → absent; Dally M open and not voted → open, voted → done, none → absent.
- [ ] Implement; run `npx vitest run tests/dashboard.test.ts`; commit.

### Task 2: The page

**Files:** Create `web/components/dashboard.tsx`; Modify `web/app/page.tsx`, `web/components/app-nav.tsx`, `web/lib/source.ts` (a `viewerDallyM(group?)` helper if needed).

- [ ] Sample: signed-in states render the dashboard from the sample round, sample LMS and sample Dally M; "View signed out" keeps today's page.
- [ ] Live: signed-in tipper with a comp → dashboard; otherwise today's page.
- [ ] Nav: Round → Home.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npx vitest run`; screenshots at 390, 768, 1440; commit.

### Task 3: Docs and checks

- [ ] DESIGN.md: a Home Dashboard component section and the nav change; PLAN_WEB.md page table.
- [ ] `npm run build`; impeccable detect on the rendered page; commit.
