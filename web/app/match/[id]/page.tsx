import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HeadToHead, MatchHeading, MatchTabs, TeamLists, TipLine, VoiceList, type MatchTab } from "@/components/match-sections";
import { SampleNote } from "@/components/sample-note";
import { CURRENT_ROUND, findSampleMatch, sampleRoundView, verdictFor, voicesFor } from "@/lib/match";
import { SAMPLE_NOW, YOUR_EARLY_TIP_COUNT } from "@/lib/sample";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const m = findSampleMatch(id)?.round.data.matches.find((x) => x.id === id);
  return { title: m ? `${m.home} v ${m.away} · rugbyleague-tipper` : "Match · rugbyleague-tipper" };
}

export default async function MatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const found = findSampleMatch(id);
  if (!found) notFound();

  // The current sample round can be viewed before kickoff or after full time; older rounds are graded.
  const current = found.round.data.round === CURRENT_ROUND;
  const state = current && query.state === "final" ? "final" : current ? "open" : "final";
  const view = sampleRoundView(found.round, state === "open" ? SAMPLE_NOW.open : SAMPLE_NOW.recap);
  const game = view.games.find((g) => g.match.id === id)!;
  if (state === "open") {
    // Before lockout the viewer has only tipped the round's first few games.
    const tipped = view.games.slice(0, YOUR_EARLY_TIP_COUNT).some((g) => g.match.id === id);
    if (!tipped) game.yourTip = undefined;
  }

  const voices = voicesFor(game, found.detail);
  const verdict = verdictFor(voices, game.status === "final");
  const tab: MatchTab = query.tab === "h2h" ? "h2h" : "teams";
  const qs = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => e[1] != null)).toString();

  return (
    <main>
      <MatchHeading game={game} verdict={verdict} voices={voices} />
      <VoiceList game={game} voices={voices} />
      <TipLine game={game} />
      <MatchTabs id={id} tab={tab} query={qs} />
      {tab === "teams" ? <TeamLists game={game} detail={found.detail} before={game.status === "upcoming"} /> : <HeadToHead game={game} detail={found.detail} />}
      <SampleNote
        states={
          current
            ? [
                { href: `/match/${id}?tab=${tab}`, label: "Before kickoff", on: state === "open" },
                { href: `/match/${id}?state=final&tab=${tab}`, label: "Full time", on: state === "final" },
              ]
            : undefined
        }
      >
        The real 2026 Round {found.round.data.round} replay: Tuesday predictions, the bookies&rsquo; opening price, Elo, team lists and
        the result. Your tip is made up.
      </SampleNote>
    </main>
  );
}
