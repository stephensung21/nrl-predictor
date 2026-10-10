"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { colourFor } from "@/lib/line-colours";
import type { TeamName } from "@/lib/teams";
import { team } from "@/lib/teams";
import { ticks, TableView, useWidth } from "./charts";
import { TeamBadge } from "./team-badge";

const MAX_HIGHLIGHT = 3;

/* ---------- Season chart: the field faint, your teams lit ---------- */

export function EloSeasonChart({
  season,
  rounds,
  ratings,
  initial,
  order,
}: {
  season: number;
  rounds: string[];
  ratings: Record<string, number[]>;
  initial: TeamName[];
  /** Teams in the table's order, so the chips mirror the ratings. */
  order: TeamName[];
}) {
  const teams = Object.keys(ratings) as TeamName[];
  // Each lit team keeps the colour it got when lit, so switching another off never repaints it.
  const [picked, setPicked] = useState<{ t: TeamName; c: string }[]>(() =>
    initial.reduce<{ t: TeamName; c: string }[]>((acc, t) => [...acc, { t, c: colourFor(t, acc.map((x) => x.c)) }], []),
  );
  // A picked team may not exist in this season (the Dolphins joined in 2023).
  const lit = picked.filter((p) => teams.includes(p.t)).map((p) => p.t);
  const colours = Object.fromEntries(picked.map((p) => [p.t, p.c]));
  const [hover, setHover] = useState<number | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();
  const toggle = (t: TeamName) =>
    setPicked((p) => {
      if (p.some((x) => x.t === t)) return p.filter((x) => x.t !== t);
      const kept = p.filter((x) => teams.includes(x.t)).slice(-(MAX_HIGHLIGHT - 1));
      return [...kept, { t, c: colourFor(t, kept.map((x) => x.c)) }];
    });

  const height = 260;
  const pad = { top: 12, right: 96, bottom: 26, left: 44 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const all = teams.flatMap((t) => ratings[t]);
  const yt = ticks(Math.min(...all), Math.max(...all));
  const [y0, y1] = [yt[0], yt.at(-1)!];
  const last = rounds.length - 1;
  const xs = (i: number) => pad.left + (last ? (i / last) * w : w / 2);
  const ys = (v: number) => pad.top + h - ((v - y0) / (y1 - y0 || 1)) * h;
  const path = (t: string) => ratings[t].map((v, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join("");

  // End labels for the lit teams, nudged apart only when they'd overlap.
  const ends = lit.map((t) => ({ t, y: ys(ratings[t][last]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
  const xLabels = rounds
    .map((r, i) => ({ r, i }))
    // Every fifth round, the first finals week, and the end (unless it's another finals week).
    .filter(({ r, i }) => i === 0 || (i === last && r !== "F") || (r.startsWith("R") && Number(r.slice(1)) % 5 === 0) || (r === "F" && rounds[i - 1] !== "F"))
    // Thin to 40px apart, working back from the end so the last label (often Finals) always stays.
    .reduceRight<{ r: string; i: number }[]>((kept, x) => (kept.length && xs(kept[0].i) - xs(x.i) < 40 ? kept : [x, ...kept]), []);

  return (
    <figure className="mt-3">
      <fieldset>
        <legend className="text-[13px] text-ink-3">Tap up to {MAX_HIGHLIGHT} teams to light them up</legend>
        <div className="mt-2 flex flex-wrap gap-1">
          {order.filter((t) => teams.includes(t)).map((t) => {
            const on = lit.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                aria-label={t}
                onClick={() => toggle(t)}
                // Off chips keep the badge at full strength (it's the only label); "on" shows in the frame.
                className={`rounded-md p-1 transition-colors ${on ? "bg-ink-2" : "ring-1 ring-line ring-inset hover:ring-ink-3"}`}
              >
                <TeamBadge name={t} size="sm" />
              </button>
            );
          })}
        </div>
      </fieldset>

      <div ref={ref} className="relative mt-4" style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Elo ratings through ${season}${lit.length ? `, highlighting ${lit.join(", ")}` : ""}`}
            tabIndex={0}
            className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setHover(Math.max(0, Math.min(last, Math.round(((e.clientX - rect.left - pad.left) / (w || 1)) * last))));
            }}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(last)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setHover((x) => Math.max(0, (x ?? last) - 1));
              if (e.key === "ArrowRight") setHover((x) => Math.min(last, (x ?? last) + 1));
            }}
          >
            {yt.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={pad.left + w} y1={ys(t)} y2={ys(t)} stroke={t === 1500 ? "var(--color-ink-3)" : "var(--color-line-soft)"} />
                <text x={pad.left - 8} y={ys(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 font-score text-[12px]">
                  {t}
                </text>
              </g>
            ))}
            {xLabels.map(({ r, i }) => (
              <text key={i} x={xs(i)} y={height - 8} textAnchor="middle" className="fill-ink-3 text-[11px]">
                {r === "F" ? "Finals" : r}
              </text>
            ))}
            {/* The field: every other team, faint. */}
            {teams
              .filter((t) => !lit.includes(t))
              .map((t) => (
                <path key={t} d={path(t)} fill="none" stroke="var(--color-ink-3)" strokeOpacity={0.28} strokeWidth={1.25} strokeLinejoin="round" />
              ))}
            {lit.map((t) => (
              <path key={t} d={path(t)} fill="none" stroke={colours[t]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {lit.map((t) => (
              <circle key={t} cx={xs(last)} cy={ys(ratings[t][last])} r={5} fill={colours[t]} stroke="var(--color-ground)" strokeWidth={4} paintOrder="stroke" />
            ))}
            {ends.map(({ t, y }) => (
              <text key={t} x={xs(last) + 10} y={y} dy="0.32em" className="fill-ink-2 font-score text-[13px] font-semibold">
                {team(t).code} {Math.round(ratings[t][last])}
              </text>
            ))}
            {hover != null && (
              <g pointerEvents="none">
                <line x1={xs(hover)} x2={xs(hover)} y1={pad.top} y2={pad.top + h} stroke="var(--color-ink-3)" />
                {lit.map((t) => (
                  <circle key={t} cx={xs(hover)} cy={ys(ratings[t][hover])} r={5} fill={colours[t]} stroke="var(--color-ground)" strokeWidth={4} paintOrder="stroke" />
                ))}
              </g>
            )}
          </svg>
        )}
        {hover != null && width > 0 && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-40 rounded-md bg-raised-2 px-3 py-2 text-[12px] shadow-[0_6px_20px_rgb(0_0_0/0.45)] ring-1 ring-line"
            style={{ left: Math.min(Math.max(xs(hover) - 80, 0), width - 170) }}
          >
            <p className="text-ink-3">
              {season} · {rounds[hover] === "F" ? "Finals" : rounds[hover].replace("R", "Round ")}
            </p>
            {lit.length === 0 && <p className="mt-1 text-ink-3">Pick a team to see its rating.</p>}
            {[...lit]
              .sort((a, b) => ratings[b][hover] - ratings[a][hover])
              .map((t) => (
                <p key={t} className="mt-1 flex items-center gap-2">
                  <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: colours[t] }} aria-hidden />
                  <span className="font-score text-[15px] font-semibold text-ink">{Math.round(ratings[t][hover])}</span>
                  <span className="text-ink-3">{t}</span>
                </p>
              ))}
          </div>
        )}
      </div>
      <TableView
        table={{
          columns: ["Team", ...rounds.map((r, i) => (r === "F" ? `F${rounds.slice(0, i + 1).filter((x) => x === "F").length}` : r))],
          rows: [...teams].sort().map((t) => [t, ...ratings[t].map((v) => Math.round(v))]),
        }}
      />
    </figure>
  );
}

/* ---------- Team view: recent seasons, biggest swings marked ---------- */

export function EloTeamChart({
  name,
  points,
  swings,
  colour,
}: {
  name: TeamName;
  points: { season: number; label: string; rating: number; change: number; text: string }[];
  swings: number[];
  colour: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 200;
  const pad = { top: 14, right: 16, bottom: 26, left: 44 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const yt = ticks(Math.min(...points.map((p) => p.rating)), Math.max(...points.map((p) => p.rating)));
  const [y0, y1] = [yt[0], yt.at(-1)!];
  const last = points.length - 1;
  const xs = (i: number) => pad.left + (last ? (i / last) * w : 0);
  const ys = (v: number) => pad.top + h - ((v - y0) / (y1 - y0 || 1)) * h;
  const seasonStarts = points.map((p, i) => ({ p, i })).filter(({ p, i }) => i === 0 || points[i - 1].season !== p.season);
  // Swing numbers: above a rise, below a fall, kept inside the plot and nudged sideways when two would touch.
  const swingLabels = swings.map((i, k) => ({
    i,
    k,
    x: xs(i),
    y: Math.min(pad.top + h - 4, Math.max(pad.top + 10, ys(points[i].rating) + (points[i].change > 0 ? -12 : 18))),
  }));
  for (let a = 0; a < swingLabels.length; a++)
    for (let b = 0; b < a; b++)
      if (Math.abs(swingLabels[a].x - swingLabels[b].x) < 14 && Math.abs(swingLabels[a].y - swingLabels[b].y) < 14) swingLabels[a].x = swingLabels[b].x + 14;

  return (
    <figure className="mt-3">
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${name}'s Elo rating, game by game, ${points[0].season} to ${points[last].season}`}
            tabIndex={0}
            className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setHover(Math.max(0, Math.min(last, Math.round(((e.clientX - rect.left - pad.left) / (w || 1)) * last))));
            }}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(last)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setHover((x) => Math.max(0, (x ?? last) - 1));
              if (e.key === "ArrowRight") setHover((x) => Math.min(last, (x ?? last) + 1));
            }}
          >
            {yt.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={pad.left + w} y1={ys(t)} y2={ys(t)} stroke={t === 1500 ? "var(--color-ink-3)" : "var(--color-line-soft)"} />
                <text x={pad.left - 8} y={ys(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 font-score text-[12px]">
                  {t}
                </text>
              </g>
            ))}
            {seasonStarts.map(({ p, i }) => (
              <g key={p.season}>
                <line x1={xs(i)} x2={xs(i)} y1={pad.top} y2={pad.top + h} stroke="var(--color-line-soft)" />
                <text x={xs(i) + 4} y={height - 8} className="fill-ink-3 font-score text-[11px]">
                  {p.season}
                </text>
              </g>
            ))}
            <path
              d={points.map((p, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)},${ys(p.rating).toFixed(1)}`).join("")}
              fill="none"
              stroke={colour}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {swingLabels.map(({ i, k, x, y }) => (
              <g key={i}>
                <circle cx={xs(i)} cy={ys(points[i].rating)} r={5} fill={colour} stroke="var(--color-ground)" strokeWidth={4} paintOrder="stroke" />
                <text x={x} y={y} textAnchor="middle" className="fill-ink-2 font-score text-[12px] font-semibold">
                  {k + 1}
                </text>
              </g>
            ))}
            {hover != null && (
              <g pointerEvents="none">
                <line x1={xs(hover)} x2={xs(hover)} y1={pad.top} y2={pad.top + h} stroke="var(--color-ink-3)" />
                <circle cx={xs(hover)} cy={ys(points[hover].rating)} r={5} fill={colour} stroke="var(--color-ground)" strokeWidth={4} paintOrder="stroke" />
              </g>
            )}
          </svg>
        )}
        {hover != null && width > 0 && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-44 rounded-md bg-raised-2 px-3 py-2 text-[12px] shadow-[0_6px_20px_rgb(0_0_0/0.45)] ring-1 ring-line"
            style={{ left: Math.min(Math.max(xs(hover) - 88, 0), width - 190) }}
          >
            <p className="text-ink-3">
              {points[hover].season} · {points[hover].label}
            </p>
            <p className="mt-1">
              <span className="font-score text-[15px] font-semibold text-ink">{Math.round(points[hover].rating)}</span>{" "}
              <span className="text-ink-3">
                ({Math.round(points[hover].change) > 0 ? "+" : Math.round(points[hover].change) < 0 ? "−" : ""}
                {Math.abs(Math.round(points[hover].change))})
              </span>
            </p>
            <p className="text-ink-2">{points[hover].text}</p>
          </div>
        )}
      </div>
    </figure>
  );
}

/* ---------- Season picker ---------- */

export function SeasonPicker({ seasons, value, team: t }: { seasons: number[]; value: number; team: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-[13px] text-ink-3">
      Season
      <select
        value={value}
        onChange={(e) => router.push(`/elo?season=${e.target.value}&team=${encodeURIComponent(t)}`, { scroll: false })}
        className="h-10 rounded-md bg-raised px-2 font-score text-[16px] font-semibold text-ink ring-1 ring-line ring-inset focus:ring-2 focus:ring-lime focus:outline-none"
      >
        {[...seasons].reverse().map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );
}
