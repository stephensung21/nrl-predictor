import type { Metadata } from "next";
import { RuleStrip } from "@/components/art/diagrams";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { EloSeasonChart, EloTeamChart, SeasonPicker } from "@/components/elo-charts";
import { TableView } from "@/components/charts";
import { FormLamps } from "@/components/form-lamps";
import { SampleNote } from "@/components/sample-note";
import { TeamBadge } from "@/components/team-badge";
import { chanceForGap, CURRENT_ROUND, FORM_FROM_ROUND, formReady, HOME_ADVANTAGE, hotAndCold, lineColours, tableOf, type EloRow } from "@/lib/elo";
import { tippers, YOU_ID } from "@/lib/sample";
import { eloSource } from "@/lib/source";
import { TEAMS, type TeamName } from "@/lib/teams";

export const metadata: Metadata = { title: "Teams · Full Credit" };

/** Data pages get a wider column on desktop (DESIGN.md, wide data pages). */
const WIDE = "md:relative md:left-1/2 md:w-[min(60rem,calc(100vw-4rem))] md:-translate-x-1/2";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(Math.round(n))}`;

/** One decimal with its sign; a figure that rounds to nothing is "0.0", never "−0.0". */
function signed1(n: number) {
  const r = Math.round(n * 10) / 10;
  return r === 0 ? "0.0" : `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(1)}`;
}

/** "18–6", with draws as a third figure ("10–5–1"). */
const recordText = ({ won, lost, drawn }: EloRow["record"]) => `${won}–${lost}${drawn ? `–${drawn}` : ""}`;

export default async function TeamsPage({ searchParams }: Props) {
  const q = await searchParams;
  const src = await eloSource();
  const season = src.seasons.includes(Number(q.season)) ? Number(q.season) : src.latest;
  const s = (await src.season(season))!;
  // The viewer's favourite team comes with sign-in (step 10); until then only the sample has one.
  const yours = src.live ? undefined : tippers.find((t) => t.id === YOU_ID)?.favTeam;
  const rows = tableOf(s);
  const pickedTeam = q.team && q.team in TEAMS ? (q.team as TeamName) : (yours ?? rows[0].team);
  // The latest season counts as current until its finals: after the Grand Final it's a finished season.
  const current = season === src.latest && s.lastRound !== "F";
  const lastLabel = s.lastRound === "F" ? "the Grand Final" : `Round ${s.lastRound.slice(1)}`;
  const gap100 = Math.round(chanceForGap(100) * 100);
  const initial = [...new Set([yours, rows[0].team, q.team ? pickedTeam : undefined].filter(Boolean) as TeamName[])].slice(-3);
  const byRank = rows.map((r) => r.team);
  const tv = await src.teamView(pickedTeam);
  const withFinals = s.rounds.includes("F");
  const form = formReady(s) ? hotAndCold(rows) : null;
  const teamHref = (t: TeamName) => `/teams?season=${season}&team=${encodeURIComponent(t)}#team`;

  return (
    <main className={WIDE}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pt-4">
        <div>
          <h1 className="font-display text-[26px] leading-none font-bold uppercase">Teams</h1>
          <p className="mt-1.5 text-[13px] text-ink-3">
            {current ? `Elo ratings after ${lastLabel}, ${season}` : `${season}, final Elo ratings after ${lastLabel}`}
          </p>
        </div>
        <SeasonPicker seasons={src.seasons} value={season} team={pickedTeam} />
      </div>

      <RuleStrip
        className="mt-3 max-w-[48rem]"
        label="How Elo works"
        steps={[
          { icon: "ratings", title: "Results move ratings", note: "Beating a strong team earns more" },
          { icon: "dial", title: `100 points ≈ ${gap100}%`, note: "Chance of winning, before home advantage" },
          { icon: "posts", title: `Home: +${HOME_ADVANTAGE} points`, note: "Added for a team at its own ground" },
          { icon: "calendar", title: "Back toward 1500", note: "Every rating drifts over the off-season" },
        ]}
      />

      <section aria-labelledby="ratings" className="mt-5">
        <h2 id="ratings" className="sr-only">
          Ratings
        </h2>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-[12px] font-semibold text-ink-3">
              <th scope="col" className="w-8 py-2 pl-2 font-semibold md:w-12 md:pl-3">
                <span className="sr-only">Rank</span>
              </th>
              <th scope="col" className="py-2 font-semibold">
                Team
              </th>
              <th scope="col" className="w-12 py-2 text-right font-semibold md:w-16">
                Elo
              </th>
              <th scope="col" className="w-12 py-2 text-right font-semibold md:w-16">
                {current ? "Week" : "Season"}
              </th>
              <th scope="col" className="w-12 py-2 text-right font-semibold md:w-16">
                <span aria-hidden>W–L</span>
                <span className="sr-only">Won–lost</span>
              </th>
              <th scope="col" className="hidden w-16 py-2 text-right font-semibold md:table-cell">
                <span aria-hidden>PD</span>
                <span className="sr-only">Points difference</span>
              </th>
              <th scope="col" className="w-14 py-2 pr-2 text-right font-semibold md:w-16 md:pr-0">
                <span aria-hidden>v Elo</span>
                <span className="sr-only">Wins against Elo&rsquo;s expectation</span>
              </th>
              <th scope="col" className="hidden w-16 py-2 text-right font-semibold md:table-cell">
                <span aria-hidden>Close</span>
                <span className="sr-only">Record in close games</span>
              </th>
              <th scope="col" className="hidden w-28 py-2 text-right font-semibold md:table-cell">
                Last 5
              </th>
              <th scope="col" className="hidden w-[4.25rem] py-2 pr-3 text-right font-semibold md:table-cell">
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
                  <td className="py-2 pl-2 font-score text-[16px] font-semibold text-ink-3 md:pl-3">{r.rank}</td>
                  <td className="py-2">
                    <Link
                      href={teamHref(r.team)}
                      scroll={false}
                      className="flex items-center gap-2 text-[14px] text-ink hover:underline"
                      aria-current={picked ? "true" : undefined}
                    >
                      <TeamBadge name={r.team} size="sm" />
                      <span className="flex min-w-0 flex-col md:flex-row md:items-center md:gap-2">
                        <span className={`whitespace-nowrap ${picked ? "font-semibold" : ""}`}>{r.team}</span>
                        {r.team === yours && <span className="text-[11px] font-bold tracking-[0.06em] text-lime-fg uppercase">Yours</span>}
                      </span>
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
                  <td className="py-2 text-right font-score text-[16px] font-semibold whitespace-nowrap text-ink-2">
                    {recordText(r.record)}
                    <span className="sr-only">
                      {" "}
                      ({r.record.won} won, {r.record.lost} lost{r.record.drawn ? `, ${r.record.drawn} drawn` : ""})
                    </span>
                  </td>
                  <td className="hidden py-2 text-right font-score text-[16px] font-semibold text-ink-2 md:table-cell">{signed(r.pointsDiff)}</td>
                  <td className="py-2 pr-2 text-right font-score text-[16px] font-semibold text-ink md:pr-0">
                    <span title={`${r.record.won + r.record.drawn / 2} wins; Elo expected ${r.expectedWins.toFixed(1)}`}>{signed1(r.vsElo)}</span>
                  </td>
                  <td className="hidden py-2 text-right font-score text-[16px] font-semibold text-ink-3 md:table-cell">
                    {r.record.closeWon}–{r.record.closeLost}
                    <span className="sr-only"> in close games</span>
                  </td>
                  <td className="hidden py-2 text-right md:table-cell">
                    <FormLamps games={r.record.form} />
                  </td>
                  <td className="hidden py-2 pr-3 text-right font-score text-[14px] text-ink-3 md:table-cell">{Math.round(r.start)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 max-w-[60ch] text-[12px] text-ink-3">
          {current ? "Week: change in the latest round (Bye: didn't play)." : "Season: change from the start of the season."} W–L: this
          season{withFinals ? ", finals included" : ""}. v Elo: wins above the wins Elo expected, from each team&rsquo;s chance going into
          every game (a draw counts half).
          <span className="hidden md:inline">
            {" "}
            PD: points difference. Close: record in games decided by 6 points or fewer. Last 5: oldest first, filled for a win. Start:
            rating going into {season}.
          </span>
        </p>
      </section>

      <div className="mt-8 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] md:items-start md:gap-x-10">
        <section aria-labelledby="season-chart">
          <h2 id="season-chart" className="text-[16px] font-semibold text-ink">
            {season} round by round
          </h2>
          <EloSeasonChart key={`${season}-${pickedTeam}`} season={season} rounds={s.rounds} ratings={s.ratings} initial={initial} order={byRank} />
        </section>

        <section aria-labelledby="hot-cold" className="mt-8 md:mt-0">
          <h2 id="hot-cold" className="text-[16px] font-semibold text-ink">
            Hot and cold
          </h2>
          {form ? (
            <>
              <p className="mt-1 text-[13px] text-ink-3">
                Elo gained or lost over each team&rsquo;s last five games{withFinals ? ", finals included" : ""}.
              </p>
              <FormList title="Hot" rows={form.hot} href={teamHref} empty="No team has gained over its last five." />
              <FormList title="Cold" rows={form.cold} href={teamHref} empty="No team has lost ground over its last five." />
            </>
          ) : (
            <p className="mt-1 text-[13px] text-ink-3">Starts after Round {FORM_FROM_ROUND}, once every team has a few games behind it.</p>
          )}
        </section>
      </div>

      <section id="team" aria-labelledby="team-view" className="mt-10 scroll-mt-20 md:max-w-[40rem]">
        <h2 id="team-view" className="flex items-center gap-2.5 font-display text-[24px] leading-none font-bold uppercase">
          <TeamBadge name={pickedTeam} size="md" />
          {tv.points.length ? `${pickedTeam} since ${tv.points[0].season}` : pickedTeam}
        </h2>
        {!tv.points.length && <p className="mt-1.5 text-[14px] text-ink-2">No games rated yet.</p>}
        {tv.points.length > 0 && <>
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
        </>}
      </section>

      {!src.live && (
        <SampleNote>
          Real results since 2009, rated with the project&rsquo;s own Elo settings. Round {CURRENT_ROUND} of {src.latest} is the
          sample&rsquo;s current round, so {src.latest} runs to Round {CURRENT_ROUND - 1}.
        </SampleNote>
      )}
    </main>
  );
}

/** Hot or cold: the team, its last five as lamps and its rating change over them. */
function FormList({ title, rows, href, empty }: { title: string; rows: EloRow[]; href: (t: TeamName) => string; empty: string }) {
  return (
    <>
      <h3 className="mt-4 text-[13px] font-semibold text-ink-2">{title}</h3>
      {rows.length ? (
        <ol className="mt-1 border-t border-line-soft">
          {rows.map((r) => (
            <li key={r.team} className="flex items-center gap-3 border-b border-line-soft py-2">
              <Link href={href(r.team)} scroll={false} className="flex min-w-0 flex-1 items-center gap-2 text-[14px] text-ink-2 hover:text-ink hover:underline">
                <TeamBadge name={r.team} size="sm" />
                <span className="whitespace-nowrap">{r.team}</span>
              </Link>
              <FormLamps games={r.record.form} />
              <span className="w-10 shrink-0 text-right font-score text-[17px] font-bold text-ink">
                {signed(r.formChange)}
                <span className="sr-only"> in Elo</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-1 text-[13px] text-ink-3">{empty}</p>
      )}
    </>
  );
}
