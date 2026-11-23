// A group's view of the comp pages: the ladder and round kept to its members (lib/comp.ts), the
// sample ladder placed among them (lib/ladder.ts), and the Dally M summed from their votes only
// (lib/dally-m-store.ts).

import { describe, expect, it } from "vitest";
import { ladderView, roundComp, type LadderRows } from "../lib/comp";
import { forGroup, type DallyMVotes } from "../lib/dally-m-store";
import { groupLadder, ladder, seasonAt } from "../lib/ladder";
import { MODEL_ID, YOU_ID } from "../lib/sample";

describe("ladderView for a group", () => {
  it("keeps the scores and tips to the tippers ladder() returned", () => {
    const rows: LadderRows = {
      ladder: [
        { user_id: "a", display_name: "A", is_model: false, points: 2, margin_score: 0, position: 1, tied: false, movement: null },
        { user_id: "b", display_name: "B", is_model: false, points: 1, margin_score: 0, position: 2, tied: false, movement: null },
      ],
      profiles: [{ id: "a", fav_team: null }, { id: "b", fav_team: null }, { id: "c", fav_team: null }],
      scores: ["a", "b", "c"].map((user_id) => ({ user_id, round: 1, correct: 1, games: 2, auto_tips: 0, bonus: 0, margin_score: 0, partial: false })),
      tips: ["a", "b", "c"].map((user_id) => ({ user_id, match_id: 1, team: "Storm", is_auto: false })),
      games: [{ id: 1, round: 1, round_title: null, kickoff: "2027-03-01T08:00:00Z", home_team: "Storm", away_team: "Broncos", home_score: 20, away_score: 10, status: "final" }],
      probs: [],
    };
    const view = ladderView(2027, rows)!;
    expect(view.ladder.map((e) => e.tipper.id)).toEqual(["a", "b"]);
    expect(view.latest.games).toBe(2);
  });
});

describe("roundComp for a group", () => {
  it("keeps its members and the Model, and drops everyone else's tips and standings", () => {
    const comp = roundComp(
      "a",
      "1",
      {
        profiles: [
          { id: "a", display_name: "A", is_model: false, fav_team: null },
          { id: "c", display_name: "C", is_model: false, fav_team: null },
          { id: "m", display_name: "Model", is_model: true, fav_team: null },
        ],
        before: [{ user_id: "a", correct: 1, bonus: 0, margin_score: 0 }, { user_id: "c", correct: 2, bonus: 0, margin_score: 0 }],
        tips: [{ user_id: "a", match_id: 1, team: "Storm", margin: null }, { user_id: "c", match_id: 1, team: "Broncos", margin: null }],
        results: [],
      },
      new Set(["a"]),
    );
    expect(comp.tippers.map((t) => t.id)).toEqual(["a", "m"]);
    expect(comp.tips.map((t) => t.tipperId)).toEqual(["a"]);
    expect(comp.ladderBefore.map((r) => r.tipperId)).toEqual(["a", "m"]);
  });
});

describe("the sample ladder for a group", () => {
  it("keeps everyone's points and places the members among themselves", () => {
    const rounds = seasonAt("recap");
    const all = ladder(rounds);
    const members = new Set(["tom", "jacko"]);
    const group = groupLadder(rounds, members);
    expect(group.map((e) => e.tipper.id).sort()).toEqual(["jacko", MODEL_ID, "tom"].sort());
    for (const e of group) expect(e.points).toBe(all.find((x) => x.tipper.id === e.tipper.id)!.points);
    const places = group.filter((e) => !e.tipper.isModel).map((e) => e.position);
    expect(places).toContain(1);
    expect(Math.max(...(places as number[]))).toBeLessThanOrEqual(2);
  });
});

describe("the Dally M for a group", () => {
  const player = (playerId: number, votes: number) => ({ playerId, name: `P${playerId}`, team: "Storm" as const, image: null, votes, threes: 0, twos: 0, ones: 0 });
  const votes: DallyMVotes = {
    you: YOU_ID,
    tippers: [{ id: YOU_ID, name: "Sully" }, { id: "tom", name: "Tom" }],
    rows: [
      { userId: YOU_ID, round: 1, votes: 3, playerId: 10 },
      { userId: "tom", round: 1, votes: 3, playerId: 20 },
      { userId: YOU_ID, round: 2, votes: 3, playerId: 20 }, // the open round: only the viewer's own shows
    ],
    results: { 1: [player(10, 3), player(20, 3)] },
    leaderboard: [player(10, 3), player(20, 3)],
    voters: 2,
  };

  it("counts only the members' ballots, in closed rounds, and hides the whole comp's voter count", () => {
    const g = forGroup(votes, new Set([YOU_ID]));
    expect(g.tippers.map((t) => t.id)).toEqual([YOU_ID]);
    expect(g.results[1]).toEqual([{ ...player(10, 3), threes: 1 }]);
    expect(g.leaderboard).toEqual([{ ...player(10, 3), threes: 1 }]);
    expect(g.rows.filter((r) => r.round === 2)).toHaveLength(1);
    expect(g.voters).toBeNull();
  });
});
