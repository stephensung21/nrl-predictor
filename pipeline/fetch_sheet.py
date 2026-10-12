"""
Download aussportsbetting.com's NRL results-and-odds sheet (PLAN_WEB.md step 4, note 4): the source of
the closing prices grading uses and the history for retraining. Run by hand once a year, after the
grand final, as part of the yearly routine (note 5), then commit it. The weekly jobs don't download it
(decided October 2026): the site refuses GitHub's runners with a 403, and nothing weekly needs it, since
Elo takes the season's results from the scrape and grading uses Betr's live prices until then.

The new file replaces data/nrl_betting_odds.xlsx only if it passes the checks: it parses with
ingest.load_odds (which stops on an unknown team name), it has at least as many games as the current
copy, and its newest game is no older. Prices whose implied probabilities add to under 100% (the 2026
sheet had some bad line and total prices) are counted and reported, not changed.

The site's terms: "These data sets are intended for personal use only. Do not make the data available
elsewhere." The sheet is kept in the repo by choice (PLAN_WEB.md, open questions). Please link to https://www.aussportsbetting.com/data/ when referring the data to others.

Usage:
    python pipeline/fetch_sheet.py
"""

import shutil
import tempfile
from pathlib import Path

import pandas as pd
import requests

import common  # noqa: F401  (puts src/ on the path)
from ingest import ODDS_FILE, load_odds

URL = "https://www.aussportsbetting.com/historical_data/nrl.xlsx"
PAIRS = {"head to head": ("Home Odds {}", "Away Odds {}"), "line": ("Home Line Odds {}", "Away Line Odds {}"),
         "total": ("Total Score Over {}", "Total Score Under {}")}


def impossible_prices(path):
    """Count the two-way markets whose implied probabilities add to under 100%, per market and price."""
    raw = pd.read_excel(path, header=1)
    out = {}
    for market, (a, b) in PAIRS.items():
        for when in ("Open", "Close"):
            pa, pb = raw[a.format(when)], raw[b.format(when)]
            n = int(((1 / pa + 1 / pb) < 1).sum())
            if n:
                out[f"{market} {when.lower()}"] = n
    return out


def check(new, current):
    """Why the new sheet can't replace the current one, or None if it can."""
    try:
        fresh = load_odds(new)
    except Exception as ex:  # an unknown team, a renamed column or a broken file
        return f"doesn't load: {type(ex).__name__}: {ex}"
    if current.exists():
        old = load_odds(current)
        if len(fresh) < len(old):
            return f"has fewer games ({len(fresh)}) than the current copy ({len(old)})"
        if fresh["date"].max() < old["date"].max():
            return f"ends earlier ({fresh['date'].max():%Y-%m-%d}) than the current copy"
    return None


def update(target=ODDS_FILE, url=URL):
    """Download, check and replace. Returns what happened, for the run record."""
    r = requests.get(url, timeout=60, headers={"User-Agent": "rugbyleague-tipper (personal project)"})
    r.raise_for_status()
    with tempfile.TemporaryDirectory() as tmp:
        new = Path(tmp) / "nrl.xlsx"
        new.write_bytes(r.content)
        problem = check(new, Path(target))
        if problem:
            return {"status": "kept the current sheet", "reason": problem}
        games = len(load_odds(new))
        bad = impossible_prices(new)
        shutil.copyfile(new, target)
    return {"status": "updated", "games": games, "impossible_prices": bad}


if __name__ == "__main__":
    print(update())
