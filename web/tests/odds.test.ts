import { describe, expect, it } from "vitest";
import { underdogBets, valueUnderdog } from "../lib/odds";
import type { Edge, SeasonBet, SeasonGame } from "../lib/types";

const edge = (homeProb: number, bet: Edge["bet"]): Edge => ({
  matchId: "3", round: 2, kickoff: "2027-03-13T08:00:00Z", home: "Broncos", away: "Storm",
  homeProb, fairHome: 1 / homeProb, fairAway: 1 / (1 - homeProb), priceAt: "2027-03-11T00:00:00Z",
  homeOdds: 3.2, awayOdds: 1.36, marketHomeProb: 0.3, homeEdge: homeProb * 3.2 - 1, awayEdge: (1 - homeProb) * 1.36 - 1, bet,
});

describe("value underdogs", () => {
  it("flags a paper bet on the team the Model tips to lose, and keeps the tip", () => {
    const dog = valueUnderdog(edge(0.35, { side: "home", team: "Broncos", edge: 0.12 }))!;
    expect(dog).toMatchObject({ tip: { team: "Storm" }, team: "Broncos", price: 3.2, edge: 0.12 });
    expect(dog.tip.prob).toBeCloseTo(0.65, 12);
    expect(dog.prob).toBeCloseTo(0.35, 12);
    expect(dog.fair).toBeCloseTo(1 / 0.35, 12);
  });

  it("doesn't flag a bet on the tip, or no bet", () => {
    expect(valueUnderdog(edge(0.6, { side: "home", team: "Broncos", edge: 0.92 }))).toBeNull();
    expect(valueUnderdog(edge(0.35, null))).toBeNull();
  });

  it("picks the season's bets on a team the Model rated under 50%", () => {
    const game = (matchId: string, model: number): SeasonGame => ({
      matchId, round: "Round 1", kickoff: "", home: "Broncos", away: "Storm", homeWin: 1, model, market: 0.5, elo: 0.5,
    });
    const bet = (matchId: string, side: "home" | "away"): SeasonBet => ({ matchId, side, odds: 2.5, won: true, profit: 1.5 });
    const bets = [bet("1", "home"), bet("1", "away"), bet("2", "away"), bet("9", "home")];
    expect(underdogBets(bets, [game("1", 0.4), game("2", 0.7)])).toEqual([bet("1", "home"), bet("2", "away")]);
  });
});
