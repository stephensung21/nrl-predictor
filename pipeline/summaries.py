"""
LLM-written text for the site (PLAN_WEB.md §7): a short preview of each coming game and a recap of
each finished round, written by Claude from the pipeline's own numbers and kept in
data/pipeline/live/<season>/summaries.csv, which publish.py copies to the `summaries` table.

Only model data goes into a prompt (predictions, the market, Elo, results, head to head), never
anything about the tippers. Each text records the Claude model and the prompt version that wrote it,
so a change to either can be traced. A preview is written once per game, from its latest prediction;
a recap once per round, after every game in it is graded. Nothing is rewritten unless --rewrite.

Needs ANTHROPIC_API_KEY (or another credential the Anthropic SDK finds); without one it does nothing,
and a failure never stops the pipeline (the workflow step carries on).

Usage:
    python pipeline/summaries.py --previews        # after the predict job
    python pipeline/summaries.py --recap           # after the results job
"""

import argparse
import json

import pandas as pd

from common import Records, load_matches
import config
from publish import env

MODEL = "claude-opus-5-5"
PROMPT_VERSION = "2026-10-v1"
SUMMARY_COLS = ["kind", "season", "round", "match_id", "body", "llm_model", "prompt_version", "run_id", "created_at"]

SYSTEM = """You write short pieces for a private NRL tipping comp's website, read by a group of friends \
who tip each week. The site's model predicts every game; you explain its numbers in plain words.

Write in Australian English, in a relaxed but factual voice. Use only the numbers and facts you are \
given: never invent injuries, team news, quotes or history. Say what the model thinks and how sure it \
is, compare it with the bookmakers when a market price is given, and say plainly when the model and \
the market disagree. No betting advice, no headings, no lists, no emoji. Write plain text with no \
Markdown formatting."""

PREVIEW = """Write a preview of this game in 60 to 90 words: who the model tips and how confident it \
is (as a percentage), its predicted score, how that compares with the market, and one thing from the \
form or head-to-head data that stands out.

{data}"""

RECAP = """Write a recap of this round in 100 to 150 words: how many games the model tipped correctly, \
its best call and its worst miss (by how confident it was), how it did against the market's \
favourites, and how its season record stands.

{data}"""


def api_client():
    """The Anthropic client, or None when there's no ANTHROPIC_API_KEY (environment or .env)."""
    import anthropic
    key = env("ANTHROPIC_API_KEY")
    return anthropic.Anthropic(api_key=key) if key else None


def write(client, prompt):
    """One piece of text, or None if Claude declined (after the server-side fallback) or ran out."""
    response = client.beta.messages.create(
        model=MODEL,
        max_tokens=2000,
        system=SYSTEM,
        output_config={"effort": "low"},  # short pieces from given numbers: no deep reasoning needed
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        messages=[{"role": "user", "content": prompt}],
    )
    if response.stop_reason != "end_turn":
        return None
    text = "".join(b.text for b in response.content if b.type == "text").strip()
    return text or None


# ---------------------------------------------------------------- what goes into a prompt

def pct(p):
    return None if p is None or pd.isna(p) else round(100 * float(p))


def game_facts(pred, matches):
    """The numbers a preview may use: the prediction, the market, each side's last five results and
    the last three meetings."""
    kick = pd.Timestamp(pred["start_time_utc"])
    played = matches[matches["home_score"].notna() & (pd.to_datetime(matches["start_time_utc"], utc=True) < kick)]

    def form(team):
        g = played[(played["home_team"] == team) | (played["away_team"] == team)].tail(5)
        out = []
        for r in g.itertuples():
            us, them = (r.home_score, r.away_score) if r.home_team == team else (r.away_score, r.home_score)
            opp = r.away_team if r.home_team == team else r.home_team
            out.append(f"{'W' if us > them else 'L' if us < them else 'D'} {int(us)}-{int(them)} v {opp}")
        return out

    h2h = played[((played["home_team"] == pred["home_team"]) & (played["away_team"] == pred["away_team"]))
                 | ((played["home_team"] == pred["away_team"]) & (played["away_team"] == pred["home_team"]))].tail(3)
    tip_home = pred["home_win_prob"] >= 0.5
    return {
        "game": f"{pred['home_team']} (home) v {pred['away_team']}",
        "model_tip": pred["home_team"] if tip_home else pred["away_team"],
        "model_win_chance_pct": pct(max(pred["home_win_prob"], 1 - pred["home_win_prob"])),
        "model_predicted_score": f"{pred['home_team']} {int(pred['home_score'])} - {int(pred['away_score'])} {pred['away_team']}",
        "model_margin": round(float(pred["margin"]), 1),
        "market_home_win_chance_pct": pct(pred.get("market_open_home_prob")),
        "form_last_5": {pred["home_team"]: form(pred["home_team"]), pred["away_team"]: form(pred["away_team"])},
        "last_meetings": [f"{int(r.season)}: {r.home_team} {int(r.home_score)}-{int(r.away_score)} {r.away_team}"
                          for r in h2h.itertuples()],
    }


