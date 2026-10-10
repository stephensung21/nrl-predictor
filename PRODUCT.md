# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router, TypeScript) on Vercel, Tailwind CSS, Recharts for charts, Supabase (Postgres, auth, row-level security) for data and sign-in. Decided in [PLAN_WEB.md](PLAN_WEB.md). No `web/` app exists yet.

## Users

- **A few invited friends** in one private NRL tipping comp. They use it mostly on a phone: tipping on Tuesday or Wednesday night after team lists come out, and checking scores and the ladder during and after games.
- **The owner** (admin), who also tips. They create invites, set each round's featured game and run the model.
- No public visitors. No sign-up funnel. The site is kept out of search engines; friends get the link directly.

## Product Purpose

**rugbyleague-tipper** (working name, at `rugbyleague-tipper.vercel.app`) has two parts:

1. **The tipping comp. This is the main part.** Friends tip each NRL round under the official NRL Tipping rules and compete on a ladder, with the Model as a shared opponent.
2. **The Model.** A machine-learning predictor publishes predicted scores, winners, margins and win probabilities for every game. It has a dedicated page where people can click through and see how it is doing: its results and record, how it compares with the market and Elo, and how it works.

Success means friends come back every round to tip, look at the ladder and see whether they beat the Model. The Model's numbers should be easy to trust because its record is shown honestly.

## Positioning

The opponent in this comp is a real, tested model, not a pundit. The Model tips every round from its prediction of record, and its accuracy is published and graded against the betting market and Elo. Beating it means something, because on the 2023–25 backtest it beat Elo and the opening market, and on the unseen 2026 season it was level with the closing market.

## Operating Context

- **The NRL week drives the site.** Results on Monday, team lists and the main prediction on Tuesday evening (Sydney time), refreshes Wednesday to Sunday as teams and odds change, and each game locks at its own kickoff.
- **Phone first.** Desktop gets wider layouts only on the data pages (Elo, model vs market). Everything else is a single centred column.
- The Python pipeline publishes to the database. The website reads model data and writes only tipping data.
- Times are stored in UTC and shown in the viewer's time zone.

## Capabilities and Constraints

- **Pages planned** (PLAN_WEB.md §3.1): home round view, past and future rounds, match detail, model vs market (`/odds`), Elo, tips, ladder, tipping admin, r/nrl news feed, about.
- **Model page:** a dedicated page for the Model's results and season record that people can click into from the tipping side. Its route, and whether it merges with `/odds` and `/about`, is **undecided**.
- **Tipping rules:** official NRL Tipping rules. 1 point per correct tip, per-game lockout at kickoff, draws count for both sides, auto-tips (home team, crowd or ladder), a bonus point for a perfect round of 8 or more games, and a margin on the featured game (default 12) as the ladder tiebreak. Other people's tips are hidden until kickoff. All of this is enforced in the database.
- **The Model is a tipper** in the comp. It tips its prediction of record and never uses an auto-tip. Its pick and probability can be shown as a hint on the tip page, with a toggle to hide it.
- **Two models:** the with-odds ensemble for predictions and the Model tipper; the no-odds ensemble for the model vs market page and as the fallback when odds aren't available.
- **Predicted scores never contradict the tip.** The winner comes from the win probability, and display scores are adjusted so they agree.
- **Free plans only.** One invite-only comp. Accounts only for tipping; everything else is read-only.
- **No official NRL or club logos.** Team names are used, with plain coloured badges.
- `noindex` on every page and a `robots.txt` that blocks crawlers.
- The site stores only email addresses, display names, favourite teams, auto-tip choices and tips. Users can delete their account and tips. Google sign-in metadata (name, avatar) is not kept.

## Brand Commitments

[DESIGN_BRIEF.md](DESIGN_BRIEF.md) is **binding** for look, feel and voice. Later design work builds inside it and only fills in details it leaves open (the exact accent, fonts, spacing). Where it and PLAN_WEB.md disagree on look or feel, the brief wins. Summary of what it fixes:

- **Name:** rugbyleague-tipper, shown as a wordmark with a small "personal project" tag. No logo.
- **Voice:** clean data editorial (FiveThirtyEight, The Athletic) with a mates' footy-comp voice. Trash talk appears in only four places: the ladder, the round recap, the home tipping strip, and empty and error states. It is generated from results with templates. Predictions, odds, Elo and about pages stay straight.
- **The Model** is a light character, called plainly "the Model", with its own badge and the occasional smug line in the recap.
- **Visual rules:** dark only, "night game under lights", one bright accent, condensed scoreboard-style display type with fixed-width figures, two-colour team badges with 3-letter codes (team colours lightened where needed), minimal motion that respects reduced motion.
- **Numbers:** lead with the plain call ("Storm by 8"), show win probability as a bar, and keep technical metrics (log loss, calibration) to the model pages.
- **Footer on every page:** "Tipping comp and predictor for the boys. I'm not responsible if you lose money."
- **Odds:** shown plainly, with no disclaimer or gambling message. Bookmaker names as plain text, with no logos, colours or links.

## Evidence on Hand

- **Model results:** [reports/backtest.md](reports/backtest.md) (2023–25 backtest: 0.622 log loss for the with-odds ensemble against 0.638 for Elo and 0.633 for the opening market), [reports/final_2026.md](reports/final_2026.md) (the unseen 2026 season), [reports/betting.md](reports/betting.md) and [reports/betting_2026.md](reports/betting_2026.md), and the experiment reports in `reports/`.
- **Frozen models:** `models/2027/` (version `2027.1`, trained on 2021–2026) and `models/2026/` for replays.
- **Data:** scraped nrl.com results, match stats and team lists in `data/`, and the historical odds sheet.
- **Not yet available, never invent:** live weekly predictions, a graded season record, live odds, tipping data, users, ladder standings or recap lines. Until the pipeline publishes them, any page that shows them uses clearly labelled sample or replay data (2026 replays are the honest source).

## Product Principles

1. **The comp comes first.** Tipping, the ladder and beating the Model are why people open the site. Model detail is one tap away, not in the way.
2. **Honest numbers.** Show the Model's record plainly, losses included, against the market and Elo. Never overstate the edge.
3. **Built for the phone, on a weeknight.** Tipping a whole round should take under a minute with one thumb.
4. **Rules are enforced, not trusted.** Lockout, hidden tips and scoring live in the database, so the comp stays fair among friends.
5. **Banter is placed, not sprinkled.** The mates' voice appears only where the brief allows it; everywhere else the site is calm and straight.
