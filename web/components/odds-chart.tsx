"use client";

import { colourFor } from "@/lib/line-colours";
import { sydney } from "@/lib/time";
import type { TeamName } from "@/lib/teams";
import type { OddsHistory } from "@/lib/types";
import { LineChart } from "./charts";

// Sydney time, the comp's clock, so the server and the browser render the same labels.
const when = (iso: string) => sydney(iso, "dayDateTime");
const day = (iso: string) => sydney(iso, "weekday");

/** The side's chance at each price, oldest first, spaced evenly (the pipeline's runs are uneven). */
export function OddsChart({ history, team, isHome }: { history: OddsHistory; team: TeamName; isHome: boolean }) {
  const pts = history.points;
  // The sheet's prices have no time: just opening and closing.
  const name = (i: number) => {
    const at = pts[i].at;
    return at ? when(at) : i === 0 ? "Opening" : "Closing";
  };
  const data = pts.map((p, i) => ({ x: i, chance: Math.round((isHome ? p.homeProb : 1 - p.homeProb) * 1000) / 10, i }));
  const last = pts.length - 1;
  const xTicks = pts.every((p) => p.at)
    ? // One label a day: the first price of each.
      pts.map((p, i) => ({ i, text: day(p.at!) })).filter((t, k, all) => k === 0 || all[k - 1].text !== t.text)
    : [{ i: 0, text: "Opening" }, { i: last, text: "Closing" }];
  const prices = pts.some((p) => p.homeOdds != null);
  return (
    <LineChart
      data={data}
      series={[{ key: "chance", label: `${team} to win`, colour: colourFor(team, []) }]}
      height={180}
      fromZero={false}
      // A few points' move should look like one, not fill the chart.
      minSpan={20}
      yFormat={(v) => `${Math.round(v)}%`}
      xLabel={(p) => name(p.i as number)}
      xTicks={xTicks}
      label={`${history.bookmaker}'s price for the ${team}: ${data[0].chance.toFixed(0)}% to ${data[last].chance.toFixed(0)}%`}
      table={{
        columns: [pts[0].at ? "When (Sydney)" : "When", `${team} to win`, ...(prices ? ["Home price", "Away price"] : []), "Line (home)"],
        rows: pts.map((p, i) => [
          name(i),
          `${data[i].chance.toFixed(1)}%`,
          ...(prices ? [p.homeOdds?.toFixed(2) ?? "", p.awayOdds?.toFixed(2) ?? ""] : []),
          p.line == null ? "" : p.line > 0 ? `+${p.line}` : String(p.line),
        ]),
      }}
    />
  );
}
