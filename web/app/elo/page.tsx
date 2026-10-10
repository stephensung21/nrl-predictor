import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { EloSeasonChart, EloTeamChart, SeasonPicker } from "@/components/elo-charts";
import { TableView } from "@/components/charts";
import { SampleNote } from "@/components/sample-note";
import { TeamBadge } from "@/components/team-badge";
import { chanceForGap, CURRENT_ROUND, HOME_ADVANTAGE, LATEST, lineColours, SEASONS, seasonOf, table, teamView } from "@/lib/elo";
import { tippers, YOU_ID } from "@/lib/sample";
import { TEAMS, type TeamName } from "@/lib/teams";

export const metadata: Metadata = { title: "Elo ratings · rugbyleague-tipper" };

/** Data pages get a wider column on desktop (DESIGN.md, wide data pages). */
const WIDE = "md:relative md:left-1/2 md:w-[min(60rem,calc(100vw-4rem))] md:-translate-x-1/2";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(Math.round(n))}`;

export default async function EloPage({ searchParams }: Props) {
  const q = await searchParams;
  const season = SEASONS.includes(Number(q.season)) ? Number(q.season) : LATEST;
  const s = seasonOf(season)!;
  const yours = tippers.find((t) => t.id === YOU_ID)?.favTeam;
  const pickedTeam = q.team && q.team in TEAMS ? (q.team as TeamName) : (yours ?? "Broncos");
  const rows = table(season);
  const current = season === LATEST;
  const lastLabel = s.lastRound === "F" ? "the Grand Final" : `Round ${s.lastRound.slice(1)}`;
  const gap100 = Math.round(chanceForGap(100) * 100);
  const initial = [...new Set([yours, rows[0].team, q.team ? pickedTeam : undefined].filter(Boolean) as TeamName[])].slice(-3);
  const byRank = rows.map((r) => r.team);
  const tv = teamView(pickedTeam);

  return (
    <main className={WIDE}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pt-4">
        <div>
          <h1 className="font-display text-[26px] leading-none font-bold uppercase">Elo ratings</h1>
          <p className="mt-1.5 text-[13px] text-ink-3">
            {current ? `After ${lastLabel}, ${season}` : `${season}, final ratings after ${lastLabel}`}
          </p>
        </div>
        <SeasonPicker seasons={SEASONS} value={season} team={pickedTeam} />
      </div>

      <p className="mt-3 max-w-[60ch] text-[14px] leading-snug text-ink-2">
        Elo rates each team from its results: beating a strong team earns more than beating a weak one. A 100-point gap is about a{" "}
        {gap100}% chance of winning before home advantage, which is worth {HOME_ADVANTAGE} points. Every rating drifts back toward
        1500 over the off-season.
      </p>

      <div className="mt-5 md:grid md:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] md:items-start md:gap-x-10">
        <section aria-labelledby="ratings">
          <h2 id="ratings" className="sr-only">
            Ratings
          </h2>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-[12px] font-semibold text-ink-3">
                <th scope="col" className="w-9 py-2 font-semibold">
                  <span className="sr-only">Rank</span>
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Team
                </th>
                <th scope="col" className="w-14 py-2 text-right font-semibold">
                  Rating
                </th>
                <th scope="col" className="w-14 py-2 text-right font-semibold">
                  {current ? "Week" : "Season"}
                </th>
                <th scope="col" className="w-14 py-2 text-right font-semibold">
                  Start
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const picked = r.team === pickedTeam;
                // A finished season shows its whole-season move; only two teams play the last round.
                // Both from the printed (rounded) numbers, so the column always equals what's shown.
                const change = current ? r.change : Math.round(r.rating) - Math.round(r.start);
                const bye = current && r.bye;
                return (
                  <tr key={r.team} className={`border-b border-line-soft ${picked ? "bg-raised" : ""}`}>
                    <td className="py-2 font-score text-[16px] font-semibold text-ink-3">{r.rank}</td>
                    <td className="py-2">
                      <Link
                        href={`/elo?season=${season}&team=${encodeURIComponent(r.team)}#team`}
                        scroll={false}
                        className="flex items-center gap-2 text-[14px] text-ink hover:underline"
                        aria-current={picked ? "true" : undefined}
                      >
                        <TeamBadge name={r.team} size="sm" />
                        <span className={picked ? "font-semibold" : ""}>{r.team}</span>
                        {r.team === yours && <span className="text-[11px] font-bold tracking-[0.06em] text-lime uppercase">Yours</span>}
                      </Link>
                    </td>
                    <td className="py-2 text-right font-score text-[19px] font-bold text-ink">{Math.round(r.rating)}</td>
                    <td className="py-2 text-right">
                      {bye ? (
                        <span className="text-[12px] text-ink-3">Bye</span>
                      ) : change == null || Math.round(change) === 0 ? (
                        <span className="text-[12px] text-ink-3">
                          –<span className="sr-only">no change</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-end gap-0.5 font-score text-[14px] text-ink-2">
                          {change > 0 ? <ArrowUp className="size-3" strokeWidth={2.5} aria-hidden /> : <ArrowDown className="size-3" strokeWidth={2.5} aria-hidden />}
                          {Math.abs(Math.round(change))}
                          <span className="sr-only">{change > 0 ? " up" : " down"}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right font-score text-[14px] text-ink-3">{Math.round(r.start)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[12px] text-ink-3">
            {current ? "Week: change in the latest round (Bye: didn't play)." : "Season: change from the start of the season."} Start: rating going into {season}.
          </p>
        </section>

        <section aria-labelledby="season-chart" className="mt-8 md:mt-0">
          <h2 id="season-chart" className="text-[16px] font-semibold text-ink">
            {season} round by round
          </h2>
          <EloSeasonChart key={`${season}-${pickedTeam}`} season={season} rounds={s.rounds} ratings={s.ratings} initial={initial} order={byRank} />
        </section>
      </div>

      <section id="team" aria-labelledby="team-view" className="mt-10 scroll-mt-20 md:max-w-[40rem]">
        <h2 id="team-view" className="flex items-center gap-2.5 font-display text-[24px] leading-none font-bold uppercase">
          <TeamBadge name={pickedTeam} size="md" />
          {pickedTeam} since {tv.points[0].season}
        </h2>
        <p className="mt-1.5 text-[13px] text-ink-3">Game by game. Tap a team in the table to switch. Numbered: the biggest rises and falls.</p>
        <EloTeamChart name={pickedTeam} points={tv.points} swings={tv.swings} colour={lineColours([pickedTeam])[pickedTeam]} />
        <ol className="mt-2 border-t border-line-soft">
          {tv.swings.map((i, k) => {
            const p = tv.points[i];
            return (
              <li key={i} className="flex items-baseline gap-3 border-b border-line-soft py-2 text-[14px]">
                <span className="w-4 shrink-0 font-score text-[14px] font-semibold text-ink-3">{k + 1}</span>
                <span className="w-12 shrink-0 font-score text-[17px] font-bold text-ink">{signed(p.change)}</span>
                <span className="min-w-0 flex-1 text-ink-2">{p.text}</span>
                <span className="shrink-0 text-[12px] text-ink-3">
                  {p.label === "Finals" ? "Finals" : p.label.replace("Round ", "R")} {p.season}
                </span>
              </li>
            );
          })}
        </ol>
        <TableView
          table={{
            columns: ["Season", "Round", "Game", "Change", "Rating"],
            rows: tv.points.map((p) => [p.season, p.label, p.text, signed(p.change), Math.round(p.rating)]),
          }}
        />
      </section>

      <SampleNote>
        Real results since 2009, rated with the project&rsquo;s own Elo settings. Round {CURRENT_ROUND} of {LATEST} is the
        sample&rsquo;s current round, so {LATEST} runs to Round {CURRENT_ROUND - 1}.
      </SampleNote>
    </main>
  );
}
