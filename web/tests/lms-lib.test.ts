// Last man standing's rules (lib/lms.ts): who survives, who's out, when a game ends and the next starts.

import { describe, expect, it } from "vitest";
import { playSeason, yourTurn, type LmsMatch, type LmsPick } from "../lib/lms";
import type { TeamName } from "../lib/teams";

const T = ["a", "b", "c"];

/** A round's games as [home, away, result]; result undefined while undecided. */
let id = 0;
const round = (r: number, games: [TeamName, TeamName, LmsMatch["result"]?][]): LmsMatch[] =>
  games.map(([home, away, result]) => ({ id: String(++id), round: r, kickoff: `2027-03-${String(r).padStart(2, "0")}T08:00:00Z`, home, away, result }));

const R1 = round(1, [["Storm", "Broncos", "home"], ["Eels", "Panthers", "away"], ["Titans", "Knights", "draw"]]);
const R2 = round(2, [["Broncos", "Storm", "home"], ["Panthers", "Eels", "home"], ["Knights", "Titans", "cancelled"]]);
const R3 = round(3, [["Storm", "Eels", undefined], ["Broncos", "Panthers", undefined]]);
const matches = [...R1, ...R2, ...R3];

const p = (userId: string, r: number, team: TeamName): LmsPick => {
  const m = matches.find((x) => x.round === r && (x.home === team || x.away === team))!;
  return { userId, round: r, matchId: m.id, team };
};

