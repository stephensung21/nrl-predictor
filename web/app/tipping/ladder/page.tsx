import type { Metadata } from "next";
import { ArrowDown, ArrowUp } from "lucide-react";
import { PageMessage } from "@/components/page-message";
import { SampleNote } from "@/components/sample-note";
import { ModelBadge, TeamBadge } from "@/components/team-badge";
import { compSeason, COMP_FIRST_SEASON, readLadder, type LadderView } from "@/lib/comp";
import { formFor, seasonStats, tagsFor } from "@/lib/comp-stats";
import { ladder as buildLadder, seasonAt, statGames, type LadderEntry, type SampleState } from "@/lib/ladder";
import { ordinal, roundName } from "@/lib/round";
import { YOU_ID } from "@/lib/sample";
import { tippingLive } from "@/lib/supabase";
import { serverClient } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Ladder · Full Credit" };

const STATES: { state: SampleState; label: string }[] = [
  { state: "recap", label: "Recap · Mon noon" },
  { state: "open", label: "Tipping open · Tue 7:30pm" },
  { state: "live", label: "In progress · Sat 6:20pm" },
];

export default async function LadderPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (tippingLive) return <LiveLadder />;
  // Same sample week as the home and tips pages, so the numbers agree everywhere.
  const q = (await searchParams).state;
  const state: SampleState = q === "recap" || q === "live" ? q : "open";
  const rounds = seasonAt(state);
  const latest = rounds.at(-1)!;
  const ladder = buildLadder(rounds);
  const view: LadderView = {
    season: 2026,
    ladder,
    tags: tagsFor(ladder),
    stats: seasonStats(ladder, statGames(rounds)),
    latest: { round: latest.round, title: roundName(latest.round), partial: !!latest.partial, games: latest.games.length },
  };

  return (
    <main>
      <Ladder view={view} youId={YOU_ID} />
      <SampleNote states={STATES.map((s) => ({ href: `/tipping/ladder?state=${s.state}`, label: s.label, on: s.state === state }))}>
        Real 2026 games, results and the Model&rsquo;s tips for rounds 1&ndash;{latest.round}. The other tippers, their tips, margins
        and forgotten tips are made up.
      </SampleNote>
    </main>
  );
}

/** The live comp's ladder, read as the signed-in tipper (lib/comp.ts). */
async function LiveLadder() {
  const sb = (await serverClient())!;
  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) {
    return (
      <PageMessage
        title="Sign in to see the ladder."
        body="Sign in with the Google account you joined with. New here? Joining is open to everyone."
        action={{ href: "/sign-in", label: "Sign in" }}
      />
    );
  }
  const { data: me } = await sb.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!me) return <PageMessage title="Signed in, but not in the comp." body="Three quick things and you’re in." action={{ href: "/join", label: "Join the comp" }} />;
  const season = await compSeason(sb);
  const view = season == null ? null : await readLadder(sb, season);
  if (!view) {
    return (
      <PageMessage
        title="The ladder starts with Round 1."
        body={`Points start counting once the first game of the ${season ?? COMP_FIRST_SEASON} season is decided.`}
      />
    );
  }
  return (
    <main>
      <Ladder view={view} youId={user.id} />
    </main>
  );
}

function Ladder({ view, youId }: { view: LadderView; youId: string }) {
  const { ladder, tags, stats, latest } = view;
  const you = ladder.find((e) => e.tipper.id === youId);
  const model = ladder.find((e) => e.tipper.isModel);
  const leader = ladder.find((e) => !e.tipper.isModel);

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-4 pb-3">
        <h1 className="font-display text-[26px] leading-none font-bold uppercase">Ladder</h1>
        <p className="text-[13px] font-medium text-ink-3">
          {latest.partial
            ? `${latest.title} in progress · ${latest.games} game${latest.games === 1 ? "" : "s"} in`
            : `After ${latest.title}`}
        </p>
      </div>

      <LadderTable ladder={ladder} tags={tags} form={formFor(ladder)} round={latest.round} youId={youId} />

      {you && leader && (
        <p className="mt-3 rounded-lg bg-raised px-3 py-2.5 text-[14px] leading-snug text-ink-2">
          You&rsquo;re{" "}
          <span className="font-semibold text-ink">
            {you.tied ? "equal " : ""}
            {ordinal(you.position!)}
          </span>
          {leader.tipper.id === you.tipper.id ? (
            ", top of the ladder"
          ) : (
            <>
              , <span className="font-semibold text-ink">{gap(leader.points - you.points)} off the lead</span>
            </>
          )}
          {!model ? (
            "."
          ) : model.points > you.points ? (
            <>
              {" "}and <span className="font-semibold text-ink">{gap(model.points - you.points)} behind the Model</span>.
            </>
          ) : model.points < you.points ? (
            <>
              {" "}and <span className="font-semibold text-ink">{gap(you.points - model.points)} ahead of the Model</span>.
            </>
          ) : (
            " and level with the Model."
          )}
        </p>
      )}

      <RoundGrid ladder={ladder} youId={youId} />
      <Stats stats={stats} />
    </>
  );
}

