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
- Data pages (Model vs market, Elo) widen on desktop and draw their charts in a fixed three-colour series palette; ink still carries every word.

## Colors

A cool green-black ground lit by near-white ink, with a single acid-lime lamp and two quiet signal colours for wrong and live.

### Primary
- **Floodlight Lime** (`lime`): the only accent. Your tips ("Your tip" labels, the "You" tag), primary actions (the loud tipping strip, "Try again", the active tab mark and icon, focus rings, text selection), and right calls (correct-tip ticks, perfect-round lamps, a perfect-round recap line). Hover lifts it to **Lamp Glare** (`lime-hover`). Text on lime is always **Lime Ink** (`lime-ink`), a near-black olive.
- **Lime Wash** (`lime-wash`, 12% lime): the tint behind your correct tip in a row, your selected tip button, and your own row in the recap table, the ladder and the round-by-round grid.

### Secondary
- **Miss Coral** (`miss`): wrong tips and failed saves only. Strikes through your wrong pick and colours its cross; colours the save note when a tip doesn't save ("Couldn't save. Tap again.") or hits lockout. Its 12% wash (`miss-wash`) tints the wrong team line and the wrong tip button.
- **Siren Amber** (`live`): live state and team changes only. The pulsing live dot and "LIVE" label, the "Updated: Hughes out" prediction-change note, and the "In" marker on a player who came into a team list.

### Neutral
- **Pitch Night** (`ground`): page background, the html colour, the ring around the halfway line, the switch knob and the margin number field.
- **Stand Shadow** (`raised`): the lit board, the tipping strip's lower band, the phone tab bar, the margin stepper panel, and row and tip-button hover.
- **Box Seat** (`raised-2`): menus, the Model's row in tables (recap, ladder, round-by-round grid), the off switch track, unlit lamps, board hover (at 50%).
- **Hairline** (`line`): borders on the board and strip, menu border, chip rings, link underlines.
- **Soft Hairline** (`line-soft`): dividers between game rows, inside strips, the footer rule.
- **Turf** (`pitch`) and **Line Paint** (`pitch-line`): the empty pitch-bar field and its markings.
- **Floodlight** (`ink`): primary text, the winning or called team, final scores, current tab.
- **Grandstand** (`ink-2`): secondary text, team names under badges and on open tip buttons, predicted scores, ladder positions, supporting copy, and the on switch track.
- **Back Row** (`ink-3`): meta lines, captions, losing scores, the "–" placeholder, inactive tabs, the dissent half of a verdict, recap placings, struck-through "Out:" players, locked unchosen tip buttons, the Model hint and tip tally, ladder tags, movement and margin scores, and every round-by-round figure but the round's best.

### Team colours
Team colours live in `web/lib/teams.ts`, not in the token set: `primary` (badge fill), `secondary` (code lettering and badge stripe), optional `ink` (lettering when secondary is too dark on the fill), and `bar` (pitch-bar fill, lightened so navy, maroon and black teams read on the ground). They appear only inside badges and pitch bars, never as text, borders or backgrounds of UI chrome.

### Chart series
A page-scoped family for chart pages only (first shipped on Model vs market, `SERIES` in `web/lib/odds.ts`), validated all-pairs on `ground` with the dataviz validator: worst colour-vision-deficiency ΔE 9.4, normal-vision ΔE 20.9, every colour at least 3:1 against the ground.
- **Model Blue** (`series-model`): the Model on every chart and on the market track's diamond.
- **Bookies Aqua** (`series-market`): the bookies' price (opening and closing) and the bookies' favourite.
- **Elo Orange** (`series-elo`): Elo.

Series colours appear only as marks: lines, dots, the track's markers and connector, and the short line keys in legends and stat labels.

### Named Rules
**The Fixed Series Rule.** An entity keeps its series colour on every chart and every page: the Model is always blue, the bookies always aqua, Elo always orange. Lime, amber and coral keep their jobs and are never series colours. Text is never set in a series colour; labels, values and tooltips use the ink steps. At most three series share an all-pairs chart, because the validation covers exactly these three.

**The One Lamp Rule.** Lime means you, an action, or a right call. Never use it for a label, a category, a heading or decoration ("Margin game" is `ink-3`/`ink-2`, not lime). If removing the lime would not change what the user can do or what they got right, it should not be lime. Wherever the Model is a row among others (the recap table, the ladder and its round-by-round grid, the match page's voice list, the tips page's "Show the Model's pick" switch), it is marked with the sm MDL badge and an `ink` label, never lime text.

