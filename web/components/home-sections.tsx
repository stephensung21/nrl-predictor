import Link from "next/link";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Clock, RotateCw, X } from "lucide-react";
import { emptyCopy, modelRoundLine, perfectLine, roastLine, vsModelLine } from "@/lib/copy";
import { ordinal, type Game, type RoundView, type Standing } from "@/lib/round";
import type { ModelRecord } from "@/lib/types";
import { YOU_ID } from "@/lib/sample";
import { team } from "@/lib/teams";
import { LocalTime } from "./local-time";
import { PitchBar } from "./pitch-bar";
import { ModelBadge, TeamBadge } from "./team-badge";

/* ---------- Round heading ---------- */

export type RoundLink = { href: string; round: number };

export function StepLink({ to, dir }: { to?: RoundLink; dir: "prev" | "next" }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  const cls = "grid size-10 place-items-center rounded-full ring-1 ring-line ring-inset";
  if (!to) return <span className={`${cls} text-ink-3/40`} aria-hidden><Icon className="size-5" /></span>;
  return (
    <Link href={to.href} aria-label={`Round ${to.round}`} className={`${cls} text-ink-2 transition-colors hover:text-ink hover:ring-ink-3`}>
      <Icon className="size-5" aria-hidden />
    </Link>
  );
}

export function RoundHeading({ view, title, prev, next }: { view: RoundView; title?: string; prev?: RoundLink; next?: RoundLink }) {
  const stepper = prev !== undefined || next !== undefined;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-4 pb-3">
      <div className={stepper ? "flex flex-col gap-1" : "contents"}>
      <h1 className="font-display text-[26px] leading-none font-bold tracking-[0.005em] uppercase">
        {title ?? `Round ${view.round}`}
      </h1>
      <p className="text-[13px] font-medium text-ink-3">
        <LocalTime iso={view.firstKickoff} format="day" /> – <LocalTime iso={view.lastKickoff} format="day" />
        <span className="mx-1.5" aria-hidden>
          ·
        </span>
        {view.games.length} games
      </p>
      </div>
      {stepper && (
        <nav aria-label="Rounds" className="flex gap-2">
          <StepLink to={prev} dir="prev" />
          <StepLink to={next} dir="next" />
        </nav>
      )}
    </div>
  );
}

/* ---------- Tipping strip (signed in only) ---------- */

function StandingLine({ you, leader, model, seed }: { you: Standing; leader: Standing; model: Standing; seed: number }) {
  const gap = leader.points - you.points;
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-[13px] leading-snug">
      <span className="shrink-0 font-semibold whitespace-nowrap text-ink">
        <span className="font-score text-[17px]">{ordinal(you.position)}</span>
        <span className="text-ink-3"> · </span>
        {gap === 0 ? "Top of the ladder" : `${gap} pt${gap === 1 ? "" : "s"} off the lead`}
      </span>
      <span className="text-right text-ink-2">{vsModelLine(you.points - model.points, seed)}</span>
    </div>
  );
}

export function TippingStrip({ view, nowIso }: { view: RoundView; nowIso: string }) {
  const you = view.ladder.find((s) => s.tipper.id === YOU_ID)!;
  const model = view.ladder.find((s) => s.tipper.isModel)!;
  const leader = view.ladder[0];
  const open = view.games.filter((g) => g.status === "upcoming");
  const tipped = view.games.filter((g) => g.yourTip).length;
  const missing = open.filter((g) => !g.yourTip).length;
  const nextLock = open.find((g) => new Date(g.match.kickoff) > new Date(nowIso));

  if (view.phase === "live") {
    const graded = view.games.filter((g) => g.status === "final");
    const right = graded.filter((g) => g.yourCorrect).length;
    return (
      <section aria-label="Your round" className="overflow-hidden rounded-xl border border-line bg-raised">
        <Link href="/tipping" className="group flex items-center justify-between gap-3 px-4 pt-4 pb-3.5">
          <p className="font-display text-[30px] leading-[0.92] font-bold text-balance uppercase">
            This round:{" "}
            <span className="font-score">
              {right}/{graded.length}
            </span>{" "}
            correct so far
          </p>
          <ChevronRight className="size-5 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
        <div className="border-t border-line-soft">
          <StandingLine you={you} leader={leader} model={model} seed={view.round} />
        </div>
      </section>
    );
  }

  const loud = missing > 0;
  return (
    <section aria-label="Your tips" className="overflow-hidden rounded-xl border border-line bg-raised">
      <Link
        href="/tipping"
        className={`group flex items-center justify-between gap-3 px-4 pt-3.5 pb-3.5 transition-colors ${loud ? "bg-lime text-lime-ink hover:bg-[oklch(0.94_0.19_126)]" : ""}`}
      >
        <div className="min-w-0">
          <p className="font-display text-[56px] leading-[0.86] font-extrabold uppercase">
            <span className="font-score">{tipped}</span> of <span className="font-score">{view.games.length}</span> tipped
          </p>
          <p className={`mt-1.5 text-[14px] font-semibold ${loud ? "text-lime-ink/80" : "text-ink-2"}`}>
            {nextLock ? (
              <>
                Next lockout: <LocalTime iso={nextLock.match.kickoff} />
              </>
            ) : (
              "All games locked"
            )}
          </p>
        </div>
        {loud ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-lime-ink px-4 py-2.5 text-[14px] font-bold text-lime">
            Tip {missing}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} aria-hidden />
          </span>
        ) : (
          <Check className="size-7 shrink-0 text-lime" strokeWidth={2.5} aria-label="All tipped" />
        )}
      </Link>
      <StandingLine you={you} leader={leader} model={model} seed={view.round} />
    </section>
  );
}

