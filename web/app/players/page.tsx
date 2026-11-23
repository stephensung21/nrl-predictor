import type { Metadata } from "next";
import Link from "next/link";
import { PageMessage } from "@/components/page-message";
import { PlayerPhoto } from "@/components/player-photo";
import { PlayerSearch, QuerySelect } from "@/components/player-pickers";
import { SampleNote } from "@/components/sample-note";
import { TeamBadge } from "@/components/team-badge";
import {
  formatRating, MIN_GAMES, POSITION_CODE, POSITIONS, powerRankings, statGroups, type PlayerSeason, type Position,
} from "@/lib/players";
import { tippers, YOU_ID } from "@/lib/sample";
import { playersSource } from "@/lib/source";
import { tippingLive } from "@/lib/supabase";
import { serverClient } from "@/lib/supabase-server";
import type { TeamName } from "@/lib/teams";

export const metadata: Metadata = { title: "Players · Full Credit" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

/** The signed-in tipper's favourite team (the sample's "you" on sample data), to tint its players. */
async function favouriteTeam(live: boolean): Promise<TeamName | undefined> {
  if (!live) return tippers.find((t) => t.id === YOU_ID)?.favTeam;
  if (!tippingLive) return undefined;
  const sb = await serverClient();
  const { data: auth } = (await sb?.auth.getUser()) ?? { data: { user: null } };
  if (!sb || !auth.user) return undefined;
  const { data } = await sb.from("profiles").select("fav_team").eq("id", auth.user.id).maybeSingle();
  return (data?.fav_team ?? undefined) as TeamName | undefined;
}

export default async function PlayersPage({ searchParams }: Props) {
  const q = await searchParams;
  const src = await playersSource();
  if (src.missing) {
    return <PageMessage title="Player stats are on their way." body="The players page's data hasn't been published yet." />;
  }
  if (!src.seasons.length) {
    return <PageMessage title="No player stats yet." body="They appear once the first games of the season are played." />;
  }
  const season = src.seasons.includes(Number(q.season)) ? Number(q.season) : src.seasons[0];
  const players = await src.season(season);
  const tab = q.tab === "stats" ? "stats" : "rankings";
  const position = (POSITIONS as readonly string[]).includes(q.pos ?? "") ? (q.pos as Position) : null;
  const fav = await favouriteTeam(src.live);
  const query: Record<string, string> = { season: String(season), tab, ...(position ? { pos: position } : {}) };
  const ranked = powerRankings(players, null);
  const picked = players.find((p) => p.id === Number(q.player)) ?? ranked[0]?.player ?? players[0];

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-4 pb-3">
        <h1 className="font-display text-[26px] leading-none font-bold uppercase">Players</h1>
        <QuerySelect
          label="Season"
          param="season"
          value={String(season)}
          options={src.seasons.map((s) => ({ value: String(s), label: String(s) }))}
          query={query}
        />
      </div>

      <nav aria-label="Players views" className="flex gap-2 border-b border-line pb-3">
        {(
          [
            ["rankings", "Power rankings"],
            ["stats", "Player stats"],
          ] as const
        ).map(([t, label]) => (
          <Link
            key={t}
            href={`/players?${new URLSearchParams({ ...query, tab: t })}`}
            aria-current={tab === t ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold transition-colors ${
              tab === t ? "bg-ink text-ground" : "text-ink-2 ring-1 ring-line ring-inset hover:text-ink hover:ring-ink-3"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {players.length === 0 ? (
        <p className="mt-6 text-[15px] text-ink-2">No games yet in {season}.</p>
      ) : tab === "rankings" ? (
        <Rankings players={players} position={position} season={season} query={query} fav={fav} />
      ) : (
        picked && <Stats player={picked} players={players} query={query} />
      )}

      {!src.live && (
        <SampleNote>
          Real 2025 and 2026 seasons for the {players.length} players with the most minutes. Ratings and rankings are the
          Model&rsquo;s, from every game.
        </SampleNote>
      )}
    </main>
  );
}

function Rankings({
  players, position, season, query, fav,
}: { players: PlayerSeason[]; position: Position | null; season: number; query: Record<string, string>; fav?: TeamName }) {
  const rows = powerRankings(players, position);
  return (
    <section aria-labelledby="rankings" className="mt-5">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <h2 id="rankings" className="font-display text-[24px] leading-none font-bold uppercase">
          Power rankings
        </h2>
        <QuerySelect
          label="Position"
          param="pos"
          value={position ?? ""}
          options={[{ value: "", label: "All players" }, ...POSITIONS.map((p) => ({ value: p, label: p }))]}
          query={{ ...query, tab: "rankings" }}
        />
      </div>
      <p className="mt-2 text-[13px] leading-snug text-ink-3">
        Ranked by the Model&rsquo;s rating: the points of margin a player adds over a full game, as the Model rates him after
        the {season} season&rsquo;s latest game. Fantasy is NRL fantasy points per game. At least {MIN_GAMES} games to be
        ranked.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-[15px] text-ink-2">Nobody at {position ?? "any position"} has played {MIN_GAMES} games yet.</p>
      ) : (
        <table className="mt-3 w-full border-collapse text-left">
          <caption className="sr-only">
            Power rankings, {position ?? "all players"}, {season}
          </caption>
          <thead>
            <tr className="border-b border-line text-[12px] font-semibold text-ink-3">
              <th scope="col" className="w-10 py-2 pl-2 font-semibold">
                <span className="sr-only">Rank</span>
              </th>
              <th scope="col" className="py-2 font-semibold">
                Player
              </th>
              <th scope="col" className="w-16 py-2 text-right font-semibold">
                Rating
              </th>
              <th scope="col" className="w-16 py-2 pr-2 text-right font-semibold">
                Fantasy
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ rank, tied, player, fantasyPerGame }) => (
              <tr key={player.id} className={`border-b border-line-soft ${player.team === fav ? "bg-lime-wash" : ""}`}>
                <td className={`py-2.5 pl-2 align-middle font-score text-[20px] font-bold ${rank === 1 ? "text-lime-fg" : "text-ink-2"}`}>
                  {tied ? "=" : ""}
                  {rank}
                </td>
                <td className="py-2.5 align-middle">
                  <Link
                    href={`/players?${new URLSearchParams({ ...query, tab: "stats", player: String(player.id) })}`}
                    className="flex items-center gap-2.5 rounded-sm focus-visible:ring-2 focus-visible:ring-lime-fg focus-visible:outline-none"
                  >
                    <PlayerPhoto src={player.image} team={player.team} />
                    <span className="min-w-0">
                      <span className="block text-[15px] leading-tight font-semibold text-ink underline-offset-2 hover:underline">
                        {player.name}
                      </span>
                      <span className="text-[12px] text-ink-3">
                        {player.position} · {player.team} · {player.games} games
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="py-2.5 text-right align-middle font-score text-[20px] font-bold text-ink">
                  {formatRating(player.rating!)}
                </td>
                <td className="py-2.5 pr-2 text-right align-middle font-score text-[17px] font-semibold text-ink-2">
                  {fantasyPerGame.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Stats({ player, players, query }: { player: PlayerSeason; players: PlayerSeason[]; query: Record<string, string> }) {
  const options = [...players]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ id: p.id, label: `${p.name} (${p.team})` }));
  const ranked = powerRankings(players, null).find((r) => r.player.id === player.id);
  const posRank = player.position !== "Interchange" ? powerRankings(players, player.position).find((r) => r.player.id === player.id) : undefined;
  return (
    <section aria-labelledby="player-name" className="mt-5">
      <PlayerSearch players={options} query={query} />

      <div className="mt-6 flex items-center gap-3">
        <PlayerPhoto src={player.image} team={player.team} size="lg" />
        <div className="min-w-0">
          <h2 id="player-name" className="font-display text-[30px] leading-none font-bold uppercase">
            {player.name}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[14px] text-ink-2">
            <TeamBadge name={player.team} size="sm" />
            {player.position} · {player.team} · {player.games} game{player.games === 1 ? "" : "s"} ·{" "}
            {Math.round(player.stats.minutes / Math.max(1, player.games))} min a game
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <Figure label="Model rating" value={player.rating == null ? "–" : formatRating(player.rating)} />
        <Figure
          label={posRank ? `${POSITION_CODE[player.position]} rank` : "Overall rank"}
          value={posRank ? `${posRank.tied ? "=" : ""}${posRank.rank}` : ranked ? `${ranked.tied ? "=" : ""}${ranked.rank}` : "–"}
        />
        <Figure label="Fantasy a game" value={(player.stats.fantasy_points / Math.max(1, player.games)).toFixed(1)} />
      </dl>

      <div className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
        {statGroups(player).map((g) => (
          <section key={g.title} aria-labelledby={`stats-${g.title}`}>
            <h3 id={`stats-${g.title}`} className="font-display text-[20px] leading-none font-bold uppercase">
              {g.title}
            </h3>
            <dl className="mt-2 border-t border-line-soft">
              {g.lines.map((l) => (
                <div key={l.label} className="flex items-baseline justify-between gap-3 border-b border-line-soft py-2">
                  <dt className="text-[14px] text-ink-2">{l.label}</dt>
                  <dd className="text-right">
                    <span className="font-score text-[18px] font-semibold text-ink">{l.value}</span>
                    {l.perGame && <span className="ml-1.5 font-score text-[14px] text-ink-3">{l.perGame}/g</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg bg-raised px-3 py-3">
      <dt className="order-2 mt-1 text-[12px] font-semibold text-ink-3">{label}</dt>
      <dd className="order-1 font-score text-[26px] leading-none font-bold text-ink">{value}</dd>
    </div>
  );
}
