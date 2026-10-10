// Line colours for highlighted teams. Kept apart from lib/elo.ts so client charts
// can use it without bundling the rating data.

import { team, type TeamName } from "./teams";

type Vision = "normal" | "protan" | "deutan";

/** Colour-blind simulation in linear RGB (Machado et al. 2009, full severity). */
const CVD: Record<Exclude<Vision, "normal">, number[][]> = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
};

/** OKLab distance ×100, the measure the dataviz palette validator uses, as seen with a given vision. */
function deltaE(a: string, b: string, vision: Vision = "normal") {
  const lab = (hex: string) => {
    let [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    if (vision !== "normal") {
      const m = CVD[vision];
      [r, g, bl] = m.map((row) => Math.max(0, Math.min(1, row[0] * r + row[1] * g + row[2] * bl)));
    }
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  };
  const [x, y] = [lab(a), lab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) * 100;
}

/** The validator's floors: normal vision 15, colour-blind 8 (below that, two lines merge). */
const MIN_NORMAL = 15;
const MIN_CVD = 8;

/** How far a colour stands from those in use, as a share of the floors (>= 1 passes every check). */
function clearance(x: string, used: string[]) {
  if (!used.length) return Infinity;
  return Math.min(
    ...used.map((u) => Math.min(deltaE(u, x) / MIN_NORMAL, deltaE(u, x, "protan") / MIN_CVD, deltaE(u, x, "deutan") / MIN_CVD)),
  );
}

/**
 * A colour for a team joining the lit set: its bar colour, unless that's too close to a
 * colour already in use (for normal or colour-blind vision), in which case whichever of
 * its colours stands furthest from them.
 */
export function colourFor(t: TeamName, used: string[]): string {
  const c = team(t);
  const options = [c.bar, c.secondary, c.primary];
  if (clearance(c.bar, used) >= 1) return c.bar;
  return options.sort((a, b) => clearance(b, used) - clearance(a, used))[0];
}

/** Colours for a list of teams lit in order (server-side default, and the team view). */
export function lineColours(teams: TeamName[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of teams) out[t] = colourFor(t, Object.values(out));
  return out;
}
