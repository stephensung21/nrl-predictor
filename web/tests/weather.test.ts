// The weather wording on match pages and game rows (lib/weather.ts).

import { describe, expect, it } from "vitest";
import type { Weather } from "../lib/types";
import { compass, weatherFlag, weatherParts } from "../lib/weather";

const base: Weather = {
  kind: "observed", fetchedAt: "2026-05-01T10:00:00.000Z", roofed: false, tempC: 19.6, rainMm: 0, rainChance: null,
  windKmh: 16.6, gustKmh: 36, windDir: 245, conditions: "Overcast",
};

describe("weather wording", () => {
  it("names the 16 compass points", () => {
    expect([0, 245, 350, 359, 90].map(compass)).toEqual(["N", "WSW", "N", "N", "E"]);
  });

  it("describes what the weather was", () => {
    expect(weatherParts(base)).toEqual(["Overcast, 20°", "No rain", "Wind 17 km/h from the WSW, gusts 36"]);
    expect(weatherParts({ ...base, rainMm: 4.24, gustKmh: 20 })).toEqual(["Overcast, 20°", "4.2 mm of rain", "Wind 17 km/h from the WSW"]);
    expect(weatherParts({ ...base, roofed: true })).toEqual(["Under the roof"]);
  });

  it("describes a forecast by its chance of rain", () => {
    const f: Weather = { ...base, kind: "forecast", rainChance: 60, rainMm: 1.5, windKmh: 3, conditions: "Light rain" };
    expect(weatherParts(f)).toEqual(["Light rain, 20°", "60% chance of rain, 1.5 mm", "Wind 3 km/h, gusts 36"]);
  });

  it("flags only rain or strong wind on a game row", () => {
    expect(weatherFlag(base)).toBeNull();
    expect(weatherFlag(undefined)).toBeNull();
    expect(weatherFlag({ ...base, kind: "forecast", rainChance: 70 })).toEqual({ kind: "rain", text: "Rain 70%" });
    expect(weatherFlag({ ...base, kind: "forecast", rainChance: 40 })).toBeNull();
    expect(weatherFlag({ ...base, rainMm: 2 })).toEqual({ kind: "rain", text: "Wet" });
    expect(weatherFlag({ ...base, gustKmh: 61 })).toEqual({ kind: "wind", text: "Gusts 61 km/h" });
    expect(weatherFlag({ ...base, roofed: true, rainMm: 9 })).toBeNull();
  });
});
