---
version: 1
slug: "web-app-news-page-tsx"
primary_target: "web/app/news/page.tsx"
related_targets: []
---

# News (`/news`)

Visitor mode: **Read** (a feed to scan and tap out of). A friend checking what's happening in the NRL between rounds.

## Scope
Production Next.js route in `web/`. A feed of r/nrl posts behind a `NewsSource` interface (`web/lib/news.ts`): a saved snapshot of the real subreddit feed now (titles, links, times; no usernames), the Reddit API with caching later (PLAN_WEB.md §3.6), which also brings the real flair. One filter: flair, as chips. Each post opens the Reddit thread in a new tab. Straight voice.

## States
All posts, filtered by a flair, a flair with no posts, the source failing (error state with banter allowed), the snapshot's date shown honestly.

## Direction contract
THESIS: A plain, fast list of what r/nrl is talking about: the headline is the content, the flair and time are quiet, and one row of flair chips is the only control. Refuses the card-grid news portal and the embedded Reddit clone (no votes, avatars or comment threads).
OWN-WORLD: DESIGN.md unchanged: Read-mode column, Sofia Sans headlines at body-plus size, Saira only for the page title, hairline rows, flair as small ink-3 labels, the shared chip style for the filter, an external-link icon on each row.
STORY: Scan the headlines, narrow to a flair if you want, tap one to read it on Reddit, come back.
FIRST VIEWPORT: Phone 390px: "News" heading with "from r/nrl" and the snapshot time; the flair chips in one row; the first five or six headlines.
FORM: Pinned by the user's answers (saved sample, flair filter) and PLAN_WEB.md §3.6; no roll.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
