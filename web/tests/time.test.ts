// The page clock (lib/time.ts clockFrom): the sample's instant, running on in real time.

import { afterEach, describe, expect, it, vi } from "vitest";
import { clockFrom } from "../lib/time";

afterEach(() => vi.useRealTimers());

describe("clockFrom", () => {
  it("starts at the given instant and runs on from there", () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-21T00:00:00Z") });
    const clock = clockFrom("2026-05-05T09:30:00Z");
    expect(clock()).toBe(Date.parse("2026-05-05T09:30:00Z"));
    vi.advanceTimersByTime(60_000);
    expect(clock()).toBe(Date.parse("2026-05-05T09:31:00Z"));
  });
});
