# AusSportsBetting NRL resources

Source: https://www.aussportsbetting.com/2026/02/26/2026-nrl-betting-resources/

These are the indexes and guides AusSportsBetting publishes for the 2026 NRL season. The tools themselves are hosted on aussportstipping.com.

Each tool has a **Method** section that explains how its numbers are calculated. Points marked *(inferred)* aren't stated on the page. I worked them out from the numbers shown. Unless a tool says otherwise:
- odds and lines come from bet365
- the date filters go back to 13 March 2009

## Interactive form guide
Filters each team's form by home/away and by strength of opponent. It takes a few rounds of the season before it tells you much.

Page: https://www.aussportstipping.com/sports/nrl/form_guide/

**Method**
- Shows each team's last 6 games of the current season, oldest to newest. Each game shows the score (the team's own score first), opponent, date and Home/Away.
- There are 9 views: Overall, Home and Away, each against All, Strong or Weak opponents.
- **Strong opponent:** a team with more competition points this season than the mean. **Weak:** fewer than the mean. This is season-to-date points, not current form.
- There's no win/loss flag or form score. You read the result from the score.
- Not stated: how ties at the mean are handled, or what happens when a filtered view has fewer than 6 games.

In short, it is a raw list of recent results with an opponent filter based on season points. There's no weighting.

## Match centres
One page per fixture with bookmaker odds, member tipping tallies, form guides and detailed performance guides for that game.

Page: https://www.aussportstipping.com/sports/nrl/

**Method**
- No method is published. A match centre combines the other tools for a single fixture.
- The NRL hub also shows **Team Betting Form**: "Profit from the last six games. 1 unit per bet."

## Line betting table
Ranks each team by how often it has covered the line this season. Figures are given for home, away and all games.

Page: https://www.aussportstipping.com/sports/nrl/line_betting_table/

**Method**
- Uses the bet365 line. Each game is a **C** (cover), **P** (push) or **NC** (non-cover) for the team. The page doesn't define these terms. Standard meanings:
  - cover: the team's margin plus its line is above 0
  - push: exactly 0
  - non-cover: below 0
- **PD:** points difference.
- **V (value):** the net profit from betting $1 on the team at the line in every game this season, at bet365 line odds.
- *(inferred)* Despite the description, the rows are ranked by **V**, not by cover count. Example: Warriors (16 covers) are 5th and Roosters (17 covers) are 6th.
- Example: Cowboys 13-0-12, PD −54.5, V $16.75 (rank 1).
- Covers the current season only, split into All, Home and Away.

## Predictability index
Ranks each team by how predictable its scorelines are, measured by how accurate the pre-game bookmaker lines were. Figures are given for home, away and all games.

Page: https://www.aussportstipping.com/sports/nrl/predictability_index/

**Method**
- Line source: bet365 pre-game line. It is used for both the cover counts and the predictability score.
- For each game: `diff = |final margin − expected margin|`, where expected margin = −line. A home line of −4.5 means the home team is expected to win by 4.5.
  - Home line −4.5, home team wins by 2: `|2 − 4.5| = 2.5`
  - Home line −4.5, home team loses by 2: `|−2 − 4.5| = 6.5`
- **PS (predictability score)** = the mean of `diff` across the team's games in the season. Margins are taken from the team's own side.
- Ranked by PS, lowest first. A low PS means the bookmaker priced that team accurately. A high PS means the team's results were hard to predict.
- Columns: R (rank), C (covers), P (pushes), NC (non-covers), PS.
- Example (All Fixtures): Titans 10-2-12, PS 12.5 (rank 1). Sharks 15-0-11, PS 17.7 (rank 17).
- Not stated on the page: how pushes are handled. A push means the margin landed exactly on the line, so its diff is 0 if it is included. There is no date filter. It covers the current season only.

In short, it is the mean absolute error of the bookmaker line as a margin forecast, per team.

## Betting value index
Ranks each team by its betting value in the head-to-head market. Can be filtered by date.

Page: https://www.aussportstipping.com/sports/nrl/betting_value_index/

**Method**
- Uses closing head-to-head odds, "primarily from bet365", and assumes a flat $1 bet on the team in every game.
- Net profit per game: win means `odds − 1`, loss means `−1`. Draw handling isn't stated.
- Columns:
  - **Fav:** net profit in games where the team was favourite
  - **Und:** net profit in games where the team was underdog
  - **All:** net profit across every game, including joint-favourite games (left out of Fav and Und)
  - **#:** games
  - **Profit:** All ÷ # (ROI per game)
- *(inferred)* Ranked by All, highest first.
- Example: Knights Fav $1.07, Und $9.20, All $9.27, 28 games, 33.1%.
- Has Home & Away, Home and Away views.

In short, it is a flat-stake ROI backtest per team. A positive value means the market has underrated the team over that period.

## Home advantage analysis
Compares each team's winning record at home against its record away. Also gives league averages and medians. Can be filtered by date.

Page: https://www.aussportstipping.com/sports/nrl/home_advantage/