describe("playSeason", () => {
  it("knocks out a loss, a draw and a missed pick, and plays on while two or more survive", () => {
    const s = playSeason(["a", "b", "c", "d"], matches, [p("a", 1, "Storm"), p("b", 1, "Panthers"), p("c", 1, "Titans")], false);
    const g = s.games[0];
    expect(g.rounds[0].entries.map((e) => [e.userId, e.outcome])).toEqual([["a", "survived"], ["b", "survived"], ["c", "out"], ["d", "missed"]]);
    expect(g.alive).toEqual(["a", "b"]);
    expect(g.winners).toEqual([]);
    expect(g.endRound).toBeNull();
  });

  it("ends the game when one is left, and starts the next game the round after with everyone back", () => {
    const s = playSeason(T, matches, [p("a", 1, "Storm"), p("b", 1, "Panthers"), p("a", 2, "Broncos"), p("b", 2, "Storm"), p("c", 3, "Eels")], false);
    expect(s.games.map((g) => [g.number, g.startRound, g.endRound, g.winners])).toEqual([[1, 1, 2, ["a"]], [2, 3, null, []]]);
    expect(s.games[1].alive).toEqual(T);
    expect(s.games[1].rounds[0].entries.find((e) => e.userId === "c")?.outcome).toBe("pending");
    expect(s.tally).toEqual([{ userId: "a", wins: 1 }, { userId: "b", wins: 0 }, { userId: "c", wins: 0 }]);
  });

  it("keeps everyone in when everyone still in goes out together, and doesn't count their teams as used", () => {
    const s = playSeason(["a", "b", "c"], matches, [p("a", 1, "Broncos"), p("b", 1, "Knights"), p("a", 2, "Broncos"), p("b", 2, "Panthers")], false);
    const g = s.games[0];
    expect(g.rounds[0]).toMatchObject({ round: 1, void: true });
    expect(g.rounds[0].entries.map((e) => e.outcome)).toEqual(["out", "out", "missed"]);
    // Round 1 didn't count, so a can pick the Broncos again; c misses again and goes out.
    expect(g.rounds[1].entries.map((e) => [e.userId, e.outcome])).toEqual([["a", "survived"], ["b", "survived"], ["c", "missed"]]);
    expect(g.alive).toEqual(["a", "b"]);
    expect(g.endRound).toBeNull();
  });

  it("lets a tipper start again once they've used every team", () => {
    // Four teams, two games a round; the first-named team always wins.
    const four = [1, 2, 3, 4, 5, 6].flatMap((r) =>
      round(r, r % 2 ? [["Storm", "Broncos", "home"], ["Eels", "Panthers", "home"]] : [["Broncos", "Storm", "home"], ["Panthers", "Eels", "home"]]));
    const q = (userId: string, r: number, team: TeamName): LmsPick => ({ userId, round: r, matchId: four.find((m) => m.round === r && (m.home === team || m.away === team))!.id, team });
    const picks = [
      q("a", 1, "Storm"), q("a", 2, "Broncos"), q("a", 3, "Eels"), q("a", 4, "Panthers"), q("a", 5, "Storm"), q("a", 6, "Broncos"),
      q("b", 1, "Eels"), q("b", 2, "Panthers"), q("b", 3, "Storm"), q("b", 4, "Broncos"), q("b", 5, "Eels"), q("b", 6, "Panthers"),
    ];
    const s = playSeason(["a", "b"], four, picks, false);
    expect(s.teams).toBe(4);
    // Both use all four teams in rounds 1-4, so their round 5 and 6 picks start a fresh run.
    expect(s.games[0].rounds.map((r) => r.entries.map((e) => e.outcome))).toEqual([
      ["survived", "survived"], ["survived", "survived"], ["survived", "survived"], ["survived", "survived"],
      ["survived", "survived"], ["survived", "survived"],
    ]);
    // A repeat inside the new cycle is still out.
    const again = playSeason(["a", "b"], four, [...picks.filter((x) => !(x.userId === "a" && x.round === 6)), q("a", 6, "Storm")], false);
    expect(again.games[0]).toMatchObject({ endRound: 6, winners: ["b"] });
    expect(again.games[0].rounds[5].entries[0].outcome).toBe("repeat");
  });

  it("knocks out a repeat even when that team wins, and survives a cancelled game", () => {
    const s = playSeason(["a", "b", "c"], matches, [p("a", 1, "Storm"), p("b", 1, "Storm"), p("c", 1, "Panthers"), p("a", 2, "Knights"), p("b", 2, "Storm"), p("c", 2, "Titans")], false);
    const r2 = s.games[0].rounds[1];
    expect(r2.entries.map((e) => [e.userId, e.outcome])).toEqual([["a", "survived"], ["b", "repeat"], ["c", "survived"]]);
    expect(s.games[0].alive).toEqual(["a", "c"]);
  });

  it("doesn't count a round where nobody still in made a pick", () => {
    const s = playSeason(T, matches, [p("a", 2, "Broncos"), p("b", 2, "Eels")], false);
    expect(s.games[0].rounds[0]).toMatchObject({ round: 1, void: true });
    expect(s.games[0]).toMatchObject({ endRound: 2, winners: ["a"] });
  });

  it("ignores picks by tippers who are out, and leaves an undecided round open", () => {
    const s = playSeason(T, matches, [p("a", 1, "Storm"), p("b", 1, "Panthers"), p("c", 1, "Eels"), p("c", 2, "Broncos")], false);
    expect(s.games[0].rounds[1].entries.map((e) => e.userId)).toEqual(["a", "b"]);
    expect(s.games[0].rounds[1].entries.every((e) => e.outcome === "missed")).toBe(true);
  });

  it("shows a pick's result as soon as its game is decided, before the round is", () => {
    const part = [...R1, ...round(2, [["Broncos", "Storm", "home"], ["Panthers", "Eels", undefined]])];
    const s = playSeason(["a", "b"], part, [{ userId: "a", round: 1, matchId: R1[1].id, team: "Panthers" }, { userId: "b", round: 1, matchId: R1[1].id, team: "Panthers" },
      { userId: "a", round: 2, matchId: part[3].id, team: "Storm" }], false);
    const r2 = s.games[0].rounds[1];
    expect(r2.graded).toBe(false);
    expect(r2.entries.map((e) => [e.userId, e.outcome])).toEqual([["a", "out"], ["b", "waiting"]]);
    expect(s.games[0].alive).toEqual(["a", "b"]);
  });

  it("shares the game among those still in when the regular season ends", () => {
    const s = playSeason(["a", "b"], [...R1, ...R2], [p("a", 1, "Storm"), p("b", 1, "Panthers"), p("a", 2, "Broncos"), p("b", 2, "Knights")], true);
    expect(s.games[0]).toMatchObject({ endRound: 2, winners: ["a", "b"] });
  });
});

describe("yourTurn", () => {
  it("gives the open round, the teams you've used this game, and your pick", () => {
    const picks = [p("a", 1, "Storm"), p("b", 1, "Panthers"), p("c", 1, "Panthers"), p("a", 2, "Broncos"), p("b", 2, "Knights"), p("c", 2, "Eels"), p("a", 3, "Eels")];
    const s = playSeason(T, matches, picks, false);
    expect(yourTurn(s, "a")).toEqual({ round: 3, game: 1, alive: true, used: ["Storm", "Broncos"], pick: picks[6] });
    expect(yourTurn(s, "c")).toMatchObject({ round: 3, alive: false });
  });

  it("is null when no round is open", () => {
    expect(yourTurn(playSeason(T, [...R1, ...R2], [], true), "a")).toBeNull();
  });
});
