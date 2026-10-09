"use client";

// Small SVG charts for the data pages. Drawn at the measured width (not a stretched
// viewBox) so lines stay 2px and text stays crisp. Specs follow the dataviz method:
// 2px lines, >=8px end dots with a 2px ground ring, hairline solid grid, one axis,
// a crosshair + tooltip listing every series, keyboard stepping, and a table view.

import { useEffect, useRef, useState } from "react";

export type Series = { key: string; label: string; colour: string };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Clean tick values that cover the whole range (the axis ends on a tick at or beyond each extreme). */
function ticks(min: number, max: number, count = 4) {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded-full" style={{ backgroundColor: s.colour }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/* ---------- Line chart ---------- */

type Point = { x: number } & Record<string, number | string>;

export function LineChart({
  data,
  series,
  height = 200,
  yFormat = (v) => String(v),
  xLabel,
  xTicks,
  zero = false,
  label,
  table,
}: {
  data: Point[];
  series: Series[];
  height?: number;
  yFormat?: (v: number) => string;
  /** Tooltip heading for a point. */
  xLabel: (p: Point) => string;
  /** Where to label the x-axis: indices into data and their text. */
  xTicks: { i: number; text: string }[];
  /** Draw the zero line a step stronger (an indexed chart's baseline). */
  zero?: boolean;
  label: string;
  table: { columns: string[]; rows: (string | number)[][] };
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 12, right: 64, bottom: 26, left: 40 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const values = data.flatMap((d) => series.map((s) => d[s.key] as number));
  const yt = ticks(Math.min(0, ...values), Math.max(0, ...values));
  const [y0, y1] = [yt[0], yt.at(-1)!];
  const xs = (i: number) => pad.left + (data.length < 2 ? 0 : (i / (data.length - 1)) * w);
  const ys = (v: number) => pad.top + h - ((v - y0) / (y1 - y0 || 1)) * h;
  const path = (k: string) => data.map((d, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)},${ys(d[k] as number).toFixed(1)}`).join("");
  const last = data.length - 1;

  const nearest = (clientX: number, rect: DOMRect) => {
    const i = Math.round(((clientX - rect.left - pad.left) / (w || 1)) * last);
    return Math.max(0, Math.min(last, i));
  };

  // End labels: nudged apart only if they'd overlap; otherwise at their line's end.
  const ends = series
    .map((s) => ({ s, y: ys(data[last][s.key] as number), v: data[last][s.key] as number }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;

  return (
    <figure className="mt-3">
      <Legend series={series} />
      <div ref={ref} className="relative mt-2" style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={label}
            tabIndex={0}
            className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
            onPointerMove={(e) => setHover(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(last)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? last) - 1));
              if (e.key === "ArrowRight") setHover((h) => Math.min(last, (h ?? last) + 1));
            }}
          >
            {yt.map((t) => (
              <g key={t}>
                <line
                  x1={pad.left}
                  x2={pad.left + w}
                  y1={ys(t)}
                  y2={ys(t)}
                  stroke={zero && t === 0 ? "var(--color-ink-3)" : "var(--color-line-soft)"}
                  strokeWidth={1}
                />
                <text x={pad.left - 8} y={ys(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 font-score text-[12px]">
                  {yFormat(t)}
                </text>
              </g>
            ))}
            {xTicks
              // Drop a label that would crowd the next one; the last (e.g. Finals) always stays.
              .filter((t, k, all) => k === all.length - 1 || xs(all[k + 1].i) - xs(t.i) >= 40)
              .map((t) => (
              <text key={t.i} x={xs(t.i)} y={height - 8} textAnchor="middle" className="fill-ink-3 text-[11px]">
                {t.text}
              </text>
            ))}
            {series.map((s) => (
              <path key={s.key} d={path(s.key)} fill="none" stroke={s.colour} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {series.map((s) => (
              <circle key={s.key} cx={xs(last)} cy={ys(data[last][s.key] as number)} r={5} fill={s.colour} stroke="var(--color-ground)" strokeWidth={4} paintOrder="stroke" />
            ))}
            {ends.map(({ s, y, v }) => (
              <text key={s.key} x={xs(last) + 10} y={y} dy="0.32em" className="fill-ink-2 font-score text-[13px] font-semibold">
                {yFormat(v)}
              </text>
            ))}
            {hover != null && (
              <g pointerEvents="none">
                <line x1={xs(hover)} x2={xs(hover)} y1={pad.top} y2={pad.top + h} stroke="var(--color-ink-3)" strokeWidth={1} />
                {series.map((s) => (
                  <circle key={s.key} cx={xs(hover)} cy={ys(data[hover][s.key] as number)} r={5} fill={s.colour} stroke="var(--color-ground)" strokeWidth={4} paintOrder="stroke" />
                ))}
              </g>
            )}
          </svg>
        )}
        {hover != null && width > 0 && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-md bg-raised-2 px-3 py-2 text-[12px] shadow-[0_6px_20px_rgb(0_0_0/0.45)] ring-1 ring-line"
            style={{ left: Math.min(Math.max(xs(hover) - 72, 0), width - 150) }}
          >
            <p className="text-ink-3">{xLabel(data[hover])}</p>
            {series.map((s) => (
              <p key={s.key} className="mt-1 flex items-center gap-2">
                <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: s.colour }} aria-hidden />
                <span className="font-score text-[15px] font-semibold text-ink">{yFormat(data[hover][s.key] as number)}</span>
                <span className="text-ink-3">{s.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <TableView table={table} />
    </figure>
  );
}

/* ---------- Calibration ---------- */

export type CalBin = { lo: number; hi: number; n: number; predicted: number; actual: number };

export function CalibrationChart({ bins, series, label }: { bins: Record<string, CalBin[]>; series: Series[]; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ key: string; i: number } | null>(null);
  const size = Math.min(width, 340);
  const pad = { top: 12, right: 12, bottom: 34, left: 40 };
  const w = size - pad.left - pad.right;
  const h = size - pad.top - pad.bottom;
  const [lo, hi] = [0.4, 1];
  const xs = (v: number) => pad.left + ((v - 0.5) / 0.5) * w;
  const ys = (v: number) => pad.top + h - ((v - lo) / (hi - lo)) * h;
  const grid = [0.5, 0.6, 0.7, 0.8, 0.9, 1];
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const hb = hover ? bins[hover.key][hover.i] : null;

  return (
    <figure className="mt-3">
      <Legend series={series} />
      <div ref={ref} className="relative mt-2" style={{ height: size || 300 }}>
        {width > 0 && (
          <svg width={size} height={size} role="group" aria-label={label} className="block">
            {grid.map((t) => (
              <g key={t}>
                <line x1={xs(t)} x2={xs(t)} y1={pad.top} y2={pad.top + h} stroke="var(--color-line-soft)" />
                <text x={xs(t)} y={size - 18} textAnchor="middle" className="fill-ink-3 font-score text-[12px]">
                  {pct(t)}
                </text>
              </g>
            ))}
            {[0.4, ...grid].map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={pad.left + w} y1={ys(t)} y2={ys(t)} stroke="var(--color-line-soft)" />
                <text x={pad.left - 8} y={ys(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 font-score text-[12px]">
                  {pct(t)}
                </text>
              </g>
            ))}
            <text x={pad.left + w / 2} y={size - 2} textAnchor="middle" className="fill-ink-3 text-[11px]">
              Chance given to the favourite
            </text>
            {/* Perfect calibration: the favourite wins exactly as often as predicted. */}
            <line x1={xs(0.5)} y1={ys(0.5)} x2={xs(1)} y2={ys(1)} stroke="var(--color-ink-3)" strokeWidth={1} />
            {series.map((s) => (
              <g key={s.key}>
                <path
                  d={bins[s.key]
                    .filter((b) => b.n)
                    .map((b, i) => `${i ? "L" : "M"}${xs(b.predicted)},${ys(b.actual)}`)
                    .join("")}
                  fill="none"
                  stroke={s.colour}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                {bins[s.key].map((b, i) =>
                  b.n ? (
                    <g key={i}>
                      <circle cx={xs(b.predicted)} cy={ys(b.actual)} r={5} fill={s.colour} stroke="var(--color-ground)" strokeWidth={4} paintOrder="stroke" />
                      {/* A hit target bigger than the dot. */}
                      <circle
                        cx={xs(b.predicted)}
                        cy={ys(b.actual)}
                        r={12}
                        fill="transparent"
                        tabIndex={0}
                        aria-label={`${s.label}, ${pct(b.lo)} to ${pct(b.hi)}: said ${pct(b.predicted)}, won ${pct(b.actual)} of ${b.n} games`}
                        onPointerEnter={() => setHover({ key: s.key, i })}
                        onPointerLeave={() => setHover(null)}
                        onFocus={() => setHover({ key: s.key, i })}
                        onBlur={() => setHover(null)}
                        className="cursor-default outline-none focus-visible:[stroke-width:2] focus-visible:[stroke:var(--color-lime)]"
                      />
                    </g>
                  ) : null,
                )}
              </g>
            ))}
          </svg>
        )}
        {hb && hover && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 rounded-md bg-raised-2 px-3 py-2 text-[12px] shadow-[0_6px_20px_rgb(0_0_0/0.45)] ring-1 ring-line"
            style={{ left: Math.min(xs(hb.predicted) + 10, size - 170), top: Math.max(0, ys(hb.actual) - 70) }}
          >
            <p className="flex items-center gap-2 text-ink-3">
              <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: series.find((s) => s.key === hover.key)!.colour }} aria-hidden />
              {series.find((s) => s.key === hover.key)!.label}, favourites at {pct(hb.lo)}&ndash;{pct(hb.hi)}
            </p>
            <p className="mt-1 text-ink">
              Said <span className="font-score text-[15px] font-semibold">{pct(hb.predicted)}</span>, won{" "}
              <span className="font-score text-[15px] font-semibold">{pct(hb.actual)}</span>
              <span className="text-ink-3"> of {hb.n} games</span>
            </p>
          </div>
        )}
      </div>
      <TableView
        table={{
          columns: ["Favourite's chance", ...series.flatMap((s) => [`${s.label}: said`, "won", "games"])],
          rows: bins[series[0].key].map((b, i) => [
            `${pct(b.lo)}–${pct(b.hi)}`,
            ...series.flatMap((s) => {
              const x = bins[s.key][i];
              return x.n ? [pct(x.predicted), pct(x.actual), x.n] : ["–", "–", 0];
            }),
          ]),
        }}
      />
    </figure>
  );
}

/* ---------- Table view: every chart's values without hovering ---------- */

export function TableView({ table }: { table: { columns: string[]; rows: (string | number)[][] } }) {
  return (
    <details className="group mt-2 text-[13px]">
      <summary className="inline-flex cursor-pointer items-center gap-1 py-1 font-semibold text-ink-3 hover:text-ink-2">
        <span className="group-open:hidden">Show as table</span>
        <span className="hidden group-open:inline">Hide table</span>
      </summary>
      <div className="mt-2 max-h-72 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-ground">
            <tr className="border-b border-line text-[12px] text-ink-3">
              {table.columns.map((c) => (
                <th key={c} scope="col" className="py-1.5 pr-3 font-semibold whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-score text-[14px] text-ink-2">
            {table.rows.map((r, i) => (
              <tr key={i} className="border-b border-line-soft">
                {r.map((c, j) => (
                  <td key={j} className="py-1 pr-3 whitespace-nowrap">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
