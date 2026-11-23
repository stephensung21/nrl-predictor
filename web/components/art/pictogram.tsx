// The site's own pictograms (docs/superpowers/specs/2026-11-24-site-graphics-design.md): "chalk on
// the scoreboard", round-cap strokes in the current text colour, drawn on a 24-unit grid. Decorative
// by default (the words beside them say it); pass `label` when one stands alone.

import type { ReactNode } from "react";

const PATHS = {
  ball: (
    <>
      <ellipse cx="12" cy="12" rx="8.5" ry="5.5" transform="rotate(-35 12 12)" />
      <path d="M8.6 15.4 15.4 8.6M10.4 11.2l2.4 2.4M11.9 9.7l2.4 2.4M8.9 12.7l2.4 2.4" />
    </>
  ),
  posts: <path d="M7 3v18M17 3v18M7 13h10" />,
  tick: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  cross: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  draw: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 10h7M8.5 14h7" />
    </>
  ),
  crown: <path d="M4 18h16M4.5 15 3.5 7l5 4L12 5l3.5 6 5-4-1 8z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  hidden: (
    <>
      <path d="M3 12s3.5-6 9-6c2 0 3.7.8 5 1.8M21 12s-3.5 6-9 6c-2 0-3.7-.8-5-1.8" />
      <path d="M4 20 20 4" />
    </>
  ),
  podium: (
    <>
      <path d="M3 20h18M9 20V8h6v12M3 20v-7h6M15 20v-4h6v4" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.5-3.2 2.7-5 5.5-5s5 1.8 5.5 5" />
      <circle cx="16.5" cy="9" r="2.5" />
      <path d="M15.5 14.2c2.6-.3 4.6 1.3 5 4.3" />
    </>
  ),
  rain: (
    <>
      <path d="M7 15a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17 7.5a3.8 3.8 0 0 1 .5 7.5z" />
      <path d="M8 18.5 7 21M12.5 18.5l-1 2.5M17 18.5l-1 2.5" />
    </>
  ),
  swap: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  "short-bars": <path d="M5 20v-4M10 20v-7M15 20v-2.5M20 20v-5M3 20h18" />,
  crowd: (
    <>
      <circle cx="6" cy="9" r="2.3" />
      <circle cx="12" cy="7.5" r="2.5" />
      <circle cx="18" cy="9" r="2.3" />
      <path d="M2.5 18c.3-2.6 1.6-4 3.5-4M8 18c.4-3 1.9-4.7 4-4.7s3.6 1.7 4 4.7M21.5 18c-.3-2.6-1.6-4-3.5-4" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.2 6.2a1.4 1.4 0 0 1-2 0z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  dial: (
    <>
      <path d="M3.5 16a8.5 8.5 0 0 1 17 0" />
      <path d="M12 16l4-5M3.5 16h2M18.5 16h2M12 7.5v2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  whistle: (
    <>
      <path d="M9 9h11v4.5H13.5A5.5 5.5 0 1 1 9 9z" />
      <circle cx="8" cy="14.5" r="1.6" />
      <path d="M16 9V6.5" />
    </>
  ),
  thread: <path d="M4 5.5h16v10H10l-4.5 3.5v-3.5H4z" />,
  news: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M7 8.5h10M7 12h4.5M7 15.5h4.5M14 12h3v3.5h-3z" />
    </>
  ),
  media: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m10 9 5 3-5 3z" />
    </>
  ),
  lineup: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M9 3.5v2h6v-2M8.5 10h7M8.5 13.5h7M8.5 17h4" />
    </>
  ),
  ratings: <path d="M4 19 9.5 12l4 3.5L20 6.5M15.5 6.5H20V11" />,
  question: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6M12 17h.01" />
    </>
  ),
  model: (
    <>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M8 10.5h2M14 10.5h2M9 14.5h6M12 6V3.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type PictogramName = keyof typeof PATHS;
export const PICTOGRAMS = Object.keys(PATHS) as PictogramName[];

export function Pictogram({
  name,
  size = 24,
  className = "",
  label,
}: {
  name: PictogramName;
  size?: 20 | 24 | 32;
  className?: string;
  /** Only for a pictogram that stands alone; otherwise it's hidden from screen readers. */
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={size <= 20 ? 1.75 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      data-pictogram={name}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {PATHS[name]}
    </svg>
  );
}
