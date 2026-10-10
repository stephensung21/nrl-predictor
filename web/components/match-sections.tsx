import Link from "next/link";
import { ArrowRight, Check, ChevronLeft, X } from "lucide-react";
import type { Game } from "@/lib/round";
import type { Verdict, Voice } from "@/lib/match";
import type { ListedPlayer, MatchDetail } from "@/lib/types";
import { team, type TeamName } from "@/lib/teams";
import { LocalTime } from "./local-time";
import { PitchBar } from "./pitch-bar";
import { ModelBadge, TeamBadge } from "./team-badge";

/* ---------- Heading: back link, teams, verdict ---------- */

const final = (g: Game) => g.status === "final";

/** Keeps team names whole ("Sea Eagles", "Wests Tigers") when a sentence wraps. */
function Unbroken({ text, teams }: { text: string; teams: TeamName[] }) {
  const parts = text.split(new RegExp(`(${teams.join("|")})`));
  return parts.map((p, i) => (teams.includes(p as TeamName) ? <span key={i} className="whitespace-nowrap">{p}</span> : p));
}

export function MatchHeading({ game, verdict, voices }: { game: Game; verdict: Verdict; voices: Voice[] }) {
  const { match, prediction } = game;
  const teams = [match.home, match.away];
  const market = voices.find((v) => v.id === "market");
  const said = `${final(game) ? "Model said" : "Model’s call:"} ${team(game.modelTip).name} by ${game.callMargin}, ${prediction.homePred}–${prediction.awayPred}.`;
  const isFinal = final(game);
  const when =
    game.status === "upcoming" ? <LocalTime iso={match.kickoff} /> : game.status === "live" ? "Live now" : isFinal ? "Full time" : "Full time · result soon";

  return (
    <div className="pt-4">
      <p className="flex items-center truncate text-[13px] font-medium whitespace-nowrap text-ink-3">
        <Link
          href={`/round/${match.season}/${match.round}`}
          className="-my-2 -ml-1 flex items-center gap-0.5 py-2 pr-1 font-semibold text-ink-2 hover:text-ink"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Round {match.round}
        </Link>
        <span className="mx-1.5">·</span>
        {when}
        <span className="mx-1.5">·</span>
        {match.venue}
      </p>

      <div className="mt-3.5 flex items-center gap-2 text-[14px] font-semibold text-ink-2">
        <TeamBadge name={match.home} size="sm" />
        <span>{match.home}</span>
        <span className="font-medium text-ink-3">v</span>
        <span>{match.away}</span>
        <TeamBadge name={match.away} size="sm" />
      </div>

      {isFinal ? (
        <>
          <h1 className="mt-3 font-display text-[40px] leading-[0.92] font-extrabold uppercase">
            {game.winners!.length === 2 ? "Draw" : <><span className="whitespace-nowrap">{game.winners![0]}</span> won</>}{" "}
            <span className="font-score">
              {Math.max(match.homeScore!, match.awayScore!)}–{Math.min(match.homeScore!, match.awayScore!)}
            </span>
          </h1>
          <p className="mt-2.5 text-[16px] leading-snug font-semibold text-ink">
            <Unbroken text={verdict.lead} teams={teams} />{" "}
            {verdict.dissent && <span className="text-ink-3"><Unbroken text={verdict.dissent} teams={teams} /></span>}
          </p>
          <p className="mt-1.5 text-[14px] leading-snug text-ink-2">{said}</p>
        </>
      ) : (
        <>
          <h1 className="mt-3 font-display text-[34px] leading-[0.94] font-extrabold text-balance uppercase">
            <Unbroken text={verdict.lead} teams={teams} />{" "}
            {verdict.dissent && <span className="text-ink-3"><Unbroken text={verdict.dissent} teams={teams} /></span>}
          </h1>
          <p className="mt-2.5 text-[14px] leading-snug text-ink-2">
            {said}
            {/* Say the bookies' number outright: "18 points apart" reads like a score margin. */}
            {verdict.gap != null && market && (
              <> The bookies give the {team(game.modelTip).name} {Math.round((game.modelTip === match.home ? market.homeProb : 1 - market.homeProb) * 100)}%.</>
            )}
          </p>
        </>
      )}
    </div>
  );
}

/* ---------- The voices, one pitch bar each ---------- */

