import type { Metadata } from "next";
import Link from "next/link";
import { SampleNote } from "@/components/sample-note";
import { TipList, type TipGame } from "@/components/tip-list";
import { ladderBefore, seasonAt, tipFor } from "@/lib/ladder";
import { buildRound } from "@/lib/round";
import { margins, round10, SAMPLE_NOW, tippers, tips, YOU_ID, YOUR_EARLY_TIP_COUNT } from "@/lib/sample";
import { liveTipRound } from "@/lib/source";
import { tippingLive } from "@/lib/supabase";
import { serverClient } from "@/lib/supabase-server";
import type { TeamName } from "@/lib/teams";
import type { RoundData } from "@/lib/types";

export const metadata: Metadata = { title: "Tips · rugbyleague-tipper" };

type State = "open" | "live";

export default async function TipsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (tippingLive) {
    const round = await liveTipRound(new Date());
    // Live tips need live games: without the model's database (SITE_DATABASE_URL) there are none.
    if (round === undefined) return <Message title="Tipping isn't connected yet." body="The site can't reach the Model's games right now." />;
    return <LiveTipsPage round={round} />;
  }
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

function Message({ title, body, action }: { title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <main>
      <section className="pt-12">
        <h1 className="font-display text-[36px] leading-[0.92] font-bold uppercase">{title}</h1>
        <p className="mt-4 max-w-[38ch] text-[16px] leading-relaxed text-ink-2">{body}</p>
        {action && (
          <Link
            href={action.href}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-lime px-5 py-3 text-[15px] font-bold text-lime-ink"
          >
            {action.label}
          </Link>
        )}
      </section>
    </main>
  );
}

/** The live comp: the round in play from the model's data, the viewer's tips and the comp's from
 * Supabase as the viewer, so row-level security decides what they may see (others' tips only
 * after kickoff). */
async function LiveTipsPage({ round }: { round: RoundData | null }) {
  const sb = (await serverClient())!;
  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) {
    return <Message title="Sign in to tip." body="The comp is invite-only. Sign in with the Google account you joined with." action={{ href: "/sign-in", label: "Sign in" }} />;
  }
  const { data: me } = await sb.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!me) return <Message title="Signed in, but not in the comp." body="Joining needs an invite link from whoever runs the comp." />;
  if (!round) {
    return <Message title="No round to tip." body="It's the off-season. Tipping opens when the Model's first predictions for next season are out." />;
  }

  const view = buildRound({ data: round, now: new Date(), tips: [], tippers: [], ladderBefore: [] });
  const ids = view.games.map((g) => Number(g.match.id));
  const lockedIds = view.games.filter((g) => g.status !== "upcoming").map((g) => Number(g.match.id));
  const [{ data: all }, { count: tipperCount }] = await Promise.all([
    // The viewer's own tips, and everyone's once their game has locked (row-level security).
    sb.from("tips").select("user_id, match_id, team, margin, profiles!inner(is_model)").in("match_id", ids),
    sb.from("profiles").select("id", { count: "exact", head: true }).eq("is_model", false),
  ]);
  const rows = (all ?? []) as unknown as { user_id: string; match_id: number; team: TeamName; margin: number | null; profiles: { is_model: boolean } }[];
  const mine = rows.filter((t) => t.user_id === user.id);
  const theirs = rows.filter((t) => !t.profiles.is_model);
  // What the viewer's auto-tip gives each locked game they didn't tip.
  const autos = new Map<string, TeamName>();
  await Promise.all(
    lockedIds
      .filter((id) => !mine.some((t) => t.match_id === id))
      .map(async (id) => {
        const { data } = await sb.rpc("auto_tip", { p_user: user.id, p_match: id });
        if (data) autos.set(String(id), data as TeamName);
      }),
  );

  const games: TipGame[] = view.games.map((g) => {
    const locked = g.status !== "upcoming";
    const tipsFor = theirs.filter((t) => String(t.match_id) === g.match.id);
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
      tally: locked ? [g.match.home, g.match.away].map((team) => ({ team, count: tipsFor.filter((t) => t.team === team).length })) : undefined,
      tippers: tipperCount ?? 0,
      autoTeam: locked ? autos.get(g.match.id) : undefined,
    };
  });
  const initial = Object.fromEntries(mine.map((t) => [String(t.match_id), t.team])) as Record<string, TeamName>;
  const margin = mine.find((t) => String(t.match_id) === round.featuredMatchId)?.margin ?? null;

  return (
    <main>
      <TipList season={round.season} round={round.round} games={games} initialTips={initial} initialMargin={margin} />
    </main>
  );
}
