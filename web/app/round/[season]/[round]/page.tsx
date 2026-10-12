import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameRow, WeatherCredit } from "@/components/game-row";
import { RecapPanel, RoundHeading, StepLink } from "@/components/home-sections";
import { SampleNote } from "@/components/sample-note";
import { emptyCopy } from "@/lib/copy";
import { CURRENT_ROUND, SAMPLE_ROUNDS, sampleRoundView } from "@/lib/match";
import { buildRound } from "@/lib/round";
import { YOU_ID } from "@/lib/sample";
import type { RoundComp } from "@/lib/comp";
import { liveRound, liveRoundTitle, viewerRoundComp, type LiveRound } from "@/lib/source";

const SEASON = 2026;
const LAST_ROUND = 27;

type Props = { params: Promise<{ season: string; round: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const [season, round] = [Number(p.season), Number(p.round)];
  const live = Number.isInteger(season) && Number.isInteger(round) ? await liveRoundTitle(season, round) : null;
  return { title: `${live ?? `Round ${p.round}`} · rugbyleague-tipper` };
}

/** Rounds with a page worth stepping to: the sample rounds, then the next one (not predicted yet). */
const STEPS = [...SAMPLE_ROUNDS.map((r) => r.data.round), CURRENT_ROUND + 1];
const link = (round?: number) => (round == null ? undefined : { round, href: `/round/${SEASON}/${round}` });

export default async function RoundPage({ params }: Props) {
  const p = await params;
  const season = Number(p.season);
  const round = Number(p.round);
  if (!Number.isInteger(season) || !Number.isInteger(round)) notFound();
  const live = await liveRound(season, round);
  if (live === null) notFound();
  if (live) return <LiveRoundPage live={live} comp={await viewerRoundComp(live.round)} />;
  if (season !== SEASON || !Number.isInteger(round) || round < 1 || round > LAST_ROUND) notFound();

  const prev = link(STEPS.filter((r) => r < round).at(-1));
  const next = link(STEPS.find((r) => r > round));
  const sample = SAMPLE_ROUNDS.find((r) => r.data.round === round);

  if (!sample) {
    const future = round > CURRENT_ROUND;
    return (
      <main>
        <div className="flex items-center justify-between gap-3 pt-4 pb-3">
          <h1 className="font-display text-[26px] leading-none font-bold uppercase">Round {round}</h1>
          <nav aria-label="Rounds" className="flex gap-2">
            <StepLink to={prev} dir="prev" />
            <StepLink to={next} dir="next" />
          </nav>
        </div>
        <section className="pt-10 pb-4">
          <p className="font-display text-[40px] leading-[0.92] font-bold uppercase">
            {future ? (round === CURRENT_ROUND + 1 ? emptyCopy.pending.title : "Not predicted yet.") : "No sample for this round."}
          </p>
          <p className="mt-4 max-w-[34ch] text-[16px] leading-relaxed text-ink-2">
            {future
              ? round === CURRENT_ROUND + 1
                ? emptyCopy.pending.body
                : "The Model predicts one round at a time, on the Tuesday team lists come out."
              : "The sample only has rounds 3, 5 and 10. Once the pipeline publishes, every round will be here."}
          </p>
        </section>
        <SampleNote>The site runs on the 2026 replays of rounds 3, 5 and 10 until the pipeline publishes real rounds.</SampleNote>
      </main>
    );
  }

  const view = sampleRoundView(sample);
  const tipsBy = (id: string) => view.games.map((g) => sample.tips.find((t) => t.tipperId === id && t.matchId === g.match.id)?.team);

  return (
    <main>
      <RoundHeading view={view} prev={prev} next={next} />
      <RecapPanel view={view} signedIn youId={YOU_ID} tipsBy={tipsBy} heading={false} />
      <h2 className="mt-9 mb-1 font-display text-[24px] leading-none font-bold uppercase">Results</h2>
      <ul className="divide-y divide-line-soft">
        {view.games.map((g) => (
          <GameRow key={g.match.id} game={g} />
        ))}
      </ul>
      <SampleNote>
        The real 2026 Round {round} replay: Tuesday predictions and the actual results. Tippers, tips and the ladder are made up.
      </SampleNote>
    </main>
  );
}


/** A round from the database: every game's prediction of record and, once played, its result. For a
 * signed-in tipper in a comp season, their tips on each game and, once the round is over, everyone's
 * scores for it. */
function LiveRoundPage({ live, comp }: { live: LiveRound; comp: RoundComp | null }) {
  const { season, round } = live.round;
  const view = buildRound({
    data: live.round, now: new Date(), tips: comp?.tips ?? [], tippers: comp?.tippers ?? [],
    ladderBefore: comp?.ladderBefore ?? [], youId: comp?.youId,
  });
  const to = (r?: LiveRound["rounds"][number]) =>
    r == null ? undefined : { round: r.round, title: r.title ?? undefined, href: `/round/${season}/${r.round}` };
  const prev = to(live.rounds.filter((r) => r.round < round).at(-1));
  const next = to(live.rounds.find((r) => r.round > round));
  const done = view.games.filter((g) => g.status === "final");
  const tipsBy = (id: string) => view.games.map((g) => comp?.tips.find((t) => t.tipperId === id && t.matchId === g.match.id)?.team);
  return (
    <main>
      <RoundHeading view={view} prev={prev} next={next} />
      {comp && view.phase === "recap" ? (
        <RecapPanel view={view} signedIn youId={comp.youId} tipsBy={tipsBy} heading={false} />
      ) : (
        done.length > 0 && (
          <p className="mt-1 text-[15px] text-ink-2">
            The Model tipped {done.filter((g) => g.modelCorrect).length} of {done.length}
            {done.length < view.games.length ? " so far" : ""}
            {comp && `; you ${done.filter((g) => g.yourCorrect).length}`}.
          </p>
        )
      )}
      {live.recap && <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">{live.recap}</p>}
      <h2 className="mt-9 mb-1 font-display text-[24px] leading-none font-bold uppercase">{done.length ? "Results" : "Games"}</h2>
      <ul className="divide-y divide-line-soft">
        {view.games.map((g) => (
          <GameRow key={g.match.id} game={g} />
        ))}
      </ul>
      <WeatherCredit games={view.games} />
    </main>
  );
}
