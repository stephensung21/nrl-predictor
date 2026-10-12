"""
Weekly grading (PLAN_WEB.md, notes 6): each finished game's prediction of record, joined to the
result, the opening and closing market and Elo, then scored per round and for the season so far.

The prediction of record is the latest prediction made before the game's kickoff. Metrics use the
same definitions as the backtest (`evaluate.evaluate`: a draw counts as a home loss for accuracy and
log loss), plus "tips correct" under the tipping rules, where a draw counts for both teams.
"""

import numpy as np
import pandas as pd

from common import load_matches
from elo import load_params, run_elo
from evaluate import evaluate
from ingest import join_odds_to_matches, load_odds
from reports import md_table

MARKET_COLS = ["p_open", "open_line", "open_total", "p_close", "close_line", "close_total", "close_ok", "p_avg",
               "elo_prob"]


def prediction_of_record(predictions):
    """The latest prediction made before each game's kickoff (one row per match)."""
    before = predictions[predictions["created_at"] < predictions["start_time_utc"]]
    return before.sort_values(["match_id", "created_at"]).groupby("match_id").tail(1).reset_index(drop=True)


def market_and_elo(matches, odds=None, live=None):
    """Opening and closing prices and the pre-match Elo probability for each match (the same Elo the
    model's features use: every result back to 2009). Prices come from the odds sheet; a game the sheet
    has no prices for takes Betr's live ones (`live`, fetch_odds.market_for_fixtures: the first snapshot
    and the last before kickoff), marked in `market_source`. The sheet is downloaded once a year, so in
    season the live prices are the market; regrade after the download to score against the sheet's."""
    odds = load_odds() if odds is None else odds
    odds = odds.join(run_elo(odds, **load_params(odds)))
    joined = join_odds_to_matches(matches[["match_id", "start_time_utc", "home_team", "away_team"]], odds)
    out = joined[["match_id", "odds_id"]].merge(odds[["odds_id"] + MARKET_COLS], on="odds_id", how="left")
    out["market_source"] = np.where(out["p_open"].notna() | out["p_close"].notna(), "sheet", None)
    if live is not None and len(live):
        fill = (out["market_source"].isna() & out["match_id"].isin(live.index)).to_numpy()
        ids = out.loc[fill, "match_id"]
        for col in live.columns:
            out.loc[fill, col] = live.loc[ids, col].to_numpy()
        out.loc[fill, "close_ok"] = out.loc[fill, "p_close"].notna()
        out.loc[fill, "market_source"] = "Betr live"
    return out


def grade(record, matches=None, odds=None, live=None):
    """One graded row per finished game that has a prediction of record. `live`: Betr's prices for
    games the odds sheet doesn't price (market_and_elo)."""
    matches = load_matches() if matches is None else matches
    done = matches[matches["home_score"].notna() & matches["away_score"].notna()]
    g = record.drop(columns=["season", "round", "home_score", "away_score", "home_team", "away_team"],
                    errors="ignore").merge(
        done[["match_id", "season", "round", "round_title", "home_team", "away_team", "home_score", "away_score"]],
        on="match_id")
    g = g.merge(market_and_elo(g, odds, live), on="match_id", how="left")
    g["margin_actual"] = g["home_score"] - g["away_score"]
    g["total_actual"] = g["home_score"] + g["away_score"]
    g["tip"] = np.where(g["home_win_prob"] >= 0.5, g["home_team"], g["away_team"])
    g["tip_correct"] = (g["margin_actual"] == 0) | ((g["home_win_prob"] >= 0.5) == (g["margin_actual"] > 0))
    return g.sort_values(["start_time_utc", "match_id"]).reset_index(drop=True)


def metrics(g):
    """Model, opening market, closing market and Elo on the same games, each where it has a price.
    The closing benchmark uses only games with reliable closing odds, as the final test does."""
    t = pd.DataFrame({"home_win": (g["margin_actual"] > 0).astype(int), "margin": g["margin_actual"],
                      "total": g["total_actual"], "home_score": g["home_score"], "away_score": g["away_score"]})
    tips = lambda p, sel: int((((p >= 0.5) == (t.loc[sel, "margin"] > 0)) | (t.loc[sel, "margin"] == 0)).sum())
    rows = {}
    every = pd.Series(True, index=g.index)
    rows["Model"] = {**evaluate(t, g["home_win_prob"], g["margin"], g["total"]), "tips": tips(g["home_win_prob"], every)}
    for name, prob, line, total, sel in [
        ("Market opening", "p_open", "open_line", "open_total", g["p_open"].notna()),
        ("Market closing", "p_close", "close_line", "close_total", g["close_ok"].fillna(False).astype(bool)),
        ("Elo", "elo_prob", None, None, g["elo_prob"].notna()),
    ]:
        if not sel.any():
            continue
        s = g[sel]
        rows[name] = {**evaluate(t[sel], s[prob], -s[line] if line else None, s[total] if total else None),
                      "tips": tips(s[prob], sel)}
    out = pd.DataFrame(rows).T
    cols = ["games", "tips", "accuracy", "log_loss", "brier", "margin_mae", "total_mae"]
    return out.reindex(columns=cols).rename_axis("source")


def by_round(g):
    """Model and market per round, with the season so far."""
    rows = []
    for rnd, r in g.groupby("round", sort=True):
        m = metrics(r)
        so_far = metrics(g[g["round"] <= rnd]).loc["Model"]
        rows.append({"round": rnd, "round_title": r["round_title"].iloc[0], "games": len(r),
                     "tips": int(m.loc["Model", "tips"]), "log_loss": m.loc["Model", "log_loss"],
                     "market_open_log_loss": m["log_loss"].get("Market opening", np.nan),
                     "elo_log_loss": m["log_loss"].get("Elo", np.nan), "margin_mae": m.loc["Model", "margin_mae"],
                     "season_tips": f"{int(so_far['tips'])}/{int(so_far['games'])}",
                     "season_log_loss": so_far["log_loss"]})
    return pd.DataFrame(rows)


def market_note(g):
    """Says which games' market prices are Betr's live ones rather than the odds sheet's."""
    n = int((g.get("market_source") == "Betr live").sum()) if "market_source" in g else 0
    return (f" The market's prices for {n} of the {len(g)} games are Betr's from The Odds API (opening: the "
            "first price fetched; closing: the last fetched before kickoff, which can be a few hours early), "
            "until the odds sheet is downloaded after the grand final.") if n else ""


def season_report(g, season, mode):
    lines = [f"# {season} season record" + (" (replay)" if mode == "replay" else ""), "",
             f"{len(g)} games graded, each on its prediction of record (the latest made before kickoff). "
             "Tips count a draw for both teams; accuracy and log loss treat a draw as a home loss, as the "
             "backtest does. Market closing is scored on games with reliable closing odds only." + market_note(g), "",
             "## Season so far", "", md_table(metrics(g)), "",
             "## By round", "", md_table(by_round(g).set_index("round")), ""]
    return "\n".join(lines)
