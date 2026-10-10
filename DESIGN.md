---
name: rugbyleague-tipper
description: Tipping comp and NRL predictor for a few mates, read like a scoreboard under lights.
colors:
  ground: "oklch(0.165 0.02 162)"
  raised: "oklch(0.205 0.022 162)"
  raised-2: "oklch(0.245 0.024 162)"
  line: "oklch(0.31 0.022 162)"
  line-soft: "oklch(0.255 0.02 162)"
  pitch: "oklch(0.235 0.035 152)"
  pitch-line: "oklch(0.42 0.03 150)"
  ink: "oklch(0.965 0.008 110)"
  ink-2: "oklch(0.82 0.016 150)"
  ink-3: "oklch(0.68 0.018 155)"
  lime: "oklch(0.91 0.2 126)"
  lime-hover: "oklch(0.94 0.19 126)"
  lime-ink: "oklch(0.22 0.05 135)"
  lime-wash: "oklch(0.91 0.2 126 / 0.12)"
  miss: "oklch(0.74 0.15 28)"
  miss-wash: "oklch(0.74 0.15 28 / 0.12)"
  live: "oklch(0.78 0.16 60)"
  series-model: "#3987e5"
  series-market: "#199e70"
  series-elo: "#d95926"
typography:
  display-hero:
    fontFamily: "Saira Extra Condensed, Arial Narrow, sans-serif"
    fontSize: "56px"
    fontWeight: 800
    lineHeight: 0.86
    letterSpacing: "normal"
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
  display:
    fontFamily: "Saira Extra Condensed, Arial Narrow, sans-serif"
    fontSize: "46px"
    fontWeight: 700
    lineHeight: 0.9
  score-board:
    fontFamily: "Saira Extra Condensed, Arial Narrow, sans-serif"
    fontSize: "48px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
  headline:
    fontFamily: "Saira Extra Condensed, Arial Narrow, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1
  title:
    fontFamily: "Saira Extra Condensed, Arial Narrow, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.005em"
  section:
    fontFamily: "Saira Extra Condensed, Arial Narrow, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1
  score-row:
    fontFamily: "Saira Extra Condensed, Arial Narrow, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
  body:
    fontFamily: "Sofia Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "\"tnum\" 1"
  body-lg:
    fontFamily: "Sofia Sans, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.625
  meta:
    fontFamily: "Sofia Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.25
  caption:
    fontFamily: "Sofia Sans, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.25
  label:
    fontFamily: "Sofia Sans, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
rounded:
  lamp: "2px"
  bar: "3px"
  focus: "4px"
  badge: "5px"
  wash: "6px"
  row: "8px"
  board: "12px"
  pill: "9999px"
spacing:
  hair: "3px"
  xs: "4px"
  sm: "8px"
  row-y: "12px"
  md: "16px"
  lg: "24px"
  section: "32px"
  column: "544px"
  chart: "640px"
  wide: "960px"
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.lime-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.lime-hover}"
  button-on-lime:
    backgroundColor: "{colors.lime-ink}"
    textColor: "{colors.lime}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
  link-quiet:
    textColor: "{colors.ink-2}"
    typography: "{typography.meta}"
  chip:
    textColor: "{colors.ink-2}"
    typography: "{typography.meta}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
  board:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.board}"
    padding: "16px"
  tipping-strip-loud:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.lime-ink}"
    typography: "{typography.display-hero}"
    padding: "14px 16px"
  game-row:
    rounded: "{rounded.row}"
    padding: "12px"
  game-row-hover:
    backgroundColor: "{colors.raised}"
  team-badge-sm:
    rounded: "{rounded.badge}"
    width: "38px"
    height: "24px"
  team-badge-md:
    rounded: "{rounded.badge}"
    width: "44px"
    height: "28px"
  team-badge-lg:
    rounded: "{rounded.badge}"
    width: "66px"
    height: "44px"
  model-badge:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.badge}"
  pitch-bar-sm:
    backgroundColor: "{colors.pitch}"
    rounded: "{rounded.bar}"
    height: "7px"
  pitch-bar-lg:
    backgroundColor: "{colors.pitch}"
    rounded: "{rounded.bar}"
    height: "14px"
  tab-bar:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink-3}"
    height: "64px"
  tab-bar-active:
    textColor: "{colors.ink}"
  menu:
    backgroundColor: "{colors.raised-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.row}"
  tip-button:
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
    rounded: "{rounded.row}"
    padding: "0 12px"
    height: "56px"
  tip-button-selected:
    backgroundColor: "{colors.lime-wash}"
    textColor: "{colors.ink}"
  tip-button-wrong:
    backgroundColor: "{colors.miss-wash}"
    textColor: "{colors.ink}"
  tip-button-locked:
    textColor: "{colors.ink-3}"
  switch:
    backgroundColor: "{colors.raised-2}"
    rounded: "{rounded.pill}"
    width: "48px"
    height: "28px"
  switch-on:
    backgroundColor: "{colors.ink-2}"
  margin-panel:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.row}"
    padding: "12px"
  margin-field:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.wash}"
    width: "56px"
    height: "44px"
  margin-step:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    width: "44px"
    height: "44px"
  ladder-row-you:
    backgroundColor: "{colors.lime-wash}"
  ladder-row-model:
    backgroundColor: "{colors.raised-2}"
    textColor: "{colors.ink}"
  market-track:
    backgroundColor: "{colors.pitch}"
    rounded: "{rounded.bar}"
    height: "8px"
  figure-tile-opening:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.wash}"
    padding: "6px 8px"
  chart-tooltip:
    backgroundColor: "{colors.raised-2}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.wash}"
    padding: "8px 12px"
  button-google:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.pill}"
    height: "48px"
  button-ghost:
    textColor: "{colors.ink-2}"
    typography: "{typography.meta}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.miss}"
    textColor: "{colors.ground}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
  text-action:
    textColor: "{colors.ink-2}"
    typography: "{typography.meta}"
    padding: "0 8px"
    height: "44px"
  text-field:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
    padding: "0 12px"
    height: "48px"
  team-pick:
    textColor: "{colors.ink-3}"
    rounded: "{rounded.row}"
    padding: "8px 4px"
  team-pick-selected:
    backgroundColor: "{colors.lime-wash}"
    textColor: "{colors.ink}"
  auto-tip-option-selected:
    backgroundColor: "{colors.lime-wash}"
    textColor: "{colors.ink}"
  confirm-panel:
    backgroundColor: "{colors.miss-wash}"
    rounded: "{rounded.row}"
    padding: "12px 16px"
  invite-panel:
    backgroundColor: "{colors.lime-wash}"
    rounded: "{rounded.row}"
    padding: "12px 16px"
  note-panel:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.row}"
    padding: "16px"
  news-row:
    textColor: "{colors.ink}"
    typography: "{typography.body-lg}"
    padding: "12px 0"
---

# Design System: rugbyleague-tipper

## Overview

**Creative North Star: "Night Game Under Lights"**

The site is a stadium scoreboard read from the stands: a green-black ground, floodlight-white figures, and one lime lamp that only lights for you. Every screen leads with the plain call ("Roosters by 14") and then shows how sure the Model is, drawn on a small pitch. Numbers are set in a condensed scoreboard face with fixed-width figures so scores and percentages line up down a column.

Density follows the dark match-row apps (Sofascore, Fotmob): one centred phone column, games as dense hairline-divided rows, and a single lit board for the game that matters most. The system rejects the betting-app card grid and the sports-portal hero: no stacks of tiles, no photography, no club logos, no gambling chrome. Teams exist only as their two colours and a three-letter code.

