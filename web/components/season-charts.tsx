"use client";

import { CalibrationChart, LineChart, type CalBin, type Series } from "./charts";

const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `\u2212${-v}` : "0");
const dollars = (v: number) => {
  const abs = Math.abs(v);
  return `${v < 0 ? "\u2212" : v > 0 ? "+" : ""}$${Number.isInteger(abs) ? abs : abs.toFixed(2)}`;
};

export function TipsVsMarketChart({
  data,
  series,
  roundStarts,
}: {
  data: { x: number; round: string; model: number; elo: number }[];
  series: Series[];
  roundStarts: { i: number; text: string }[];
}) {
  return (
    <LineChart
      data={data}
      series={series}
      zero
      yFormat={signed}
      xLabel={(p) => `Game ${p.x} · ${p.round}`}
      xTicks={roundStarts}
      label="Correct tips compared with the bookies' favourite over the 2026 season"
      table={{
        columns: ["Game", "Round", ...series.map((s) => s.label)],
        rows: data.map((d) => [d.x, d.round, ...series.map((s) => signed(d[s.key as "model" | "elo"]))]),
      }}
    />
  );
}

export function ProfitChart({ data, series }: { data: { x: number; profit: number }[]; series: Series[] }) {
  return (
    <LineChart
      data={data}
      series={series}
      zero
      height={180}
      yFormat={dollars}
      xLabel={(p) => `After bet ${p.x}`}
      xTicks={[1, 25, 50, 75, 100, data.length].filter((i) => i <= data.length).map((i) => ({ i: i - 1, text: String(i) }))}
      label="Running profit of $10 bets on the Model's edges at the opening price"
      table={{ columns: ["Bet", "Running profit"], rows: data.map((d) => [d.x, dollars(d.profit)]) }}
    />
  );
}

export function Calibration({ bins, series }: { bins: Record<string, CalBin[]>; series: Series[] }) {
  return <CalibrationChart bins={bins} series={series} label="Calibration: how often favourites won at each predicted chance" />;
}
