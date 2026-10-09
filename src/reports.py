"""
Report helpers: Markdown tables and saved predictions.
"""

import numpy as np

PREDICTION_COLUMNS = ["match_id", "season", "round_title", "home_team", "away_team", "home_score", "away_score",
                      "home_win", "margin", "total", "elo_prob", "p_open", "p_close", "p_avg"]


def md_table(df, floatfmt="{:.4f}"):
    """Minimal Markdown table (no tabulate dependency). Missing values show as '-'."""
    df = df.rename_axis(df.index.name or "").reset_index()

    def fmt(v):
        if not isinstance(v, float):
            return str(v)
        return "-" if np.isnan(v) else str(int(v)) if v.is_integer() and abs(v) >= 1 else floatfmt.format(v)

    cells = [[fmt(v) for v in row] for row in df.itertuples(index=False)]
    head = "| " + " | ".join(map(str, df.columns)) + " |"
    sep = "|" + "|".join("---" for _ in df.columns) + "|"
    return "\n".join([head, sep] + ["| " + " | ".join(r) + " |" for r in cells])


def save_predictions(test, preds, path):
    test[PREDICTION_COLUMNS].join(preds).to_csv(path, index=False)