Dark only. Motion is rare and earns its place: bars fill as they appear, a correct tip pops, a perfect round chases its lamps once. With reduce motion, nothing moves.

**Key Characteristics:**
- Green-black tonal ground with floodlight-white ink in three steps; no light theme.
- One accent (lime), reserved for you, actions and right calls.
- Saira Extra Condensed uppercase for calls, headings and every score; Sofia Sans for everything you read as sentences.
- Tabular, lining figures everywhere.
- Hairline rows and strips; one raised board per page.
- The pitch bar is the signature: win probability as a field with a halfway line and ten-metre lines.
- Data pages (Model vs market, Elo) widen on desktop. Charts that compare forecasters use a fixed three-colour series palette; the Elo page draws teams in their own colours, at most three lit over a faint field. Ink still carries every word.

## Colors

A cool green-black ground lit by near-white ink, with a single acid-lime lamp and two quiet signal colours for wrong and live.

### Primary
- **Floodlight Lime** (`lime`): the only accent. Your tips ("Your tip" labels, the "You" tag), primary actions (the loud tipping strip, "Try again", the active tab mark and icon, focus rings, text selection), and right calls (correct-tip ticks, perfect-round lamps, a perfect-round recap line). Hover lifts it to **Lamp Glare** (`lime-hover`). Text on lime is always **Lime Ink** (`lime-ink`), a near-black olive.
- **Lime Wash** (`lime-wash`, 12% lime): the tint behind your correct tip in a row, your selected tip button, your own row in the recap table, the ladder and the round-by-round grid, your chosen favourite team and auto-tip option in the profile fields, and the panel holding a new invite you just made.

### Secondary
- **Miss Coral** (`miss`): wrong, failed and destructive only. Strikes through your wrong pick and colours its cross; colours the save note when a tip doesn't save ("Couldn't save. Tap again.") or hits lockout; colours form errors (a field's help line when it becomes the error, sign-in and save failures), a FAILED pipeline run, and the destructive pill in a two-step confirm ("Yes, delete it all", `ground` text on coral). Its 12% wash (`miss-wash`) tints the wrong team line, the wrong tip button and the confirm panel.
- **Siren Amber** (`live`): live and in-progress state, and team changes only. The pulsing live dot and "LIVE" label, a RUNNING pipeline run, the "Updated: Hughes out" prediction-change note, and the "In" marker on a player who came into a team list.

### Neutral
- **Pitch Night** (`ground`): page background, the html colour, the ring around the halfway line, the switch knob and the margin number field.
- **Stand Shadow** (`raised`): the lit board, the tipping strip's lower band, the phone tab bar, the margin stepper panel, text fields, the unbordered note panels on the sign-in pages ("Check your email", "No account for that one."), and row and tip-button hover.
- **Box Seat** (`raised-2`): menus, the Model's row in tables (recap, ladder, round-by-round grid), the off switch track, unlit lamps, board hover (at 50%).
- **Hairline** (`line`): borders on the board and strip, menu border, chip rings, link underlines.
- **Soft Hairline** (`line-soft`): dividers between game rows, inside strips, the footer rule.
- **Turf** (`pitch`) and **Line Paint** (`pitch-line`): the empty pitch-bar field and its markings.
- **Floodlight** (`ink`): primary text, the winning or called team, final scores, current tab, and the fill of the Google sign-in pill.
- **Grandstand** (`ink-2`): secondary text, team names under badges and on open tip buttons, predicted scores, ladder positions, supporting copy, and the on switch track.
- **Back Row** (`ink-3`): meta lines, captions, losing scores, the "–" placeholder, inactive tabs, the dissent half of a verdict, recap placings, struck-through "Out:" players, locked unchosen tip buttons, the Model hint and tip tally, ladder tags, movement and margin scores, and every round-by-round figure but the round's best.

### Team colours
Team colours live in `web/lib/teams.ts`, not in the token set: `primary` (badge fill), `secondary` (code lettering and badge stripe), optional `ink` (lettering when secondary is too dark on the fill), and `bar` (pitch-bar fill, lightened so navy, maroon and black teams read on the ground). They appear only inside badges, pitch bars and the Elo page's lit lines (Team-colour series, below), never as text, borders or backgrounds of UI chrome.

### Chart series
A page-scoped family for chart pages only (first shipped on Model vs market, `SERIES` in `web/lib/odds.ts`), validated all-pairs on `ground` with the dataviz validator: worst colour-vision-deficiency ΔE 9.4, normal-vision ΔE 20.9, every colour at least 3:1 against the ground.
- **Model Blue** (`series-model`): the Model on every chart and on the market track's diamond.
- **Bookies Aqua** (`series-market`): the bookies' price (opening and closing) and the bookies' favourite.
- **Elo Orange** (`series-elo`): Elo.

Series colours appear only as marks: lines, dots, the track's markers and connector, and the short line keys in legends and stat labels.

### Team-colour series (Elo only)
The `/elo` charts plot teams, not forecasters, so they leave the fixed palette and draw each team in its own colour (`colourFor` and `lineColours` in `web/lib/line-colours.ts`).
- **Colour:** a lit team takes its `bar` colour unless that is too close to a colour already lit. `clearance()` measures OKLab ΔE×100 against each lit colour and needs at least 15 for normal vision and at least 8 under protan and deutan simulation (Machado 2009, full severity), the dataviz validator's floors. A team that fails takes whichever of its `bar`, `secondary` or `primary` clears best.
- **Lit set:** at most three teams. A team's colour is fixed when it is lit and held in state, so switching another team off never repaints it. The team view's single line is that team's `bar`.
- **The field:** every unlit team is a 1.25px `ink-3` line at 0.28 opacity.
- **Labels:** each lit line ends in an r=5 dot and an end label (team code and rating, "PEN 1650", 13px semibold score face `ink-2`) in place of a legend; the team chips above the chart are the key.

### Named Rules
**The Fixed Series Rule.** On every chart that compares forecasters, an entity keeps its series colour on every page: the Model is always blue, the bookies always aqua, Elo always orange. Lime, amber and coral keep their jobs and are never series colours. Text is never set in a series colour; labels, values and tooltips use the ink steps. At most three series share an all-pairs chart, because the validation covers exactly these three. The Elo page, which compares teams, follows the Team Line Rule instead.

**The Team Line Rule.** On `/elo`, lines are team colours, checked for clearance as each team is lit (ΔE×100 of at least 15 for normal vision, 8 for protan and deutan), at most three lit at once, each colour held from the moment it is lit; the rest of the field stays faint `ink-3`. Team colours there are line marks only: labels, values and tooltips stay in the ink steps.

**The One Lamp Rule.** Lime means you, an action, or a right call. Never use it for a label, a category, a heading or decoration ("Margin game" is `ink-3`/`ink-2`, not lime). If removing the lime would not change what the user can do or what they got right, it should not be lime. Wherever the Model is a row among others (the recap table, the ladder and its round-by-round grid, the match page's voice list, the tips page's "Show the Model's pick" switch), it is marked with the sm MDL badge and an `ink` label, never lime text.

**The Clash Rule.** A game's two bar colours must sit at least 90 RGB distance apart. When the away team's `bar` is closer than that to the home team's, the away fill switches to whichever of its `primary` or `secondary` sits furthest from the home bar (`barColours` in `pitch-bar.tsx`), so Sea Eagles v Broncos draws the Broncos in gold. New team colours must be checked against likely opponents.