def round_facts(graded, rnd):
    """The numbers a recap may use: every game's tip and result, and the season so far."""
    g = graded[graded["round"] == rnd]
    so_far = graded[graded["round"] <= rnd]
    games = []
    for r in g.itertuples():
        tip_home = r.home_win_prob >= 0.5
        fav = None if pd.isna(r.p_open) else (r.home_team if r.p_open >= 0.5 else r.away_team)
        games.append({"game": f"{r.home_team} v {r.away_team}", "score": f"{int(r.home_score)}-{int(r.away_score)}",
                      "model_tip": r.home_team if tip_home else r.away_team,
                      "model_confidence_pct": pct(max(r.home_win_prob, 1 - r.home_win_prob)),
                      "model_correct": bool(r.tip_correct), "market_favourite": fav})
    fav_right = [((r.p_open >= 0.5) == (r.margin_actual > 0)) or r.margin_actual == 0
                 for r in g.itertuples() if not pd.isna(r.p_open)]
    return {"round": int(rnd), "games": games,
            "model_tips_correct": f"{int(g['tip_correct'].sum())}/{len(g)}",
            "market_favourites_correct": f"{int(sum(fav_right))}/{len(fav_right)}" if fav_right else None,
            "model_season_record": f"{int(so_far['tip_correct'].sum())}/{len(so_far)}"}


# ---------------------------------------------------------------- what to write

def previews(records, client, now, run_id=None, rewrite=False):
    """A preview for each coming game that has a prediction and no preview yet."""
    preds = records.predictions()
    if preds.empty:
        return []
    latest = preds.sort_values("created_at").groupby("match_id").tail(1)
    coming = latest[latest["start_time_utc"] > now]
    done = records.summaries()
    have = set(done.loc[done["kind"] == "match_preview", "match_id"].dropna().astype(int))
    matches = load_matches()
    out = []
    for pred in coming.sort_values("start_time_utc").to_dict("records"):
        if int(pred["match_id"]) in have and not rewrite:
            continue
        text = write(client, PREVIEW.format(data=json.dumps(game_facts(pred, matches), indent=1)))
        if text:
            out.append({"kind": "match_preview", "season": int(pred["season"]), "round": int(pred["round"]),
                        "match_id": int(pred["match_id"]), "body": text})
    return stamp(records, out, run_id, now)


def recap(records, client, now, run_id=None, rewrite=False):
    """A recap of each round whose games are all graded and that has no recap yet."""
    graded = records.graded()
    if graded is None or graded.empty:
        return []
    predicted = records.predictions()
    done = records.summaries()
    have = set(done.loc[done["kind"] == "round_recap", "round"].astype(int))
    out = []
    for rnd in sorted(graded["round"].unique()):
        if int(rnd) in have and not rewrite:
            continue
        if not set(predicted.loc[predicted["round"] == rnd, "match_id"]) <= set(graded.loc[graded["round"] == rnd, "match_id"]):
            continue  # some of the round's games aren't graded yet
        text = write(client, RECAP.format(data=json.dumps(round_facts(graded, rnd), indent=1)))
        if text:
            out.append({"kind": "round_recap", "season": int(graded["season"].iloc[0]), "round": int(rnd),
                        "match_id": None, "body": text})
    return stamp(records, out, run_id, now)


def stamp(records, rows, run_id, now):
    for r in rows:
        r.update(llm_model=MODEL, prompt_version=PROMPT_VERSION, run_id=run_id, created_at=now.isoformat())
    if rows:
        records.add_summaries(pd.DataFrame(rows, columns=SUMMARY_COLS))
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--previews", action="store_true")
    parser.add_argument("--recap", action="store_true")
    parser.add_argument("--season", type=int, default=config.PREDICT_SEASON)
    parser.add_argument("--rewrite", action="store_true", help="write again even where text exists")
    args = parser.parse_args()
    client = api_client()
    if client is None:
        print("summaries: skipped (no Anthropic credentials)")
        return
    records = Records(args.season, replay=False)
    now = pd.Timestamp.now(tz="UTC")
    if args.previews:
        print(f"previews: {len(previews(records, client, now, rewrite=args.rewrite))} written")
    if args.recap:
        print(f"recaps: {len(recap(records, client, now, rewrite=args.rewrite))} written")


if __name__ == "__main__":
    main()
