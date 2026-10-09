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

## Colors

A cool green-black ground lit by near-white ink, with a single acid-lime lamp and two quiet signal colours for wrong and live.

### Primary
- **Floodlight Lime** (`lime`): the only accent. Your tips ("Your tip" labels, the "You" tag), primary actions (the loud tipping strip, "Try again", the active tab mark and icon, focus rings, text selection), and right calls (correct-tip ticks, perfect-round lamps, a perfect-round recap line). Hover lifts it to **Lamp Glare** (`lime-hover`). Text on lime is always **Lime Ink** (`lime-ink`), a near-black olive.
- **Lime Wash** (`lime-wash`, 12% lime): the tint behind your correct tip in a row and behind your own row in the recap table.

### Secondary
- **Miss Coral** (`miss`): wrong tips only. Strikes through your wrong pick and colours its cross. Its 12% wash (`miss-wash`) tints the wrong team line.
- **Siren Amber** (`live`): live state and team changes only. The pulsing live dot and "LIVE" label, the "Updated: Hughes out" prediction-change note, and the "In" marker on a player who came into a team list.

### Neutral
- **Pitch Night** (`ground`): page background, the html colour, and the ring around the halfway line.
- **Stand Shadow** (`raised`): the lit board, the tipping strip's lower band, the phone tab bar, and row hover.
- **Box Seat** (`raised-2`): menus, the Model's row in tables, unlit lamps, board hover (at 50%).
- **Hairline** (`line`): borders on the board and strip, menu border, chip rings, link underlines.
- **Soft Hairline** (`line-soft`): dividers between game rows, inside strips, the footer rule.
- **Turf** (`pitch`) and **Line Paint** (`pitch-line`): the empty pitch-bar field and its markings.
- **Floodlight** (`ink`): primary text, the winning or called team, final scores, current tab.
- **Grandstand** (`ink-2`): secondary text, team names under badges, predicted scores, supporting copy.
- **Back Row** (`ink-3`): meta lines, captions, losing scores, the "–" placeholder, inactive tabs, the dissent half of a verdict, recap placings, and struck-through "Out:" players.

### Team colours
Team colours live in `web/lib/teams.ts`, not in the token set: `primary` (badge fill), `secondary` (code lettering and badge stripe), optional `ink` (lettering when secondary is too dark on the fill), and `bar` (pitch-bar fill, lightened so navy, maroon and black teams read on the ground). They appear only inside badges and pitch bars, never as text, borders or backgrounds of UI chrome.

