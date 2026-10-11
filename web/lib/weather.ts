// Words for a game's weather (`match_weather`, Open-Meteo): the match page's full line, and the short
// flag a game row shows only when the weather could matter (rain or strong wind).

import type { Weather } from "./types";

/** Rain worth flagging: a forecast at least this likely, or this much rain over the 2 hours. */
const RAIN_CHANCE = 50;
const RAIN_MM = 1;
/** Gusts worth flagging, km/h. */
const GUSTS = 50;

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

/** "WSW" for 245°: the 16-point compass direction the wind comes from. */
export function compass(deg: number) {
  return POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

const r = (n: number) => Math.round(n);

/** Rain for the 2 hours from kickoff, in words: "60% chance of rain", "4 mm of rain", "No rain". */
function rainText(w: Weather) {
  const mm = w.rainMm ?? 0;
  const amount = mm >= 0.5 ? `${mm < 10 ? mm.toFixed(1).replace(/\.0$/, "") : r(mm)} mm` : null;
  if (w.kind === "forecast") {
    if (w.rainChance == null) return amount ? `${amount} of rain forecast` : null;
    return `${w.rainChance}% chance of rain${amount ? `, ${amount}` : ""}`;
  }
  return amount ? `${amount} of rain` : "No rain";
}

function windText(w: Weather) {
  if (w.windKmh == null) return null;
  const from = w.windDir != null && w.windKmh >= 5 ? ` from the ${compass(w.windDir)}` : "";
  const gusts = w.gustKmh != null && w.gustKmh >= w.windKmh + 10 ? `, gusts ${r(w.gustKmh)}` : "";
  return `Wind ${r(w.windKmh)} km/h${from}${gusts}`;
}

/** The match page's weather, as separate phrases: ["Light rain, 18°", "60% chance of rain", "Wind 17 km/h from the WSW"]. */
export function weatherParts(w: Weather): string[] {
  if (w.roofed) return ["Under the roof"];
  const head = [w.conditions, w.tempC != null ? `${r(w.tempC)}°` : null].filter(Boolean).join(", ");
  return [head, rainText(w), windText(w)].filter((p): p is string => !!p);
}

/** The short flag for a game row, or null when the weather is unremarkable. */
export function weatherFlag(w: Weather | undefined): { kind: "rain" | "wind"; text: string } | null {
  if (!w || w.roofed) return null;
  const mm = w.rainMm ?? 0;
  if (w.kind === "forecast" && ((w.rainChance ?? 0) >= RAIN_CHANCE || mm >= RAIN_MM)) {
    return { kind: "rain", text: w.rainChance != null ? `Rain ${w.rainChance}%` : "Rain forecast" };
  }
  if (w.kind === "observed" && mm >= RAIN_MM) return { kind: "rain", text: "Wet" };
  if ((w.gustKmh ?? 0) >= GUSTS) return { kind: "wind", text: `Gusts ${r(w.gustKmh!)} km/h` };
  return null;
}
