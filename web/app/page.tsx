import { GameRow } from "@/components/game-row";
import {
  EmptyState,
  FeaturedGame,
  ModelRecordStrip,
  RecapPanel,
  RoundHeading,
  TippingStrip,
} from "@/components/home-sections";
import { SampleBar, type SampleState } from "@/components/sample-bar";
import { ladderBefore } from "@/lib/ladder";
import { buildRound } from "@/lib/round";
import { liveHome, type LiveHome } from "@/lib/source";
import {
  margins,
  modelRecord,
  NEXT_ROUND,
  round10,
  SAMPLE_NOW,
  tippers,
  tips,
  YOU_ID,
  YOUR_EARLY_TIP_COUNT,
} from "@/lib/sample";

const STATES: SampleState[] = ["recap", "open", "live", "pending", "offseason", "error"];


export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const live = await liveHome(new Date());
  if (live) return <LiveHomePage live={live} />;
  const state: SampleState = STATES.includes(params.state as SampleState) ? (params.state as SampleState) : "open";
  const signedIn = params.as !== "guest";

  if (state === "pending" || state === "offseason" || state === "error") {
    return (
      <main>
        <EmptyState kind={state} />
        <ModelRecordStrip record={modelRecord} />
        <SampleBar state={state} signedIn={signedIn} />
      </main>
    );
  }

  const nowIso = SAMPLE_NOW[state];
  const view = buildRound({
    data: round10,
    now: new Date(nowIso),
    tips,
    tippers,
    ladderBefore: ladderBefore(round10.round),
    youId: signedIn ? YOU_ID : undefined,
    yourTipLimit: state === "open" ? YOUR_EARLY_TIP_COUNT : undefined,
  });
  const tipsBy = (id: string) => view.games.map((g) => tips.find((t) => t.tipperId === id && t.matchId === g.match.id)?.team);

  if (view.phase === "recap") {
    return (
      <main>
        <RecapPanel view={view} signedIn={signedIn} tipsBy={tipsBy} nextRound={NEXT_ROUND} />
        <h2 className="mt-9 mb-1 font-display text-[24px] leading-none font-bold uppercase">Results</h2>
        <ul className="divide-y divide-line-soft">
          {view.games.map((g) => (
            <GameRow key={g.match.id} game={g} />
          ))}
        </ul>
        <ModelRecordStrip record={modelRecord} />
        <SampleBar state={state} signedIn={signedIn} />
      </main>
    );
  }

  const others = view.games.filter((g) => !g.featured);
  return (
    <main>
      <RoundHeading view={view} />
      {signedIn && <TippingStrip view={view} nowIso={nowIso} />}
      <FeaturedGame game={view.featured} yourMargin={view.featured.yourTip ? margins.find((m) => m.tipperId === YOU_ID)?.margin : undefined} />
      <h2 className="sr-only">Other games</h2>
      <ul className="mt-2 divide-y divide-line-soft">
        {others.map((g) => (
          <GameRow key={g.match.id} game={g} />
        ))}
      </ul>
      <ModelRecordStrip record={modelRecord} />
      <SampleBar state={state} signedIn={signedIn} />
    </main>
  );
}

/** The home page from the database. The tipping strip and the viewer's tips come with sign-in (step 10). */
function LiveHomePage({ live }: { live: LiveHome }) {
  if (live.kind === "offseason") {
    return (
      <main>
        <EmptyState kind="offseason" />
        {live.record && <ModelRecordStrip record={live.record} />}
      </main>
    );
  }
  const view = buildRound({ data: live.round, now: new Date(), tips: [], tippers: [], ladderBefore: [] });
  const others = view.games.filter((g) => !g.featured);
  const done = view.games.every((g) => g.status === "final");
  return (
    <main>
      <RoundHeading view={view} />
      {done && live.recap && <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">{live.recap}</p>}
      <FeaturedGame game={view.featured} />
      <h2 className="sr-only">Other games</h2>
      <ul className="mt-2 divide-y divide-line-soft">
        {others.map((g) => (
          <GameRow key={g.match.id} game={g} />
        ))}
      </ul>
      {live.record && <ModelRecordStrip record={live.record} />}
    </main>
  );
}