/* ---------- Featured (margin) game ---------- */

export function FeaturedGame({ game, yourMargin }: { game: Game; yourMargin?: number }) {
  const { match, prediction } = game;
  const final = game.status === "final";
  const tip = team(game.modelTip);
  const homePct = Math.round(prediction.homeWinProb * 100);
  const upcoming = game.status === "upcoming";
  const inPlay = game.status === "live" || game.status === "awaiting";
  const homeScore = final ? match.homeScore! : prediction.homePred;
  const awayScore = final ? match.awayScore! : prediction.awayPred;

  return (
    <section aria-label="Margin game" className="mt-3 overflow-hidden rounded-xl border border-line bg-raised">
      <Link href={`/match/${match.id}`} className="block px-4 pt-4 pb-4 transition-colors hover:bg-raised-2/50">
        <p className="truncate text-[13px] font-medium text-ink-3">
          Margin game
          <span className="mx-1.5">·</span>
          {game.status === "upcoming" ? <LocalTime iso={match.kickoff} /> : game.status === "live" ? "Live now" : "Full time"}
          <span className="mx-1.5">·</span>
          {match.venue}
        </p>

        <div className="mt-2.5 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[30px] leading-none font-bold uppercase">
            {final ? (game.winners!.length === 2 ? "Draw" : `${game.winners![0]} won`) : `${tip.name} by ${game.callMargin}`}
          </h2>
          {game.yourTip && (
            <span
              className={`flex shrink-0 items-center gap-1 text-[13px] font-semibold ${game.yourCorrect === true ? "text-lime" : game.yourCorrect === false ? "text-miss line-through decoration-2" : "text-ink"}`}
            >
              {game.yourCorrect === true && <Check className="tick-pop size-4" strokeWidth={3} aria-label="Correct" />}
              {game.yourCorrect === false && <X className="size-4" strokeWidth={3} aria-label="Wrong" />}
              <span className="font-medium text-ink-3">Your tip:</span>
              {game.yourTip}
              {yourMargin != null && <> by <span className="font-score text-[15px]">{yourMargin}</span></>}
            </span>
          )}
        </div>
        {(final || inPlay) && (
          <p className={`mt-1.5 flex items-center gap-1 text-[13px] font-semibold ${game.modelCorrect ? "text-ink-2" : "text-ink-3"}`}>
            {final && (game.modelCorrect ? <Check className="size-3.5" strokeWidth={2.5} aria-hidden /> : <X className="size-3.5" strokeWidth={2.5} aria-hidden />)}
            Model {final ? "said" : "says"} {tip.name} by {game.callMargin}
          </p>
        )}

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex flex-col items-start gap-1.5">
            <TeamBadge name={match.home} size="lg" />
            <span className="text-[14px] font-semibold text-ink-2">{match.home}</span>
          </div>
          {inPlay ? (
            <p className="font-score text-[48px] leading-none font-bold text-ink-3" aria-label="Score not in yet">
              – –
            </p>
          ) : (
            <div className="flex flex-col items-center">
              <p
                className={`font-score text-[48px] leading-none tracking-[-0.01em] ${final ? "font-bold" : "font-semibold"}`}
                aria-label={`${final ? "Final score" : "Model's predicted score"}: ${match.home} ${homeScore}, ${match.away} ${awayScore}`}
              >
                <span className={homeScore >= awayScore ? (final ? "text-ink" : "text-ink-2") : "text-ink-3"}>{homeScore}</span>
                <span className="mx-1.5 text-ink-3">–</span>
                <span className={awayScore >= homeScore ? (final ? "text-ink" : "text-ink-2") : "text-ink-3"}>{awayScore}</span>
              </p>
              {upcoming && <span className="mt-1 text-[12px] font-medium text-ink-3">Model&rsquo;s score</span>}
            </div>
          )}
          <div className="flex flex-col items-end gap-1.5">
            <TeamBadge name={match.away} size="lg" />
            <span className="text-[14px] font-semibold text-ink-2">{match.away}</span>
          </div>
        </div>

        <div className="mt-3">
          <PitchBar
            home={match.home}
            away={match.away}
            homeProb={prediction.homeWinProb}
            size="lg"
            label={`Model: ${match.home} ${homePct}% to win, ${match.away} ${100 - homePct}%`}
          />
          <div className="mt-1 flex justify-between font-score text-[17px] font-semibold">
            <span className={homePct >= 50 ? "text-ink" : "text-ink-3"}>{homePct}%</span>
            <span className="font-sans text-[12px] font-medium text-ink-3">win chance</span>
            <span className={homePct < 50 ? "text-ink" : "text-ink-3"}>{100 - homePct}%</span>
          </div>
        </div>
      </Link>

    </section>
  );
}