const gap = (n: number) => `${n} pt${n === 1 ? "" : "s"}`;

/** The Model's series colour (lib/odds.ts), for its divider's rules. */
const MODEL_LINE = "#3987e5";

function Movement({ n }: { n: number | null }) {
  if (n == null || n === 0)
    return n === 0 ? <span className="sr-only">, no change</span> : null;
  const Icon = n > 0 ? ArrowUp : ArrowDown;
  return (
    <span className="ml-1 inline-flex items-center text-[11px] font-semibold text-ink-3">
      <Icon className="size-3" strokeWidth={2.5} aria-hidden />
      {Math.abs(n)}
      <span className="sr-only">{n > 0 ? " places up" : " places down"}</span>
    </span>
  );
}

function FormTag({ form }: { form?: "hot" | "cold" }) {
  if (!form) return null;
  return (
    <span
      className={`ml-1.5 text-[11px] font-bold tracking-[0.06em] uppercase ${form === "hot" ? "text-lime-fg" : "text-miss"}`}
    >
      {form === "hot" ? "Hot" : "Cold"}
      <span className="sr-only">: {form === "hot" ? "best" : "worst"} of the last three rounds</span>
    </span>
  );
}

/** The Model isn't ranked: it's a line across the ladder, placed by its points. */
function ModelDivider({ model }: { model: LadderEntry }) {
  return (
    <tr>
      <td colSpan={5} className="px-2 py-2">
        <span className="flex items-center gap-2 text-[12px] font-semibold text-ink-2">
          <span className="h-0 flex-1 border-t-[1.5px] border-dashed" style={{ borderColor: MODEL_LINE }} aria-hidden />
          <ModelBadge size="sm" />
          <span>
            <span className="sr-only">Not ranked: </span>The Model ·{" "}
            <span className="font-score text-[15px] text-ink">{model.points}</span>
            <span className="sr-only"> points, margin</span>
            <span aria-hidden> · </span>
            <span className="font-score text-[15px]">{model.marginScore}</span>
          </span>
          <span className="h-0 flex-1 border-t-[1.5px] border-dashed" style={{ borderColor: MODEL_LINE }} aria-hidden />
        </span>
      </td>
    </tr>
  );
}

function LadderTable({
  ladder, tags, form, round, youId,
}: { ladder: LadderEntry[]; tags: Map<string, string>; form: Map<string, "hot" | "cold">; round: number; youId: string }) {
  const model = ladder.find((e) => e.tipper.isModel);
  const humans = ladder.filter((e) => !e.tipper.isModel);
  const top = humans[0]?.points ?? 0;
  // The divider goes before the first tipper below the Model; a tipper level with it stays above.
  const below = model ? humans.findIndex((e) => e.points < model.points) : -1;
  const dividerAt = below === -1 ? humans.length : below;

  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Tipping ladder, round {round}</caption>
      <thead>
        <tr className="border-b border-line text-[12px] font-semibold text-ink-3">
          <th scope="col" className="w-11 py-2 pl-2 font-semibold">
            <span className="sr-only">Position</span>
          </th>
          <th scope="col" className="py-2 font-semibold">
            Tipper
          </th>
          <th scope="col" className="w-11 py-2 text-right font-semibold">
            Pts
          </th>
          <th scope="col" className="w-11 py-2 text-right font-semibold">
            Gap
          </th>
          <th scope="col" className="w-14 py-2 pr-2 text-right font-semibold">
            Margin
          </th>
        </tr>
      </thead>
      <tbody>
        {humans.flatMap((e, i) => {
          const you = e.tipper.id === youId;
          const tag = tags.get(e.tipper.id);
          const behind = top - e.points;
          const row = (
            <tr key={e.tipper.id} className={`border-b border-line-soft ${you ? "bg-lime-wash" : ""}`}>
              <td className="py-3 pl-2 align-middle whitespace-nowrap">
                <span className={`font-score text-[22px] font-bold ${e.position === 1 ? "text-lime-fg" : "text-ink-2"}`}>
                  {e.tied ? "=" : ""}
                  {e.position}
                </span>
                <Movement n={e.movement} />
              </td>
              <td className="py-3 align-middle">
                <span className="flex items-center gap-2.5">
                  {e.tipper.favTeam && <TeamBadge name={e.tipper.favTeam} size="sm" />}
                  <span className="min-w-0">
                    <span className="text-[15px] font-semibold text-ink">{e.tipper.name}</span>
                    {you && <span className="ml-1.5 text-[11px] font-bold tracking-[0.06em] text-lime-fg uppercase">You</span>}
                    <FormTag form={form.get(e.tipper.id)} />
                    {tag && <span className="block text-[12px] leading-tight text-ink-3">{tag}</span>}
                  </span>
                </span>
              </td>
              <td className="py-3 text-right align-middle font-score text-[26px] leading-none font-bold text-ink">{e.points}</td>
              <td className="py-3 text-right align-middle font-score text-[16px] font-semibold text-ink-2">
                {behind === 0 ? (
                  <>
                    –<span className="sr-only">level with the lead</span>
                  </>
                ) : (
                  <>
                    &minus;{behind}
                    <span className="sr-only"> behind the lead</span>
                  </>
                )}
              </td>
              <td className="py-3 pr-2 text-right align-middle font-score text-[16px] text-ink-3">{e.marginScore}</td>
            </tr>
          );
          return model && i === dividerAt ? [<ModelDivider key="model" model={model} />, row] : [row];
        })}
        {model && dividerAt === humans.length && <ModelDivider model={model} />}
      </tbody>
    </table>
  );
}

