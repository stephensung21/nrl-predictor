// A team's last few results as lamps, oldest first: filled for a win, a ring for a loss, half for a draw.
// Ink only: lime and coral mean your right and wrong tips (DESIGN.md, The One Lamp Rule), not a team's results.

import type { EloFormGame } from "@/lib/types";

const resultOf = (g: EloFormGame) => (g.scored > g.conceded ? "W" : g.scored < g.conceded ? "L" : "D");
const SAID = { W: "won", L: "lost", D: "drew" } as const;
const VERB = { W: "Beat", L: "Lost to", D: "Drew with" } as const;
const LAMP = {
  W: "bg-ink-2",
  L: "ring-[1.5px] ring-ink-3 ring-inset",
  D: "bg-[linear-gradient(90deg,var(--color-ink-2)_50%,transparent_50%)] ring-[1.5px] ring-ink-2 ring-inset",
} as const;

export function FormLamps({ games }: { games: EloFormGame[] }) {
  return (
    <span className="inline-flex items-center gap-[3px] align-middle">
      {games.map((g, i) => {
        const r = resultOf(g);
        return (
          <span
            key={i}
            aria-hidden
            title={`${VERB[r]} ${g.opponent} ${g.scored}–${g.conceded}, ${g.label}`}
            className={`size-2.5 rounded-[2px] ${LAMP[r]}`}
          />
        );
      })}
      <span className="sr-only">
        Last {games.length === 1 ? "game" : `${games.length} games`}, oldest first: {games.map((g) => SAID[resultOf(g)]).join(", ")}
      </span>
    </span>
  );
}
