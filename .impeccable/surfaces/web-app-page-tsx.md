---
version: 1
slug: "web-app-page-tsx"
primary_target: "web/app/page.tsx"
related_targets: []
---

# Home (`/`)

Visitor mode: **Operate**. A friend on a phone checking the round: have I tipped, what does the Model say, how am I going against everyone and the Model.

## Scope
Production Next.js page in `web/`, app shell included (wordmark, bottom tab bar on phone, top bar on desktop, footer). Sample data shaped like the planned Supabase tables, from the 2026 Round 10 replay; tipper names are sample and labelled. No sign-in, no live scores, other routes only linked.

## States
The page follows the NRL week: **recap** (Mon until Tuesday predictions) → **tipping open** (until first kickoff) → **round in progress** (Live, "Full time · result soon", graded). Signed in / signed out. Off-season, predictions-pending and load-error states carry the banter. Up to 9 games per round, as few as 4–5 in Origin rounds.

## Direction contract
THESIS: The round as a scoreboard you read in two seconds: the call first ("Roosters by 14"), then how sure the Model is, drawn on the pitch itself. Refuses the betting-app card grid and the sports-portal hero.
OWN-WORLD: Night game under lights. Green-black pitch ground, floodlight-white text, one lime accent reserved for you, actions and right calls. Saira Extra Condensed set like a scoreboard (tabular figures) over a plain sans body. Two-colour team badges with 3-letter codes. Hairline rows, no card stacks.
STORY: Tipping strip says what you owe (tips missing, next lockout); the featured margin game sits as the lit board; every other game is a dense row; the Model's record closes it honestly.
FIRST VIEWPORT: Phone 390px: wordmark bar; tipping strip full-width with "3 of 7 tipped" as the biggest type; featured game board (badges, scoreboard score, pitch bar); first two rows visible; bottom tab bar fixed with Round active.
FORM: Pinned by DESIGN_BRIEF.md (binding per PRODUCT.md); no concept roll. Signature move: the win-probability bar drawn as a pitch with a halfway line and ten-metre lines, filled from each end in team colours, so a 55% game visibly sits just past halfway.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
