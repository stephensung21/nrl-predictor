import Link from "next/link";
import { Check, RefreshCw, X } from "lucide-react";
import type { Game } from "@/lib/round";
import { team, type TeamName } from "@/lib/teams";
import { LocalTime } from "./local-time";
import { PitchBar } from "./pitch-bar";
import { TeamBadge } from "./team-badge";

/** `score` is the result once graded, the Model's predicted score before kickoff,
 *  and null while a game is live or waiting on its result. */
function TeamLine({ game, name, score, side }: { game: Game; name: TeamName; score: number | null; side: "home" | "away" }) {
  const final = game.status === "final";
  const lead = final ? game.winners!.includes(name) : game.modelTip === name;
  const yours = game.yourTip === name;
  const right = yours && game.yourCorrect === true;
  const wrong = yours && game.yourCorrect === false;
  return (
    <div
      className={`-mx-1.5 flex items-center gap-2.5 rounded-md px-1.5 py-[3px] ${right ? "bg-lime-wash" : wrong ? "bg-miss-wash" : ""}`}
    >
      <TeamBadge name={name} size="sm" />
      <span
        className={`min-w-0 flex-1 truncate text-[15px] ${lead ? "font-semibold text-ink" : "text-ink-2"} ${wrong ? "line-through decoration-miss decoration-2" : ""}`}
      >
        {name}
        <span className="sr-only">{side === "home" ? " (home)" : ""}</span>
      </span>
      {yours && (
        <span
          className={`flex shrink-0 items-center gap-1 text-[11px] font-bold tracking-[0.06em] uppercase ${right ? "text-lime" : wrong ? "text-miss" : "text-lime"}`}
        >
          {right && <Check className="tick-pop size-3.5" strokeWidth={3} aria-hidden />}
          {wrong && <X className="size-3.5" strokeWidth={3} aria-hidden />}
          Your tip
        </span>
      )}
      <span
        className={`w-8 shrink-0 text-right font-score text-[21px] leading-none ${
          score == null ? "text-ink-3" : !final ? (lead ? "font-medium text-ink-2" : "font-medium text-ink-3") : lead ? "font-bold text-ink" : "font-semibold text-ink-3"
        }`}
      >
        {score ?? "–"}
        {score != null && !final && <span className="sr-only"> predicted</span>}
      </span>
    </div>
  );
}

function Status({ game }: { game: Game }) {
  switch (game.status) {
    case "upcoming":
      return (
        <span className="flex flex-col items-end text-right text-[13px] leading-tight font-medium text-ink-2">
          <LocalTime iso={game.match.kickoff} format="weekday" />
          <span className="font-semibold text-ink">
            <LocalTime iso={game.match.kickoff} format="time" />
          </span>
        </span>
      );
    case "live":
      return (
        <span className="flex items-center gap-1.5 text-[13px] font-bold tracking-[0.06em] text-live uppercase">
          <span className="live-dot size-2 rounded-full bg-live" aria-hidden />
          Live
        </span>
      );
    case "awaiting":
      return (
        <span className="flex flex-col items-end text-right text-[13px] leading-tight">
          <span className="font-bold tracking-[0.06em] text-ink uppercase">Full time</span>
          <span className="text-ink-3">result soon</span>
        </span>
      );
    case "final":
      return (
        <span className="flex flex-col items-end gap-0.5 text-right text-[13px] leading-tight">
          <span className="font-bold tracking-[0.06em] text-ink-2 uppercase">FT</span>
          <span className={`flex items-center gap-1 ${game.modelCorrect ? "text-ink-2" : "text-ink-3"}`}>
            {game.modelCorrect ? <Check className="size-3.5" strokeWidth={2.5} aria-hidden /> : <X className="size-3.5" strokeWidth={2.5} aria-hidden />}
            Model
            <span className="sr-only">{game.modelCorrect ? " tipped it" : " got it wrong"}</span>
          </span>
        </span>
      );
    case "postponed":
      return <span className="text-[13px] font-bold tracking-[0.06em] text-ink-3 uppercase">Postponed</span>;
  }
}

export function GameRow({ game }: { game: Game }) {
  const { match, prediction } = game;
  const final = game.status === "final";
  const tip = team(game.modelTip);
  const pct = Math.round(game.modelProb * 100);
  const upcoming = game.status === "upcoming";
  const inPlay = game.status === "live" || game.status === "awaiting";
  const shown = (actual: number | undefined, predicted: number) => (final ? actual! : upcoming ? predicted : null);
  return (
    <li>
      <Link
        href={`/match/${match.id}`}
        className="group -mx-3 block rounded-lg px-3 py-3 transition-colors hover:bg-raised focus-visible:bg-raised"
      >
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="space-y-1">
              <TeamLine game={game} name={match.home} side="home" score={shown(match.homeScore, prediction.homePred)} />
              <TeamLine game={game} name={match.away} side="away" score={shown(match.awayScore, prediction.awayPred)} />
            </div>
            <div className="mt-2 flex items-center gap-2.5">
              <div className="flex-1">
                <PitchBar
                  home={match.home}
                  away={match.away}
                  homeProb={prediction.homeWinProb}
                  label={`Model: ${tip.name} ${pct}% to win`}
                />
              </div>
              <span className="shrink-0 text-right text-[12px] leading-none font-semibold text-ink-3">
                Model {tip.code} <span className="font-score text-[15px] text-ink-2">{pct}%</span>
              </span>
            </div>
          </div>
          <div className="flex w-[64px] shrink-0 justify-end pt-1">
            <Status game={game} />
          </div>
        </div>

        {(final || inPlay || game.featured || prediction.updated || prediction.model === "no odds") && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-medium text-ink-3">
            {(final || inPlay) && (
              <span>
                Model {final ? "said" : "says"} {tip.code} by {game.callMargin}
              </span>
            )}
            {game.featured && <span className="font-semibold text-ink-2">Margin game</span>}
            {prediction.updated && !final && (
              <span className="flex items-center gap-1 text-live">
                <RefreshCw className="size-3" strokeWidth={2.5} aria-hidden />
                Updated: {prediction.updated}
              </span>
            )}
            {prediction.model === "no odds" && <span>No odds yet: model without odds</span>}
          </div>
        )}
      </Link>
    </li>
  );
}