export function VoiceList({ game, voices }: { game: Game; voices: Voice[] }) {
  const { home, away } = game.match;
  const noOdds = !voices.some((v) => v.id === "market");
  return (
    <section aria-label="Win chances" className="mt-5">
      <ul className="border-t border-line-soft">
        {voices.map((v) => (
          <li key={v.id} className="border-b border-line-soft py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                {v.correct === true && <Check className="size-3.5 text-ink-2" strokeWidth={2.5} aria-label="Right" />}
                {v.correct === false && <X className="size-3.5 text-ink-3" strokeWidth={2.5} aria-label="Wrong" />}
                {v.id === "model" && <ModelBadge size="sm" />}
                {v.label}
              </span>
              <span className="text-[13px] font-semibold text-ink-3">
                {team(v.backs).code} <span className="font-score text-[19px] text-ink">{Math.round(v.prob * 100)}%</span>
              </span>
            </div>
            <div className="mt-1.5">
              <PitchBar
                home={home}
                away={away}
                homeProb={v.homeProb}
                label={`${v.label}: ${v.backs} ${Math.round(v.prob * 100)}% to win`}
              />
            </div>
          </li>
        ))}
      </ul>
      {noOdds && <p className="mt-2 text-[12px] text-ink-3">No odds yet, so the Model is running without them.</p>}
    </section>
  );
}

/* ---------- Tip action or your graded tip ---------- */

export function TipLine({ game }: { game: Game }) {
  if (game.status === "upcoming") {
    return (
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[14px] text-ink-2">
          {game.yourTip ? (
            <>
              Your tip: <span className="font-semibold text-ink">{game.yourTip}</span>
            </>
          ) : (
            "Not tipped yet"
          )}
        </span>
        <Link
          href="/tipping"
          className="group flex shrink-0 items-center gap-1 rounded-full bg-lime px-4 py-2.5 text-[14px] font-bold text-lime-ink hover:bg-[oklch(0.94_0.19_126)]"
        >
          {game.yourTip ? "Change tip" : "Tip this game"}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} aria-hidden />
        </Link>
      </div>
    );
  }
  if (!game.yourTip) return null;
  return (
    <p className="mt-4 flex items-center gap-1.5 text-[14px]">
      <span className="text-ink-3">Your tip:</span>
      <span
        className={`flex items-center gap-1 font-semibold ${game.yourCorrect === true ? "text-lime" : game.yourCorrect === false ? "text-miss line-through decoration-2" : "text-ink"}`}
      >
        {game.yourCorrect === true && <Check className="tick-pop size-4" strokeWidth={3} aria-label="Correct" />}
        {game.yourCorrect === false && <X className="size-4" strokeWidth={3} aria-label="Wrong" />}
        {game.yourTip}
      </span>
    </p>
  );
}

/* ---------- Tabs (links, so they work without JavaScript) ---------- */

export type MatchTab = "teams" | "h2h";

