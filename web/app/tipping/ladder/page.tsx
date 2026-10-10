import type { Metadata } from "next";
import { ArrowDown, ArrowUp } from "lucide-react";
import { SampleNote } from "@/components/sample-note";
import { ModelBadge, TeamBadge } from "@/components/team-badge";
import { ladder as buildLadder, seasonAt, seasonStats, tagsFor, type LadderEntry, type SampleState } from "@/lib/ladder";
import { ordinal } from "@/lib/round";
import { YOU_ID } from "@/lib/sample";

export const metadata: Metadata = { title: "Ladder · rugbyleague-tipper" };

const STATES: { state: SampleState; label: string }[] = [
  { state: "recap", label: "Recap · Mon noon" },
  { state: "open", label: "Tipping open · Tue 7:30pm" },
  { state: "live", label: "In progress · Sat 6:20pm" },
];

export default async function LadderPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  // Same sample week as the home and tips pages, so the numbers agree everywhere.
  const q = (await searchParams).state;
  const state: SampleState = q === "recap" || q === "live" ? q : "open";
  const rounds = seasonAt(state);
  const latest = rounds.at(-1)!;
  const ladder = buildLadder(rounds);
  const tags = tagsFor(ladder);
  const stats = seasonStats(rounds);
  const you = ladder.find((e) => e.tipper.id === YOU_ID)!;
  const model = ladder.find((e) => e.tipper.isModel)!;
  const leader = ladder.find((e) => !e.tipper.isModel)!;

  return (
    <main>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-4 pb-3">
        <h1 className="font-display text-[26px] leading-none font-bold uppercase">Ladder</h1>
        <p className="text-[13px] font-medium text-ink-3">
          {latest.partial
            ? `Round ${latest.round} in progress · ${latest.games.length} game${latest.games.length === 1 ? "" : "s"} in`
            : `After Round ${latest.round}`}
        </p>
      </div>

      <LadderTable ladder={ladder} tags={tags} round={latest.round} />

      <p className="mt-3 text-[14px] leading-snug text-ink-2">
        You&rsquo;re {you.tied ? "equal " : ""}
        {ordinal(you.position!)}
        {leader.tipper.id === you.tipper.id ? ", top of the ladder" : `, ${gap(leader.points - you.points)} off the lead`}
        {model.points > you.points
          ? ` and ${gap(model.points - you.points)} behind the Model.`
          : model.points < you.points
            ? ` and ${gap(you.points - model.points)} ahead of the Model.`
            : " and level with the Model."}
      </p>

      <RoundGrid ladder={ladder} />
      <Stats stats={stats} />

      <SampleNote states={STATES.map((s) => ({ href: `/tipping/ladder?state=${s.state}`, label: s.label, on: s.state === state }))}>
        Real 2026 games, results and the Model&rsquo;s tips for rounds 1&ndash;{latest.round}. The other tippers, their tips, margins
        and forgotten tips are made up.
      </SampleNote>
    </main>
  );
}

const gap = (n: number) => `${n} pt${n === 1 ? "" : "s"}`;

function Movement({ n }: { n: number | null }) {
  if (n == null) return <span className="w-6" aria-hidden />;
  if (n === 0)
    return (
      <span className="w-6 text-[12px] font-semibold text-ink-3">
        –<span className="sr-only">no change</span>
      </span>
    );
  const Icon = n > 0 ? ArrowUp : ArrowDown;
  return (
    <span className="flex w-6 items-center text-[12px] font-semibold text-ink-3">
      <Icon className="size-3" strokeWidth={2.5} aria-hidden />
      {Math.abs(n)}
      <span className="sr-only">{n > 0 ? " places up" : " places down"}</span>
    </span>
  );
}