### Named Rules
**The One Lamp Rule.** Lime means you, an action, or a right call. Never use it for a label, a category, a heading or decoration ("Margin game" is `ink-3`/`ink-2`, not lime). If removing the lime would not change what the user can do or what they got right, it should not be lime. Wherever the Model is a row among others (the recap table, the match page's voice list), it is marked with the sm MDL badge and an `ink` label, never lime text.

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
- **Title** (700, 26px, 1): page heading such as "Round 10".
- **Section** (700, 24px, 1): in-page section headings such as "Results".
- **Score row** (700 final / 500 predicted, 21px): scores in game rows; record figures at 22px, ladder scores at 19px.
- **Body** (400 to 600, 15px): team names in rows, menu items, the Model's record heading; 16px with relaxed leading for empty-state and recap prose, capped at 34ch.
- **Meta** (500, 13px): date ranges, board meta line, kickoff times, standing line.
- **Caption** (500, 12px): "Model's score", "win chance", record labels, row footnotes.
- **Label** (700, 11px, 0.06em, uppercase): status words and tags only: "Your tip", "LIVE", "FT", "Full time", "Postponed", the amber "In" team-list marker, the tab-bar labels (600, no uppercase), the "personal project" wordmark tag (10px).

### Named Rules
**The Scoreboard Figures Rule.** Every number is tabular. Scores, percentages, positions and counts use the score face (`font-score`: display family with `tnum` and `lnum`); body text inherits `tabular-nums` from the page.

**The Marked Prediction Rule.** A predicted score never passes for a result. Predicted scores are set one step dimmer and lighter (`ink-2` at most, weight 500 to 600), carry a "Model's score" caption on the board and a screen-reader "predicted", and bars are labelled "Model XXX nn%". While a game is live or awaiting its result, the score slot shows "–" in `ink-3`, never a number.

**The Points Mean Margins Rule.** "Points" is reserved for score margins ("Roosters by 14"). A win chance is a percentage for the side it backs ("MAN 63%"), and the bookies' figure is stated the same way ("The bookies give the Sea Eagles 45%"), never as "N points apart".

**The Whole Name Rule.** A team name never breaks across lines inside a display sentence or verdict ("Sea Eagles", "Wests Tigers" stay together, `whitespace-nowrap` on each name); the sentence wraps around it.

**The Loudest Line Rule.** On home, "N of M tipped" (56px) is the biggest thing on the page and the board score (48px) is next. Nothing else on a page outranks what you owe.

**The No Eyebrow Rule.** No small uppercase kicker above a heading. Context goes on a meta line beside or below the heading in sentence case (`ink-3`, 13px), as the board does with "Margin game · Fri 6:00pm · Polytec Stadium".

## Layout

One centred column, `max-width: 34rem` (544px), 16px side padding, on every page except the wide data pages (Elo, model vs market), which the brief allows to widen on desktop. The desktop top bar spans up to 64rem; content stays in the column.

Phones get a fixed bottom tab bar (64px plus safe-area inset), so content carries 112px bottom padding (48px from 768px up, where the tab bar is replaced by the top bar). The sticky top header is 56px.

Vertical rhythm on the 4px scale: page heading 16px top / 12px bottom; 12px between strip and board; game rows 12px vertical padding with 4px between team lines; 32px before the Model's record strip; 48px before the footer. Rows bleed 12px into the gutter (`-mx-3 px-3`) so hover tints reach past the text edge while text stays aligned to the column.

Game rows are a two-column grid: content left (two team lines, then the pitch bar with its label), a fixed 64px status column right, top-aligned.

Paired columns (team lists, head to head) put home on the left and away on the right, mirrored: away names right-aligned with jersey numbers on the outer edge.

## Elevation & Depth

Flat and tonal. Depth comes from stepping the ground: `ground` to `raised` to `raised-2`, with hairline borders. The sticky header and tab bar are translucent (`ground` at 92%, `raised` at 95%) with a medium backdrop blur so rows slide under them.

### Shadow Vocabulary
- **Menu drop** (`box-shadow: 0 12px 32px -8px rgb(0 0 0 / 0.6)`): the More menu only, the one element that floats over content.
- **Lamp glow** (`box-shadow: 0 0 10px 1px` lime at 55%, transient): the perfect-round lamp chase; never at rest.

### Named Rules
**The One Board Rule.** Hairline rows and strips everywhere; a single raised, bordered, 12px-rounded board per page carries the game that matters (the featured margin game on home, the recap panel on the recap and round pages). The match page has no board; its voices are hairline rows. Never build a grid or stack of cards.

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
A dashed `line` border, 12px radius, 16px padding, 40px above it; 13px `ink-3` copy led by a semibold `ink-2` "Sample data." Optional state chips sit below it. It closes every page that runs on sample data and is never a board.

### Cards / Containers
- **The board:** `raised` fill, 1px `line` border, 12px radius, 16px padding; whole board is a link with hover to `raised-2` at 50%.
- **Tipping strip:** in the build, a bordered `raised` container with two bands: the loud top band (lime fill while tips are missing, plain once all are in with a lime check) and a `line-soft`-divided standing line.
- **Record strip:** no fill; `line-soft` hairlines top and bottom, 16px vertical padding, three-up stat grid.
- **Recap table rows:** `line-soft` dividers; your row `lime-wash`, the Model's row `raised-2`. The first column is this round's placing among the human tippers in the score face (`ink-3`, "=" prefix for a tie, e.g. "=2nd"); the Model is not ranked and shows the sm MDL badge instead. On the round page the panel drops its own heading (the round heading with steppers sits above it); the next-round line under it is optional.

### Navigation
- **Phone:** fixed bottom tab bar (Round, Tips, Ladder, Elo, More), `raised` at 95% with blur and a `line` top border. 22px Lucide icons over 11px semibold labels; inactive `ink-3`, active `ink` with a lime icon and a 3px by 32px lime mark at the top edge.
- **Desktop (768px+):** the same items in the sticky top bar, 14px semibold, active marked by a 2px lime underline on the header's bottom edge.
- **In-page tabs:** link tabs (they work without JavaScript) on a `line` bottom rule, 14px semibold; active `ink` with a 2px lime underline, inactive `ink-3` (hover `ink-2`). Used on the match page for "Team lists" and "Head to head".
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

### Don't:
- **Don't** use lime for labels, categories, headings or decoration; it is only for you, actions and right calls.
- **Don't** phrase the gap between two win chances as "N points apart"; points are score margins.
- **Don't** put an eyebrow or kicker label above a heading.
- **Don't** build card grids or stacks of bordered tiles; games are rows.
- **Don't** show a number in the score slot of a live or awaiting game, or let a predicted score look like a result.
- **Don't** use club logos, photography or bookmaker colours; teams are two colours and a code.
- **Don't** use team colours outside badges and pitch bars.
- **Don't** add a light theme or a second accent.
