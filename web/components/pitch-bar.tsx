"use client";

import { useEffect, useRef } from "react";
import { team, type TeamName } from "@/lib/teams";

function hexDistance(a: string, b: string) {
  const n = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [n(a), n(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** Bar colours for a game, switching the away team to its other colour when the
 *  two would look alike (Cowboys v Eels are both gold). */
export function barColours(home: TeamName, away: TeamName): [string, string] {
  const h = team(home).bar;
  const a = team(away);
  return [h, hexDistance(h, a.bar) < 90 ? a.primary : a.bar];
}

/**
 * Win probability drawn as a pitch: the halfway line marks 50%, faint
 * ten-metre lines mark every 10%, and each team's colour fills from its own
 * end. A 55% game sits just past halfway; a 90% game is nearly all one colour.
 */
export function PitchBar({
  home,
  away,
  homeProb,
  size = "sm",
  label,
}: {
  home: TeamName;
  away: TeamName;
  homeProb: number;
  size?: "sm" | "lg";
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [homeColour, awayColour] = barColours(home, away);
  const homePct = Math.round(homeProb * 1000) / 10;
  const homeTipped = homeProb >= 0.5;

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.run = "1";
          io.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const lg = size === "lg";
  return (
    <div ref={ref} data-pitch role="img" aria-label={label} className={`relative ${lg ? "py-[5px]" : "py-[3px]"}`}>
      <div className={`relative overflow-hidden rounded-[3px] bg-pitch ${lg ? "h-3.5" : "h-[7px]"}`}>
        <div
          data-fill
          className="absolute inset-y-0 left-0"
          style={{ width: `${homePct}%`, backgroundColor: homeColour, opacity: homeTipped ? 1 : 0.42 }}
        />
        <div
          data-fill
          className="absolute inset-y-0 right-0"
          style={{ width: `${100 - homePct}%`, backgroundColor: awayColour, opacity: homeTipped ? 0.42 : 1 }}
        />
        {/* ten-metre lines */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, transparent 0, transparent calc(10% - 1px), rgb(10 20 16 / 0.55) calc(10% - 1px), rgb(10 20 16 / 0.55) 10%)",
          }}
        />
      </div>
      {/* halfway line */}
      <div
        className={`absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-full bg-ink ring-[1.5px] ring-ground ${lg ? "w-[3px]" : "w-[2px]"}`}
      />
    </div>
  );
}