function LadderTable({ ladder, tags, round }: { ladder: LadderEntry[]; tags: Map<string, string>; round: number }) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Tipping ladder, round {round}</caption>
      <thead>
        <tr className="border-b border-line text-[12px] font-semibold text-ink-3">
          <th scope="col" className="w-12 py-2 pl-2 font-semibold">
            <span className="sr-only">Position</span>
          </th>
          <th scope="col" className="py-2 font-semibold">
            Tipper
          </th>
          <th scope="col" className="w-12 py-2 text-right font-semibold">
            Pts
          </th>
          <th scope="col" className="w-16 py-2 pr-2 text-right font-semibold">
            Margin
          </th>
        </tr>
      </thead>
      <tbody>
        {ladder.map((e) => {
          const you = e.tipper.id === YOU_ID;
          const tag = tags.get(e.tipper.id);
          return (
            <tr
              key={e.tipper.id}
              // The Model is the line everyone measures against: tinted, ruled above and below, unranked.
              className={`border-b ${you ? "border-line-soft bg-lime-wash" : e.tipper.isModel ? "border-y border-line bg-raised-2" : "border-line-soft"}`}
            >
              <td className="py-3 pl-2 align-middle">
                {e.tipper.isModel ? (
                  <span className="font-score text-[17px] text-ink-3">
                    –<span className="sr-only">Not ranked</span>
                  </span>
                ) : (
                  <span className="font-score text-[17px] font-semibold text-ink-2">
                    {e.tied ? "=" : ""}
                    {ordinal(e.position!)}
                  </span>
                )}
              </td>
              <td className="py-3 align-middle">
                <span className="flex items-center gap-2.5">
                  {e.tipper.isModel ? <ModelBadge size="sm" /> : e.tipper.favTeam && <TeamBadge name={e.tipper.favTeam} size="sm" />}
                  <span className="min-w-0">
                    <span className={`text-[15px] ${you || e.tipper.isModel ? "font-semibold text-ink" : "text-ink"}`}>
                      {e.tipper.isModel ? "The Model" : e.tipper.name}
                    </span>
                    {you && <span className="ml-1.5 text-[11px] font-bold tracking-[0.06em] text-lime uppercase">You</span>}
                    {tag && <span className="block text-[12px] leading-tight text-ink-3">{tag}</span>}
                  </span>
                  <span className="ml-auto">
                    <Movement n={e.movement} />
                  </span>
                </span>
              </td>
              <td className="py-3 text-right align-middle font-score text-[21px] font-bold text-ink">{e.points}</td>
              <td className="py-3 pr-2 text-right align-middle font-score text-[17px] font-semibold text-ink-3">{e.marginScore}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RoundGrid({ ladder }: { ladder: LadderEntry[] }) {
  const rounds = ladder[0].rounds.map((r) => r.round);
  const humans = ladder.filter((e) => !e.tipper.isModel);
  // A round's best score among the tippers (the Model isn't competing for it).
  const best = Object.fromEntries(rounds.map((r, i) => [r, Math.max(...humans.map((e) => e.rounds[i].correct + e.rounds[i].bonus))]));

  return (
    <section aria-labelledby="by-round" className="mt-10">
      <h2 id="by-round" className="font-display text-[24px] leading-none font-bold uppercase">
        Round by round
      </h2>
      <p className="mt-1.5 text-[13px] text-ink-3">
        Points each round. Bold is the round&rsquo;s best among the tippers; + is a perfect-round bonus; * means an auto-tip
        filled a forgotten game.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-center">
          <thead>
            <tr className="border-b border-line text-[12px] font-semibold text-ink-3">
              <th scope="col" className="sticky left-0 bg-ground py-2 pr-2 text-left font-semibold">
                <span className="sr-only">Tipper</span>
              </th>
              {rounds.map((r) => (
                <th key={r} scope="col" className="w-7 py-2 font-semibold">
                  <span className="sr-only">Round </span>
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ladder.map((e) => {
              const you = e.tipper.id === YOU_ID;
              const rowBg = you ? "bg-lime-wash" : e.tipper.isModel ? "bg-raised-2" : "";
              return (
                <tr key={e.tipper.id} className={`border-b border-line-soft ${rowBg}`}>
                  <th
                    scope="row"
                    className={`sticky left-0 py-2 pr-3 text-left text-[14px] font-medium whitespace-nowrap ${
                      // The sticky cell paints the same wash over the same ground as its row, so there's no seam.
                      you
                        ? "bg-ground [background-image:linear-gradient(var(--color-lime-wash),var(--color-lime-wash))]"
                        : e.tipper.isModel
                          ? "bg-raised-2"
                          : "bg-ground"
                    } ${you || e.tipper.isModel ? "text-ink" : "text-ink-2"}`}
                  >
                    {e.tipper.isModel ? "Model" : e.tipper.name}
                  </th>
                  {e.rounds.map((s) => {
                    const pts = s.correct + s.bonus;
                    const top = !e.tipper.isModel && pts === best[s.round];
                    return (
                      <td
                        key={s.round}
                        className={`py-2 font-score text-[16px] ${top ? "font-bold text-ink" : "text-ink-3"}`}
                      >
                        {s.correct}
                        {s.bonus > 0 && <span className="text-[12px]">+</span>}
                        {s.autoTips > 0 && <span className="text-[12px] text-ink-3">*</span>}
                        <span className="sr-only">
                          {" "}
                          of {s.games}
                          {s.bonus > 0 ? ", plus a bonus point" : ""}
                          {s.autoTips > 0 ? `, ${s.autoTips} auto-tip${s.autoTips === 1 ? "" : "s"}` : ""}
                          {s.partial ? ", round in progress" : ""}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stats({ stats }: { stats: ReturnType<typeof seasonStats> }) {
  const streak = stats.longestStreak[0];
  const upset = stats.biggestUpset;
  const rows: [string, React.ReactNode][] = [
    [
      "Perfect rounds",
      stats.perfectRounds.length === 0
        ? "Nobody yet."
        : stats.perfectRounds.map((p) => `${p.tipper.name} (round${p.rounds.length > 1 ? "s" : ""} ${p.rounds.join(", ")})`).join(", "),
    ],
    [
      "Longest streak",
      streak && streak.length > 0 ? (
        <>
          {streak.tipper.name}, <span className="font-score text-[17px] text-ink">{streak.length}</span> correct in a row
          {streak.endedRound == null ? " and counting" : `, ended in round ${streak.endedRound}`}.
        </>
      ) : (
        "Nobody yet."
      ),
    ],
    [
      "Biggest upset tipped",
      upset ? (
        <>
          {upset.tipper.name} tipped the {upset.team} over the {upset.opponent} in round {upset.round}. The Model gave them{" "}
          <span className="font-score text-[17px] text-ink">{Math.round(upset.modelChance * 100)}%</span>.
        </>
      ) : (
        "Nobody's tipped an upset yet."
      ),
    ],
  ];
  return (
    <section aria-labelledby="season-stats" className="mt-10">
      <h2 id="season-stats" className="font-display text-[24px] leading-none font-bold uppercase">
        Bragging rights
      </h2>
      <dl className="mt-3 border-t border-line-soft">
        {rows.map(([label, value]) => (
          <div key={label} className="border-b border-line-soft py-3">
            <dt className="text-[13px] font-semibold text-ink-3">{label}</dt>
            <dd className="mt-0.5 text-[15px] leading-snug text-ink-2">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
