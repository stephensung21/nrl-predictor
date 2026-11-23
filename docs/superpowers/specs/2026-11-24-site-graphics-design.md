# Site graphics: design

Fewer words, more pictures, across the whole site, in the site's own drawn style.

## Why

The user: the site has "a lot of text, even with all of the colour". The home page and ladder already
carry badges, pitch bars and big figures; the explaining pages (How the Model works, The Model, the
rules intros on last man standing and the Dally M), the message-only pages (signed out, not found,
off-season) and the news list are mostly sentences. Success: a first-time visitor understands a page
from its pictures and headings, and the paragraphs are there for whoever wants the detail.

## Decided by the user (24 November 2026)

- **The site's own graphics, not club logos** (no NRL or club trademarks).
- **The whole site**, not a page or two.
- **Approach 1, a drawn SVG kit** (below), chosen over an icon library alone and over image files.

## Goals, non-goals, anti-goals

- Goals: every page leads with a picture or a diagram where its words explain a process, a rule or a
  comparison; message pages get an illustration; the wordiest pages lose about half their words with
  no fact lost.
- Non-goals: club logos or crests; photography (player headshots on Players and the Dally M stay as
  they are); new data or features; animation beyond what's there (static art, see Motion).
- Anti-goals: clip art (generic stock-looking icons dropped beside text); decoration that carries no
  meaning; a card grid; lime used as decoration (DESIGN.md's One Lamp Rule); hiding the Model's limits
  (the "Where it falls down" section keeps its full weight, in pictures and words).

## Approaches

1. **Drawn SVG kit (chosen).** React components drawing inline SVG with the site's colour tokens, so
   light and dark mode follow; crisp, tiny, one style shared with the logo (goalposts, pitch bar,
   ball). Most drawing effort.
2. **Icon library only** (more Lucide). Quick, but generic, and message pages stay bare. Rejected.
3. **Image files** (generated or drawn PNG/SVG files). Richer, but heavier, can't follow the theme,
   and drift from the scoreboard look. Rejected.

## The kit (`web/components/art/`)

One style for all of it, "chalk on the scoreboard": 2px round-cap strokes (1.5px under 24px) in
`ink-2` and `ink-3`, flat fills in `pitch` and `raised-2`, `line` for ground lines. Lime only where the
picture means you, an action or a right call (a ticked tip, the ball between the posts on the join
page); team colours never (they stay in badges and pitch bars). Shapes from the logo: the H goalposts,
the rugby ball (an ellipse with a seam), the pitch with ten-metre lines.

- **Pictograms** (`Pictogram` with a `name`; 24 and 32px): pick, tick, cross, draw, crown, clock
  (lockout), eye-off (hidden until), votes-3-2-1, link, people (group), rain, late-change (swap), small
  data (a short bar), the crowd, the bookies (a price tag, never a brand), Elo (a rating dial),
  calendar.
- **Spot illustrations** (`Spot` with a `name`; about 120 by 90, scaled down on phones): `kick` (ball
  through the posts: join, sign-in), `empty-pitch` (off-season, nothing yet), `knock-on` (dropped
  ball: not found, errors), `whistle` (sign in to see this), `huddle` (groups), `team-sheet` (team
  lists not out yet), `ballot` (Dally M with no votes yet), `last-one` (a lone figure on the posts:
  last man standing with no game yet).
- **Rule strip** (`RuleStrip`): 3 to 5 steps in one row (wrapping on phones), each a 32px pictogram
  over a short bold line and at most one `ink-3` line. A hairline-ruled strip, not tiles or cards.
- **Flow diagram** (`FlowDiagram`): inputs on the left, a box in the middle, outputs on the right,
  joined by lines; stacks vertically under 480px. Labels are real text (HTML over or beside the SVG),
  so it reads and translates like text.
- **Compare bars** (`CompareBars`): two to four horizontal bars in the chart series colours (Model
  blue, bookies aqua, Elo orange, as DESIGN.md's chart rules), figure at the end in the score face.
  For "how it was tested" figures.

Every piece: `aria-hidden` when decorative (a spot next to a heading that already says it); a
diagram carries its meaning in real text, so a screen reader gets the same facts. No external files,
no fonts inside SVG.

## Page by page

- **How the Model works (`/about`):** "What goes in" becomes a flow diagram (team ratings, team
  lists, the situation, opening prices: the Model: win chance, margin and total, its tip). "Two
  versions" becomes a two-lane diagram (with odds: tips in the comp; without: Model vs market). "How it
  was tested" leads with compare bars, then one or two sentences. "Where it falls down" becomes
  pictogram rows (a third wrong, the bookies are hard to beat, late changes, weather, not much data,
  only the numbers), each one bold line and one short line. Prose cut by about half; the technical
  disclosure stays as is.
- **The Model (`/model`):** "How it was tested" reuses the compare bars plus one sentence and the link.
- **Last man standing:** the intro paragraph becomes a rule strip (pick one team; never the same team
  twice in a game; a loss, a draw or no pick and you're out; everyone out: the round doesn't count;
  the last one left wins, then a new game). The empty "no game yet" state gets `last-one`.
- **Dally M:** the intro becomes a rule strip (3, 2 and 1 votes; hidden until the next round kicks
  off; then everyone's revealed; the season leaderboard). No votes yet: `ballot`.
- **Tips:** the Dally M and last man standing reminders under the games become pictogram-led rows. The
  signed-out and off-season states get spots.
- **Groups and joining:** `/groups` leads with a rule strip (start one, share its link, your mates'
  ladder, same tips everywhere) and `huddle` when you're in none. `/join` and `/groups/join/<code>`
  lead with `kick` and a three-step strip (sign in, three answers, tip). Sign-in gets `kick`.
- **Message pages:** `PageMessage` gains an optional `art` (a spot name); every caller picks one
  (signed out: `whistle`; not in the comp: `kick`; off-season and "starts with Round 1": `empty-pitch`;
  not set up yet: `team-sheet`). Not found: `knock-on`. Error states: `knock-on`.
- **News:** each row gets a 24px pictogram for its flair (news, discussion thread, media), never the
  publisher's logo.
- **Elo:** the explaining paragraph under the title becomes a small diagram: two ratings, the gap, the
  win chance (with the 100 points = 64% example), plus the off-season drift in one line.
- **Model vs market:** the one-line explanation keeps its line, led by the market track's own legend;
  no new art (the page is already drawn).
- **Home, round, match, ladder, players, account, admin:** already led by badges, bars and figures;
  only their empty and message states change (above).

## Motion

Static. The logo's kick stays the one animated mark. Under reduced motion nothing changes, since
nothing moves.

## Constraints

- DESIGN.md is the system of record: no club logos, no photography beyond the existing headshots, no
  card grids, lime only for you, actions and right calls, team colours only in badges and pitch bars.
  Add an "Illustrations and pictograms" section to DESIGN.md describing the kit, and update "Empty and
  Error States", "Not Found" and "Read-mode Page".
- CLAUDE.md's redesign pipeline: read PRODUCT.md, DESIGN.md and design-system/MASTER.md; the taste
  skill for direction and screenshot checks at 1440, 768 and 390 before moving on; impeccable polish at
  the end.
- Light and dark: every colour from a token; check both themes in screenshots.
- No new dependencies. Inline SVG only; each spot under about 3 KB.
- Copy keeps every fact (the about page's limits stay complete); the site's voice; banter only where
  DESIGN.md allows it.
- Existing tests keep passing; add a test that every `Pictogram` and `Spot` name renders and that
  decorative ones are `aria-hidden`.

## Left to the builder

- The exact drawings, within the style above.
- Final wording of the shortened copy.
- Pictogram sizes per spot, within 24 and 32px.