export function MatchTabs({ id, tab, query }: { id: string; tab: MatchTab; query: string }) {
  const tabs: [MatchTab, string][] = [
    ["teams", "Team lists"],
    ["h2h", "Head to head"],
  ];
  return (
    <nav aria-label="Match sections" className="mt-7 flex gap-1 border-b border-line">
      {tabs.map(([t, label]) => (
        <Link
          key={t}
          href={`/match/${id}?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(query)), tab: t })}`}
          scroll={false}
          aria-current={tab === t ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2.5 text-[14px] font-semibold transition-colors ${
            tab === t ? "border-lime text-ink" : "border-transparent text-ink-3 hover:text-ink-2"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/* ---------- Team lists: home left, away right, row by row ---------- */

function InTag({ className = "" }: { className?: string }) {
  return <span className={`text-[11px] font-bold tracking-[0.06em] whitespace-nowrap text-live uppercase ${className}`}>In</span>;
}

export function TeamLists({ game, detail, before }: { game: Game; detail: MatchDetail; before: boolean }) {
  const { home, away } = detail.lists;
  // Before kickoff only Tuesday's list is known; afterwards, the 17 who played.
  const [h, a] = before ? [home.tuesday, away.tuesday] : [home.players, away.players];
  const rows = Array.from({ length: Math.max(h.length, a.length) }, (_, i) => [h[i], a[i]] as const);
  // A swap is one change: count the larger of ins and outs for each team.
  const changes = [home, away].reduce((n, t) => n + Math.max(t.out.length, t.players.filter((p) => p.isIn).length), 0);

  const Cell = ({ p, side }: { p?: ListedPlayer; side: "home" | "away" }) => (
    <span className={`flex min-w-0 items-baseline gap-2 ${side === "away" ? "flex-row-reverse text-right" : ""}`}>
      <span className="w-5 shrink-0 font-score text-[15px] font-semibold text-ink-3">{p?.n}</span>
      <span className={`min-w-0 leading-snug break-words ${p?.isIn ? "font-semibold text-ink" : "text-ink-2"}`}>
        {/* The tag sits inline so it stays with the last word when a long name wraps. */}
        {p?.isIn && side === "away" && <InTag className="mr-1.5" />}
        {p?.name}
        {p?.isIn && side === "home" && <InTag className="ml-1.5" />}
      </span>
    </span>
  );

  return (
    <section aria-label="Team lists" className="mt-3">
      <p className="text-[13px] text-ink-3">
        {before
          ? "As named on Tuesday. Changes show here after kickoff."
          : `Who played. ${changes === 0 ? "No changes since Tuesday." : `${changes} change${changes === 1 ? "" : "s"} since Tuesday.`}`}
        {!before &&
          ([[game.match.home, h], [game.match.away, a]] as const)
            .filter(([, list]) => list.length < 17)
            .map(([name, list]) => ` The stats are missing ${17 - list.length} ${name} player${17 - list.length === 1 ? "" : "s"}.`)}
      </p>
      <div className="mt-3 flex justify-between pb-2">
        <TeamBadge name={game.match.home} size="sm" />
        <TeamBadge name={game.match.away} size="sm" />
      </div>
      <ol className="border-t border-line-soft text-[14px]">
        {rows.map(([hp, ap], i) => (
          <li key={i} className={`grid grid-cols-2 gap-x-4 border-b py-[7px] ${i === 12 ? "border-line" : "border-line-soft"}`}>
            <Cell p={hp} side="home" />
            <Cell p={ap} side="away" />
          </li>
        ))}
      </ol>
      {!before && (home.out.length > 0 || away.out.length > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-4 text-[13px] leading-relaxed text-ink-3">
          {(["home", "away"] as const).map((side) => (
            <p key={side} className={side === "away" ? "text-right" : ""}>
              {detail.lists[side].out.length > 0 && (
                <>
                  <span className="font-semibold">Out: </span>
                  <span className="line-through decoration-ink-3/60">{detail.lists[side].out.join(", ")}</span>
                </>
              )}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- Head to head ---------- */

export function HeadToHead({ game, detail }: { game: Game; detail: MatchDetail }) {
  const { home, away } = game.match;
  const meetings = detail.headToHead;
  if (meetings.length === 0) return <p className="mt-4 text-[14px] text-ink-3">These two haven&rsquo;t met since 2020.</p>;
  const wins = (t: string) => meetings.filter((m) => (m.homeScore > m.awayScore ? m.home : m.awayScore > m.homeScore ? m.away : null) === t).length;
  const [hw, aw] = [wins(home), wins(away)];

  return (
    <section aria-label="Head to head" className="mt-4">
      <p className="text-[15px] font-semibold text-ink">
        Last {meetings.length}: {home} <span className="font-score text-[18px]">{hw}</span>, {away}{" "}
        <span className="font-score text-[18px]">{aw}</span>
        {meetings.length - hw - aw > 0 && <>, drawn {meetings.length - hw - aw}</>}
      </p>
      <ul className="mt-3 border-t border-line-soft">
        {meetings.map((m) => {
          const homeWon = m.homeScore > m.awayScore;
          const awayWon = m.awayScore > m.homeScore;
          return (
            <li key={m.matchId} className="flex items-center gap-3 border-b border-line-soft py-2.5">
              <span className="w-[112px] shrink-0 text-[12px] leading-tight text-ink-3">
                {m.season} · {m.roundTitle.replace("Round ", "R")}
                <span className="block truncate">{m.venue}</span>
              </span>
              <span className="flex flex-1 justify-end">
                <TeamBadge name={m.home} size="sm" />
              </span>
              <span className="w-[64px] shrink-0 text-center font-score text-[21px] leading-none">
                <span className={homeWon ? "font-bold text-ink" : "text-ink-3"}>{m.homeScore}</span>
                <span className="text-ink-3">–</span>
                <span className={awayWon ? "font-bold text-ink" : "text-ink-3"}>{m.awayScore}</span>
              </span>
              <span className="flex flex-1">
                <TeamBadge name={m.away} size="sm" />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
