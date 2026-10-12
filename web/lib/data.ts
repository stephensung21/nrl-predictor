// Reads the model's data from the database into the row shapes the pages already use (types.ts),
// so each page can swap its sample module for these one at a time (PLAN_WEB.md step 9). Every
// function takes the connection, so the tests can run them against a throwaway Postgres.

import type { Sql } from "./db";
import type { GradedGame } from "./model-record";
import type {
  Edge, EloSeason, EloTeamView, ListedPlayer, Match, MatchDetail, ModelRecord, OddsGame, OddsRound, Prediction,
  RoundData, SeasonBet, SeasonGame, Weather,
} from "./types";
import type { TeamName } from "./teams";

const iso = (d: Date | string) => new Date(d).toISOString();
const num = (v: unknown) => (v == null ? null : Number(v));

type MatchRow = {
  id: string; season: number; round: number; kickoff: Date; home_team: string; away_team: string;
  venue: string | null; city: string | null; status: string; home_score: number | null; away_score: number | null;
  round_title: string | null;
};

function toMatch(r: MatchRow): Match {
  return {
    id: String(r.id), season: r.season, round: r.round, ...(r.round_title ? { roundTitle: r.round_title } : {}),
    kickoff: iso(r.kickoff),
    home: r.home_team as TeamName, away: r.away_team as TeamName, venue: r.venue ?? "", city: r.city ?? "",
    ...(r.status === "postponed" ? { postponed: true } : {}),
    ...(r.status === "final" ? { homeScore: r.home_score!, awayScore: r.away_score! } : {}),
  };
}

const MATCH_COLS = "m.id, m.season, m.round, m.round_title, m.kickoff, m.home_team, m.away_team, m.venue, m.city, m.status, m.home_score, m.away_score";

/* ---------- rounds ---------- */

/** A round's predicted games, each with its prediction of record, and the round's margin game. */
export async function roundData(sql: Sql, season: number, round: number): Promise<RoundData | null> {
  const rows = await sql.unsafe<(MatchRow & {
    home_win_prob: number; margin: number; total: number; p_home: number; p_away: number; model: string;
    model_version: string; updated_reason: string | null;
  })[]>(
    `select ${MATCH_COLS}, p.home_win_prob, p.margin, p.total, p.home_score as p_home, p.away_score as p_away,
            p.model, p.model_version, p.updated_reason
     from matches m join prediction_of_record p on p.match_id = m.id
     where m.season = $1 and m.round = $2 order by m.kickoff, m.id`, [season, round]);
  if (!rows.length) return null;
  const [drawn] = await sql`select featured_match from rounds where season = ${season} and round = ${round}`;
  const predictions: Prediction[] = rows.map((r) => ({
    matchId: String(r.id), homeWinProb: r.home_win_prob, margin: r.margin, total: r.total,
    homePred: r.p_home, awayPred: r.p_away, model: r.model as Prediction["model"], modelVersion: r.model_version,
    ...(r.updated_reason ? { updated: r.updated_reason } : {}),
  }));
  const weather = await weatherFor(sql, rows.map((r) => String(r.id)));
  return {
    season, round,
    // The pipeline draws the margin game; until it has, the round's first game stands in.
    featuredMatchId: drawn?.featured_match != null ? String(drawn.featured_match) : String(rows[0].id),
    matches: rows.map((r) => {
      const m = toMatch(r);
      const w = weather.get(m.id);
      return w ? { ...m, weather: w } : m;
    }),
    predictions,
  };
}

/** Each game's weather (`match_weather`: observed if known, otherwise the latest forecast). */
export async function weatherFor(sql: Sql, matchIds: string[]): Promise<Map<string, Weather>> {
  if (!matchIds.length) return new Map();
  const rows = await sql`
    select match_id, kind, fetched_at, roofed, temp_c, rain_mm, rain_chance, wind_kmh, gust_kmh, wind_dir, conditions
    from match_weather where match_id in ${sql(matchIds)}`;
  return new Map(rows.map((r) => [String(r.match_id), {
    kind: r.kind, fetchedAt: iso(r.fetched_at), roofed: r.roofed, tempC: num(r.temp_c), rainMm: num(r.rain_mm),
    rainChance: num(r.rain_chance), windKmh: num(r.wind_kmh), gustKmh: num(r.gust_kmh), windDir: num(r.wind_dir),
    conditions: r.conditions,
  } satisfies Weather]));
}

/** The round the home page shows: the first with a predicted game still to be decided, else the
 * season's latest predicted round. */
export async function currentRound(sql: Sql, season: number): Promise<number | null> {
  const [r] = await sql`
    select coalesce(min(m.round) filter (where m.status not in ('final', 'cancelled')), max(m.round)) as round
    from matches m join prediction_of_record p on p.match_id = m.id where m.season = ${season}`;
  return r?.round ?? null;
}

