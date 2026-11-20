import type { Metadata } from "next";
import Link from "next/link";
import { DallyMBallot } from "@/components/dally-m-ballot";
import { LocalTime } from "@/components/local-time";
import { PageMessage } from "@/components/page-message";
import { PlayerPhoto } from "@/components/player-photo";
import { QuerySelect } from "@/components/player-pickers";
import { SampleNote } from "@/components/sample-note";
import { ballotOf, lastClosed, openRound, rankTallies, VOTE_SLOTS, type RankedTally, type RoundPlayer, type Tally } from "@/lib/dally-m";
import type { DallyMVotes } from "@/lib/dally-m-store";
import { dallyMSource } from "@/lib/source";

export const metadata: Metadata = { title: "Dally M · rugbyleague-tipper" };
// Each tipper sees their own votes, and everyone's only once a round closes: render per request.
export const dynamic = "force-dynamic";

const TOP_BOARD = 25;
const TOP_ROUND = 10;

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function DallyMPage({ searchParams }: Props) {
  const q = await searchParams;
  const src = await dallyMSource();
  if (src.missing) return <PageMessage title="The Dally M is on its way." body="Its votes and players haven't been set up yet." />;
  if (!src.seasons.length) {
    return <PageMessage title="No Dally M votes yet." body="Voting opens after the first round of the season is played." />;
  }
  const season = src.seasons.includes(Number(q.season)) ? Number(q.season) : src.seasons[0];
  const rounds = await src.rounds(season);
  const open = openRound(rounds);
  const closed = rounds.filter((r) => r.isClosed);
  const shown = closed.find((r) => r.round === Number(q.round)) ?? lastClosed(rounds);
  const [votes, openPlayers] = await Promise.all([src.votes(season, open?.round ?? null), open ? src.players(season, open.round) : Promise.resolve([])]);
  const query: Record<string, string> = { season: String(season) };

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-4 pb-3">
        <h1 className="font-display text-[26px] leading-none font-bold uppercase">Dally M</h1>
        {src.seasons.length > 1 && (
          <QuerySelect
            path="/dally-m"
            label="Season"
            param="season"
            value={String(season)}
            options={src.seasons.map((s) => ({ value: String(s), label: String(s) }))}
            query={query}
          />
        )}
      </div>
      <p className="max-w-prose text-[15px] leading-snug text-ink-2">
        Each round, give 3, 2 and 1 votes to the best players of the whole round. Votes stay hidden until the next round kicks
        off, then everyone&rsquo;s are revealed.
      </p>

      <YourVotes season={season} open={open} players={openPlayers} votes={votes} nextRound={(rounds.at(-1)?.round ?? 0) + 1} />

      {shown && votes && (
        <Revealed
          round={shown.round}
          rounds={closed.map((r) => r.round)}
          query={query}
          votes={votes}
          players={await src.players(season, shown.round)}
        />
      )}

      {votes ? (
        <Leaderboard season={season} tallies={votes.leaderboard} all={q.all === "1"} query={query} />
      ) : (
        <PageMessage
          title="Sign in to see the votes."
          body="The Dally M is for the comp's tippers: sign in to vote and see the leaderboard."
          action={{ href: "/sign-in", label: "Sign in" }}
        />
      )}

      {!src.live && (
        <SampleNote>
          The real players from 2026 Rounds 1 to 9; the votes are made up. Your votes save in this browser only.
        </SampleNote>
      )}
    </main>
  );
}

function YourVotes({
  season, open, players, votes, nextRound,
}: { season: number; open?: { round: number; closes: string }; players: RoundPlayer[]; votes: DallyMVotes | null; nextRound: number }) {
  return (
    <section aria-labelledby="your-votes" className="mt-6">
      <h2 id="your-votes" className="font-display text-[24px] leading-none font-bold uppercase">
        {open ? `Your votes · Round ${open.round}` : "Your votes"}
      </h2>
      {!open ? (
        <p className="mt-2 text-[15px] text-ink-2">
          Voting for Round {nextRound} opens once its results are in, usually on Monday.
        </p>
      ) : !votes ? (
        <p className="mt-2 text-[15px] text-ink-2">
          <Link href="/sign-in" className="font-semibold text-ink underline underline-offset-2 hover:text-lime-fg">
            Sign in
          </Link>{" "}
          to vote.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[14px] text-ink-2">
            Closes <LocalTime iso={open.closes} />
            {votes.voters != null && (
              <>
                {" "}
                · {votes.voters} of {votes.tippers.length} tippers have voted
              </>
            )}
          </p>
          <DallyMBallot season={season} round={open.round} closes={open.closes} players={players} />
        </>
      )}
    </section>
  );
}

