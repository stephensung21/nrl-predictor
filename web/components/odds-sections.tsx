import Link from "next/link";
import { Check, X } from "lucide-react";
import { SERIES } from "@/lib/odds";
import { team, type TeamName } from "@/lib/teams";
import type { OddsGame } from "@/lib/types";
import { LocalTime } from "./local-time";
import { TeamBadge } from "./team-badge";

/** Gaps this big between the Model and the opening price get called out. */
export const BIG_GAP = 10;

const pct = (p: number) => Math.round(p * 100);

/** "MAN 64%": the team a home-win chance backs, and its chance. */
function backs(g: OddsGame, homeProb: number) {
  const home = homeProb >= 0.5;
  return { team: home ? g.home : g.away, pct: pct(home ? homeProb : 1 - homeProb) };
}

/** "MAN −1.5": the handicap on whichever team is giving start. */
function lineText(g: OddsGame, homeLine: number) {
  if (homeLine === 0) return "Level";
  const fav = homeLine < 0 ? g.home : g.away;
  return `${team(fav).code} −${Math.abs(homeLine)}`;
}

/** Points between the Model and the opening price, on the Model's side. */
export function gapOf(g: OddsGame) {
  return g.openHomeProb == null ? null : Math.abs(pct(g.modelHomeProb) - pct(g.openHomeProb));
}

/**
 * The signature: one pitch, home end on the left. Each estimate sits toward the
 * team it backs (further left = more likely a home win), so a disagreement is a
 * distance and the market's move from opening to closing is an arrow.
 */
function MarketTrack({ g, graded }: { g: OddsGame; graded: boolean }) {
  const at = (homeProb: number) => `${(1 - homeProb) * 100}%`;
  const open = g.openHomeProb;
  const close = graded ? g.closeHomeProb : null;
  const [x0, x1] = open != null && close != null ? [(1 - open) * 100, (1 - close) * 100] : [0, 0];
  const moved = Math.abs(x1 - x0) >= 1;
  const label = [
    `Model ${backs(g, g.modelHomeProb).team} ${backs(g, g.modelHomeProb).pct}%`,
    open != null && `opening price ${backs(g, open).team} ${backs(g, open).pct}%`,
    close != null && `closing ${backs(g, close).team} ${backs(g, close).pct}%`,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <div role="img" aria-label={label} className="mt-2 flex items-center gap-2">
      <span className="w-7 shrink-0 text-[11px] font-semibold text-ink-3">{team(g.home).code}</span>
      <div className="relative h-8 flex-1">
        {/* The Model's lane, above the bar, so it never covers a price. */}
        <span
          className="absolute top-0.5 size-3 -translate-x-1/2 rotate-45 rounded-[2px] ring-2 ring-ground"
          style={{ left: at(g.modelHomeProb), backgroundColor: SERIES.model.colour }}
        />
        <span
          className="absolute top-3 h-2 w-px -translate-x-1/2"
          style={{ left: at(g.modelHomeProb), backgroundColor: SERIES.model.colour }}
          aria-hidden
        />
        {/* The bar: a pitch with tenths and a halfway line; the prices sit on it. */}
        <div
          className="absolute inset-x-0 bottom-2 h-2 rounded-[3px] bg-pitch"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, transparent 0, transparent calc(10% - 1px), rgb(10 20 16 / 0.6) calc(10% - 1px), rgb(10 20 16 / 0.6) 10%)",
          }}
        />
        <div className="absolute bottom-1 left-1/2 h-4 w-[2px] -translate-x-1/2 rounded-full bg-ink-3" />
        {/* The market's move, opening to closing, with an arrowhead at the closing end. */}
        {moved && (
          <>
            <div
              className="absolute bottom-[11px] h-[2px]"
              style={{ left: `${Math.min(x0, x1)}%`, width: `${Math.abs(x1 - x0)}%`, backgroundColor: SERIES.market.colour }}
            />
            <span
              className="absolute bottom-[7px] size-0 -translate-x-1/2 border-y-[5px] border-y-transparent"
              style={{
                left: `calc(${x1}% ${x1 > x0 ? "-" : "+"} 9px)`,
                [x1 > x0 ? "borderLeft" : "borderRight"]: `7px solid ${SERIES.market.colour}`,
              }}
              aria-hidden
            />
          </>
        )}
        {close != null && (
          <span
            className="absolute bottom-[6px] size-3 -translate-x-1/2 rounded-full bg-ground"
            style={{ left: at(close), boxShadow: `inset 0 0 0 2px ${SERIES.market.colour}` }}
          />
        )}
        {open != null && (
          <span
            className="absolute bottom-[5px] size-3.5 -translate-x-1/2 rounded-full ring-2 ring-ground"
            style={{ left: at(open), backgroundColor: SERIES.market.colour }}
          />
        )}
      </div>
      <span className="w-7 shrink-0 text-right text-[11px] font-semibold text-ink-3">{team(g.away).code}</span>
    </div>
  );
}

export function TrackKey({ graded }: { graded: boolean }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
      <li className="flex items-center gap-1.5">
        <span className="size-2.5 rotate-45 rounded-[2px]" style={{ backgroundColor: SERIES.model.colour }} aria-hidden />
        The Model
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: SERIES.market.colour }} aria-hidden />
        Opening price
      </li>
      {graded && (
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ boxShadow: `inset 0 0 0 2px ${SERIES.market.colour}` }} aria-hidden />
          Closing price
        </li>
      )}
      <li className="text-ink-3">Each sits toward the team it backs{graded && <>; the arrow is the market&rsquo;s move</>}</li>
    </ul>
  );
}