/* ---------- one game ---------- */

type ListRow = { team: string; fetched_at: Date; player_name: string; jersey_number: number; position: string };

/** The named 17: the 17 lowest-numbered players who aren't reserves (features.named_from_list). */
function named17(rows: ListRow[]) {
  return rows.filter((r) => !/reserve/i.test(r.position)).sort((a, b) => a.jersey_number - b.jersey_number).slice(0, 17);
}

/** Each side's first list (Tuesday's) and last list before kickoff, with who came in and went out. */
function listsFor(rows: ListRow[], team: string): MatchDetail["lists"]["home"] {
  const versions = [...new Set(rows.filter((r) => r.team === team).map((r) => iso(r.fetched_at)))].sort();
  if (!versions.length) return { tuesday: [], players: [], out: [] };
  const version = (v: string) => named17(rows.filter((r) => r.team === team && iso(r.fetched_at) === v));
  const first = version(versions[0]);
  const last = version(versions[versions.length - 1]);
  const firstNames = new Set(first.map((p) => p.player_name));
  const lastNames = new Set(last.map((p) => p.player_name));
  const listed = (p: ListRow, isIn?: boolean): ListedPlayer => ({
    n: p.jersey_number, name: p.player_name, position: p.position, ...(isIn ? { isIn } : {}),
  });
  return {
    tuesday: first.map((p) => listed(p)),
    players: last.map((p) => listed(p, !firstNames.has(p.player_name))),
    out: first.filter((p) => !lastNames.has(p.player_name)).map((p) => p.player_name),
  };
}

/** Everything the match page shows beyond the round row, or null for an unknown game. */
export async function matchDetail(sql: Sql, matchId: string): Promise<MatchDetail | null> {
  const [m] = await sql.unsafe<(MatchRow & { neutral: boolean })[]>(
    `select ${MATCH_COLS}, m.neutral from matches m where m.id = $1`, [matchId]);
  if (!m) return null;
  const [p] = await sql`select no_odds_home_win_prob from prediction_of_record where match_id = ${matchId}`;
  const [o] = await sql`select p_open from match_odds_probs where match_id = ${matchId}`;
  const [e] = await sql`select win_prob from elo_ratings where match_id = ${matchId} and is_home`;
  const lists = await sql<ListRow[]>`
    select team, fetched_at, player_name, jersey_number, position from team_lists
    where match_id = ${matchId} and fetched_at < ${m.kickoff}`;
  const h2h = await sql.unsafe<MatchRow[]>(
    `select ${MATCH_COLS} from matches m
     where m.status = 'final' and m.kickoff < $1
       and ((m.home_team = $2 and m.away_team = $3) or (m.home_team = $3 and m.away_team = $2))
     order by m.kickoff desc limit 5`, [m.kickoff, m.home_team, m.away_team]);
  return {
    matchId, noOddsHomeProb: num(p?.no_odds_home_win_prob), marketHomeProb: num(o?.p_open), eloHomeProb: num(e?.win_prob),
    neutral: m.neutral,
    lists: { home: listsFor(lists, m.home_team), away: listsFor(lists, m.away_team) },
    headToHead: h2h.map((r) => ({
      matchId: String(r.id), season: r.season, roundTitle: r.round_title ?? `Round ${r.round}`,
      home: r.home_team as TeamName, away: r.away_team as TeamName, venue: r.venue ?? "",
      homeScore: r.home_score!, awayScore: r.away_score!,
    })),
  };
}

/* ---------- model vs market ---------- */

/** The season's finished games by round: the no-odds Model against the bookies' prices. */
export async function oddsRounds(sql: Sql, season: number): Promise<OddsRound[]> {
  const rows = await sql.unsafe<(MatchRow & {
    no_odds: number | null; p_open: number | null; p_close: number | null; open_line: number | null;
    close_line: number | null; open_total: number | null; close_total: number | null; bookmaker: string | null;
  })[]>(
    `select ${MATCH_COLS}, p.no_odds_home_win_prob as no_odds, o.p_open, o.p_close, o.open_line, o.close_line,
            o.open_total, o.close_total, o.bookmaker
     from matches m
     join prediction_of_record p on p.match_id = m.id
     left join match_odds_probs o on o.match_id = m.id
     where m.season = $1 and m.status = 'final' and p.no_odds_home_win_prob is not null
     order by m.round, m.kickoff, m.id`, [season]);
  const byRound = new Map<number, OddsGame[]>();
  const titles = new Map<number, string>();
  for (const r of rows) {
    const game: OddsGame = {
      matchId: String(r.id), kickoff: iso(r.kickoff), home: r.home_team as TeamName, away: r.away_team as TeamName,
      venue: r.venue ?? "", homeScore: r.home_score!, awayScore: r.away_score!, modelHomeProb: r.no_odds!,
      // Only the main model's margin and total are kept, not the no-odds model's.
      modelMargin: null, modelTotal: null,
      openHomeProb: num(r.p_open), closeHomeProb: num(r.p_close), openLine: num(r.open_line), closeLine: num(r.close_line),
      openTotal: num(r.open_total), closeTotal: num(r.close_total), bookmaker: r.bookmaker,
    };
    byRound.set(r.round, [...(byRound.get(r.round) ?? []), game]);
    if (r.round_title) titles.set(r.round, r.round_title);
  }
  return [...byRound].map(([round, games]) => ({ round, ...(titles.has(round) ? { title: titles.get(round) } : {}), games }));
}