/** A round cell's lime tint: brighter for more points, capped so ink text keeps its contrast in both themes. */
const tint = (pts: number, games: number) =>
  `color-mix(in oklch, var(--color-lime) ${Math.round(4 + 31 * Math.min(1, pts / Math.max(1, games)))}%, transparent)`;

function RoundGrid({ ladder, youId }: { ladder: LadderEntry[]; youId: string }) {
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
        Points each round; brighter is a better round. Bold is the round&rsquo;s best among the tippers; + is a perfect-round
        bonus; * means an auto-tip filled a forgotten game.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-max border-separate border-spacing-[3px] text-center">
          <thead>
            <tr className="text-[12px] font-semibold text-ink-3">
              <th scope="col" className="sticky left-0 z-10 bg-ground pr-2 text-left font-semibold">
                <span className="sr-only">Tipper</span>
              </th>
              {rounds.map((r) => (
                <th key={r} scope="col" className="min-w-8 pb-1 font-semibold">
                  <span className="sr-only">Round </span>
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ladder.map((e) => {
              const you = e.tipper.id === youId;
              return (
                <tr key={e.tipper.id}>
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 bg-ground pr-3 text-left text-[14px] whitespace-nowrap ${
                      you ? "font-semibold text-lime-fg" : e.tipper.isModel ? "font-medium text-ink" : "font-medium text-ink-2"
                    }`}
                  >
                    {e.tipper.isModel ? "Model" : e.tipper.name}
                  </th>
                  {e.rounds.map((s) => {
                    const pts = s.correct + s.bonus;
                    const top = !e.tipper.isModel && pts === best[s.round];
                    return (
                      <td
                        key={s.round}
                        className={`h-8 rounded-[5px] font-score text-[16px] text-ink ${top ? "font-bold" : ""} ${
                          e.tipper.isModel ? "bg-raised-2" : ""
                        }`}
                        style={e.tipper.isModel ? undefined : { background: tint(pts, s.games) }}
                      >
                        {s.correct}
                        {s.bonus > 0 && <span className="text-[12px]">+</span>}
                        {s.autoTips > 0 && <span className="text-[12px]">*</span>}
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

function Stats({ stats }: { stats: LadderView["stats"] }) {
  const streak = stats.longestStreak[0];
  const upset = stats.biggestUpset;
  const perfect = stats.perfectRounds;
  const tiles: { figure: string; label: string; detail: string }[] = [
    {
      figure: streak && streak.length > 0 ? String(streak.length) : "0",
      label: "Longest streak",
      detail:
        streak && streak.length > 0
          ? `${streak.tipper.name}, ${streak.endedRound == null ? "still going" : `ended round ${streak.endedRound}`}`
          : "Nobody yet.",
    },
    {
      figure: upset ? `${Math.round(upset.modelChance * 100)}%` : "–",
      label: "Biggest upset",
      detail: upset ? `${upset.tipper.name}: ${upset.team} over ${upset.opponent}, round ${upset.round}` : "Nobody yet.",
    },
    {
      figure: String(perfect.reduce((n, p) => n + p.rounds.length, 0)),
      label: "Perfect rounds",
      detail:
        perfect.length === 0
          ? "Nobody yet."
          : perfect.map((p) => `${p.tipper.name} (round${p.rounds.length > 1 ? "s" : ""} ${p.rounds.join(", ")})`).join(", "),
    },
  ];
  return (
    <section aria-labelledby="season-stats" className="mt-10">
      <h2 id="season-stats" className="font-display text-[24px] leading-none font-bold uppercase">
        Bragging rights
      </h2>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col rounded-lg bg-raised px-3 py-3">
            <dt className="order-2 mt-1 text-[12px] font-semibold text-ink-3">{t.label}</dt>
            <dd className="order-1 font-score text-[28px] leading-none font-bold text-ink">{t.figure}</dd>
            <dd className="order-3 mt-1 text-[12px] leading-snug text-ink-2">{t.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
