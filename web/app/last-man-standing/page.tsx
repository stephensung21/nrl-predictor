import { RuleStrip } from "@/components/art/diagrams";
import type { Metadata } from "next";
import { Check, X } from "lucide-react";
import { GroupSwitcher } from "@/components/group-switcher";
import { LmsPicker } from "@/components/lms-picker";
import { PageMessage } from "@/components/page-message";
import { SampleNote } from "@/components/sample-note";
import { TeamBadge } from "@/components/team-badge";
import { COMP_FIRST_SEASON } from "@/lib/comp";
import { playSeason, yourTurn, type LmsEntry, type LmsGame, type LmsMatch, type LmsSeason, type Turn } from "@/lib/lms";
import type { LmsTipper } from "@/lib/lms-store";
import { lmsSource } from "@/lib/source";

export const metadata: Metadata = { title: "Last man standing · Full Credit" };
// Each tipper sees their own pick, and others' only once their game kicks off: render per request.
export const dynamic = "force-dynamic";

export default async function LastManStandingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const src = await lmsSource((await searchParams).group);
  if (src.missing) return <PageMessage art="team-sheet" title="Last man standing is on its way." body="Its picks haven't been set up yet." />;
  if (src.season == null) {
    return <PageMessage art="last-one" title="No last man standing yet." body={`The first game starts with Round 1 of ${COMP_FIRST_SEASON}, once the draw is out.`} />;
  }
  if (!src.view) {
    return (
      <PageMessage
        art="whistle"
        title="Sign in to play."
        body="Last man standing is for the comp's tippers: sign in to pick and see who's still in."
        action={{ href: "/sign-in", label: "Sign in" }}
      />
    );
  }
  const { you, tippers, picks, groups, fields } = src.view;
  const season = playSeason(tippers.map((t) => t.id), src.matches, picks, src.seasonOver);
  const shown = yourTurn(season, you);
  // One pick counts in every game you're in: out of this one, you may still be in another.
  const elsewhere =
    shown && !shown.alive
      ? fields.map((f) => yourTurn(playSeason(f, src.matches, picks, src.seasonOver), you)).find((t) => t?.alive && t.round === shown.round)
      : undefined;
  const turn = elsewhere ?? shown;
  const game = season.games.at(-1);
  const names = new Map(tippers.map((t) => [t.id, t.id === you ? `${t.name} (you)` : t.name]));

  return (
    <main>
      <h1 className="pt-4 pb-3 font-display text-[26px] leading-none font-bold uppercase">
        Last man standing{groups.current ? <span className="text-ink-3"> · {groups.current.name}</span> : null}
      </h1>
      <GroupSwitcher choice={groups} />
      <RuleStrip
        label="The rules"
        steps={[
          { icon: "ball", title: "Pick one team a round", note: "Never the same team twice in a game" },
          { icon: "cross", title: "Lose, draw or miss: out", note: "No pick counts as out" },
          { icon: "draw", title: "Everyone out together?", note: "That round doesn’t count" },
          { icon: "crown", title: "Last one left wins", note: "A new game starts the next round" },
        ]}
      />

      <YourPick season={src.season} now={src.now} turn={turn} matches={src.matches} elsewhere={!!elsewhere} />

      {game && <ThisGame game={game} names={names} tippers={tippers} you={you} />}

      <Tally season={season} names={names} you={you} />

      {!src.live && (
        <SampleNote>The real results from 2026 Rounds 1 to 9; the picks are made up. Your pick saves in this browser only.</SampleNote>
      )}
    </main>
  );
}

function YourPick({
  season, now, turn, matches, elsewhere,
}: { season: number; now: string; turn: Turn | null; matches: LmsMatch[]; elsewhere: boolean }) {
  return (
    <section aria-labelledby="your-pick" className="mt-6">
      <h2 id="your-pick" className="font-display text-[24px] leading-none font-bold uppercase">
        {turn ? `Your pick · Round ${turn.round}` : "Your pick"}
      </h2>
      {!turn ? (
        <p className="mt-2 text-[15px] text-ink-2">Picks for the next round open once its draw is out.</p>
      ) : !turn.alive ? (
        <p className="mt-2 text-[15px] text-ink-2">
          You&rsquo;re out of game {turn.game}. Everyone&rsquo;s back in for the next game, the round after this one ends.
        </p>
      ) : (
        <>
          {elsewhere && (
            <p className="mt-2 text-[14px] text-ink-2">You&rsquo;re out of this game, but still in another of yours: your pick counts there.</p>
          )}
          <LmsPicker
            season={season}
            round={turn.round}
            now={now}
            used={turn.used}
            games={matches.filter((m) => m.round === turn.round).map((m) => ({ id: m.id, kickoff: m.kickoff, home: m.home, away: m.away }))}
          />
        </>
      )}
    </section>
  );
}