/* ---------- The Model's season record ---------- */

export function ModelRecordStrip({ record }: { record: ModelRecord }) {
  const pct = (n: number) => Math.round((n / record.games) * 100);
  return (
    <section aria-label="The Model's record" className="mt-8 border-y border-line-soft py-4">
      <div className="flex items-center gap-2.5">
        <ModelBadge size="sm" />
        <h2 className="text-[15px] font-semibold">The Model&rsquo;s record</h2>
        <span className="ml-auto text-[12px] font-medium text-ink-3">{record.label}</span>
      </div>
      <dl className="mt-3.5 grid grid-cols-3 gap-3 text-[12px] leading-tight text-ink-3">
        <div>
          <dt>Tips correct</dt>
          <dd className="mt-1 font-score text-[22px] font-bold text-ink">
            {record.correct}
            <span className="text-ink-3">/{record.games}</span>
          </dd>
          <dd className="mt-0.5 font-semibold text-ink-2">{pct(record.correct)}%</dd>
        </div>
        <div>
          <dt>Bookies&rsquo; favourite</dt>
          <dd className="mt-1 font-score text-[22px] font-bold text-ink-2">
            {record.favouriteCorrect}
            <span className="text-ink-3">/{record.games}</span>
          </dd>
          <dd className="mt-0.5 font-semibold text-ink-3">{pct(record.favouriteCorrect)}%</dd>
        </div>
        <div>
          <dt>Margin miss</dt>
          <dd className="mt-1 font-score text-[22px] font-bold text-ink-2">{record.marginError.toFixed(1)}</dd>
          <dd className="mt-0.5 font-semibold text-ink-3">points a game</dd>
        </div>
      </dl>
      <Link href="/about" className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-2 underline decoration-line hover:text-ink">
        How the Model works
        <ChevronRight className="size-3.5" aria-hidden />
      </Link>
    </section>
  );
}

/* ---------- Recap ---------- */

function Lamps({ results, chase }: { results: boolean[]; chase: boolean }) {
  return (
    <span className={`flex gap-[3px] ${chase ? "lamp-chase" : ""}`} aria-hidden>
      {results.map((r, i) => (
        <span
          key={i}
          style={{ ["--i" as string]: i }}
          className={`size-[11px] rounded-[2px] ${r ? "bg-lime" : "bg-raised-2 ring-1 ring-line ring-inset"}`}
        />
      ))}
    </span>
  );
}

