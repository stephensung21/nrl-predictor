---
version: 1
slug: "web-app-tipping-page-tsx"
primary_target: "web/app/tipping/page.tsx"
related_targets: []
---

# Tips (`/tipping`)

Visitor mode: **Operate**. A friend on a phone on Tuesday or Wednesday night, tipping the whole round with one thumb in under a minute.

## Scope
Production Next.js route in `web/`. Tips save on every tap through a `TipStore` interface: the browser (localStorage) implementation now, a Supabase one later with no page changes. Sample round: the real 2026 Round 10 replay. Lockout is enforced in the page for the sample; the database enforces it later.

## States
Tipping open (nothing locked), round in progress (some games locked or final, with the group's tally), all tipped, nothing tipped, saving / saved / save failed, Model hint shown or hidden, featured game with no margin entered (default 12 applies).

## Direction contract
THESIS: The round as a stack of two-button choices you tap straight down: every game one row, two big team buttons, autosaved. Refuses the form-with-submit and the betting slip.
OWN-WORLD: DESIGN.md unchanged: team badges inside the buttons, your pick lit with lime (it is yours), the Model's hint in ink-3 with the MDL badge, locked rows dimmed with a lock, hairline rows, no cards.
STORY: See how many are left and when the next lockout is, tap down the list, set a margin on the featured game, glance at the Model if you want, leave.
FIRST VIEWPORT: Phone 390px: "Round 10 tips" heading with "3 of 7 tipped · next lockout Fri 6:00pm"; the Model-hint switch; the first three game rows, each a kickoff line and two half-width team buttons at least 56px tall.
FORM: Pinned by DESIGN_BRIEF.md (one list, two big buttons, autosave, hint toggle, margin input, greyed locked games); no roll.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
