// The home dashboard (docs/superpowers/specs/2026-11-25-home-dashboard-design.md): what a tipper still
// has to do before the round locks, worked out from the round view, their last man standing turn and
// the Dally M's open round. Pure, so the page only lays it out.

import { playSeason, yourTurn, type LmsMatch, type LmsPick } from "./lms";
import type { RoundView } from "./round";
import type { TeamName } from "./teams";
import { sydney } from "./time";

export type Todo = {
  key: "tips" | "margin" | "lms" | "dallym";
  done: boolean;
  title: string;
  note?: string;
  action?: { href: string; label: string };
};

export type TodoInput = {
  view: RoundView;
  now: Date;
  /** The margin entered for the round's margin game, if any. */
  yourMargin?: number;
  /** The open last man standing round, if the viewer is in a game this round. */
  lms: { round: number; alive: boolean; picked?: TeamName } | null;
  /** The Dally M round open for votes, if any. */
  dallyM: { round: number; closes: string; voted: boolean } | null;
};

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** The week's to-dos: still open first, then done. */
export function todos({ view, now, yourMargin, lms, dallyM }: TodoInput): Todo[] {
  const out: Todo[] = [];
  const open = view.games.filter((g) => g.status === "upcoming" && new Date(g.match.kickoff) > now);
  const untipped = open.filter((g) => !g.yourTip);
  const tipped = view.games.filter((g) => g.yourTip).length;

  if (untipped.length) {
    out.push({
      key: "tips",
      done: false,
      title: `Tip ${plural(untipped.length, "more game")}`,
      // The board's heading gives the next lockout.
      note: `${tipped} of ${view.games.length} tipped`,
      action: { href: "/tipping", label: `Tip ${untipped.length} →` },
    });
  } else {
    out.push({ key: "tips", done: true, title: tipped === view.games.length ? `All ${view.games.length} tipped` : `${tipped} of ${view.games.length} tipped` });
  }

  const featured = view.featured;
  if (featured.yourTip && yourMargin != null) {
    out.push({ key: "margin", done: true, title: `Margin game: ${featured.yourTip} by ${yourMargin}` });
  } else if (featured.yourTip && open.includes(featured)) {
    out.push({
      key: "margin",
      done: false,
      title: "Set your margin",
      note: `${featured.match.home} v ${featured.match.away}: closest margin breaks ladder ties`,
      action: { href: "/tipping", label: "Set it" },
    });
  }

  if (lms?.alive) {
    out.push(
      lms.picked
        ? { key: "lms", done: true, title: `Last man standing: ${lms.picked}` }
        : {
            key: "lms",
            done: false,
            title: `Pick for Round ${lms.round}`,
            note: "Last man standing: you're still in",
            action: { href: "/last-man-standing", label: "Pick" },
          },
    );
  }

  if (dallyM) {
    out.push(
      dallyM.voted
        ? { key: "dallym", done: true, title: `Dally M votes in for Round ${dallyM.round}` }
        : {
            key: "dallym",
            done: false,
            title: `Dally M votes, Round ${dallyM.round}`,
            note: `Closes ${sydney(dallyM.closes)}`,
            action: { href: "/dally-m", label: "Vote" },
          },
    );
  }

  return [...out.filter((t) => !t.done), ...out.filter((t) => t.done)];
}

// ---------- Last man standing at a glance ----------


export type LmsGlance = {
  /** The to-do's part: the open round, whether you're in any of your games, and your pick. */
  todo: { round: number; alive: boolean; picked?: TeamName } | null;
  /** The shown group's (or the global) game: its number, you in or out, how many left of how many. */
  game: number;
  alive: boolean;
  stillIn: number;
  field: number;
  wins: number;
  used: TeamName[];
};

/**
 * Last man standing as the dashboard shows it, from the same inputs as its page: `tippers` is the
 * shown field, `fields` every game you're in (one pick counts in all of them).
 */
export function lmsGlance(you: string, tippers: string[], fields: string[][], matches: LmsMatch[], picks: LmsPick[], seasonOver: boolean): LmsGlance | null {
  const season = playSeason(tippers, matches, picks, seasonOver);
  const game = season.games.at(-1);
  if (!game) return null;
  const shown = yourTurn(season, you);
  const elsewhere =
    shown && !shown.alive
      ? fields.map((f) => yourTurn(playSeason(f, matches, picks, seasonOver), you)).find((t) => t?.alive && t.round === shown.round)
      : undefined;
  const turn = elsewhere ?? shown;
  return {
    todo: turn ? { round: turn.round, alive: turn.alive, ...(turn.pick ? { picked: turn.pick.team } : {}) } : null,
    game: game.number,
    alive: game.alive.includes(you),
    stillIn: game.alive.length,
    field: tippers.length,
    wins: season.tally.find((t) => t.userId === you)?.wins ?? 0,
    used: shown?.used ?? [],
  };
}
