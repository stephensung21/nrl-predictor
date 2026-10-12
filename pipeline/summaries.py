"""
LLM-written text for the site (PLAN_WEB.md §7): a short preview of each coming game and a recap of
each finished round, written by Claude from the pipeline's own numbers and kept in
data/pipeline/live/<season>/summaries.csv, which publish.py copies to the `summaries` table.

A preview is written from the game's match brief (brief.py, PLAN_WEB.md §7.4): the facts assembled
when it was predicted (the prediction, what drove it, the market, Elo, form, team news, conditions).
Every number in a text must appear in the facts it was written from (brief.ungrounded); a text that
fails is asked for once more, then dropped. Only model data goes into a prompt, never anything about
the tippers. Each text records the Claude model and the prompt version that wrote it,
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

import brief as brieflib
from common import Records, load_matches
import config
from publish import env

MODEL = "claude-opus-5-5"
PROMPT_VERSION = "2026-10-v2"  # v2: previews from the match brief, with what drove the prediction
SUMMARY_COLS = ["kind", "season", "round", "match_id", "body", "llm_model", "prompt_version", "run_id", "created_at",
                "brief_run_id"]

SYSTEM = """You write short pieces for a private NRL tipping comp's website, read by a group of friends \
who tip each week. The site's model predicts every game; you explain its numbers in plain words.

Write in Australian English, in a relaxed but factual voice. Use only the numbers and facts you are \
given: never invent injuries, team news, quotes or history. Say what the model thinks and how sure it \
is, compare it with the bookmakers when a market price is given, and say plainly when the model and \
the market disagree. No betting advice, no headings, no lists, no emoji. Write plain text with no \
Markdown formatting."""

PREVIEW = """Write a preview of this game in 60 to 90 words: who the model tips and how confident it \
is (as a percentage), its predicted score, how that compares with the market, the one or two biggest \
things driving the prediction (from "drivers", naming players from "team_news" where it fits), and one \
thing from the form or head-to-head data that stands out.

The facts are below, in sections. Use only the sections present, and only numbers that appear in them \
exactly as given: don't add, subtract or convert numbers yourself.

{data}"""

RETRY = """

Your last version used numbers that aren't in the facts: {bad}. Write it again using only numbers \
that appear in the facts."""

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


def preview_brief(pred, briefs, matches):
    """The brief a preview is written from: the one recorded with the prediction, or for a prediction
    made without one, a brief built from what the prediction record holds. Returns (brief, the run that
    recorded it), the run None for a brief that wasn't recorded."""
    for b in reversed(briefs):
        if b.get("run_id") == pred.get("run_id") and b.get("match_id") == int(pred["match_id"]):
            return b, b["run_id"]
    kick = pd.Timestamp(pred["start_time_utc"])
    played = matches[matches["home_score"].notna() & (pd.to_datetime(matches["start_time_utc"], utc=True) < kick)]
    return brieflib.build(pred, {"p_open": pred.get("market_open_home_prob")}, played=played), None


def write_grounded(client, prompt, facts):
    """A text whose numbers all appear in `facts`, asking once more if the first try's don't; None if
    the second try's don't either (logged), so invented figures are never published."""
    text = write(client, prompt)
    bad = None if text is None else brieflib.ungrounded(text, facts)
    if bad:
        text = write(client, prompt + RETRY.format(bad=", ".join(f"{n:g}" for n in bad)))
        bad = None if text is None else brieflib.ungrounded(text, facts)
        if bad:
            print(f"  summary dropped: numbers not in the facts: {bad}")
            return None
    return text


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
    briefs = records.briefs()
    out = []
    for pred in coming.sort_values("start_time_utc").to_dict("records"):
        if int(pred["match_id"]) in have and not rewrite:
            continue
        b, brief_run = preview_brief(pred, briefs, matches)
        facts = {"game": b["game"], **b["sections"]}
        text = write_grounded(client, PREVIEW.format(data=json.dumps(facts, indent=1, ensure_ascii=False)), facts)
        if text:
            out.append({"kind": "match_preview", "season": int(pred["season"]), "round": int(pred["round"]),
                        "match_id": int(pred["match_id"]), "body": text, "brief_run_id": brief_run})
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
        facts = round_facts(graded, rnd)
        text = write_grounded(client, RECAP.format(data=json.dumps(facts, indent=1)), facts)
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
