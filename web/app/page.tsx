import { GameRow, WeatherCredit } from "@/components/game-row";
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
import type { RoundComp } from "@/lib/comp";
import { GroupSwitcher } from "@/components/group-switcher";
import { Dashboard } from "@/components/dashboard";
import { todos } from "@/lib/dashboard";
import { dashboardComps } from "@/lib/dashboard-data";
import { choiceOf, sampleGroups } from "@/lib/groups-server";
import { liveHome, viewerRoundComp, type LiveHome } from "@/lib/source";
import {
  margins,
  MODEL_ID,
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
  if (live) {
    const comp = live.kind === "round" ? await viewerRoundComp(live.round) : null;
    // A signed-in tipper in a comp season gets their week at a glance; anyone else the round.
    if (live.kind === "round" && comp) return <LiveDashboard live={live} comp={comp} />;
    return <LiveHomePage live={live} comp={comp} />;
  }
  const state: SampleState = STATES.includes(params.state as SampleState) ? (params.state as SampleState) : "open";
  const signedIn = params.as !== "guest";

  if (state === "pending" || state === "offseason" || state === "error") {
    return (
      <main>
        {/* The sample's off-season looks back at its latest replayed round. */}
        <EmptyState kind={state} lastRound={state === "offseason" ? { season: round10.season, round: round10.round } : undefined} />
        <ModelRecordStrip record={modelRecord} />
        <SampleBar state={state} signedIn={signedIn} />
      </main>
    );
  }

  const nowIso = SAMPLE_NOW[state];
  if (signedIn) return <SampleDashboard state={state} group={params.group} />;
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
        <RecapPanel view={view} signedIn={signedIn} youId={YOU_ID} tipsBy={tipsBy} nextRound={NEXT_ROUND} />
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
      {signedIn && <TippingStrip view={view} nowIso={nowIso} youId={YOU_ID} />}
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

/** The dashboard from the database: the round as the viewer's group sees it, and their other comps. */
async function LiveDashboard({ live, comp }: { live: Extract<LiveHome, { kind: "round" }>; comp: RoundComp }) {
  const now = new Date();
  const view = buildRound({ data: live.round, now, tips: comp.tips, tippers: comp.tippers, ladderBefore: comp.ladderBefore, youId: comp.youId });
  const { lms, dallyM } = await dashboardComps();
  const items = todos({ view, now, yourMargin: comp.yourMargin, lms: lms?.todo ?? null, dallyM: dallyM?.todo ?? null });
  return (
    <main>
      <Dashboard view={view} items={items} youId={comp.youId} lms={lms} dallyM={dallyM} groups={comp.groups} />
      {live.record && <ModelRecordStrip record={live.record} />}
    </main>
  );
}

/** The sample's dashboard: the sample week as Sully sees it, kept to a sample group when one is chosen. */
async function SampleDashboard({ state, group }: { state: "open" | "live" | "recap"; group?: string }) {
  const now = new Date(SAMPLE_NOW[state]);
  const g = await sampleGroups(group);
  const inGroup = (id: string) => !g.memberIds || g.memberIds.has(id) || id === MODEL_ID;
  const view = buildRound({
    data: round10,
    now,
    tips: tips.filter((t) => inGroup(t.tipperId)),
    tippers: tippers.filter((t) => inGroup(t.id)),
    ladderBefore: ladderBefore(round10.round).filter((r) => inGroup(r.tipperId)),
    youId: YOU_ID,
    yourTipLimit: state === "open" ? YOUR_EARLY_TIP_COUNT : undefined,
  });
  const yourMargin = view.featured.yourTip ? margins.find((m) => m.tipperId === YOU_ID)?.margin : undefined;
  const { lms, dallyM } = await dashboardComps(group);
  const items = todos({ view, now, yourMargin, lms: lms?.todo ?? null, dallyM: dallyM?.todo ?? null });
  return (
    <main>
      <Dashboard view={view} items={items} youId={YOU_ID} lms={lms} dallyM={dallyM} groups={choiceOf(g)} />
      <ModelRecordStrip record={modelRecord} />
      <SampleBar state={state} signedIn />
    </main>
  );
}

/** The home page from the database. For a signed-in tipper in a comp season, their tips, the tipping
 * strip and, once the round is over, the round's scores; otherwise the round as anyone sees it. */
function LiveHomePage({ live, comp }: { live: LiveHome; comp: RoundComp | null }) {
  if (live.kind === "offseason") {
    return (
      <main>
        <EmptyState kind="offseason" lastRound={live.lastRound ?? undefined} />
        {live.record && <ModelRecordStrip record={live.record} />}
      </main>
    );
  }
  const now = new Date();
  const view = buildRound({
    data: live.round, now, tips: comp?.tips ?? [], tippers: comp?.tippers ?? [], ladderBefore: comp?.ladderBefore ?? [],
    youId: comp?.youId,
  });
  const others = view.games.filter((g) => !g.featured);
  const done = view.games.every((g) => g.status === "final");
  const recap = live.recap && <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">{live.recap}</p>;

  if (comp && view.phase === "recap") {
    const tipsBy = (id: string) => view.games.map((g) => comp.tips.find((t) => t.tipperId === id && t.matchId === g.match.id)?.team);
    return (
      <main>
        {comp.groups && <GroupSwitcher choice={comp.groups} />}
        <RecapPanel view={view} signedIn youId={comp.youId} tipsBy={tipsBy} />
        {recap}
        <h2 className="mt-9 mb-1 font-display text-[24px] leading-none font-bold uppercase">Results</h2>
        <ul className="divide-y divide-line-soft">
          {view.games.map((g) => (
            <GameRow key={g.match.id} game={g} />
          ))}
        </ul>
        <WeatherCredit games={view.games} />
        {live.record && <ModelRecordStrip record={live.record} />}
      </main>
    );
  }

  return (
    <main>
      <RoundHeading view={view} />
      {comp && <TippingStrip view={view} nowIso={now.toISOString()} youId={comp.youId} />}
      {done && recap}
      <FeaturedGame game={view.featured} yourMargin={view.featured.yourTip ? comp?.yourMargin : undefined} />
      <h2 className="sr-only">Other games</h2>
      <ul className="mt-2 divide-y divide-line-soft">
        {others.map((g) => (
          <GameRow key={g.match.id} game={g} />
        ))}
      </ul>
      <WeatherCredit games={others} />
      {live.record && <ModelRecordStrip record={live.record} />}
    </main>
  );
}
