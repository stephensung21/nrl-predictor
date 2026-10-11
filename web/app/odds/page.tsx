import type { Metadata } from "next";
import Link from "next/link";
import { StepLink } from "@/components/home-sections";
import { LocalTime } from "@/components/local-time";
import { BIG_GAP, EdgeRow, gapOf, OddsGameRow, TrackKey } from "@/components/odds-sections";
import { SampleNote } from "@/components/sample-note";
import { Calibration, ProfitChart, TipsVsMarketChart } from "@/components/season-charts";
import { calibration, profitCurve, SERIES, tipsCorrect, tipsVsMarket } from "@/lib/odds";
import { oddsSource, type OddsSource } from "@/lib/source";
import type { Edge } from "@/lib/types";

export const metadata: Metadata = { title: "Model vs market · rugbyleague-tipper" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

/** Data pages get a wider column on desktop (DESIGN_BRIEF.md). */
const WIDE = "md:relative md:left-1/2 md:w-[min(60rem,calc(100vw-4rem))] md:-translate-x-1/2";

export default async function OddsPage({ searchParams }: Props) {
  const q = await searchParams;
  const tab = q.tab === "season" ? "season" : "round";
  const src = await oddsSource();

  return (
    <main className={WIDE}>
      <div className="pt-4">
        <h1 className="font-display text-[26px] leading-none font-bold uppercase">Model vs market</h1>
        <p className="mt-2 max-w-[60ch] text-[13px] leading-snug text-ink-2">
          This Model ignores the bookies&rsquo; prices, so it&rsquo;s independent of them. The Round page uses the Model with odds.
        </p>
      </div>

      <nav aria-label="Model vs market" className="mt-4 flex gap-1 border-b border-line">
        {(
          [
            ["round", "This round", "/odds"],
            ["season", "Season", "/odds?tab=season"],
          ] as const
        ).map(([t, label, href]) => (
          <Link
            key={t}
            href={href}
            aria-current={tab === t ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2.5 text-[14px] font-semibold transition-colors ${
              tab === t ? "border-lime text-ink" : "border-transparent text-ink-3 hover:text-ink-2"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "round" ? <RoundTab q={q} src={src} /> : <SeasonTab src={src} />}

      <p className="mt-8 text-[12px] leading-relaxed text-ink-3">
        Odds:{" "}
        <a href="https://www.aussportsbetting.com/data/" className="underline hover:text-ink-2">
          aussportsbetting.com
        </a>{" "}
        historical NRL odds{src.live ? " and Betr's live prices from The Odds API" : ""} (
        {src.rounds[0]?.games.find((g) => g.bookmaker)?.bookmaker ?? "BlueBet"} prices), with the bookmaker&rsquo;s margin removed.
      </p>
    </main>
  );
}

function RoundTab({ q, src }: { q: Record<string, string | undefined>; src: OddsSource }) {
  const rounds = src.rounds;
  const coming = src.upcoming.length > 0 && q.round == null ? <ComingGames edges={src.upcoming} /> : null;
  if (!rounds.length) {
    return coming ?? <p className="pt-6 text-[15px] text-ink-2">No graded rounds yet this season.</p>;
  }
  const CURRENT = rounds.at(-1)!.round;
  const n = Number(q.round);
  const round = rounds.find((r) => r.round === n) ?? rounds.at(-1)!;
  // The sample's current round is viewed on Tuesday (opening prices only) unless you pick full time;
  // live, every round shown here is finished.
  const current = !src.live && round.round === CURRENT;
  const graded = !current || q.state === "recap";
  const prev = rounds.filter((r) => r.round < round.round).at(-1);
  const next = rounds.find((r) => r.round > round.round);
  const href = (r: number) => `/odds?round=${r}`;

  const priced = round.games.filter((g) => g.openHomeProb != null);
  const splits = priced.filter((g) => g.modelHomeProb >= 0.5 !== g.openHomeProb! >= 0.5).length;
  const big = priced.filter((g) => (gapOf(g) ?? 0) >= BIG_GAP).length;

  return (
    <>
    {coming}
    <section aria-label={`Round ${round.round}`} className={coming ? "mt-10" : undefined}>
      <div className="flex items-center justify-between gap-3 pt-4">
        <div>
          <h2 className="font-display text-[24px] leading-none font-bold uppercase">Round {round.round}</h2>
          <p className="mt-1 text-[13px] text-ink-3">{graded ? "Opening and closing prices, and results" : "Opening prices. Closing prices land at kickoff."}</p>
        </div>
        <nav aria-label="Rounds" className="flex gap-2">
          <StepLink to={prev && { round: prev.round, href: href(prev.round) }} dir="prev" />
          <StepLink to={next && { round: next.round, href: href(next.round) }} dir="next" />
        </nav>
      </div>

      <p className="mt-3 text-[15px] leading-snug font-semibold text-ink">
        {splits === 0
          ? "The Model and the opening price back the same team in every game."
          : `The Model and the opening price back different teams in ${splits} of ${priced.length} games.`}{" "}
        <span className="font-normal text-ink-2">
          {big === 0
            ? `None are ${BIG_GAP}% or more apart.`
            : `${big} ${big === 1 ? "is" : "are"} ${BIG_GAP}% or more apart.`}
        </span>
      </p>
      <div className="mt-3">
        <TrackKey graded={graded} />
      </div>

      <div>
        <ul className="mt-1 divide-y divide-line-soft md:grid md:grid-cols-2 md:gap-x-10 md:divide-y-0 md:[&>li]:border-b md:[&>li]:border-line-soft">
          {round.games.map((g) => (
            <OddsGameRow key={g.matchId} g={g} graded={graded} />
          ))}
        </ul>
      </div>

      {current && (
        <SampleNote
          states={[
            { href: `/odds?round=${CURRENT}`, label: "Tipping open · Tue 7:30pm", on: !graded },
            { href: `/odds?round=${CURRENT}&state=recap`, label: "Recap · Mon noon", on: graded },
          ]}
        >
          Real 2026 prices and Model numbers. Round {CURRENT} is the sample&rsquo;s current round.
        </SampleNote>
      )}
    </section>
    </>
  );
}

/** Games still to kick off: the Model's fair odds against Betr's latest price, and paper trading's bet. */
function ComingGames({ edges }: { edges: Edge[] }) {
  const rounds = [...new Set(edges.map((e) => e.round))];
  const latest = edges.map((e) => e.priceAt).filter((t): t is string => t != null).sort().at(-1);
  const bets = edges.filter((e) => e.bet).length;
  return (
    <section aria-labelledby="coming" className="pt-4">
      <h2 id="coming" className="font-display text-[24px] leading-none font-bold uppercase">
        {rounds.length === 1 ? `Round ${rounds[0]}` : "Coming up"}: prices
      </h2>
      <p className="mt-1 max-w-[60ch] text-[13px] leading-snug text-ink-3">
        Fair odds from the Model with odds (the Round page&rsquo;s Model), against Betr&rsquo;s latest price
        {latest ? (
          <>
            {" "}(<LocalTime iso={latest} />)
          </>
        ) : null}
        . Edge is the Model&rsquo;s chance times the price, minus one.
      </p>
      <p className="mt-3 text-[15px] leading-snug font-semibold text-ink">
        {latest == null
          ? "Betr hasn’t priced these games yet."
          : bets === 0
            ? "No paper bets: the Model doesn’t rate either side 2% better than Betr’s price in any game."
            : `Paper trading would back ${bets} of ${edges.length} games.`}{" "}
        <span className="font-normal text-ink-2">Paper bets are tracked, not placed.</span>
      </p>
      <ul className="mt-1 divide-y divide-line-soft md:grid md:grid-cols-2 md:gap-x-10 md:divide-y-0 md:[&>li]:border-b md:[&>li]:border-line-soft">
        {edges.map((e) => (
          <EdgeRow key={e.matchId} e={e} />
        ))}
      </ul>
    </section>
  );
}

function SeasonTab({ src }: { src: OddsSource }) {
  const tips = tipsCorrect(src.games);
  if (!tips.games) {
    return <p className="pt-6 text-[15px] text-ink-2">No graded games yet this season.</p>;
  }
  const vs = tipsVsMarket(src.games);
  const profit = profitCurve(src.bets);
  const cal = { model: calibration("model", src.games), market: calibration("market", src.games) };
  // Label the x-axis at the start of every sixth round, and the finals.
  const starts = vs
    .map((d, i) => ({ i, text: d.round, prev: vs[i - 1]?.round }))
    .filter((d) => d.text !== d.prev)
    .filter((d, k) => k % 6 === 0 || (/final/i.test(d.text) && !/final/i.test(d.prev ?? "")))
    .map((d) => ({ i: d.i, text: /final/i.test(d.text) ? "Finals" : d.text.replace("Round ", "R") }));
  const pctOf = (n: number) => Math.round((n / tips.games) * 100);

  return (
    <section aria-label={`${src.season} season`} className="pt-4">
      <h2 className="font-display text-[24px] leading-none font-bold uppercase">
        {src.season} {src.live ? "season" : "test season"}
      </h2>
      <p className="mt-1 text-[13px] text-ink-3">
        {tips.games} games (draws left out). The Model never saw any of them while it was being built.
      </p>

      <dl className="mt-4 grid grid-cols-3 border-y border-line-soft md:max-w-[40rem]">
        {(
          [
            ["model", tips.model],
            ["market", tips.market],
            ["elo", tips.elo],
          ] as const
        ).map(([k, n]) => (
          <div key={k} className="py-3 pr-2">
            <dt className="flex min-h-[2lh] items-start gap-1.5 text-[12px] leading-tight text-ink-3">
              <span className="mt-[0.45em] h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: SERIES[k].colour }} aria-hidden />
              {SERIES[k].label}
            </dt>
            <dd className="mt-1 font-display text-[30px] leading-none font-bold text-ink">
              {n}
              <span className="text-[16px] font-semibold text-ink-3">/{tips.games}</span>
            </dd>
            <dd className="mt-0.5 text-[12px] text-ink-3">{pctOf(n)}% tipped right</dd>
          </div>
        ))}
      </dl>

      <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-10">
        <section aria-labelledby="vs-market" className="mt-8">
          <h3 id="vs-market" className="text-[16px] font-semibold text-ink">
            Correct tips, compared with the bookies&rsquo; favourite
          </h3>
          <p className="mt-1 text-[13px] leading-snug text-ink-3">
            Above zero: ahead of just tipping the favourite. The lines never stray far, which is the honest answer: the market is
            hard to beat.
          </p>
          <TipsVsMarketChart data={vs} series={[SERIES.model, SERIES.elo].map((s, i) => ({ ...s, key: i ? "elo" : "model" }))} roundStarts={starts} />
        </section>

        <section aria-labelledby="calibration" className="mt-8">
          <h3 id="calibration" className="text-[16px] font-semibold text-ink">
            When it says 70%, do they win 70%?
          </h3>
          <p className="mt-1 text-[13px] leading-snug text-ink-3">
            Favourites grouped by the chance they were given, {cal.model.map((b) => b.n).join(", ")} games for the Model and{" "}
            {cal.market.map((b) => b.n).join(", ")} for the bookies. On the diagonal is perfectly calibrated.
          </p>
          <Calibration
            bins={cal}
            series={[
              { key: "model", label: SERIES.model.label, colour: SERIES.model.colour },
              { key: "market", label: "Bookies’ opening price", colour: SERIES.market.colour },
            ]}
          />
        </section>
      </div>

      <section aria-labelledby="bets" className="mt-8 md:max-w-[40rem]">
        <h3 id="bets" className="text-[16px] font-semibold text-ink">
          If you&rsquo;d bet it
        </h3>
        <p className="mt-1 text-[13px] leading-snug text-ink-3">
          $10 on the Model&rsquo;s team whenever it rated them at least 2% better value than the opening price.
        </p>
        <p className="mt-3 font-display text-[40px] leading-none font-bold text-ink">
          {profit.profit >= 0 ? "+" : "−"}${Number.isInteger(profit.profit) ? Math.abs(profit.profit) : Math.abs(profit.profit).toFixed(2)}
        </p>
        <p className="mt-1 text-[13px] text-ink-2">
          from {profit.bets} bets (${profit.staked} staked), {profit.won} won.
        </p>
        <ProfitChart data={profit.points} series={[{ key: "profit", label: "Running profit", colour: SERIES.model.colour }]} />
      </section>
    </section>
  );
}
