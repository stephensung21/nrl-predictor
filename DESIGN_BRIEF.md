# rugbyleague-tipper: Design Brief

The visual and UX design for the website in [PLAN_WEB.md](PLAN_WEB.md) §3. Agreed in a grilling session in October 2026. Where this brief and PLAN_WEB.md disagree on look or feel, this brief wins; PLAN_WEB.md owns data, pages and rules.

## Audience and context

- A personal site for a few invited friends. No public visitors to impress, no sign-up funnel.
- **Phone first.** Most use is on a phone: tipping on Tuesday or Wednesday night, checking during games.
- **Desktop** gets wider layouts on the data pages only (Elo, model vs market: wider charts, table and chart side by side). Every other page stays a single centred column.

## Personality

- **Clean data editorial, with casual character.** Calm, readable and honest, like FiveThirtyEight or The Athletic, with a mates' footy-comp voice in a few places.
- **The trash talk lives in four places only:**
  1. the **ladder** (tags like "Wooden spoon watch", "Clear of the Model", biggest upset tipped)
  2. the **round recap** ("Perfect round: nobody. Again.")
  3. the **home tipping strip** (a short jab when you're behind the Model)
  4. **empty and error states**

  The predictions, odds, Elo and about pages stay straight. The copy is generated from results using templates, not written by hand each week.
- **The Model is a light character:** the shared opponent everyone is trying to beat, with its own badge and the occasional smug line in the recap ("Model went 7/8. Some of you went 3."). Its name stays plain: "the Model".

## Visual direction

- **Dark only** for now. Mood: **night game under lights.** A deep charcoal or green-black base and **one bright brand accent** (floodlight white or a sharp lime), with the feel of a stadium scoreboard. One accent keeps the brand from fighting 17 sets of team colours.
- **Typography:** a condensed, scoreboard-like display face for headlines and scores, a clean sans for body text, and **fixed-width figures** for every number so scores and percentages line up.
- **Teams:** no logos. Each team gets a **badge in its two colours with a 3-letter code** (e.g. MEL). Lighten team colours where needed so they read on the dark background; navy and maroon teams will need it.
- **Brand:** a wordmark only ("rugbyleague-tipper" in the display face, plus a small "personal project" tag) and a simple favicon. No logo.
- **Motion:** minimal, and only where there's a payoff: probability bars fill as they appear, a small pop on a correct tip, a short celebration for a perfect round. None at all with "reduce motion".
- **Touchstones:** Sofascore and Fotmob (dense dark match rows that are easy to read on a phone), FiveThirtyEight (honest probability visuals).

## Numbers

- **Lead with the plain call:** "Storm by 8", "Storm 24 – 16 Broncos".
- **Win probability as a bar,** so a 55% game *looks* close.
- Technical metrics (log loss, calibration) appear only on `/odds` and `/about`.

## Navigation

- **Phone:** a bottom tab bar: **Round · Tips · Ladder · Elo · More** (More holds Odds, News and About).
- **Desktop:** the same items in a top bar.

## Pages

### Home (`/`): the round

1. **Tipping strip** (signed-in users only; hidden when signed out). It links to `/tipping` and shows:
   - tips entered ("5 of 8 tipped"), the loudest element when any are missing
   - the next lockout ("Next lockout: Thu 7:50pm")
   - your ladder position and gap ("3rd · 2 pts off the lead")
   - your record against the Model ("+3 on the Model")

   Once the round has started, it switches to progress: "This round: 4/6 correct so far".
2. **The featured game** (the margin game) as a full card: badges, predicted score, probability bar, margin, kickoff, venue.
3. **Every other game as a compact row:** badges, predicted score, a thin probability bar, and the "Updated: Hughes out" badge when the prediction changed. Tapping a row opens `/match/[id]`.
4. The model's season record as a small strip.

### Results

- On the model's prediction cards: a **quiet tick or cross**, so the record reads as data.
- On tipping pages and the recap: **louder.** Correct and wrong tips are clearly marked (tinted edge, wrong tip struck through), a perfect round or a called upset gets a small celebration, and the round's lowest score gets a gentle roast.

### Tips (`/tipping`)

- **One list:** each game is a row with **two big team buttons**. Tap the team you want.
- **Autosave on every tap.** There's no submit button.
- The model's pick appears as a small hint on each row, with a **toggle at the top to hide it**.
- The featured game has a **margin input**, and shows the default margin (12) that applies if none is entered.
- **Locked games are greyed out** and show your tip.

### Ladder (`/tipping/ladder`)

- A ranked table: position, display name with a favourite-team badge, points, margin score.
- The **Model row is visually distinct** (its own badge, slightly tinted), so you can see who's above and below it.
- **Your row is highlighted.**
- Trash-talk tags appear as small labels beside names.

### Model vs market (`/odds`)

- Just the odds. **No disclaimer or gambling message.** Bookmaker names appear as plain text, with no logos, colours or links.

### Footer (every page)

A single line:

> Tipping comp and predictor for the boys. I'm not responsible if you lose money.