## Typography

**Display Font:** Saira Extra Condensed (with Arial Narrow, sans-serif), weights 500 to 800
**Body Font:** Sofia Sans (with system-ui, sans-serif), weights 400 to 700

**Character:** A tall, tight scoreboard face shouting the call and the numbers, over a plain, friendly sans that does the explaining. Display text is uppercase; body is sentence case.

### Hierarchy
- **Display hero** (800, 56px, 0.86): the "N of M tipped" line. The largest type on the home page.
- **Display** (700, 36 to 52px, 0.9 to 0.92): page titles that stand alone: the recap ("Round 10 wrap"); empty, error and not-found titles at 52px ("Nothing doing.", "Reddit's gone quiet.", "Knocked on."); 40px for the round page's missing-round state, a bad invite and the account's "Gone."; 36px for the invite and sign-in headlines ("Sully's invited you to the comp.", "Sign in").
- **Match verdict** (800, 34px before kickoff / 40px at full time, 0.92 to 0.94): the match page's headline. Before kickoff it is the verdict sentence itself ("The Model and Elo back the Sea Eagles."), with any dissent dimmed to `ink-3` in the same line; at full time it is the result ("Sea Eagles won 32–4") and the verdict drops to 16px semibold body below it.
- **Score board** (600 predicted / 700 final, 48px, 1): the featured board's score. Second only to the tipping strip.
- **Headline** (700, 30px, 1): the board's call ("Roosters by 14"), the live strip ("This round: 4/6 correct so far"); recap line at 28px.
- **Title** (700, 26px, 1): page heading such as "Round 10", "Round 10 tips", "Ladder", "News", "Admin", and "Your account" (led by your favourite team's sm badge).
- **Section** (700, 24px, 1): in-page section headings such as "Results", "Round by round", "Bragging rights", the section heads of `/model` and `/about` ("Best calls", "What goes in", "Where it falls down"), and the admin page's four sections. The margin number field uses the score face at the same 24px, bold.
- **Score row** (700 final / 500 predicted, 21px): scores in game rows and ladder points (bold `ink`); record figures at 22px, recap-table scores at 19px; ladder positions and margin scores at 17px semibold, final scores on tip buttons at 17px `ink-3`, round-by-round figures at 16px.
- **Body** (400 to 600, 15px): team names in rows, menu items, the Model's record heading, auto-tip option labels; 16px with relaxed leading for empty-state and recap prose, capped at 34ch. Read-mode prose (`/about`, and `/model`'s "How it was tested" at 15px) is relaxed at a 60ch measure. News headlines are 16px semibold `ink` at snug leading. Form labels and fieldset legends are 13px semibold `ink-2`, help lines 13px `ink-3`; text fields are 16px so phones never zoom.
- **Meta** (500, 13px): date ranges, board meta line, kickoff times, standing line.
- **Caption** (500, 12px): "Model's score", "win chance", record labels, row footnotes.
- **Data page figures:** the stat row's figures at 30px bold display (the "/213" at 16px semibold `ink-3`); the hero money figure ("+$240.50") at 40px bold display; the figures row at 22px bold `ink` for the highlighted Opening and 19px semibold `ink-2` for the rest, each after a 12px semibold `ink-3` team code.
- **Chart text:** chart titles 16px semibold `ink` in sentence case with a 13px `ink-3` note below; y-axis ticks 12px score face `ink-3`; x labels 11px `ink-3`; end values 13px semibold score face `ink-2`; legends 12px `ink-2`; tooltip values 15px semibold score face `ink`. On Elo, end labels carry the team code with the rating ("PEN 1650") and the team view's swing numbers are 12px semibold score face `ink-2`.
- **Label** (700, 11px, 0.06em, uppercase): status words and tags only: "Your tip", the lime "You" beside your name on the ladder and the admin tipper list, "LIVE", "FT", "Full time", "Postponed", the amber "In" team-list marker, pipeline run status (OK, FAILED, RUNNING, at 12px), the tab-bar labels (600, no uppercase), the "personal project" wordmark tag (10px).

### Named Rules
**The Scoreboard Figures Rule.** Every number is tabular. Scores, percentages, positions and counts use the score face (`font-score`: display family with `tnum` and `lnum`); body text inherits `tabular-nums` from the page. A data page's hero figure ("+$240.50") is in the display face too, not a sans hero.

**The Honest Minus Rule.** Negative figures use the true minus (U+2212, "−4", "CBY −2.5"), never a hyphen; positive changes carry "+". Money shows cents only when there are cents ("+$40", "+$240.50").

**The Marked Prediction Rule.** A predicted score never passes for a result. Predicted scores are set one step dimmer and lighter (`ink-2` at most, weight 500 to 600), carry a "Model's score" caption on the board and a screen-reader "predicted", and bars are labelled "Model XXX nn%". While a game is live or awaiting its result, the score slot shows "–" in `ink-3`, never a number.

**The Points Mean Margins Rule.** "Points" is reserved for score margins ("Roosters by 14"). A win chance is a percentage for the side it backs ("MAN 63%"), and the bookies' figure is stated the same way ("The bookies give the Sea Eagles 45%"), never as "N points apart".

**The Whole Name Rule.** A team name never breaks across lines inside a display sentence or verdict ("Sea Eagles", "Wests Tigers" stay together, `whitespace-nowrap` on each name); the sentence wraps around it.

**The Loudest Line Rule.** On home, "N of M tipped" (56px) is the biggest thing on the page and the board score (48px) is next. Nothing else on a page outranks what you owe.

**The No Eyebrow Rule.** No small uppercase kicker above a heading. Context goes on a meta line beside or below the heading in sentence case (`ink-3`, 13px), as the board does with "Margin game · Fri 6:00pm · Polytec Stadium".

## Layout

One centred column, `max-width: 34rem` (544px), 16px side padding, on every page except the wide data pages (Elo, model vs market), which the brief allows to widen on desktop. The desktop top bar spans up to 64rem; content stays in the column.

**Wide data pages.** From 768px the page's `main` breaks out of the column to `min(60rem, 100vw − 4rem)` (the `wide` step), centred on the column. Inside it, prose keeps a 60ch measure, stat rows and single full-width charts are capped at 40rem (`chart`), and paired content runs in a two-column grid with a 40px gap, top-aligned (`items-start`) so a short chart never stretches: two charts side by side, or game rows two-up. On phones everything returns to the single column. On Elo the ratings table (up to 24rem) and the season chart share that two-column grid; the team view below is capped at 40rem.

**Read-mode pages.** The Model (`/model`) and How the Model works (`/about`) stay in the single column at every width, with prose capped at 60ch.

Phones get a fixed bottom tab bar (64px plus safe-area inset), so content carries 112px bottom padding (48px from 768px up, where the tab bar is replaced by the top bar). The sticky top header is 56px.

Vertical rhythm on the 4px scale: page heading 16px top / 12px bottom; 12px between strip and board; game rows 12px vertical padding with 4px between team lines; 32px before the Model's record strip; 48px before the footer. Rows bleed 12px into the gutter (`-mx-3 px-3`) so hover tints reach past the text edge while text stays aligned to the column. Text actions inside a row ("Cancel", "Remove", a disclosure summary) bleed the same way: a 44px hit area from negative margins (`-my-2 -mr-2 px-2`, `min-height: 44px`), so the target is thumb-sized while the row keeps its height and its right edge.