export function RecapPanel({
  view,
  signedIn,
  tipsBy,
  nextRound,
  heading = true,
}: {
  view: RoundView;
  signedIn: boolean;
  tipsBy: (tipperId: string) => (string | undefined)[];
  nextRound?: { round: number; predictionsDue: string };
  /** The round page draws its own heading with round steppers. */
  heading?: boolean;
}) {
  const n = view.games.length;
  const modelScore = view.games.filter((g) => g.modelCorrect).length;
  const scores = view.ladder
    .map((s) => ({ s, score: s.roundCorrect }))
    .sort((a, b) => b.score - a.score || a.s.position - b.s.position);
  const humans = scores.filter((x) => !x.s.tipper.isModel);
  const lowest = humans.at(-1)!;
  const perfect = humans.filter((x) => x.score === n).map((x) => x.s.tipper.name);
  // What tipping every home team would have scored, so the roast never lies.
  const homeTeamScore = view.games.filter((g) => g.winners?.includes(g.match.home)).length;
  /** This round's placing among the tippers (the Model isn't ranked); "=" marks a tie. */
  const placing = (score: number) => {
    const tied = humans.filter((x) => x.score === score).length > 1;
    return `${tied ? "=" : ""}${ordinal(1 + humans.filter((x) => x.score > score).length)}`;
  };

  return (
    <section aria-label={`Round ${view.round} recap`}>
      {heading && (
        <div className="pt-7 pb-5">
          <h1 className="font-display text-[46px] leading-[0.9] font-bold uppercase">Round {view.round} wrap</h1>
          <p className="mt-2 text-[14px] font-medium text-ink-3">All {n} games graded</p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-raised">
        <div className="space-y-1.5 px-4 pt-4 pb-4">
          {signedIn && (
            <p
              className={`font-display text-[28px] leading-[0.95] font-bold uppercase ${perfect.length ? "text-lime" : "text-ink"}`}
            >
              {perfectLine(perfect, n, view.round)}
            </p>
          )}
          <p className="text-[16px] font-semibold text-ink">
            {signedIn ? modelRoundLine(modelScore, n, { name: lowest.s.tipper.name, score: lowest.score }) : `The Model went ${modelScore}/${n}.`}
          </p>
          {signedIn && <p className="text-[14px] text-ink-2">{roastLine(lowest.s.tipper.name, lowest.score, homeTeamScore, view.round)}</p>}
        </div>

        {signedIn && (
          <ol className="border-t border-line-soft">
            {scores.map(({ s, score }) => {
              const you = s.tipper.id === YOU_ID;
              const results = view.games.map((g, i) => {
                const t = tipsBy(s.tipper.id)[i];
                return !!t && g.winners!.includes(t as never);
              });
              return (
                <li
                  key={s.tipper.id}
                  className={`flex items-center gap-3 border-b border-line-soft px-4 py-2.5 last:border-b-0 ${
                    you ? "bg-lime-wash" : s.tipper.isModel ? "bg-raised-2" : ""
                  }`}
                >
                  <span className="w-[38px] shrink-0">
                    {s.tipper.isModel ? (
                      <ModelBadge size="sm" />
                    ) : (
                      <span className="font-score text-[15px] font-semibold text-ink-3">
                        {placing(score)}
                      </span>
                    )}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-[15px] ${you || s.tipper.isModel ? "font-semibold text-ink" : "text-ink-2"}`}>
                    {s.tipper.isModel ? "The Model" : s.tipper.name}
                    {you && <span className="ml-1.5 text-[12px] font-bold text-lime uppercase">You</span>}
                  </span>
                  <Lamps results={results} chase={score === n} />
                  <span className="w-11 text-right font-score text-[19px] font-bold">
                    {score}
                    <span className="text-[14px] text-ink-3">/{n}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {nextRound && (
      <p className="mt-4 flex items-center gap-2 text-[14px] text-ink-2">
        <Clock className="size-4 shrink-0 text-ink-3" aria-hidden />
        <span>
          Round {nextRound.round} predictions land <LocalTime iso={nextRound.predictionsDue} format="day" />, about{" "}
          <LocalTime iso={nextRound.predictionsDue} format="time" />.
        </span>
      </p>
      )}
    </section>
  );
}

/* ---------- Empty and error states ---------- */

export function EmptyState({ kind }: { kind: keyof typeof emptyCopy }) {
  const c = emptyCopy[kind];
  return (
    <section className="pt-16 pb-8" aria-live={kind === "error" ? "polite" : undefined}>
      <h1 className="font-display text-[52px] leading-[0.9] font-bold uppercase">{c.title}</h1>
      <p className="mt-4 max-w-[34ch] text-[16px] leading-relaxed text-ink-2">{c.body}</p>
      {kind === "error" ? (
        <a
          href="?state=error"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-lime px-5 py-3 text-[15px] font-bold text-lime-ink hover:bg-[oklch(0.94_0.19_126)]"
        >
          <RotateCw className="size-4" strokeWidth={2.5} aria-hidden />
          Try again
        </a>
      ) : (
        <Link href="/elo" className="mt-6 inline-flex items-center gap-1 text-[15px] font-semibold text-ink underline decoration-line">
          Look at the Elo ratings instead
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
    </section>
  );
}
