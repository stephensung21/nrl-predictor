// SAMPLE last man standing: the real 2026 results for Rounds 1-9 (lib/sample-odds.ts) and Round 10's
// draw (lib/sample.ts), viewed at the sample's tips-open instant, so Round 10 is the one to pick.
// The picks are invented by a fixed rule: each tipper still in takes the bookies' favourite they
// haven't used this game (the 1st to 5th most favoured, by tipper), and Jacko forgets Round 3.

import { playSeason, type LmsMatch, type LmsPick } from "./lms";
import { round10, tippers } from "./sample";
import { ODDS_ROUNDS } from "./sample-odds";
import type { TeamName } from "./teams";

export const SAMPLE_LMS_SEASON = 2026;
export const SAMPLE_LMS_TIPPERS = tippers.filter((t) => !t.isModel);

const result = (h: number, a: number): LmsMatch["result"] => (h > a ? "home" : h < a ? "away" : "draw");

export const SAMPLE_LMS_MATCHES: LmsMatch[] = [
  ...ODDS_ROUNDS.filter((r) => r.round < round10.round).flatMap((r) =>
    r.games.map((g) => ({ id: g.matchId, round: r.round, kickoff: g.kickoff, home: g.home, away: g.away, result: result(g.homeScore, g.awayScore) })),
  ),
  ...round10.matches.map((m) => ({ id: m.id, round: m.round, kickoff: m.kickoff, home: m.home, away: m.away })),
];

const OFFSET: Record<string, number> = { mick: 0, dazza: 1, sully: 2, jacko: 3, tom: 4 };
const FORGETS = new Set(["jacko:3"]);

function samplePicks(): LmsPick[] {
  const ids = SAMPLE_LMS_TIPPERS.map((t) => t.id);
  const picks: LmsPick[] = [];
  for (const r of ODDS_ROUNDS.filter((x) => x.round < round10.round)) {
    // Favourites first, by the bookies' closing price (the opening price, or the Model, when it's missing).
    const sides = r.games
      .flatMap((g) => {
        const home = g.closeHomeProb ?? g.openHomeProb ?? g.modelHomeProb;
        return [
          { team: g.home, matchId: g.matchId, prob: home },
          { team: g.away, matchId: g.matchId, prob: 1 - home },
        ];
      })
      .sort((a, b) => b.prob - a.prob);
    const season = playSeason(ids, SAMPLE_LMS_MATCHES.filter((m) => m.round < r.round), picks, false);
    const game = season.games.at(-1);
    const fresh = !game || game.endRound != null;
    const alive = fresh ? ids : game.alive;
    for (const userId of alive) {
      if (FORGETS.has(`${userId}:${r.round}`)) continue;
      const used = new Set<TeamName>(fresh ? [] : game.rounds.flatMap((x) => x.entries.filter((e) => e.userId === userId && e.team).map((e) => e.team!)));
      const options = sides.filter((s) => !used.has(s.team));
      const s = options[Math.min(OFFSET[userId] ?? 0, options.length - 1)];
      picks.push({ userId, round: r.round, matchId: s.matchId, team: s.team });
    }
  }
  return picks;
}

export const SAMPLE_LMS_PICKS: LmsPick[] = samplePicks();
