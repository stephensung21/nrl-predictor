// lib/groups.ts: which group a page shows, and the sample's browser store.

import { describe, expect, it } from "vitest";
import { BrowserGroupStore, pickGroup, SAMPLE_GROUPS, type Group } from "../lib/groups";
import { YOU_ID } from "../lib/sample";

const g = (id: string, joinedAt: string): Group => ({ id, name: id, code: id.toUpperCase(), owner: null, members: [{ id: "me", name: "Me", joinedAt }] });
const groups = [g("older", "2027-01-01T00:00:00Z"), g("newer", "2027-02-01T00:00:00Z")];

describe("pickGroup", () => {
  it("takes the group asked for, or none for global", () => {
    expect(pickGroup(groups, "older", "me")?.id).toBe("older");
    expect(pickGroup(groups, "global", "me")).toBeNull();
  });

  it("falls back to global for a group the viewer isn't in any more", () => {
    expect(pickGroup(groups, "deleted", "me")).toBeNull();
  });

  it("with nothing asked for, shows the group joined most recently, or global for someone in none", () => {
    expect(pickGroup(groups, undefined, "me")?.id).toBe("newer");
    expect(pickGroup([], undefined, "me")).toBeNull();
  });
});

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("the sample's store", () => {
  it("starts with the sample groups, and makes, joins and leaves groups in this browser", async () => {
    const store = new BrowserGroupStore(memoryStorage());
    expect((await store.list()).map((x) => x.name)).toEqual(SAMPLE_GROUPS.map((x) => x.name));
    const id = await store.create("  Footy club ");
    const made = (await store.list()).find((x) => x.id === id)!;
    expect(made).toMatchObject({ name: "Footy club", owner: YOU_ID });
    expect(await store.check(made.code.toLowerCase())).toEqual({ name: "Footy club", members: 1 });
    await store.leave("sample-work");
    expect((await store.list()).map((x) => x.id)).not.toContain("sample-work");
    expect(await store.join("work2026")).toBe("sample-work");
    await expect(store.create(" ")).rejects.toThrow(/name/);
    await expect(store.rename("sample-work", "Mine")).rejects.toThrow(/owner/);
  });

  it("deletes a group when its last member leaves", async () => {
    const store = new BrowserGroupStore(memoryStorage());
    const id = await store.create("Solo");
    await store.leave(id);
    expect(await store.check((await store.list()).find((x) => x.id === id)?.code ?? "NONE")).toBeNull();
  });
});