function ThisGame({ game, names, tippers, you }: { game: LmsGame; names: Map<string, string>; tippers: LmsTipper[]; you: string }) {
  const going = game.endRound == null;
  // Still in first, then by how long they lasted.
  const lasted = (id: string) => game.rounds.filter((r) => r.entries.some((e) => e.userId === id)).length;
  const rows = [...tippers].sort(
    (a, b) => Number(game.alive.includes(b.id)) - Number(game.alive.includes(a.id)) || lasted(b.id) - lasted(a.id) || a.name.localeCompare(b.name),
  );
  const first = game.rounds[0]?.graded;
  return (
    <section aria-labelledby="this-game" className="mt-8">
      <h2 id="this-game" className="font-display text-[24px] leading-none font-bold uppercase">
        Game {game.number}
      </h2>
      <p className="mt-2 text-[14px] text-ink-2">
        {going
          ? first
            ? `From Round ${game.startRound}. ${game.alive.length} of ${tippers.length} still in.`
            : `Starts Round ${game.startRound}. Everyone's in.`
          : `${span(game)}. ${winners(game.winners, names)}.`}
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Game {game.number} picks by round</caption>
          <thead>
            <tr className="border-b border-line text-[12px] font-semibold text-ink-3">
              <th scope="col" className="py-2 pl-2 font-semibold">
                Tipper
              </th>
              {game.rounds.map((r) => (
                <th key={r.round} scope="col" className="px-1 py-2 text-center font-semibold whitespace-nowrap">
                  R{r.round}
                  {r.void && <span className="sr-only"> (didn&rsquo;t count)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className={`border-b border-line-soft ${t.id === you ? "bg-lime-wash" : ""}`}>
                <th scope="row" className="py-2.5 pl-2 text-[15px] font-semibold whitespace-nowrap text-ink">
                  {names.get(t.id)}
                  {going && first && !game.alive.includes(t.id) && <span className="ml-1.5 text-[12px] font-normal text-ink-3">out</span>}
                </th>
                {game.rounds.map((r) => (
                  <td key={r.round} className="px-1 py-2.5 text-center align-middle">
                    <Cell entry={r.entries.find((e) => e.userId === t.id)} void={r.void} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {game.rounds.some((r) => r.void) && (
        <p className="mt-2 text-[13px] text-ink-3">
          A round where everyone still in went out doesn&rsquo;t count: they all stay in, and can use those teams again.
        </p>
      )}
    </section>
  );
}

function Cell({ entry, void: voided }: { entry?: LmsEntry; void: boolean }) {
  if (!entry) return null;
  const o = entry.outcome;
  if (!entry.team) {
    return <span className="text-[12px] whitespace-nowrap text-ink-3">{o === "missed" && !voided ? "No pick" : "–"}</span>;
  }
  const out = o === "out" || o === "repeat";
  if (voided) {
    return (
      <span className="inline-flex items-center gap-1">
        <TeamBadge name={entry.team} size="sm" dim />
        <span className="sr-only">{entry.team}, didn&rsquo;t count</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <TeamBadge name={entry.team} size="sm" dim={out} />
      {o === "survived" && <Check className="size-4 text-lime-fg" strokeWidth={3} aria-label={`${entry.team}, survived`} />}
      {o === "out" && <X className="size-4 text-miss" strokeWidth={3} aria-label={`${entry.team}, out`} />}
      {o === "repeat" && <X className="size-4 text-miss" strokeWidth={3} aria-label={`${entry.team}, out: used already this game`} />}
      {o === "pending" && <span className="sr-only">{entry.team}, to play</span>}
    </span>
  );
}

const span = (g: LmsGame) => (g.endRound === g.startRound ? `Round ${g.startRound}` : `Rounds ${g.startRound}–${g.endRound}`);

function winners(ids: string[], names: Map<string, string>) {
  const n = ids.map((id) => names.get(id) ?? "?");
  if (n.length === 0) return "No winner";
  if (n.length === 1) return `Won by ${n[0]}`;
  return `Shared by ${n.slice(0, -1).join(", ")} and ${n.at(-1)}`;
}

function Tally({ season, names, you }: { season: LmsSeason; names: Map<string, string>; you: string }) {
  const done = season.games.filter((g) => g.endRound != null);
  if (!done.length) return null;
  const rows = [...season.tally].sort((a, b) => b.wins - a.wins || (names.get(a.userId) ?? "").localeCompare(names.get(b.userId) ?? ""));
  return (
    <section aria-labelledby="tally" className="mt-8">
      <h2 id="tally" className="font-display text-[24px] leading-none font-bold uppercase">
        Games won
      </h2>
      <table className="mt-2 w-full border-collapse text-left">
        <caption className="sr-only">Last man standing games won this season</caption>
        <thead>
          <tr className="border-b border-line text-[12px] font-semibold text-ink-3">
            <th scope="col" className="py-2 pl-2 font-semibold">
              Tipper
            </th>
            <th scope="col" className="w-16 py-2 pr-2 text-right font-semibold">
              Wins
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className={`border-b border-line-soft ${r.userId === you ? "bg-lime-wash" : ""}`}>
              <th scope="row" className="py-2.5 pl-2 text-[15px] font-semibold text-ink">
                {names.get(r.userId)}
              </th>
              <td className={`py-2.5 pr-2 text-right font-score text-[20px] font-bold ${r.wins ? "text-ink" : "text-ink-3"}`}>{r.wins}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ol className="mt-4 grid gap-1 text-[14px] text-ink-2">
        {[...done].reverse().map((g) => (
          <li key={g.number}>
            <span className="font-semibold text-ink">Game {g.number}</span> · {span(g)} · {winners(g.winners, names)}
          </li>
        ))}
      </ol>
    </section>
  );
}