/** The season's graded games for the model-vs-market scoreboard: the no-odds Model (independent of
 * the bookies), the opening market and Elo. */
export async function seasonGames(sql: Sql, season: number): Promise<SeasonGame[]> {
  const rows = await sql`
    select m.id, m.round, m.round_title, m.kickoff, m.home_team, m.away_team, g.margin_actual,
           p.no_odds_home_win_prob as home_win_prob, g.p_open, g.elo_prob
    from graded_games g join matches m on m.id = g.match_id
    join prediction_of_record p on p.match_id = g.match_id
    where m.season = ${season} and p.no_odds_home_win_prob is not null order by m.kickoff, m.id`;
  return rows.map((r) => ({
    matchId: String(r.id), round: r.round_title ?? `Round ${r.round}`, kickoff: iso(r.kickoff),
    home: r.home_team as TeamName, away: r.away_team as TeamName,
    homeWin: r.margin_actual > 0 ? 1 : r.margin_actual < 0 ? 0 : 0.5,
    model: r.home_win_prob, market: num(r.p_open), elo: num(r.elo_prob),
  }));
}

/** Flat bets on the no-odds Model's edges of more than 2% at the opening price, either side, draws
 * left out (as web/scripts/build_odds_sample.py and src/betting.py). */
export async function seasonBets(sql: Sql, season: number): Promise<SeasonBet[]> {
  const rows = await sql`
    select m.id, m.home_score, m.away_score, p.no_odds_home_win_prob as p, o.home_odds_open, o.away_odds_open
    from matches m
    join prediction_of_record p on p.match_id = m.id
    join match_odds o on o.match_id = m.id
    where m.season = ${season} and m.status = 'final' and m.home_score <> m.away_score
      and p.no_odds_home_win_prob is not null
    order by m.kickoff, m.id`;
  const bets: SeasonBet[] = [];
  for (const r of rows) {
    const homeWon = r.home_score > r.away_score;
    for (const [side, prob, price] of [["home", r.p, r.home_odds_open], ["away", 1 - r.p, r.away_odds_open]] as const) {
      if (price == null || prob * price - 1 <= 0.02) continue;
      const won = homeWon === (side === "home");
      bets.push({ matchId: String(r.id), side, odds: price, won, profit: won ? Math.round((price - 1) * 100) / 100 : -1 });
    }
  }
  return bets;
}

/** Games still to kick off with the Model's fair odds and Betr's latest price (`match_edges`), or as
 * they stood at `at` (`edges_at`, for the tests). */
export async function upcomingEdges(sql: Sql, at?: Date): Promise<Edge[]> {
  const rows = at ? await sql`select * from edges_at(${at})` : await sql`select * from match_edges`;
  return rows.map((r) => ({
    matchId: String(r.match_id), round: r.round, kickoff: iso(r.kickoff),
    home: r.home_team as TeamName, away: r.away_team as TeamName,
    homeProb: r.home_prob, fairHome: r.fair_home, fairAway: r.fair_away,
    priceAt: r.price_at ? iso(r.price_at) : null, homeOdds: num(r.home_odds), awayOdds: num(r.away_odds),
    marketHomeProb: num(r.market_home_prob), homeEdge: num(r.home_edge), awayEdge: num(r.away_edge),
    bet: r.bet_side ? { side: r.bet_side, team: r.bet_team as TeamName, edge: r.bet_edge } : null,
  }));
}

/** A season's graded games in kickoff order, for /model's round-by-round record (lib/model-record.ts):
 * the prediction of record, the opening market and Elo, each a home chance. */
export async function gradedGames(sql: Sql, season: number): Promise<GradedGame[]> {
  const rows = await sql`
    select m.id, m.round, m.round_title, m.home_team, m.away_team, m.home_score, m.away_score, g.home_win_prob, g.p_open, g.elo_prob
    from graded_games g join matches m on m.id = g.match_id
    where m.season = ${season} and m.status = 'final'
    order by m.kickoff, m.id`;
  return rows.map((r) => ({
    round: r.round, roundTitle: r.round_title, matchId: String(r.id), home: r.home_team as TeamName, away: r.away_team as TeamName,
    homeScore: r.home_score, awayScore: r.away_score, modelHomeProb: r.home_win_prob, market: num(r.p_open), elo: num(r.elo_prob),
  }));
}

