"""
Live edges: for each game still to kick off, the Model's fair odds beside Betr's latest price, the
expected edge on each side (probability x odds - 1), and the bet paper trading would place now.

Head to head only: it's the market whose edge held up out of sample (reports/betting_2026.md: +27% ROI
at a 2% edge, and the bets mostly beat the closing price). Line bets lost money, and the totals' edge was
mostly the rain flag, which isn't known early in the week. The rule is paper.py's: the side with the
bigger expected edge, when that edge is at least MIN_EDGE, on the prediction of record's probability.
A draw would lose a head-to-head bet, which is why the fair odds are just 1 / probability.

Written after every live job (they all fetch odds first) to edges.csv and edges.md beside the season's
records. The database's `edges_at()` and `match_edges` view
(supabase/migrations/20261016000000_match_edges.sql) apply the same rule to the latest snapshot, so the
website's prices are always current; tests/test_publish.py checks the two agree.
"""

import numpy as np
import pandas as pd

import paper
from grade import prediction_of_record

MIN_EDGE = paper.MIN_EDGE
EDGE_COLS = ["match_id", "season", "round", "kickoff", "home_team", "away_team", "home_prob", "fair_home",
             "fair_away", "price_at", "home_odds", "away_odds", "market_home_prob", "home_edge", "away_edge",
             "bet_side", "bet_team", "bet_edge"]


def live_edges(record, snaps, now):
    """One row per game with a prediction of record that hasn't kicked off by `now`, in kickoff order.
    `record`: grade.prediction_of_record (match_id, start_time_utc, home_win_prob, season, round,
    home_team, away_team). `snaps`: paper.oriented_snapshots. A game Betr hasn't priced yet keeps its
    fair odds, with no price, edge or bet."""
    now = pd.Timestamp(now)
    rows = []
    for p in record.sort_values(["start_time_utc", "match_id"]).itertuples():
        kickoff = pd.Timestamp(p.start_time_utc)
        if kickoff <= now:
            continue
        s = snaps[(snaps["match_id"] == p.match_id) & (snaps["captured_at"] <= now) & (snaps["captured_at"] < kickoff)]
        prob = float(p.home_win_prob)
        row = {"match_id": p.match_id, "season": p.season, "round": p.round, "kickoff": kickoff,
               "home_team": p.home_team, "away_team": p.away_team, "home_prob": prob,
               "fair_home": 1 / prob, "fair_away": 1 / (1 - prob), "price_at": pd.NaT, "home_odds": np.nan,
               "away_odds": np.nan, "market_home_prob": np.nan, "home_edge": np.nan, "away_edge": np.nan,
               "bet_side": None, "bet_team": None, "bet_edge": np.nan}
        if not s.empty:
            price = s.iloc[-1]
            h, a = float(price["home_odds"]), float(price["away_odds"])
            home_edge, away_edge = prob * h - 1, (1 - prob) * a - 1
            # As paper.py: the bigger expected edge (home on a tie), if it clears the threshold.
            side, edge = ("home", home_edge) if home_edge >= away_edge else ("away", away_edge)
            row.update(price_at=price["captured_at"], home_odds=h, away_odds=a,
                       market_home_prob=(1 / h) / (1 / h + 1 / a), home_edge=home_edge, away_edge=away_edge)
            if edge >= MIN_EDGE:
                row.update(bet_side=side, bet_team=p.home_team if side == "home" else p.away_team, bet_edge=edge)
        rows.append(row)
    return pd.DataFrame(rows, columns=EDGE_COLS)


def report(edges):
    """The coming games' edges as Markdown. No clock in it, so an unchanged market writes an unchanged file."""
    lines = ["# Live edges (head to head)", "",
             f"The Model's fair odds (1 / its win probability) against Betr's latest price. Edge is probability x "
             f"odds - 1; a bet is the side with the bigger edge when it's at least {MIN_EDGE:.0%} (paper trading's "
             "rule). Market is Betr's implied home chance with its margin removed.", ""]
    if edges.empty:
        return "\n".join(lines + ["No games to come.", ""])
    priced = edges["price_at"].dropna()
    if not priced.empty:
        lines += [f"Prices as of {priced.max():%Y-%m-%d %H:%M} UTC.", ""]
    lines += ["| Kickoff (UTC) | Game | Model | Fair | Betr | Market | Edge | Bet |", "|---|---|---|---|---|---|---|---|"]
    pct = lambda x: "" if pd.isna(x) else f"{x:.0%}"  # noqa: E731
    odds = lambda x: "" if pd.isna(x) else f"{x:.2f}"  # noqa: E731
    signed = lambda x: "" if pd.isna(x) else f"{x:+.1%}"  # noqa: E731
    for e in edges.itertuples():
        bet = f"{e.bet_team} ({signed(e.bet_edge)})" if pd.notna(e.bet_side) else ("no price yet" if pd.isna(e.home_odds) else "")
        lines.append(f"| {e.kickoff:%a %d %b %H:%M} | {e.home_team} v {e.away_team} | {pct(e.home_prob)} | "
                     f"{odds(e.fair_home)} / {odds(e.fair_away)} | {odds(e.home_odds)} / {odds(e.away_odds)} | "
                     f"{pct(e.market_home_prob)} | {signed(e.home_edge)} / {signed(e.away_edge)} | {bet} |")
    bets = int(edges["bet_side"].notna().sum())
    lines += ["", f"{bets} bet{'' if bets == 1 else 's'} at {MIN_EDGE:.0%} or more, of {len(edges)} games to come.", ""]
    return "\n".join(lines)


def write(records, now):
    """Rebuild edges.csv and edges.md from the season's records. Off-season, with no games ever
    predicted, nothing is written."""
    predictions = records.predictions()
    csv, md = records.dir / "edges.csv", records.dir / "edges.md"
    if predictions.empty and not md.exists():
        return {"games": 0, "bets": 0}
    snaps = paper.oriented_snapshots(records.odds_snapshots(), records.fixtures())
    edges = live_edges(prediction_of_record(predictions), snaps, now)
    edges.to_csv(csv, index=False)
    md.write_text(report(edges), encoding="utf-8")
    return {"games": len(edges), "bets": int(edges["bet_side"].notna().sum())}
