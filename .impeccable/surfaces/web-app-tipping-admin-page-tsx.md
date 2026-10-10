---
version: 1
slug: "web-app-tipping-admin-page-tsx"
primary_target: "web/app/tipping/admin/page.tsx"
related_targets: []
---

# Tipping admin (`/tipping/admin`)

Visitor mode: **Operate**. The comp's owner, on a phone or laptop, doing a quick chore: invite a mate, check who's missing tips, remove someone, see whether this week's pipeline ran.

## Scope
Production Next.js route in `web/`, admin only. Four sections: invites (create a one-use link that lasts 7 days, copy or share it, see pending / used / expired, cancel a pending one); tippers (name, favourite team, joined, tips still missing this round, remove with confirmation); the margin game (this round's, and how the next round's will be drawn: at random, leaving out both teams from this round's margin game, per PLAN_WEB.md §3.5); pipeline status (the last results / predict / refresh runs from the run log, with status and model version). A working mock behind an `AdminStore` interface (`web/lib/admin.ts`), browser storage, swap point for Supabase. Sample tippers, invites and runs are labelled.

## States
Invite created (link shown, copied), no pending invites, cancelled invite, removing a tipper (confirm), pipeline run failed, the next round's draw previewed.

## Direction contract
THESIS: An owner's checklist on one page: four short hairline-ruled sections, each answering "is anything needing me?" at a glance, with the one action beside it. Refuses the admin dashboard of cards and charts.
OWN-WORLD: DESIGN.md unchanged: Saira section heads, hairline rows, team badges, the lime pill for the one primary action (Create invite), status words in ink tokens (amber only for a run in progress or a needed attention, coral only for a failed run and the remove confirmation), tabular figures.
STORY: Make an invite and send it, see who still owes tips this round, check the margin game and next week's draw rule, confirm the pipeline ran.
FIRST VIEWPORT: Phone 390px: "Admin" heading with "Round 10 · tipping open"; the invites section with the Create invite pill and the pending invites list.
FORM: Pinned by the user's answers (invites 7 days one use, tippers, pipeline status, random margin game) and PLAN_WEB.md §2-3; no roll.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