Game rows are a two-column grid: content left (two team lines, then the pitch bar with its label), a fixed 64px status column right, top-aligned.

Paired columns (team lists, head to head, tip buttons) put home on the left and away on the right, mirrored: away names right-aligned with jersey numbers or badges on the outer edge.

Forms (join, account) run in the same column with 28px between field groups and full-width 48px fields and submit pills. The favourite-team picker is a grid of 4 per row on phones and 6 from 640px, on a 6px gap.

Tip rows are two equal half-width buttons on an 8px gap. Tables (ladder, round-by-round grid) run the full column with 8px inner padding at the edges; a grid wider than the column scrolls sideways under a sticky name column.

## Elevation & Depth

Flat and tonal. Depth comes from stepping the ground: `ground` to `raised` to `raised-2`, with hairline borders. The sticky header and tab bar are translucent (`ground` at 92%, `raised` at 95%) with a medium backdrop blur so rows slide under them.

### Shadow Vocabulary
- **Menu drop** (`box-shadow: 0 12px 32px -8px rgb(0 0 0 / 0.6)`): the More menu only.
- **Tooltip lift** (`box-shadow: 0 6px 20px rgb(0 0 0 / 0.45)`): chart tooltips only, which float over the plot while hovered or focused.
- **Lamp glow** (`box-shadow: 0 0 10px 1px` lime at 55%, transient): the perfect-round lamp chase; never at rest.

### Named Rules
**The One Board Rule.** Hairline rows and strips everywhere; a single raised, bordered, 12px-rounded board per page carries the game that matters (the featured margin game on home, the recap panel on the recap and round pages). The match page has no board; its voices are hairline rows. The tips page and ladder have no board: the margin stepper is an unbordered `raised` panel inset inside its game's row, not a board, and the Model's ladder row is a tint, not a raised surface. On Model vs market the highlighted Opening figure is an unbordered `raised` tile inside its row, not a board. The Elo, Model and How the Model works pages have no board, and nor do join, sign-in, account, admin, news or not-found: their note, confirm and invite panels are unbordered 8px-rounded tints, never boards. Never build a grid or stack of cards.

## Shapes

Small, tight corners that read as scoreboard hardware: 2px lamps, 3px pitch bars, 5px team badges, 6px row tints, 8px row hover and menus, 12px for the board. Actions and chips are full pills; the Elo team chips are the exception, 6px frames around a badge. Borders are 1px hairlines; the only heavy strokes are the 2 to 3px lime active-tab marks, the 3px badge stripe and the halfway line.

## Components

### Buttons
Pill-shaped, bold, short labels with an arrow or icon.
- **Shape:** full pill (9999px).
- **Primary:** `lime` with `lime-ink` text, 15px bold, 12px by 20px, optional 16px icon at stroke 2.5. Hover to `lime-hover`.
- **On lime:** inside a lime surface the action inverts to `lime-ink` with `lime` text ("Tip 4 →"); the arrow nudges 2px right on hover.
- **Quiet link:** sentence-case `ink-2` or `ink` text, semibold, underlined in `line`, trailing chevron; hover to `ink`.
- **Google:** a full-width 48px `ink` pill with 15px semibold `ground` text, "Continue with Google", led by the 20px four-colour Google mark, following Google's own sign-in convention; it sits above an "or" rule and the email field. The Google mark's colours appear nowhere else.
- **Ghost:** a pill with an inset 1px `line` ring, 13px semibold `ink-2` (hover `ink`), at least 44px tall, 14px side padding, optional 16px icon: "Copy link", "Share", "Keep my account".
- **Danger:** a `miss` pill with 13 to 14px bold `ground` text, only as the destructive half of a two-step confirm.
- **Text action:** 13 to 15px semibold, underlined in `line` ("Sign out", "Delete my account", "Cancel", "Remove"), `ink-2` (`ink-3` for Remove) with hover one step brighter; in rows it keeps a 44px hit area (see Layout).
- **Round stepper:** a 40px circle with an inset `line` ring and a 20px chevron in `ink-2` (hover `ink` text, `ink-3` ring), prev and next side by side at the right of the round heading; at either end the missing step stays in place at `ink-3` 40% and is not a link.
- **Focus:** 2px `lime` outline at 2px offset, 4px radius, on every focusable element.
- **Never disabled:** a submit pill stays live; an incomplete form says what's missing when it is submitted ("Fill in all three to join: a name, a team and an auto-tip.").

### Chips
- **Style:** pill, 13px semibold, 6px by 12px; unselected is `ink-2` text with an inset `line` ring (hover `ink` text, `ink-3` ring); selected is solid `ink` with `ground` text. Used for filters and state switches (the sample-data note, the news flair row). In a filter row a chip may carry a count after its label in regular weight at 70% opacity ("All 24"); the row scrolls sideways past the column edge (`-mx-4 px-4`) rather than wrapping, and link chips mark the current one with `aria-current`.

### Sample-data note
A dashed `line` border, 12px radius, 16px padding, 40px above it; 13px `ink-3` copy led by a semibold `ink-2` "Sample data." Optional state chips sit below it. It closes every page that runs on sample data and is never a board. The home, tips and ladder pages share one sample NRL week (tipping open, in progress, recap) through these chips and the home sample bar, so the same state shows the same numbers on every page.

### Cards / Containers
- **The board:** `raised` fill, 1px `line` border, 12px radius, 16px padding; whole board is a link with hover to `raised-2` at 50%.
- **Tipping strip:** in the build, a bordered `raised` container with two bands: the loud top band (lime fill while tips are missing, plain once all are in with a lime check) and a `line-soft`-divided standing line.
- **Record strip:** no fill; `line-soft` hairlines top and bottom, 16px vertical padding, three-up stat grid, closed by a quiet link ("The Model's season so far") to `/model`.
- **Recap table rows:** `line-soft` dividers; your row `lime-wash`, the Model's row `raised-2` (the full ladder is under Ladder Table). The first column is this round's placing among the human tippers in the score face (`ink-3`, "=" prefix for a tie, e.g. "=2nd"); the Model is not ranked and shows the sm MDL badge instead. On the round page the panel drops its own heading (the round heading with steppers sits above it); the next-round line under it is optional.
- **Featured game:** the board, the "Margin game" meta label and the margin stepper follow the round's featured game. It is drawn at random when the round's predictions publish, from the games that involve neither team in the previous round's featured game (from all the round's games if none qualify), stored with the round and never changed (PLAN_WEB.md §3.5). Copy says it was drawn, never chosen or picked.
- **Note panel:** an unbordered `raised` tint, 8px radius, 16px padding: a 16px semibold `ink` line over 14px relaxed `ink-2` copy. Used for "Check your email" (led by a mail icon, with a dashed `line` "Sample only: open the link" button inside while on sample data) and "No account for that one."

### Inputs / Fields
- **Text field:** 48px tall, `raised` fill, 8px radius, inset 1px `line` ring, 16px `ink` text, `ink-3` placeholder, 12px side padding; focus swaps the ring for a 2px inset `lime` ring. A 13px semibold `ink-2` label sits 6px above.
- **Help that becomes the error:** a field has one 13px line under it, `ink-3` help ("What everyone sees on the ladder and in the recap.") that turns `miss` and states the problem in its place, tied by `aria-describedby`. Form-level errors are 14px `miss` with `role="alert"`; the email form is `noValidate`, so the page, not the browser's bubble, says what's wrong.
- **Choices:** one-of-many choices are native radios inside their labels, so arrow keys and screen readers work as usual (Team Picker, Auto-tip Options).