function Figure({
  label,
  g,
  homeProb,
  strong,
  pending,
  correct,
}: {
  label: string;
  g: OddsGame;
  homeProb: number | null;
  strong?: boolean;
  pending?: string;
  correct?: boolean;
}) {
  const b = homeProb != null ? backs(g, homeProb) : null;
  return (
    <div className={`min-w-0 rounded-md px-2 py-1.5 ${strong ? "bg-raised" : ""}`}>
      <p className={`flex items-center gap-1 text-[12px] ${strong ? "font-semibold text-ink-2" : "text-ink-3"}`}>
        {correct === true && <Check className="size-3 text-ink-2" strokeWidth={2.5} aria-label="Backed the winner" />}
        {correct === false && <X className="size-3 text-ink-3" strokeWidth={2.5} aria-label="Backed the loser" />}
        {label}
      </p>
      {b ? (
        <p className="mt-0.5 whitespace-nowrap">
          <span className="text-[12px] font-semibold text-ink-3">{team(b.team).code} </span>
          <span className={`font-score ${strong ? "text-[22px] font-bold text-ink" : "text-[19px] font-semibold text-ink-2"}`}>{b.pct}%</span>
        </p>
      ) : (
        <p className="mt-1 text-[12px] leading-tight text-ink-3">{pending ?? "No price"}</p>
      )}
    </div>
  );
}

export function OddsGameRow({ g, graded }: { g: OddsGame; graded: boolean }) {
  const gap = gapOf(g);
  const split = g.openHomeProb != null && g.modelHomeProb >= 0.5 !== g.openHomeProb >= 0.5;
  const winner: TeamName | null = graded ? (g.homeScore === g.awayScore ? null : g.homeScore > g.awayScore ? g.home : g.away) : null;
  const right = (p: number | null) => (winner && p != null ? backs(g, p).team === winner : undefined);
  const model = backs(g, g.modelHomeProb);

  return (
    <li className="py-4">
      <Link href={`/match/${g.matchId}`} className="group flex items-center gap-2 text-[14px]">
        <TeamBadge name={g.home} size="sm" />
        <span className="font-semibold text-ink group-hover:underline">{g.home}</span>
        <span className="text-ink-3">v</span>
        <span className="font-semibold text-ink group-hover:underline">{g.away}</span>
        <TeamBadge name={g.away} size="sm" />
        <span className="ml-auto shrink-0 text-[12px] text-ink-3">
          {graded ? (
            <span className="font-score text-[15px] text-ink-2">
              {g.homeScore}–{g.awayScore}
            </span>
          ) : (
            <LocalTime iso={g.kickoff} />
          )}
        </span>
      </Link>

      <MarketTrack g={g} graded={graded} />

      <div className="mt-2 grid grid-cols-4 gap-1">
        <Figure label="Model" g={g} homeProb={g.modelHomeProb} correct={right(g.modelHomeProb)} />
        <Figure label="Opening" g={g} homeProb={g.openHomeProb} strong correct={right(g.openHomeProb)} />
        <Figure label="Closing" g={g} homeProb={graded ? g.closeHomeProb : null} pending={graded ? "No closing price" : "At kickoff"} />
        <div className={`min-w-0 rounded-md px-2 py-1.5 ${gap != null && gap >= BIG_GAP ? "ring-1 ring-ink-3 ring-inset" : ""}`}>
          <p className="text-[12px] text-ink-3">Gap</p>
          {gap != null ? (
            <p className="mt-0.5 whitespace-nowrap">
              <span className={`font-score ${gap >= BIG_GAP ? "text-[22px] font-bold text-ink" : "text-[19px] font-semibold text-ink-2"}`}>{gap}</span>
              <span className="text-[12px] text-ink-3">%{split ? ", split" : ""}</span>
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-ink-3">–</p>
          )}
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px] text-ink-2">
        <dt className="text-ink-3">Margin</dt>
        <dd>
          Model {team(model.team).code} by {g.modelMargin == null ? "–" : Math.max(1, Math.round(Math.abs(g.modelMargin)))}
          {g.openLine != null && (
            <>
              <span className="text-ink-3"> · line </span>
              <span className="font-semibold">{lineText(g, g.openLine)}</span>
              {graded && g.closeLine != null && g.closeLine !== g.openLine && <span className="text-ink-3"> → {lineText(g, g.closeLine)}</span>}
            </>
          )}
        </dd>
        <dt className="text-ink-3">Total</dt>
        <dd>
          Model {g.modelTotal == null ? "–" : Math.round(g.modelTotal)}
          {g.openTotal != null && (
            <>
              <span className="text-ink-3"> · bookies </span>
              <span className="font-semibold">{g.openTotal}</span>
              {graded && g.closeTotal != null && g.closeTotal !== g.openTotal && <span className="text-ink-3"> → {g.closeTotal}</span>}
            </>
          )}
          {graded && <span className="text-ink-3"> · actual {g.homeScore + g.awayScore}</span>}
        </dd>
      </dl>
    </li>
  );
}
