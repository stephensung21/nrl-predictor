import { describe, expect, it } from "vitest";
import { barColours } from "@/components/pitch-bar";
import { colourFor, lineColours } from "@/lib/line-colours";
import { TEAMS } from "@/lib/teams";
import { readsOnLight, splitThemed, themed } from "@/lib/theme";

describe("themed colours", () => {
  it("puts the day value first, as light-dark() expects, and splits back to [dark, light]", () => {
    expect(themed("#111111", "#eeeeee")).toBe("light-dark(#eeeeee, #111111)");
    expect(splitThemed(themed("#111111", "#eeeeee"))).toEqual(["#111111", "#eeeeee"]);
    expect(themed("#3987e5", "#3987e5")).toBe("#3987e5");
  });

  it("keeps white and gold off light-mode lines but lets gold fill a bar", () => {
    expect(readsOnLight("#ffffff")).toBe(false);
    expect(readsOnLight("#fbbf15")).toBe(false);
    expect(readsOnLight("#fbbf15", 1.3)).toBe(true);
    expect(readsOnLight("#6c1d45")).toBe(true);
  });

  it("gives every team a light-mode bar that reads on white", () => {
    for (const t of Object.values(TEAMS)) expect(readsOnLight(t.lightBar, 3), t.name).toBe(true);
  });
});

describe("bar colours by mode", () => {
  it("leaves dark mode as it was: Sea Eagles v Broncos draws the Broncos in gold", () => {
    const [home, away] = barColours("Sea Eagles", "Broncos").map(splitThemed);
    expect(home[0]).toBe(TEAMS["Sea Eagles"].bar);
    expect(away[0]).toBe(TEAMS.Broncos.secondary);
  });

  it("uses the real club colours by day, switching the away side when they clash", () => {
    const [home, away] = barColours("Sea Eagles", "Broncos").map(splitThemed);
    expect(home[1]).toBe(TEAMS["Sea Eagles"].lightBar);
    expect(away[1]).toBe(TEAMS.Broncos.secondary);
    const [, eels] = barColours("Cowboys", "Eels").map(splitThemed);
    expect(eels[1]).toBe(TEAMS.Eels.secondary);
  });
});

describe("line colours by mode", () => {
  it("picks each mode against that mode's colours already in use", () => {
    const lit = lineColours(["Sea Eagles", "Broncos"]);
    const [, broncos] = splitThemed(lit.Broncos);
    expect(broncos).not.toBe(TEAMS.Broncos.lightBar);
    expect(readsOnLight(broncos)).toBe(true);
  });

  it("never draws a light-mode line in white or gold", () => {
    const used: string[] = [];
    for (const t of Object.keys(TEAMS) as (keyof typeof TEAMS)[]) {
      const c = colourFor(t, used.slice(-2));
      used.push(c);
      expect(readsOnLight(splitThemed(c)[1]), t).toBe(true);
    }
  });
});
