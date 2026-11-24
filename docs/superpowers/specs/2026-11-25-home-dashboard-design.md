# Home dashboard: design

The home page becomes each tipper's week at a glance: what they still have to do before the round
locks, and how they're going in every comp. Mockup approved by the user on 25 November 2026
(`.superpowers/brainstorm/640-1795529186/content/home-dashboard.html`).

## Why

The user: "a homepage to be able to see quickly the progress for the users comps and if they have to
do any actions before the week is over". Today `/` is the round page; the Dally M and last man
standing only show as reminder lines on the tips page, and the ladder is a separate tab.

## Decided by the user

- **Approach A:** the dashboard replaces `/` for a signed-in tipper; the round's games move behind a
  "This round" link (`/round/<season>/<round>`); the Round tab becomes **Home**. Chosen over stacking
  the dashboard above today's home (approach B), which makes a long page where the comps compete with
  the games.
- **The layout in the mockup:** a To do board, then Ladder, Your tips, Last man standing, Dally M, then
  the This round link.

## Who sees it

- A signed-in tipper during a comp season (any round phase): the dashboard.
- Signed out, not in the comp, before the comp's first season, off-season or predictions pending: the
  home page as it is today (my call: those visitors have no comps to show).
- Sample site: the dashboard by default (the sample viewer, Sully, is in the comp); "View signed out"
  shows today's page.

## The page

- **Heading:** the round's name and dates; the group chips (GroupSwitcher) when the viewer is in a
  group. Every panel follows the chosen group.
- **To do** (the page's one raised board, DESIGN.md's One Board Rule): items still open, each with a
  lime action; done items below them with a lime-fg tick and no button. Heading "To do · N" (or "All
  done" with N = 0), meta "first lock <time>" while games are still open.
  - Tips: untipped games still to kick off. "Tip N more games", "x of y tipped · next lockout <time>",
    button "Tip N →" to `/tipping`. Done: "All y tipped".
  - Margin game: tipped the featured game but no margin, before its kickoff: "Set your margin"
    (button "Set it" to `/tipping`). Done: "Margin game: <team> by <n>".
  - Last man standing: still in any of your games and no pick for its open round: "Pick for Round N"
    (button "Pick" to `/last-man-standing`). Done: "Picked <team>". Out: no item.
  - Dally M: a round open for votes and you haven't voted: "Dally M votes, Round N", "Closes <time>",
    button "Vote" to `/dally-m`. Done: "Dally M votes in".
- **Ladder:** the top two tippers, you (lime wash), and the Model, as the ladder going into this round
  plus this round so far (the round view's standings); the line "N off the lead · N behind the Model";
  link "Full ladder".
- **Your tips:** a lamp per game in kickoff order, lit when you've tipped it; once games are decided,
  "x of y right so far"; link "All games" to `/tipping`.
- **Last man standing:** in or out of the current game (lime "IN" only for you), how many are still in
  of the field, games won this season, and the teams you've used this game (dimmed badges); link
  "Game N". Hidden before the comp's last man standing season has a draw.
- **Dally M:** the season's top three (photo, name, team, votes) for the group; link "Leaderboard".
  Hidden before any round has closed.
- **This round:** a link row to `/round/<season>/<round>`: "This round: every game, the margin game,
  the Model's calls".

## Constraints

- DESIGN.md: one raised board (To do); everything else hairline sections; lime only for you, actions
  and right calls; no card grids. Reuse the existing pieces (TeamBadge, ModelBadge, PlayerPhoto,
  GroupSwitcher, pictograms).
- The to-do rules live in a pure, tested function (`web/lib/dashboard.ts`); the page only lays it out.
- No new database objects: everything comes from the round view, the last man standing and Dally M
  sources, and the groups already read.
- Screens at 1440, 768 and 390 (CLAUDE.md), and the design detector clean on the new page.

## Left to the builder

- Exact copy within the mockup's wording; the order of done items; empty-state copy for a group of one.
