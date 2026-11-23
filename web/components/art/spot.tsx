// Spot illustrations for message and empty states (docs/superpowers/specs/2026-11-24-site-graphics-design.md):
// the logo's goalposts, ball and pitch drawn in chalk lines on a 120 by 90 grid. Strokes in ink steps,
// fills in pitch tones; lime only where the picture means an action you take (the kick on joining).
// Always decorative: the heading beside one says what it shows.

import type { ReactNode } from "react";

const ink = "stroke-ink-2";
const faint = "stroke-ink-3";

/** The ground line every spot stands on. */
const Ground = ({ y = 78 }: { y?: number }) => <path d={`M8 ${y}h104`} className={faint} />;

/** H goalposts, base at `y`. */
const Posts = ({ x, y = 78, w = 26, h = 56, bar = 22, cls = ink }: { x: number; y?: number; w?: number; h?: number; bar?: number; cls?: string }) => (
  <path d={`M${x} ${y}v-${h}M${x + w} ${y}v-${h}M${x} ${y - bar}h${w}`} className={cls} />
);

/** A rugby ball centred at (x, y), tilted. */
const Ball = ({ x, y, r = 7, tilt = -35, cls = "fill-raised-2 stroke-ink-2" }: { x: number; y: number; r?: number; tilt?: number; cls?: string }) => (
  <g transform={`rotate(${tilt} ${x} ${y})`}>
    <ellipse cx={x} cy={y} rx={r} ry={r * 0.62} className={cls} />
    <path d={`M${x - r * 0.45} ${y}h${r * 0.9}`} className={cls} />
  </g>
);

/** A player: head and shoulders, standing at (x, base). */
const Figure = ({ x, base = 78, s = 1, cls = ink }: { x: number; base?: number; s?: number; cls?: string }) => (
  <g className={cls}>
    <circle cx={x} cy={base - 30 * s} r={5 * s} className="fill-raised-2" />
    <path d={`M${x - 9 * s} ${base}v-${10 * s}a9 9 0 0 1 ${18 * s} 0v${10 * s}`} className="fill-raised-2" />
  </g>
);

const SPOTS = {
  /** A conversion sailing between the posts: joining, signing in. */
  kick: (
    <>
      <Ground />
      <Posts x={68} />
      <path d="M20 74 C40 30 62 22 81 32" className={`${faint} [stroke-dasharray:3_5]`} />
      <Ball x={81} y={34} cls="fill-lime stroke-lime-ink" />
      <path d="M12 78l8-4" className={ink} />
    </>
  ),
  /** The field under lights with nothing on it: off-season, not started. */
  "empty-pitch": (
    <>
      <path d="M30 34h60l16 44H14z" className="fill-pitch stroke-ink-3" />
      <path d="M60 34v44M24 58h72M38 34l-8 44M82 34l8 44" className="stroke-pitch-line" />
      <Posts x={53} y={34} w={14} h={22} bar={9} />
      <path d="M10 76V18M6 18h8M8 14h4M110 76V18M106 18h8M108 14h4" className={faint} />
      <path d="M14 22l14 10M106 22 92 32" className={`${faint} [stroke-dasharray:2_4]`} />
    </>
  ),
  /** The ball spilled forward: not found, something went wrong. */
  "knock-on": (
    <>
      <Ground />
      <Figure x={36} />
      <path d="M45 58l10-6" className={ink} />
      <path d="M58 46c8-6 16-2 18 10s4 10 8 14" className={`${faint} [stroke-dasharray:3_5]`} />
      <Ball x={88} y={72} tilt={20} />
      <path d="M78 77l-4 1M100 77l4 1" className={faint} />
    </>
  ),
  /** The referee's whistle: sign in to see this. */
  whistle: (
    <>
      <path d="M34 38h46v18H54a14 14 0 1 1-20-18z" className="fill-raised-2 stroke-ink-2" />
      <circle cx="40" cy="58" r="5" className={ink} />
      <path d="M68 38v-8M86 32l8-6M88 44h10M86 54l8 5" className={faint} />
      <path d="M80 47h-6" className={ink} />
    </>
  ),
  /** A huddle: groups. */
  huddle: (
    <>
      <Ground />
      <Figure x={34} s={0.85} cls={faint} />
      <Figure x={86} s={0.85} cls={faint} />
      <Figure x={48} />
      <Figure x={72} />
      <Figure x={60} s={1.1} />
    </>
  ),
  /** A clipboard team sheet: team lists or data not out yet. */
  "team-sheet": (
    <>
      <rect x="36" y="14" width="48" height="66" rx="4" className="fill-raised-2 stroke-ink-2" />
      <path d="M50 14v-4h20v4" className={ink} />
      {[28, 38, 48, 58, 68].map((y) => (
        <path key={y} d={`M44 ${y}h3M52 ${y}h${y === 68 ? 12 : 24}`} className={faint} />
      ))}
    </>
  ),
  /** A ballot going in: the Dally M with no votes yet. */
  ballot: (
    <>
      <rect x="30" y="44" width="60" height="34" rx="3" className="fill-raised-2 stroke-ink-2" />
      <path d="M46 44h28" className="stroke-ground" />
      <path d="M48 46V18h24v28" className="fill-ground stroke-ink-2" />
      <path d="M55 26h10M55 32h7" className={faint} />
      <path d="M52 62h16" className={faint} />
    </>
  ),
  /** One player left at the posts, the rest walking off: last man standing. */
  "last-one": (
    <>
      <Ground />
      <Posts x={47} />
      <Figure x={60} />
      <Figure x={20} s={0.7} cls={`${faint} [stroke-dasharray:2_3]`} />
      <Figure x={98} s={0.7} cls={`${faint} [stroke-dasharray:2_3]`} />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type SpotName = keyof typeof SPOTS;
export const SPOT_NAMES = Object.keys(SPOTS) as SpotName[];

export function Spot({ name, className = "" }: { name: SpotName; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 90"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-auto w-28 sm:w-32 ${className}`}
      data-spot={name}
      aria-hidden
    >
      {SPOTS[name]}
    </svg>
  );
}