**Method**
- Home Win % = home wins ÷ home games. Away Win % = away wins ÷ away games.
- Difference % = Home Win % − Away Win %, in percentage points. Teams are ranked on this.
  - Example: Dragons 55.50% (121/218) home, 33.18% (73/220) away, giving 22.32.
  - Example: Dolphins 53.06% (26/49) home, 48.98% (24/49) away, giving 4.08.
- Only wins count. Draws count as non-wins, so home % + away % need not add up to 100.
- Date filter. The data goes back to 13 March 2009. By default the table appears to cover the whole history, not just one season.
- League rows:
  - All teams, past and present: pooled, with each fixture weighted equally. The site recommends this one as the league average.
  - Active teams, average: the plain mean of the per-team percentages.
  - Active teams, median: the median of each column across the 17 current teams. This is inferred from the figures, not stated.
- Caveats from the page: some finals at neutral venues have an arbitrarily assigned "home" team. Shared grounds and same-stadium derbies get no special treatment.

In short, it is raw win-rate splits with no adjustment for opponent strength, travel or venue. It is a descriptive stat rather than a model.

## Elo ratings
Works out Elo ratings for each team using parameters you choose.

Page: https://www.aussportstipping.com/sports/nrl/elo_ratings/

**Method**
- Update: `R_new = R_old + K · G · (W − W_e)`
  - W = 1 for a win, 0.5 for a draw, 0 for a loss.
  - G is the margin-of-victory multiplier. G = 1 for plain Elo.
- Expected result: `W_e = 1 / (1 + 10^((R_opp − R_team) / 400))`. The home advantage is added to the home team's rating before this is calculated.
- Parameters you can set:
  - **K:** typical range 15–60
  - **Home Advantage:** in rating points
  - **Previous Season Weighting:** carry-over between 0 and 1
  - **Promoted Team Default Rating**
- Every team starts at 1500.
- Season carry-over: `R = w · R_last + (1 − w) · default`. Returning teams are then rescaled so the league mean stays at 1500.
- Margin-of-victory options (N = winning margin, N_median = the league's median winning margin):
  - Basic: G = 1, not defined on the page
  - **AST1/2:** `G = (1 + N / N_median)^(1/2)`
  - **AST1/3:** `G = (1 + N / N_median)^(1/3)`
  - Also offered, borrowed from other sports: EloRatings.net, ClubElo, FiveThirtyEight NFL/NBA and FIFA Women's
- The NRL table shows Basic, AST1/2 and AST1/3 ratings plus their **Average**. Example: Panthers 1618.73 / 1654.90 / 1641.99, average 1638.54.
- Ratings for teams with fewer than 30 games are provisional. The defaults used for the published NRL table aren't stated.

## Score statistics
Points for, points against, points difference and total score figures for the current season. Averages are given for home games, away games and all games.

Page: https://www.aussportstipping.com/sports/nrl/score_statistics/

**Method**
- Per team, averaged per game:
  - **PF:** points for
  - **PA:** points against
  - **PD:** PF − PA (example: Panthers 27.5 / 14.7 / 12.9)
- Totals table, per team:
  - **T:** the mean combined score of both teams
  - **O / U:** the number of games that went over or under the bookmaker total
  - profit from betting $1 on Over and $1 on Under every game
- Pushes aren't shown. Pushes = G − O − U. Example: Rabbitohs 25 games, T 52.2, O 14 (+$1.28), U 11 (−$2.53).
- Neutral venues count as home games for whichever team the bookmaker listed first.
- Has All, Home and Away views.

## Stadium analysis
A range of statistics for each team at each stadium.

Page: https://www.aussportstipping.com/sports/nrl/stadium_records/

**Method**
- For each team and stadium: win record, win %, average points for and against, head-to-head betting value, line record, over/under record and average total. Some of these are only given where applicable.
- No formulas are published. The measures are presumably the same as in the betting value index, line betting table and score statistics, applied to games at one stadium.
- No minimum number of games and no date range is stated.

## Table
League table (ladder) data for any date range you choose.

Page: https://www.aussportstipping.com/sports/nrl/table/

**Method**
- 2 competition points per win, 0 per loss (and 1 per draw by standard NRL rules). The table leaves out bye points and bonus points.
- Columns: P (played), W/D/L, PD (points for − points against), Pts.
- *(inferred)* Teams level on points are ordered by PD.
- Finals are included by default. To leave them out, set the end date before the finals.
- Has Overall, Home and Away tables, with any date range back to 2009.

## Winning margins
Winning margin data for the whole league, and for each team at home and/or away.

Page: https://www.aussportstipping.com/sports/nrl/winning_margins/

**Method**
- Games are counted in margin bands: Draw, then 1–6, 7–12, …, 73–78. The band width can be changed with the "points increment" setting.
- Each band shows a count and a % of all games, draws included. Example: 1–6 has 1114 games out of 3631, or 30.7%.
- Average and median margins leave out draws. Across the whole league they are 14.62 (average) and 12 (median).
- The team view shows winning and losing margins separately, with home/away filters and a date range.
