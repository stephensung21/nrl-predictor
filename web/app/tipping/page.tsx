import type { Metadata } from "next";
import { SampleNote } from "@/components/sample-note";
import { TipList, type TipGame } from "@/components/tip-list";
import { ladderBefore, seasonAt, tipFor } from "@/lib/ladder";
import { buildRound } from "@/lib/round";
import { margins, round10, SAMPLE_NOW, tippers, tips, YOU_ID, YOUR_EARLY_TIP_COUNT } from "@/lib/sample";
import type { TeamName } from "@/lib/teams";

export const metadata: Metadata = { title: "Tips · rugbyleague-tipper" };

type State = "open" | "live";

export default async function TipsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const state: State = (await searchParams).state === "live" ? "live" : "open";
  const view = buildRound({
    data: round10,
    now: new Date(SAMPLE_NOW[state]),
    tips,
    tippers,
    ladderBefore: ladderBefore(round10.round),
    youId: YOU_ID,
  });

  const you = tippers.find((t) => t.id === YOU_ID)!;
  const r10 = seasonAt("recap").at(-1)!;
  const games: TipGame[] = view.games.map((g) => {
    const locked = g.status !== "upcoming";
    const tipsFor = tips.filter((t) => t.matchId === g.match.id);
    return {
      matchId: g.match.id,
      home: g.match.home,
      away: g.match.away,
      kickoff: g.match.kickoff,
      venue: g.match.venue,
      status: g.status,
      featured: g.featured,
      modelTip: g.modelTip,
      modelPct: Math.round(g.modelProb * 100),
      winners: g.winners,
      score: g.status === "final" ? [g.match.homeScore!, g.match.awayScore!] : undefined,
      // Everyone's tips stay hidden until the game locks.
      tally: locked ? [g.match.home, g.match.away].map((team) => ({ team, count: tipsFor.filter((t) => t.team === team).length })) : undefined,
      tippers: tippers.length,
      autoTeam: locked ? tipFor({ ...r10, tips: r10.tips.filter((t) => t.tipperId !== YOU_ID) }, r10.games.find((x) => x.matchId === g.match.id)!, you).team : undefined,
    };
  });

  // Tuesday night: the viewer has tipped the first few games. By Saturday they've done the lot.
  const yours = tips.filter((t) => t.tipperId === YOU_ID);
  const initial = Object.fromEntries(
    (state === "open" ? yours.slice(0, YOUR_EARLY_TIP_COUNT) : yours).map((t) => [t.matchId, t.team]),
  ) as Record<string, TeamName>;
  // The featured game is among the first few, so its margin was entered with them (the home page shows it too).
  const yourMargin = margins.find((m) => m.tipperId === YOU_ID)?.margin ?? null;

  return (
    <main>
      <TipList season={round10.season} round={round10.round} games={games} initialTips={initial} initialMargin={yourMargin} />
      <SampleNote
        states={[
          { href: "/tipping", label: "Tipping open · Tue 7:30pm", on: state === "open" },
          { href: "/tipping?state=live", label: "In progress · Sat 6:20pm", on: state === "live" },
        ]}
      >
        The real 2026 Round 10 games and the Model&rsquo;s picks. Your tips save in this browser only; other tippers are made up.
      </SampleNote>
    </main>
  );
}
