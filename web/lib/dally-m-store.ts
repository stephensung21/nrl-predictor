// Where Dally M votes are saved and read. The ballot talks only to the VoteStore interface: this
// browser for the sample, or Supabase when it's configured (dally_m_votes, where row-level security
// keeps votes hidden until the round closes and refuses changes after it). The page reads the
// revealed votes, tallies and leaderboard through `readVotes`, as the signed-in tipper.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ballotOf, ballotRows, EMPTY_BALLOT, type Ballot, type Tally, type VoteRow, type VoteSlot } from "./dally-m";
import { browserClient, RLS_DENIED, tippingLive } from "./supabase";
import type { TeamName } from "./teams";
import { LockedError } from "./tip-store";

export interface VoteStore {
  /** The viewer's saved ballot for a round (empty slots null). */
  load(season: number, round: number): Promise<Ballot>;
  /** Replaces the viewer's ballot for a round. Rejects with LockedError once voting has closed. */
  save(season: number, round: number, ballot: Ballot): Promise<void>;
}

/** Sample store: the viewer's own browser. Nothing leaves the device. */
export class BrowserVoteStore implements VoteStore {
  constructor(private readonly isClosed: () => boolean = () => false) {}

  private key(season: number, round: number) {
    return `rlt:dallym:${season}:${round}`;
  }

  async load(season: number, round: number): Promise<Ballot> {
    try {
      const raw = window.localStorage.getItem(this.key(season, round));
      return raw ? { ...EMPTY_BALLOT, ...(JSON.parse(raw) as Ballot) } : { ...EMPTY_BALLOT };
    } catch {
      return { ...EMPTY_BALLOT };
    }
  }

  async save(season: number, round: number, ballot: Ballot) {
    if (this.isClosed()) throw new LockedError();
    window.localStorage.setItem(this.key(season, round), JSON.stringify(ballot));
  }
}

/** Live store: the `dally_m_votes` table. */
export class SupabaseVoteStore implements VoteStore {
  constructor(private readonly sb: SupabaseClient = browserClient()) {}

  private async userId() {
    const { data } = await this.sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error("Sign in to vote.");
    return id;
  }

  async load(season: number, round: number): Promise<Ballot> {
    const { data: s } = await this.sb.auth.getSession();
    const user = s.session?.user.id;
    if (!user) return { ...EMPTY_BALLOT };
    const { data, error } = await this.sb
      .from("dally_m_votes").select("votes, player_id").eq("user_id", user).eq("season", season).eq("round", round);
    if (error) throw error;
    return ballotOf(data.map((r) => ({ userId: user, round, votes: r.votes as VoteSlot, playerId: Number(r.player_id) })), user, round);
  }

  async save(season: number, round: number, ballot: Ballot) {
    const user_id = await this.userId();
    const rows = ballotRows(ballot);
    // Clear the slots this ballot leaves empty first, so a player moving into a filled slot doesn't
    // briefly hold two. The upsert is one statement, so a swap between slots is checked as a whole.
    const keep = rows.map((r) => r.votes);
    let clear = this.sb.from("dally_m_votes").delete().eq("user_id", user_id).eq("season", season).eq("round", round);
    if (keep.length) clear = clear.not("votes", "in", `(${keep.join(",")})`);
    const { error: cleared } = await clear;
    if (cleared?.code === RLS_DENIED) throw new LockedError();
    if (cleared) throw cleared;
    if (!rows.length) return;
    const { error } = await this.sb.from("dally_m_votes").upsert(
      rows.map((r) => ({ user_id, season, round, votes: r.votes, player_id: r.playerId })),
      { onConflict: "user_id,season,round,votes" },
    );
    if (error?.code === RLS_DENIED) throw new LockedError();
    if (error) throw error;
  }
}

/** The store the site uses: Supabase when it's configured, this browser otherwise. */
export function createVoteStore(isClosed: () => boolean): VoteStore {
  return tippingLive ? new SupabaseVoteStore() : new BrowserVoteStore(isClosed);
}

/** What the viewer may see of a season's votes: every closed round's, and their own. */
export type DallyMVotes = {
  you: string;
  tippers: { id: string; name: string; favTeam?: TeamName }[];
  /** Closed rounds' votes by everyone, plus the viewer's own on the open round. */
  rows: VoteRow[];
  /** Each closed round's tallies, by round. */
  results: Record<number, Tally[]>;
  /** The season's tallies over closed rounds. */
  leaderboard: Tally[];
  /** How many tippers have voted in the open round, if there is one. */
  voters: number | null;
};

const tally = (r: Record<string, unknown>): Tally => ({
  playerId: Number(r.player_id), name: r.player_name as string, team: r.team as TeamName, image: (r.head_image as string | null) ?? null,
  votes: Number(r.votes), threes: Number(r.threes), twos: Number(r.twos), ones: Number(r.ones),
});

/** The season's votes as the signed-in tipper may see them (row-level security decides). */
export async function readVotes(sb: SupabaseClient, you: string, season: number, open: number | null): Promise<DallyMVotes> {
  const [profiles, votes, results, board, voters] = await Promise.all([
    sb.from("profiles").select("id, display_name, fav_team, is_model"),
    sb.from("dally_m_votes").select("user_id, round, votes, player_id").eq("season", season),
    sb.from("dally_m_round_results").select("*").eq("season", season),
    sb.from("dally_m_leaderboard").select("*").eq("season", season),
    open == null ? Promise.resolve({ data: null, error: null }) : sb.rpc("dally_m_voters", { p_season: season, p_round: open }),
  ]);
  for (const r of [profiles, votes, results, board, voters]) if (r.error) throw r.error;
  const byRound: Record<number, Tally[]> = {};
  for (const r of results.data ?? []) (byRound[r.round as number] ??= []).push(tally(r));
  return {
    you,
    tippers: (profiles.data ?? [])
      .filter((p) => !p.is_model)
      .map((p) => ({ id: p.id as string, name: p.display_name as string, favTeam: (p.fav_team ?? undefined) as TeamName | undefined })),
    rows: (votes.data ?? []).map((r) => ({ userId: r.user_id as string, round: r.round as number, votes: r.votes as VoteSlot, playerId: Number(r.player_id) })),
    results: byRound,
    leaderboard: (board.data ?? []).map(tally),
    voters: (voters.data as number | null) ?? null,
  };
}