### Navigation
- **Phone:** fixed bottom tab bar (Round, Tips, Ladder, Elo, More), `raised` at 95% with blur and a `line` top border. 22px Lucide icons over 11px semibold labels; inactive `ink-3`, active `ink` with a lime icon and a 3px by 32px lime mark at the top edge.
- **Desktop (768px+):** the same items in the sticky top bar, 14px semibold, active marked by a 2px lime underline on the header's bottom edge.
- **In-page tabs:** link tabs (they work without JavaScript) on a `line` bottom rule, 14px semibold; active `ink` with a 2px lime underline, inactive `ink-3` (hover `ink-2`). Used on the match page for "Team lists" and "Head to head", and on Model vs market for "This round" and "Season".
- **More:** opens a `raised-2` menu with the menu drop shadow listing Model vs market, News, The Model (`/model`), How the Model works (`/about`), Your account and, only for whoever runs the comp, Admin; closes on outside click, Escape or navigation.
- **Wordmark:** "rugbyleague-tipper" in the display face at 23px with the hyphen in lime, plus a bordered 10px "personal project" tag.

### Team Badge
Two-colour block with the team's three-letter code. Fill is `primary`, code is `ink` or `secondary`, a 3px `secondary` stripe at the bottom (85%), 1px inset white-10% ring so dark fills hold an edge. Sizes: sm 38x24 (rows, tables), md 44x28, lg 66x44 (board). `dim` drops it to 55%. **Model badge:** the same shape in `ink` with `ground` "MDL" and a lime stripe; it stands for the Model in every table and strip.

### Pitch Bar (signature)
Win probability as a rugby league field. A `pitch` track (7px sm, 14px lg; 3px radius) filled from each end in the teams' `bar` colours, home from the left. The called team's fill is full strength and the other is 42%. Ten-metre lines every 10% are 1px dark ground marks over the fill; the halfway line is an `ink` post (2px sm, 3px lg) with a 1.5px `ground` ring so it reads on any fill, standing 3 to 5px proud of the track. Fills slide out from halfway over 900ms on the expo ease the first time 60% of the bar is visible; the resting state is final, so no-JS and reduced-motion users see it complete. Always carries an accessible label ("Model: Roosters 74% to win") and a visible one ("Model SYD 74%" in rows, both percentages and "win chance" on the board).

### Game Row
The default for every game outside the board. Two team lines (sm badge, 15px name, optional lime "Your tip" label, 21px score), then a small pitch bar with "Model XXX nn%", then an optional 12px footnote line (Model's call after kickoff, "Margin game", the amber "Updated" note, "No odds yet"). Right column shows kickoff (weekday over time), pulsing amber LIVE, "Full time / result soon", or "FT" with a quiet Model tick or cross. The called or winning team is `ink` semibold, the other `ink-2`. Your right tip gets a `lime-wash` line and a popping tick; your wrong tip a `miss-wash` line, coral strike-through and cross.

### Voice List
The match page's answer to "who backs whom": one hairline row per voice (the Model, Model without odds, Bookies' opening price, Elo), each a 14px semibold `ink` label on the left and the backed side on the right as an `ink-3` code plus a 19px score-face percentage in `ink` ("MAN 63%"), with a small pitch bar below. The Model's row leads with the sm MDL badge. Once graded, a quiet tick (`ink-2`) or cross (`ink-3`) precedes the label. Above it, a one-sentence verdict names the Model first and dims whoever disagrees.

### Team Lists
Home and away side by side, row by row by jersey number (15px score-face numbers in `ink-3`, names 14px `ink-2`), `line-soft` dividers with a stronger `line` rule after the 13th row to set off the bench. A player who came in is `ink` semibold with the amber "In" label set inline with the name, so it stays attached when a long name wraps. Players who dropped out are listed below as "Out:" (semibold) followed by their names struck through, all in `ink-3`.

### Head to Head
A summary line ("Last 6: Sea Eagles 4, Broncos 2") then hairline rows: an `ink-3` 12px season, round and venue column, the two sm badges either side of a centred 21px score, the winning figure `ink` bold and the other `ink-3`.

### Tip Row
The tips page's row, one per game, `line-soft`-divided, 14px vertical padding.
- **Meta line:** 13px `ink-3`: "Margin game" (`ink-2` semibold, featured game only), kickoff (or a 14px lock icon with "Locked", "Live", "Full time", "Postponed" once locked), venue. The save note sits at its right: 12px semibold `ink-3` "Saving…" then a check with "Saved" (clears after 1.8s); coral "Couldn't save. Tap again." or "Locked at kickoff" on failure, with the pick rolled back.
- **Two buttons:** half-width, at least 56px tall, 8px radius, 12px side padding, md badge inside, 15px semibold name; the away button mirrored (badge on the outer edge, text right-aligned). Open and unchosen: `ink-2` with an inset 1px `line` ring, hover `raised` and `ink`. Selected: `lime-wash`, `ink`, 2px inset `lime` ring and a 20px lime check that pops. Locked and right: `lime-wash` with a 1px `lime` ring at 50% and a static lime check. Locked and wrong: `miss-wash`, 1px `miss` ring at 60%, the name struck through in coral (2px) and a coral cross. Locked and unchosen: `ink-3` text, 1px `line-soft` ring, badge dimmed. At full time each button carries its team's score at 17px `ink-3`.
- **Footnote line:** 12px `ink-3`: the optional Model hint ("Model: Roosters 74%", team semibold `ink-2`, figure in the score face) on the left; after lockout the comp's tally on the right ("5 of 6 on SYD · 1 of 6 on GLD"), never before kickoff; an untipped locked game says "Not tipped. Auto-tip: Knights" in `ink-2`.

### Switch
A 48 by 28 pill with `role="switch"`: on is an `ink-2` track, off a `raised-2` track with an inset `line` ring; a 20px `ground` knob slides 20px over 200ms on the expo ease. Its label sits left in 14px `ink-2`. Used for "Show the Model's pick", led by the sm MDL badge, on a `line-soft`-ruled strip under the page heading; the choice persists per viewer.

### Margin Stepper
Inside the featured game's tip row, 12px below the buttons: an unbordered `raised` panel, 8px radius, 12px padding. Left, a 14px semibold `ink` label ("Roosters by", or "Winning margin" before a team is picked). Right, a 44px round minus, a 56 by 44 number field (`ground` fill, 6px radius, inset `line` ring, 24px bold score face, 2px `lime` ring on focus) and a 44px round plus; the round steps use an inset `line` ring with `ink-2` icons and drop to `ink-3` at 40% when disabled, as the round stepper does. A 12px `ink-3` helper below: "Pick a team first.", "Leave it and 12 applies." until a margin is entered, and at full time the outcome ("Roosters won by 16. You were 6 off."), with its own save note.