/** The latest season with a graded game, or null before the first. */
export async function latestGradedSeason(sql: Sql): Promise<number | null> {
  const [r] = await sql`select max(m.season) as season from graded_games g join matches m on m.id = g.match_id`;
  return r?.season ?? null;
}

/** The model's record for a season (`model_accuracy`), with the bookies' favourite on the same games. */
export async function modelRecord(sql: Sql, season: number): Promise<ModelRecord | null> {
  const rows = await sql`
    select source, games, tips, margin_mae from model_accuracy where season = ${season} and round is null`;
  const model = rows.find((r) => r.source === "model");
  if (!model) return null;
  const market = rows.find((r) => r.source === "market_open");
  return {
    label: `${season} season`, games: model.games, correct: model.tips, marginError: Number(model.margin_mae),
    favouriteCorrect: market ? market.tips : 0,
  };
}

/* ---------- Elo ---------- */

type EloRow = {
  team: string; season: number; played_on: Date; round_label: string; opponent: string; is_home: boolean;
  points_for: number; points_against: number; rating_before: number; rating_after: number;
};

/** "R10" stays as is; a final is "F" (finals collapse into one point each week). */
const step = (label: string) => (/^R\d+$/.test(label) ? label : "F");

/** One season of Elo: each team's rating after every round, from `elo_ratings`. */
export async function eloSeason(sql: Sql, season: number): Promise<EloSeason | null> {
  const rows = await sql<EloRow[]>`select * from elo_ratings where season = ${season} order by played_on, team`;
  if (!rows.length) return null;
  // Rounds in date order; each week of finals is its own "F" point.
  const steps: string[] = [];
  const stepOf = new Map<string, number>();
  for (const r of rows) {
    const day = iso(r.played_on).slice(0, 10);
    const label = step(r.round_label);
    const key = label === "F" ? `F:${weekOf(day)}` : label;
    if (!stepOf.has(key)) {
      stepOf.set(key, steps.length);
      steps.push(label);
    }
  }
  const teams = [...new Set(rows.map((r) => r.team))].sort();
  const start: Record<string, number> = {};
  const ratings: Record<string, number[]> = {};
  for (const t of teams) {
    const games = rows.filter((r) => r.team === t);
    start[t] = round1(games[0].rating_before);
    let rating = games[0].rating_before;
    ratings[t] = steps.map((_, i) => {
      for (const g of games) {
        const label = step(g.round_label);
        const key = label === "F" ? `F:${weekOf(iso(g.played_on).slice(0, 10))}` : label;
        if (stepOf.get(key) === i) rating = g.rating_after;
      }
      return round1(rating);
    });
  }
  return { season, rounds: steps, lastRound: steps[steps.length - 1], start, ratings };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Finals are a week apart: the Tuesday that starts each game's week. */
function weekOf(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 5) % 7));
  return d.toISOString().slice(0, 10);
}

/** A team's last `seasons` seasons game by game; `swings` index its 3 biggest rises and falls. */
export async function eloTeamView(sql: Sql, team: string, seasons = 6): Promise<EloTeamView> {
  const rows = await sql<EloRow[]>`
    select * from elo_ratings where team = ${team}
      and season > (select max(season) from elo_ratings) - ${seasons}
    order by played_on`;
  const points = rows.map((r) => {
    const result = r.points_for > r.points_against ? "Beat" : r.points_for < r.points_against ? "Lost to" : "Drew with";
    return {
      season: r.season, label: /^R\d+$/.test(r.round_label) ? `Round ${r.round_label.slice(1)}` : "Finals",
      date: iso(r.played_on).slice(0, 10), rating: round1(r.rating_after), change: round1(r.rating_after - r.rating_before),
      text: `${result} ${r.opponent} ${r.points_for}–${r.points_against}`,
    };
  });
  const order = points.map((_, i) => i).sort((a, b) => points[a].change - points[b].change);
  const swings = [...new Set([...order.slice(0, 3), ...order.slice(-3)])].sort((a, b) => a - b);
  return { points, swings };
}

/* ---------- LLM-written text ---------- */

/** The current preview of a game, or recap of a round (pipeline/summaries.py), if one exists. */
export async function summary(sql: Sql, kind: "match_preview" | "round_recap", season: number, round: number, matchId?: string) {
  const [r] = matchId
    ? await sql`select body, llm_model, created_at from summaries where kind = ${kind} and match_id = ${matchId}`
    : await sql`select body, llm_model, created_at from summaries
                where kind = ${kind} and season = ${season} and round = ${round} and match_id is null`;
  return r ? { body: r.body as string, model: r.llm_model as string, writtenAt: iso(r.created_at) } : null;
}
