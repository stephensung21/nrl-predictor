// The home dashboard's to-do rules (lib/dashboard.ts).

import { describe, expect, it } from "vitest";
import { todos } from "../lib/dashboard";
import { buildRound } from "../lib/round";
import { round10, tippers, tips, YOU_ID } from "../lib/sample";

const view = (tipped: number, now = "2026-05-05T09:30:00Z") =>
  buildRound({ data: round10, now: new Date(now), tips, tippers, ladderBefore: [], youId: YOU_ID, yourTipLimit: tipped });
const NOW = new Date("2026-05-05T09:30:00Z"); // Tuesday night, before the first game
const byKey = (list: ReturnType<typeof todos>) => Object.fromEntries(list.map((t) => [t.key, t]));

describe("todos", () => {
  it("asks for the untipped games, with the next lockout, and the button says how many", () => {
    const t = byKey(todos({ view: view(3), now: NOW, yourMargin: 10, lms: null, dallyM: null }));
    expect(t.tips).toMatchObject({ done: false, title: "Tip 4 more games", action: { href: "/tipping", label: "Tip 4 →" } });
    expect(t.tips.note).toMatch(/^3 of 7 tipped · next lockout /);
  });

  it("ticks the tips off once every game is tipped", () => {
    const t = byKey(todos({ view: view(7), now: NOW, yourMargin: 10, lms: null, dallyM: null }));
    expect(t.tips).toMatchObject({ done: true, title: "All 7 tipped" });
    expect(t.tips.action).toBeUndefined();
  });

  it("asks for the margin when the margin game is tipped without one, before it kicks off", () => {
    expect(byKey(todos({ view: view(7), now: NOW, lms: null, dallyM: null })).margin).toMatchObject({ done: false, title: "Set your margin" });
    expect(byKey(todos({ view: view(7), now: NOW, yourMargin: 10, lms: null, dallyM: null })).margin).toMatchObject({
      done: true,
      title: "Margin game: Roosters by 10",
    });
  });

  it("asks for a last man standing pick while you're in, and ticks it once picked; nothing when you're out", () => {
    const open = byKey(todos({ view: view(7), now: NOW, yourMargin: 10, lms: { round: 10, alive: true }, dallyM: null }));
    expect(open.lms).toMatchObject({ done: false, title: "Pick for Round 10", action: { href: "/last-man-standing" } });
    expect(byKey(todos({ view: view(7), now: NOW, yourMargin: 10, lms: { round: 10, alive: true, picked: "Storm" }, dallyM: null })).lms).toMatchObject({
      done: true,
      title: "Last man standing: Storm",
    });
    expect(byKey(todos({ view: view(7), now: NOW, yourMargin: 10, lms: { round: 10, alive: false }, dallyM: null })).lms).toBeUndefined();
  });

  it("asks for Dally M votes while a round is open, and ticks them once in", () => {
    const dallyM = { round: 9, closes: "2026-05-08T09:50:00Z", voted: false };
    expect(byKey(todos({ view: view(7), now: NOW, yourMargin: 10, lms: null, dallyM })).dallym).toMatchObject({
      done: false,
      title: "Dally M votes, Round 9",
      action: { href: "/dally-m", label: "Vote" },
    });
    expect(byKey(todos({ view: view(7), now: NOW, yourMargin: 10, lms: null, dallyM: { ...dallyM, voted: true } })).dallym).toMatchObject({ done: true });
  });

  it("puts what's still open first", () => {
    const list = todos({ view: view(7), now: NOW, yourMargin: 10, lms: { round: 10, alive: true }, dallyM: null });
    expect(list.map((t) => t.done)).toEqual([false, true, true]);
  });

  it("drops the tips and margin to-dos once every game has kicked off", () => {
    const after = new Date("2026-05-11T02:00:00Z");
    const t = byKey(todos({ view: view(3, "2026-05-11T02:00:00Z"), now: after, lms: null, dallyM: null }));
    expect(t.tips).toMatchObject({ done: true });
    expect(t.margin).toBeUndefined();
  });
});