### Ladder Table
Full-column table under a `line` header rule (12px semibold `ink-3` "Tipper", "Pts", "Margin"), `line-soft` row dividers, 12px vertical padding.
- **Columns:** position in the score face at 17px semibold `ink-2`, "=" prefix for a tie ("=2nd"); then the name cell: sm badge (the tipper's favourite team, or MDL for the Model), the 15px name, and below it the tipper's tag in 12px `ink-3`, with movement at the cell's right edge (12px semibold `ink-3`, an up or down arrow and the places moved, "–" for no change); points at 21px bold `ink`; margin score at 17px semibold `ink-3`.
- **Your row:** `lime-wash`, semibold `ink` name with the lime "You" label.
- **The Model's row:** `raised-2` tint, ruled above and below with `line`, "–" in the position column, MDL badge, "The Model" semibold `ink`.
- **Under it:** one 14px `ink-2` sentence with your place, your gap to the lead and your gap to the Model ("You're 3rd, 5 pts off the lead and 7 pts behind the Model.").
- **Bragging rights:** a `line-soft`-divided definition list, 13px semibold `ink-3` term over a 15px `ink-2` sentence; figures inside it in the score face at 17px `ink`.

### Round-by-round Grid
Rounds across, tippers down in ladder order, the same row tints as the ladder. Names in a sticky left column (14px medium; `ink` for you and the Model, `ink-2` otherwise); round figures in the score face at 16px, the round's best among the tippers bold `ink`, the rest `ink-3` (the Model never takes the bold). "+" marks a perfect-round bonus and "*" a game filled by an auto-tip, both 12px, explained in a 13px `ink-3` line under the heading. A sticky cell on a washed row paints `ground` with the same wash layered over it, so there is no seam when the grid scrolls.

### Trash-talk Tags
Banter lives in four places only (DESIGN_BRIEF.md): the ladder, the round recap, the home tipping strip (a short jab when you're behind the Model), and empty and error states ("Nothing doing.", "Reddit's gone quiet.", "Knocked on."). Prediction, odds, Elo, Model, about, admin and account copy stays straight. On the ladder, each tipper gets at most one tag, in 12px `ink-3` under their name, never lime, never a chip. Walking the ladder from the top, each tipper takes the most specific tag that applies and hasn't been used higher up, in this order: Wooden spoon, Top dog, Won round N, Wooden spoon watch, Climbing, Sliding, Clear of the Model, Behind a spreadsheet. The Model gets none.

### Named Rules
**The Unranked Model Rule.** The Model is the line everyone measures against, never a competitor. It takes no position ("–"), never wins a round's bold, gets no tag, and sits among the tippers sorted by points so you can see who is above and below it. "Off the lead" and "top of the ladder" are measured against the leading tipper, on the ladder and on the home strip alike.

**The One Tag Rule.** At most one trash-talk tag per tipper and no tag twice on the same ladder; the more specific tag wins.

**The Four Places Rule.** Banter appears only on the ladder, the round recap, the home tipping strip, and empty and error states. Everywhere else the voice is plain.

**The Coin-Flip Rule.** An exact 50-50 is no tip. The tallies on `/odds` and `/model` count a 50% price or chance as not a right tip, as the project's reports count it, and a 50% bookies' price never makes a call "against the bookies".

**The Focus Follows Rule.** When a panel swaps in place (email sent, signed in, a confirm opening or closing, a new invite, "Gone."), focus moves to the new heading or the safest new control, so nobody is dropped back at the top of the page.

**The Explain on Submit Rule.** No disabled pills. A submit stays live, and an incomplete or wrong form says what's missing in plain words when it is submitted.

**The Sydney Clock Rule.** The comp's times (invites, joined dates, the next draw, run logs, news) are read in Sydney through `sydney()` in `web/lib/time.ts`, in one of its formats: "Fri 8 May" (`day`), "Fri 6:00pm" (`dayTime`), "Tue 12 May 5:15pm" (`dayDateTime`); lower-case am/pm, no comma.

**The Printed Figures Rule.** A figure derived from figures on screen is computed from them as printed: the Elo Week and Season columns are differences of the rounded ratings, so every column equals what the reader can check.

### Market Track (signature)
The Model vs market row's picture: one pitch per game where each estimate is a marker, so a disagreement is a distance and the market's move is an arrow.
- **Bar:** an 8px `pitch` track, 3px radius, with tenth lines (1px dark ground marks) and a 2px `ink-3` halfway line standing 4px proud. Home's team code sits at the left end and away's at the right (11px semibold `ink-3`).
- **Position:** each estimate sits toward the team it backs, at x = 1 − home win chance, so further left means more likely a home win.
- **The Model:** a 12px `series-model` diamond (2px radius, 2px `ground` ring) in its own lane above the bar, joined to the bar by a 1px stem, so it never covers a price.
- **Prices:** the opening price is a 14px filled `series-market` dot with a 2px `ground` ring; the closing price is a 12px hollow ring (2px `series-market` stroke on `ground`). When they differ by at least 1%, a 2px `series-market` connector runs between them with a 7px arrowhead at the closing end.
- **Key:** a legend above the rows (12px `ink-2`): diamond "The Model", dot "Opening price", ring "Closing price" (once graded), then an `ink-3` note: "Each sits toward the team it backs; the arrow is the market's move".
- **Label:** `role="img"` with the full reading ("Model CBY 58%, opening price CBY 60%, closing CBY 53%").

### Figures Row
Under each market track, four equal columns: Model, Opening, Closing, Gap. Each is a 12px label over the backed team's code and percentage. Opening is highlighted because it is what the Model is most comparable against: an unbordered `raised` tile (6px radius, 6px by 8px padding), a semibold `ink-2` label and a 22px bold `ink` figure, against 19px semibold `ink-2` for the others. Gap is the difference between the Model's and the opening price's figures; at 10 or more it takes a 1px inset `ink-3` ring and the 22px bold figure, and "split" when the two back different teams. Before kickoff, Closing reads "At kickoff". Once graded, a quiet tick (`ink-2`) or cross (`ink-3`) before Model and Opening shows who backed the winner. Below, a 13px definition list gives the margin and total: the Model's figure, the bookies' line and total, the move to closing ("→"), and the actual total.

### Stat Row
Three figures across a `line-soft`-ruled strip (top and bottom, 12px vertical padding), capped at 40rem. Each label is 12px `ink-3`, led by its series' 12px line key, in a fixed two-line slot (`min-height: 2lh`) so the figures share a baseline whether or not a label wraps; then the 30px figure and a 12px `ink-3` line ("63% tipped right"). Used on Model vs market, `/model` and `/about`.

### Charts
Small SVG charts for data pages (`web/components/charts.tsx`), shared by Model vs market and Elo.
- **Drawing:** drawn at the measured width (ResizeObserver), never a stretched viewBox, so lines stay 2px and text stays crisp.
- **Marks:** 2px series lines with round joins. End dots and crosshair dots are r=5 with a 4px `ground` stroke under the fill (`paint-order: stroke`): a 10px coloured dot inside a visible 2px ground ring.
- **Grid and axes:** solid 1px `line-soft` gridlines. An indexed chart's zero line is one step stronger (`ink-3`), and so is an Elo chart's 1500 line. One y-axis, its ticks covering the full range (the axis ends on a tick at or beyond each extreme). X labels are thinned so they sit at least 40px apart, always keeping the last ("Finals").
- **Labels:** each series' end value is labelled at its line's end in `ink-2`, nudged apart only where two would overlap. A legend of short line keys sits above any chart with two or more series; a single-series chart has none. The Elo season chart has no legend: lit teams are named by end labels, and its team chips are the key.
- **Tooltip:** a crosshair (1px `ink-3`) and a `raised-2` tooltip with a 1px `line` ring and the tooltip lift, headed by the point in `ink-3` and listing every series, value first, then its name. The chart is focusable and the arrow keys step through the points.
- **Calibration:** a square plot (up to 340px) with an `ink-3` diagonal for perfect calibration; every dot carries its own hit target of at least 24px, and the plot is `role="group"`.
- **Table view:** every chart ends in a "Show as table" disclosure (13px semibold `ink-3`) opening a scrollable table with the chart's values in the score face.

### Elo Team Chips
The season chart's picker: a fieldset under a 13px `ink-3` legend ("Tap up to 3 teams to light them up"), the teams as badge-only buttons in ratings order with 4px gaps, each with `aria-pressed` and the team's name as its `aria-label`. Each chip is a 6px frame with 4px padding around an sm badge. On is a filled `ink-2` frame; off is a 1px inset `line` ring (hover `ink-3`) with the badge at full strength, because the badge is the only label.

### Elo Ratings Table
Under a `line` header rule (12px semibold `ink-3`), `line-soft` rows: rank at 16px semibold score face `ink-3`; the sm badge and 14px `ink` name, linking to the team view, with the lime "Yours" label beside your team; rating at 19px bold `ink`; Week (Season for a finished season) as an `ink-2` 14px score-face arrow and figure, "–" in `ink-3` for no change, and a 12px `ink-3` "Bye" for a team that didn't play; Start at 14px `ink-3`. The selected team's row is tinted `raised`. A 12px `ink-3` footnote defines the columns.

### Elo Team View
A section head with the md badge ("Rabbitohs since 2021"), a 13px `ink-3` note, then a single line in the team's `bar` colour with each season start as a `line-soft` vertical labelled in the 11px score face. The biggest swings carry r=5 dots and numbers (12px semibold score face `ink-2`) above a rise or below a fall, kept inside the plot and nudged 14px sideways when two collide. Below, a `line-soft`-ruled list repeats them: the number in `ink-3`, the signed change at 17px bold `ink`, the game in 14px `ink-2`, and round and season in 12px `ink-3`.

### Season Picker
A native select labelled "Season" (13px `ink-3`): 40px tall, `raised` fill, 6px radius, inset `line` ring, 16px semibold score face `ink`, 2px `lime` ring on focus. Changing it loads that season and keeps the picked team.

### Model Season Card
The `/model` page, in the column with no board.
- **Heading:** the md MDL badge before the 26px title "The Model", with a 13px `ink-3` meta line ("2026 so far, Rounds 1–9").
- **Tally:** the stat row (the Model, Bookies' favourite, Elo, each led by its series line key), then one 15px `ink` sentence placing the Model among the tippers (its points in the 17px score face) with a quiet "See the ladder" link.
- **Round by round:** a table under a `line` header rule: round at 15px semibold score face `ink-3`; one 11px lamp per game in kickoff order, the recap's lamps (lit `lime` when it tipped the winner, unlit `raised-2` with a `line` ring, 2px radius, 3px gaps); the round score at 19px bold `ink` with "/N" at 14px `ink-3`; "vs bookies" at 15px `ink-2` ("+1", "−2", "Level").
- **Best calls / Worst misses:** `line-soft`-divided rows: the pick's sm badge, a 14px `ink` line ("Sharks over the Storm") over a 12px `ink-3` meta line (round, result, the bookies' figure), and the Model's chance at the right, 19px bold `ink` over an 11px `ink-3` "its chance". A row links to a match page, with `raised` hover, only when one exists; otherwise it is a plain row.
- **How it was tested:** a 60ch paragraph, then link rows to `/about` and `/odds`.

### Link Rows
Full-width `line-soft`-ruled rows of 15px semibold `ink` text with a trailing `ink-3` chevron that nudges 2px right on hover. Used for onward links on `/model` and near the top of `/about` ("See how it's going this season").

### Read-mode Page
`/about`: in the column, with no board and no chart. The title with the md MDL badge, a 16px `ink` lead, a link row, then sections of 24px section heads over 60ch, 16px relaxed `ink-2` prose; bulleted lists use `ink-3` markers and a semibold `ink` lead phrase per item. The voice is straight, and the limits ("Where it falls down") get a full section with the same weight as the strengths. A stat row of test-season figures and a disclosure close it.

### Disclosure
A native details/summary ruled with `line-soft` above and below: a 15px semibold `ink` summary row with the marker hidden and a 20px `ink-3` chevron that rotates 90° when open. Inside, 60ch 15px `ink-2` prose and a metrics table (12px `ink-3` header on a `line` rule, `line-soft` rows, figures in the 15px score face `ink-2`, the main row's name semibold `ink`), scrolling sideways below 22rem.

### Join, Sign-in and Account
- **Join:** the invite headline in 36px display ("Sully's invited you to the comp."), a 15px `ink-2` line, then the Google pill, an "or" rule (12px `ink-3` between `line-soft` hairlines), the email field and a full-width lime "Email me a link"; a 13px `ink-3` privacy line closes it. Once signed in, a lime check and "Signed in as …. Three quick things:" lead the profile fields and a lime "Join the comp →". A bad invite (used, expired, unknown) is a 40px display title over one 16px line with a "Sign in" link.
- **Sign-in:** the 36px "Sign in" title over the same panel; "No account for that one." appears as a note panel above it.
- **Account:** the 26px title led by your favourite team's sm badge, a 13px `ink-3` "Signed in with … as …" line, the profile fields, and a lime "Save changes" pill with an `aria-live` "Saved" (check, 14px semibold `ink-3`) or a coral failure beside it. Then, each under a `line-soft` rule, a "Sign out" text action and "Delete your account" (16px semibold heading, 14px `ink-3` consequence line, a "Delete my account" text action opening the two-step confirm). After deletion, a 40px "Gone." with one line and a link back to the round.
- **Sign-in plumbing:** an `AuthStore` (`web/lib/auth.ts`) with `startSignIn` (Google or email link) and `completeSignIn` on `/auth/callback`, which shows "Signing you in…" and replaces itself with the return page.

### Team Picker
The favourite-team fieldset: 17 teams in alphabetical order, a grid of 4 per row on phones and 6 from 640px, 6px gaps. Each is a label wrapping a visually hidden native radio: an md badge over an 11px semibold name (truncated), 8px radius, 8px by 4px padding. Unchosen: `ink-3` text with an inset 1px `line-soft` ring (hover `ink-2`). Chosen: `lime-wash` fill, `ink` text and a 2px inset `lime` ring, as your selected tip is. Keyboard focus draws the lime focus outline on the label.

### Auto-tip Options
"If you forget to tip a game": a 13px `ink-3` note on when it can change (open; joining mid-season, when it is picked once for the season; locked), then native radios in rows between `line-soft` rules, each a 15px semibold label (`ink` when chosen, `ink-2` otherwise) over a 13px `ink-3` explanation, 12px vertical padding, 6px radius. The chosen row is `lime-wash`. Locked, the fieldset is disabled, unchosen rows drop to 60% and the chosen row carries a 16px `ink-3` lock icon at its right.

### Two-step Confirm
Anything that deletes starts as a quiet text action and opens an inline panel in its place: `miss-wash` fill, 1px inset `miss` ring at 50%, 8px radius, a 14 to 15px semibold `ink` question naming what goes ("Delete everything for Sully?", "Remove Dazza and all their tips from the comp?"), then the coral danger pill and a ghost pill that keeps it. Focus lands on the keep button when the panel opens and returns to the text action if kept; after a removal it moves to the section's summary line, with a polite announcement.

### Admin Sections
`/tipping/admin`, behind an admin gate (anyone else sees a 36px "This page is for whoever runs the comp." and a link back). Under the 26px title and a meta line ("Round 10 · tipping open · times in Sydney"), four sections 36px apart, each a 24px section head on a `line` bottom rule with an optional 13px `ink-3` meta at its right ("Round 10", "Last 4 runs"). Invites, Tippers and Pipeline then open with a one-sentence plain summary worked out from the data (14px `ink-2`, or 13px `ink-3` beside the Create invite pill): who still has to tip, how many invites are waiting, which runs failed and whether a later run covered them. Rows are `line-soft`-divided between `line-soft` rules, 10px vertical padding, 14px text.
- **Invites:** a lime "+ Create invite" pill; rows of the code in the 16px score face `ink`, an `ink-3` status ("Waiting · expires Sun 10 May", "Used by Tom", "Expired Fri 24 Oct") and a Cancel text action on waiting invites. A new invite opens a `lime-wash` panel (8px radius, 12px by 16px) with a 13px semibold line, the full link in the 17px score face, and Copy link and Share ghost pills; focus lands on Copy, which turns to "Copied" with a check.
- **Tippers:** sm favourite badge, 14px semibold `ink` name (with the lime "You" label on yours) over a 12px `ink-3` "Joined Tue 24 Feb", then "n to tip" in 13px semibold `ink` or "All tipped" in `ink-3`, and a Remove text action with the two-step confirm. Your own row has no Remove.
- **Margin game:** two rows, each led by a 15px semibold score-face round label in `ink-3` (R10, R11). This round's featured game as sm badges either side of the fixture, with a 13px `ink-3` line on how it was drawn; next round's either drawn or "Drawn at random when its predictions publish, Tue 12 May 5:15pm", the count in the draw, the games left out and why, and a disclosure ("Show the 6 games in the draw") listing the eligible games.
- **Pipeline:** one row per run: job and round (semibold `ink` "Predictions", `ink-3` "· Round 10"), the status at the right as a 12px bold uppercase label (OK `ink-3`, FAILED `miss`, RUNNING `live`), a 13px `ink-2` note, and a 12px `ink-3` line of Sydney time · model version · commit.

### News List
`/news`, read-mode in the column: the 26px title over a 13px `ink-3` meta line ("From r/nrl · fetched Tue 12 May 5:15pm", plus "· flairs guessed" on the sample), the flair chip row, then `line-soft`-divided rows. Each row is one link opening Reddit in a new tab (a screen-reader note says so): a 16px semibold `ink` headline that underlines on hover, a 12px `ink-3` meta line (flair · Sydney time · linked site), and a 16px `ink-3` external-link icon at the right. An unknown flair gets a ruled 15px `ink-2` line ("No “Trades” posts in this feed.") with a "Show all" link. The sample-data note appears only when the source is the sample.

### Empty and Error States
A 52px display title, one 16px relaxed `ink-2` line capped at 34ch, then one way on: a lime pill ("Try again" with a retry icon) or, on not-found, link rows. These are one of the four places banter is allowed ("Nothing doing.", "Reddit's gone quiet.", "Knocked on.").

### Not Found
"Knocked on." at 52px, one line on why, then three link rows capped at 24rem (This round, Your tips, The ladder) between `line-soft` rules: 15px semibold `ink` with an `ink-3` chevron that nudges 2px right on hover.

### Odds copy
No disclaimer or gambling message. The bookmaker is named in plain text and the source credited once at the page foot (12px `ink-3`: aussportsbetting.com historical odds, BlueBet prices, margin removed). The no-odds Model is explained once, in a single line under the page heading.

### Result marks
Quiet on prediction surfaces (a small `ink-2` or `ink-3` tick or cross beside "Model"); loud on tipping surfaces and the recap (lime and coral, washes, strike-through, the tick pop, lamp rows with a one-time chase on a perfect round).

## Do's and Don'ts

### Do:
- **Do** lead every game with the plain call ("Roosters by 14") before any number or bar.
- **Do** set every figure in the score face with tabular, lining numerals.
- **Do** mark every predicted score: dimmer weight and `ink-2`, a "Model's score" caption on boards, "Model XXX nn%" beside bars; show "–" in `ink-3` while a game is live or awaiting its result.
- **Do** keep "N of M tipped" (56px) the largest type on home and the board score (48px) next.
- **Do** draw win probability with the pitch bar, called team at full strength, halfway line ringed in `ground`.
- **Do** run new team colours through the 90-distance clash check against likely opponents.
- **Do** state every win chance as a percentage for the side it backs ("MAN 63%", "The bookies give the Sea Eagles 45%").
- **Do** keep team names whole inside display sentences and verdicts.
- **Do** mark the Model as a row with the sm MDL badge and an `ink` label.
- **Do** separate lists with `line-soft` hairlines and give each page at most one raised board.
- **Do** put context on a sentence-case `ink-3` meta line beside or below a heading.
- **Do** turn off every animation and transition under reduced motion, with the resting state already final.
- **Do** make each tip a half-width button at least 56px tall, the away side mirrored, and confirm every save in the row's meta line.
- **Do** show the Model as an unranked, `raised-2` row sorted among the tippers by points, and measure "off the lead" against the leading tipper.
- **Do** keep the comp's tips hidden until a game locks, then show the tally ("5 of 6 on SYD").
- **Do** drive every sample page from the same sample week so home, tips and ladder agree.
- **Do** draw every chart at its measured width with 2px lines, one y-axis, a legend for two or more series (end labels in its place on `/elo`) and a "Show as table" view.
- **Do** keep each entity's series colour on every chart (Model blue, bookies aqua, Elo orange), at most three series per all-pairs chart; on `/elo`, draw teams in their own clearance-checked colours, at most three lit.
- **Do** count an exact 50-50 as no tip in every tally, and derive shown differences from the rounded figures shown.
- **Do** write minus as U+2212 and show cents only when there are cents.
- **Do** widen data pages on desktop to the wide container, keeping prose at 60ch and single charts and stat rows at 40rem.
- **Do** give every text action in a row a 44px hit area with negative margins (`-my-2 -mr-2 px-2`), so the row keeps its look.
- **Do** move focus to the new heading or control whenever a panel swaps in place.
- **Do** make deletion two steps: a quiet text action, then a coral confirm panel with focus on the keep button.
- **Do** show the comp's times in Sydney through `sydney()`.
- **Do** describe the featured game as drawn at random, leaving out the previous round's featured teams.

### Don't:
- **Don't** use lime for labels, categories, headings or decoration; it is only for you, actions and right calls.
- **Don't** phrase the gap between two win chances as "N points apart"; points are score margins.
- **Don't** put an eyebrow or kicker label above a heading.
- **Don't** build card grids or stacks of bordered tiles; games are rows.
- **Don't** show a number in the score slot of a live or awaiting game, or let a predicted score look like a result.
- **Don't** use club logos, photography or bookmaker colours; teams are two colours and a code.
- **Don't** use team colours outside badges, pitch bars and the lit lines on `/elo`.
- **Don't** add a light theme or a second accent; the chart series colours are data marks on chart pages, not accents.
- **Don't** set text in a series colour, or use lime, amber or coral as a series colour.
- **Don't** add a disclaimer, gambling message or bookmaker branding to odds pages; name the bookmaker in plain text and credit the source.
- **Don't** give the Model a ladder position, a round's bold, or a trash-talk tag.
- **Don't** give a tipper more than one tag or repeat a tag on one ladder, and don't put banter anywhere but the ladder, the round recap, the home tipping strip, and empty and error states.
- **Don't** disable a submit pill; explain what's missing on submit.
- **Don't** use coral for anything but wrong, failed or destructive.