function Revealed({
  round, rounds, query, votes, players,
}: { round: number; rounds: number[]; query: Record<string, string>; votes: DallyMVotes; players: RoundPlayer[] }) {
  const results = rankTallies(votes.results[round] ?? []).slice(0, TOP_ROUND);
  const byId = new Map(players.map((p) => [p.id, p]));
  const tippers = [...votes.tippers].sort((a, b) => Number(b.id === votes.you) - Number(a.id === votes.you) || a.name.localeCompare(b.name));
  return (
    <section aria-labelledby="revealed" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <h2 id="revealed" className="font-display text-[24px] leading-none font-bold uppercase">
          Round {round} revealed
        </h2>
        {rounds.length > 1 && (
          <QuerySelect
            path="/dally-m"
            label="Round"
            param="round"
            value={String(round)}
            options={[...rounds].reverse().map((r) => ({ value: String(r), label: `Round ${r}` }))}
            query={query}
          />
        )}
      </div>

      {results.length === 0 ? (
        <p className="mt-3 text-[15px] text-ink-2">Nobody voted in Round {round}.</p>
      ) : (
        <div className="mt-3 grid gap-y-6">
          <div>
            <h3 className="text-[13px] font-semibold text-ink-3">The round&rsquo;s votes</h3>
            <TallyTable tallies={results} caption={`Round ${round} votes`} />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-ink-3">Who voted for whom</h3>
            <ul className="mt-1 border-t border-line-soft">
              {tippers.map((t) => {
                const b = ballotOf(votes.rows, t.id, round);
                const any = VOTE_SLOTS.some((s) => b[s] != null);
                return (
                  <li key={t.id} className={`border-b border-line-soft px-2 py-2.5 ${t.id === votes.you ? "bg-lime-wash" : ""}`}>
                    <p className="text-[15px] font-semibold text-ink">{t.id === votes.you ? `${t.name} (you)` : t.name}</p>
                    {any ? (
                      <ol className="mt-1 grid gap-0.5">
                        {VOTE_SLOTS.map((s) => {
                          const p = b[s] == null ? undefined : byId.get(b[s]!);
                          return (
                            <li key={s} className="flex items-baseline gap-2 text-[14px] text-ink-2">
                              <span className="w-3 font-score font-bold text-ink">{s}</span>
                              {p ? `${p.name} · ${p.team}` : "–"}
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className="text-[14px] text-ink-3">Didn&rsquo;t vote</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function Leaderboard({ season, tallies, all, query }: { season: number; tallies: Tally[]; all: boolean; query: Record<string, string> }) {
  const ranked = rankTallies(tallies);
  const rows = all ? ranked : ranked.slice(0, TOP_BOARD);
  return (
    <section aria-labelledby="leaderboard" className="mt-8">
      <h2 id="leaderboard" className="font-display text-[24px] leading-none font-bold uppercase">
        {season} leaderboard
      </h2>
      <p className="mt-2 text-[13px] leading-snug text-ink-3">Votes from closed rounds. Level on votes, more 3s, then more 2s, goes higher.</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-[15px] text-ink-2">No votes revealed yet. The first round&rsquo;s show up when voting closes.</p>
      ) : (
        <>
          <TallyTable tallies={rows} caption={`${season} Dally M leaderboard`} />
          {!all && ranked.length > TOP_BOARD && (
            <Link
              href={`/dally-m?${new URLSearchParams({ ...query, all: "1" })}#leaderboard`}
              className="mt-3 inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold text-ink-2 ring-1 ring-line ring-inset hover:text-ink hover:ring-ink-3"
            >
              Show all {ranked.length}
            </Link>
          )}
        </>
      )}
    </section>
  );
}

function TallyTable({ tallies, caption }: { tallies: RankedTally[]; caption: string }) {
  return (
    <table className="mt-1 w-full border-collapse text-left">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-line text-[12px] font-semibold text-ink-3">
          <th scope="col" className="w-10 py-2 pl-2 font-semibold">
            <span className="sr-only">Rank</span>
          </th>
          <th scope="col" className="py-2 font-semibold">
            Player
          </th>
          <th scope="col" className="w-14 py-2 text-right font-semibold">
            Votes
          </th>
          <th scope="col" className="w-12 py-2 pr-2 text-right font-semibold">
            3s
          </th>
        </tr>
      </thead>
      <tbody>
        {tallies.map((t) => (
          <tr key={t.playerId} className="border-b border-line-soft">
            <td className={`py-2.5 pl-2 align-middle font-score text-[20px] font-bold ${t.rank === 1 ? "text-lime-fg" : "text-ink-2"}`}>
              {t.tied ? "=" : ""}
              {t.rank}
            </td>
            <td className="py-2.5 align-middle">
              <span className="flex items-center gap-2.5">
                <PlayerPhoto src={t.image} team={t.team} />
                <span className="min-w-0">
                  <span className="block text-[15px] leading-tight font-semibold text-ink">{t.name}</span>
                  <span className="text-[12px] text-ink-3">{t.team}</span>
                </span>
              </span>
            </td>
            <td className="py-2.5 text-right align-middle font-score text-[20px] font-bold text-ink">{t.votes}</td>
            <td className="py-2.5 pr-2 text-right align-middle font-score text-[17px] font-semibold text-ink-2">{t.threes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
