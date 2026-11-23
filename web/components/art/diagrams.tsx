// Diagrams that replace explaining paragraphs (docs/superpowers/specs/2026-11-24-site-graphics-design.md).
// Every label is real text, so screen readers and search read the same facts; the drawing is aria-hidden.

import { SERIES } from "@/lib/odds";
import { Pictogram, type PictogramName } from "./pictogram";

/** Spelled out so Tailwind sees each class. */
const COLS: Record<number, string> = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5" };

/** A rule or a how-it-works sequence as a row of steps: pictogram, bold line, optional short line. */
export function RuleStrip({ steps, label, className = "" }: { steps: { icon: PictogramName; title: string; note?: string }[]; label: string; className?: string }) {
  return (
    <ol aria-label={label} className={`grid ${steps.length === 3 ? "grid-cols-3" : "grid-cols-2"} gap-x-4 gap-y-5 border-y border-line-soft py-4 ${COLS[Math.min(steps.length, 5)]} ${className}`}>
      {steps.map((s) => (
        <li key={s.title} className="flex flex-col gap-2">
          <Pictogram name={s.icon} size={32} className="text-ink-2" />
          <span className="text-[14px] leading-snug font-semibold text-ink">{s.title}</span>
          {s.note && <span className="-mt-1 text-[13px] leading-snug text-ink-3">{s.note}</span>}
        </li>
      ))}
    </ol>
  );
}

type Node = { icon: PictogramName; title: string; note?: string };

const NodeRow = ({ n }: { n: Node }) => (
  <li className="flex flex-col items-start gap-1.5 sm:flex-row sm:gap-3">
    <Pictogram name={n.icon} size={24} className="mt-0.5 text-ink-2" />
    <span>
      <span className="block text-[14px] leading-snug font-semibold text-ink">{n.title}</span>
      {n.note && <span className="block text-[13px] leading-snug text-ink-3">{n.note}</span>}
    </span>
  </li>
);

/** The arrow down between a flow's rows. */
const Arrow = () => (
  <svg viewBox="0 0 24 24" className="mx-auto size-6 shrink-0 text-ink-3" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 4v15M7 14l5 5 5-5" />
  </svg>
);

/** Inputs feeding a centre, giving outputs: how the Model works, in one picture, top to bottom. */
export function FlowDiagram({ inputs, centre, outputs, label }: { inputs: Node[]; centre: { title: string; note?: string }; outputs: Node[]; label: string }) {
  return (
    <figure aria-label={label} className="mt-4 flex flex-col gap-3 border-y border-line-soft py-5">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
        {inputs.map((n) => (
          <NodeRow key={n.title} n={n} />
        ))}
      </ul>
      <Arrow />
      <div className="flex items-center justify-center gap-3 rounded-lg bg-raised px-4 py-3">
        <Pictogram name="model" size={32} className="text-ink" />
        <span>
          <span className="block font-display text-[22px] leading-none font-bold text-ink uppercase">{centre.title}</span>
          {centre.note && <span className="block text-[12px] leading-snug text-ink-3">{centre.note}</span>}
        </span>
      </div>
      <Arrow />
      <ul className={`grid gap-x-4 gap-y-3 ${outputs.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {outputs.map((n) => (
          <NodeRow key={n.title} n={n} />
        ))}
      </ul>
    </figure>
  );
}

/** Two to four forecasters' figures as bars in their series colours, longest best. */
export function CompareBars({
  rows,
  caption,
  min = 0,
  max = 100,
  unit = "%",
}: {
  rows: { label: string; value: number; series: "model" | "market" | "elo"; note?: string }[];
  caption: string;
  /** Where the bars start: 50 for win rates, so they grow from a coin toss. */
  min?: number;
  max?: number;
  unit?: string;
}) {
  return (
    <figure className="mt-4 max-w-[40rem]">
      <figcaption className="text-[13px] text-ink-3">{caption}</figcaption>
      <ul className="mt-2 flex flex-col gap-2.5">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3">
            <span className="text-[13px] leading-tight text-ink-2">{r.label}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-pitch" aria-hidden>
              <span className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, ((r.value - min) / (max - min)) * 100))}%`, backgroundColor: SERIES[r.series].colour }} />
            </span>
            <span className="text-right font-score text-[20px] leading-none font-bold text-ink tabular-nums">
              {r.value}
              <span className="text-[13px] text-ink-3">{unit}</span>
              {r.note && <span className="sr-only"> {r.note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** A list where each point leads with a pictogram: limits, reminders. */
export function IconList({ items, className = "" }: { items: { icon: PictogramName; title: string; note: string }[]; className?: string }) {
  return (
    <ul className={`mt-3 divide-y divide-line-soft border-y border-line-soft ${className}`}>
      {items.map((i) => (
        <li key={i.title} className="flex items-start gap-3 py-3">
          <Pictogram name={i.icon} size={24} className="mt-0.5 text-ink-2" />
          <span>
            <span className="block text-[15px] leading-snug font-semibold text-ink">{i.title}</span>
            <span className="block max-w-[60ch] text-[14px] leading-snug text-ink-2">{i.note}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