**The Clash Rule.** A game's two bar colours must sit at least 90 RGB distance apart. When the away team's `bar` is closer than that to the home team's, the away fill switches to whichever of its `primary` or `secondary` sits furthest from the home bar (`barColours` in `pitch-bar.tsx`), so Sea Eagles v Broncos draws the Broncos in gold. New team colours must be checked against likely opponents.

## Typography

**Display Font:** Saira Extra Condensed (with Arial Narrow, sans-serif), weights 500 to 800
**Body Font:** Sofia Sans (with system-ui, sans-serif), weights 400 to 700

**Character:** A tall, tight scoreboard face shouting the call and the numbers, over a plain, friendly sans that does the explaining. Display text is uppercase; body is sentence case.

### Hierarchy
- **Display hero** (800, 56px, 0.86): the "N of M tipped" line. The largest type on the home page.
- **Display** (700, 40 to 52px, 0.9): page titles that stand alone: the recap ("Round 10 wrap") and empty/error titles (40px for the round page's missing-round state).
- **Match verdict** (800, 34px before kickoff / 40px at full time, 0.92 to 0.94): the match page's headline. Before kickoff it is the verdict sentence itself ("The Model and Elo back the Sea Eagles."), with any dissent dimmed to `ink-3` in the same line; at full time it is the result ("Sea Eagles won 32–4") and the verdict drops to 16px semibold body below it.
- **Score board** (600 predicted / 700 final, 48px, 1): the featured board's score. Second only to the tipping strip.
- **Headline** (700, 30px, 1): the board's call ("Roosters by 14"), the live strip ("This round: 4/6 correct so far"); recap line at 28px.
- **Title** (700, 26px, 1): page heading such as "Round 10", "Round 10 tips", "Ladder".
- **Section** (700, 24px, 1): in-page section headings such as "Results", "Round by round", "Bragging rights". The margin number field uses the score face at the same 24px, bold.
- **Score row** (700 final / 500 predicted, 21px): scores in game rows and ladder points (bold `ink`); record figures at 22px, recap-table scores at 19px; ladder positions and margin scores at 17px semibold, final scores on tip buttons at 17px `ink-3`, round-by-round figures at 16px.
- **Body** (400 to 600, 15px): team names in rows, menu items, the Model's record heading; 16px with relaxed leading for empty-state and recap prose, capped at 34ch.
- **Meta** (500, 13px): date ranges, board meta line, kickoff times, standing line.
- **Caption** (500, 12px): "Model's score", "win chance", record labels, row footnotes.
- **Data page figures:** the stat row's figures at 30px bold display (the "/213" at 16px semibold `ink-3`); the hero money figure ("+$240.50") at 40px bold display; the figures row at 22px bold `ink` for the highlighted Opening and 19px semibold `ink-2` for the rest, each after a 12px semibold `ink-3` team code.
- **Chart text:** chart titles 16px semibold `ink` in sentence case with a 13px `ink-3` note below; y-axis ticks 12px score face `ink-3`; x labels 11px `ink-3`; end values 13px semibold score face `ink-2`; legends 12px `ink-2`; tooltip values 15px semibold score face `ink`.
- **Label** (700, 11px, 0.06em, uppercase): status words and tags only: "Your tip", the lime "You" beside your ladder name, "LIVE", "FT", "Full time", "Postponed", the amber "In" team-list marker, the tab-bar labels (600, no uppercase), the "personal project" wordmark tag (10px).

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

**Wide data pages.** From 768px the page's `main` breaks out of the column to `min(60rem, 100vw − 4rem)` (the `wide` step), centred on the column. Inside it, prose keeps a 60ch measure, stat rows and single full-width charts are capped at 40rem (`chart`), and paired content runs in a two-column grid with a 40px gap, top-aligned (`items-start`) so a short chart never stretches: two charts side by side, or game rows two-up. On phones everything returns to the single column.

Phones get a fixed bottom tab bar (64px plus safe-area inset), so content carries 112px bottom padding (48px from 768px up, where the tab bar is replaced by the top bar). The sticky top header is 56px.

Vertical rhythm on the 4px scale: page heading 16px top / 12px bottom; 12px between strip and board; game rows 12px vertical padding with 4px between team lines; 32px before the Model's record strip; 48px before the footer. Rows bleed 12px into the gutter (`-mx-3 px-3`) so hover tints reach past the text edge while text stays aligned to the column.

Game rows are a two-column grid: content left (two team lines, then the pitch bar with its label), a fixed 64px status column right, top-aligned.

Paired columns (team lists, head to head, tip buttons) put home on the left and away on the right, mirrored: away names right-aligned with jersey numbers or badges on the outer edge.

Tip rows are two equal half-width buttons on an 8px gap. Tables (ladder, round-by-round grid) run the full column with 8px inner padding at the edges; a grid wider than the column scrolls sideways under a sticky name column.

## Elevation & Depth

Flat and tonal. Depth comes from stepping the ground: `ground` to `raised` to `raised-2`, with hairline borders. The sticky header and tab bar are translucent (`ground` at 92%, `raised` at 95%) with a medium backdrop blur so rows slide under them.

### Shadow Vocabulary
- **Menu drop** (`box-shadow: 0 12px 32px -8px rgb(0 0 0 / 0.6)`): the More menu only.
- **Tooltip lift** (`box-shadow: 0 6px 20px rgb(0 0 0 / 0.45)`): chart tooltips only, which float over the plot while hovered or focused.
- **Lamp glow** (`box-shadow: 0 0 10px 1px` lime at 55%, transient): the perfect-round lamp chase; never at rest.

### Named Rules
**The One Board Rule.** Hairline rows and strips everywhere; a single raised, bordered, 12px-rounded board per page carries the game that matters (the featured margin game on home, the recap panel on the recap and round pages). The match page has no board; its voices are hairline rows. The tips page and ladder have no board: the margin stepper is an unbordered `raised` panel inset inside its game's row, not a board, and the Model's ladder row is a tint, not a raised surface. On Model vs market the highlighted Opening figure is an unbordered `raised` tile inside its row, not a board. Never build a grid or stack of cards.

## Shapes

Small, tight corners that read as scoreboard hardware: 2px lamps, 3px pitch bars, 5px team badges, 6px row tints, 8px row hover and menus, 12px for the board. Actions and chips are full pills. Borders are 1px hairlines; the only heavy strokes are the 2 to 3px lime active-tab marks, the 3px badge stripe and the halfway line.

## Components

### Buttons
Pill-shaped, bold, short labels with an arrow or icon.
- **Shape:** full pill (9999px).
- **Primary:** `lime` with `lime-ink` text, 15px bold, 12px by 20px, optional 16px icon at stroke 2.5. Hover to `lime-hover`.
- **On lime:** inside a lime surface the action inverts to `lime-ink` with `lime` text ("Tip 4 →"); the arrow nudges 2px right on hover.
- **Quiet link:** sentence-case `ink-2` or `ink` text, semibold, underlined in `line`, trailing chevron; hover to `ink`.
- **Round stepper:** a 40px circle with an inset `line` ring and a 20px chevron in `ink-2` (hover `ink` text, `ink-3` ring), prev and next side by side at the right of the round heading; at either end the missing step stays in place at `ink-3` 40% and is not a link.
- **Focus:** 2px `lime` outline at 2px offset, 4px radius, on every focusable element.

### Chips
- **Style:** pill, 13px semibold, 6px by 12px; unselected is `ink-2` text with an inset `line` ring (hover `ink` text, `ink-3` ring); selected is solid `ink` with `ground` text. Used for filters and state switches (the sample-data note).

### Sample-data note
A dashed `line` border, 12px radius, 16px padding, 40px above it; 13px `ink-3` copy led by a semibold `ink-2` "Sample data." Optional state chips sit below it. It closes every page that runs on sample data and is never a board. The home, tips and ladder pages share one sample NRL week (tipping open, in progress, recap) through these chips and the home sample bar, so the same state shows the same numbers on every page.

### Cards / Containers
- **The board:** `raised` fill, 1px `line` border, 12px radius, 16px padding; whole board is a link with hover to `raised-2` at 50%.
- **Tipping strip:** in the build, a bordered `raised` container with two bands: the loud top band (lime fill while tips are missing, plain once all are in with a lime check) and a `line-soft`-divided standing line.
- **Record strip:** no fill; `line-soft` hairlines top and bottom, 16px vertical padding, three-up stat grid.
- **Recap table rows:** `line-soft` dividers; your row `lime-wash`, the Model's row `raised-2` (the full ladder is under Ladder Table). The first column is this round's placing among the human tippers in the score face (`ink-3`, "=" prefix for a tie, e.g. "=2nd"); the Model is not ranked and shows the sm MDL badge instead. On the round page the panel drops its own heading (the round heading with steppers sits above it); the next-round line under it is optional.

### Navigation
- **Phone:** fixed bottom tab bar (Round, Tips, Ladder, Elo, More), `raised` at 95% with blur and a `line` top border. 22px Lucide icons over 11px semibold labels; inactive `ink-3`, active `ink` with a lime icon and a 3px by 32px lime mark at the top edge.
- **Desktop (768px+):** the same items in the sticky top bar, 14px semibold, active marked by a 2px lime underline on the header's bottom edge.
- **In-page tabs:** link tabs (they work without JavaScript) on a `line` bottom rule, 14px semibold; active `ink` with a 2px lime underline, inactive `ink-3` (hover `ink-2`). Used on the match page for "Team lists" and "Head to head", and on Model vs market for "This round" and "Season".
- **More:** opens a `raised-2` menu with the menu drop shadow; closes on outside click, Escape or navigation.
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
Banter belongs on the ladder only. Each tipper gets at most one tag, in 12px `ink-3` under their name, never lime, never a chip. Walking the ladder from the top, each tipper takes the most specific tag that applies and hasn't been used higher up, in this order: Wooden spoon, Top dog, Won round N, Wooden spoon watch, Climbing, Sliding, Clear of the Model, Behind a spreadsheet. The Model gets none.

### Named Rules
**The Unranked Model Rule.** The Model is the line everyone measures against, never a competitor. It takes no position ("–"), never wins a round's bold, gets no tag, and sits among the tippers sorted by points so you can see who is above and below it. "Off the lead" and "top of the ladder" are measured against the leading tipper, on the ladder and on the home strip alike.

**The One Tag Rule.** At most one trash-talk tag per tipper and no tag twice on the same ladder; the more specific tag wins.

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
Three figures across a `line-soft`-ruled strip (top and bottom, 12px vertical padding), capped at 40rem. Each label is 12px `ink-3`, led by its series' 12px line key, in a fixed two-line slot (`min-height: 2lh`) so the figures share a baseline whether or not a label wraps; then the 30px figure and a 12px `ink-3` line ("63% tipped right").

### Charts
Small SVG charts for data pages (`web/components/charts.tsx`), shared by Model vs market and Elo.
- **Drawing:** drawn at the measured width (ResizeObserver), never a stretched viewBox, so lines stay 2px and text stays crisp.
- **Marks:** 2px series lines with round joins. End dots and crosshair dots are r=5 with a 4px `ground` stroke under the fill (`paint-order: stroke`): a 10px coloured dot inside a visible 2px ground ring.
- **Grid and axes:** solid 1px `line-soft` gridlines. An indexed chart's zero line is one step stronger (`ink-3`). One y-axis, its ticks covering the full range (the axis ends on a tick at or beyond each extreme). X labels are thinned so they sit at least 40px apart, always keeping the last ("Finals").
- **Labels:** each series' end value is labelled at its line's end in `ink-2`, nudged apart only where two would overlap. A legend of short line keys sits above any chart with two or more series; a single-series chart has none.
- **Tooltip:** a crosshair (1px `ink-3`) and a `raised-2` tooltip with a 1px `line` ring and the tooltip lift, headed by the point in `ink-3` and listing every series, value first, then its name. The chart is focusable and the arrow keys step through the points.
- **Calibration:** a square plot (up to 340px) with an `ink-3` diagonal for perfect calibration; every dot carries its own hit target of at least 24px, and the plot is `role="group"`.
- **Table view:** every chart ends in a "Show as table" disclosure (13px semibold `ink-3`) opening a scrollable table with the chart's values in the score face.

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
- **Do** draw every chart at its measured width with 2px lines, one y-axis, a legend for two or more series and a "Show as table" view.
- **Do** keep each entity's series colour on every chart (Model blue, bookies aqua, Elo orange), at most three series per all-pairs chart.
- **Do** write minus as U+2212 and show cents only when there are cents.
- **Do** widen data pages on desktop to the wide container, keeping prose at 60ch and single charts and stat rows at 40rem.

### Don't:
- **Don't** use lime for labels, categories, headings or decoration; it is only for you, actions and right calls.
- **Don't** phrase the gap between two win chances as "N points apart"; points are score margins.
- **Don't** put an eyebrow or kicker label above a heading.
- **Don't** build card grids or stacks of bordered tiles; games are rows.
- **Don't** show a number in the score slot of a live or awaiting game, or let a predicted score look like a result.
- **Don't** use club logos, photography or bookmaker colours; teams are two colours and a code.
- **Don't** use team colours outside badges and pitch bars.
- **Don't** add a light theme or a second accent; the chart series colours are data marks on chart pages, not accents.
- **Don't** set text in a series colour, or use lime, amber or coral as a series colour.
- **Don't** add a disclaimer, gambling message or bookmaker branding to odds pages; name the bookmaker in plain text and credit the source.
- **Don't** give the Model a ladder position, a round's bold, or a trash-talk tag.
- **Don't** give a tipper more than one tag, repeat a tag on one ladder, or put banter anywhere but the ladder.
