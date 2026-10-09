// Template copy for the four places the site is allowed to talk trash
// (DESIGN_BRIEF.md): the ladder, the round recap, the home tipping strip,
// and empty and error states. Picks are deterministic per round, so a page
// doesn't change its jokes on every refresh.

const pick = <T,>(options: T[], seed: number) => options[Math.abs(seed) % options.length];

/** Tipping strip: your record against the Model this season. */
export function vsModelLine(diff: number, seed: number): string {
  if (diff > 0)
    return pick([
      `+${diff} on the Model. Don't get comfortable.`,
      `+${diff} on the Model. It's taking notes.`,
    ], seed);
  if (diff === 0)
    return pick(["Dead level with the Model.", "Level with the Model. It's not worried."], seed);
  const n = -diff;
  return pick([
    `${n} behind the Model. It doesn't even watch the games.`,
    `${n} behind the Model. It's a spreadsheet, mate.`,
    `${n} behind the Model. It hasn't missed a tipping deadline yet.`,
  ], seed);
}

/** Recap headline for the Model's round. */
export function modelRoundLine(modelScore: number, games: number, lowest: { name: string; score: number }): string {
  if (lowest.score < modelScore) return `Model went ${modelScore}/${games}. ${lowest.name} went ${lowest.score}.`;
  return `Model went ${modelScore}/${games}. Nobody did worse. Small mercies.`;
}

export function perfectLine(names: string[], games: number, seed: number): string {
  if (names.length === 0) return pick(["Perfect round: nobody. Again.", "Perfect round: nobody. As usual."], seed);
  if (names.length === 1) return `Perfect round: ${names[0]}. ${games} from ${games}.`;
  return `Perfect round: ${names.slice(0, -1).join(", ")} and ${names.at(-1)}.`;
}

export function roastLine(name: string, score: number, games: number, seed: number): string {
  return pick([
    `${name} went ${score} from ${games}. The home-team auto-tip would've done better.`,
    `${name} went ${score} from ${games}. Character-building stuff.`,
    `${name} went ${score} from ${games}. Bold choices, all of them wrong.`,
  ], seed);
}

export const emptyCopy = {
  offseason: {
    title: "No footy.",
    body: "The Model is resting. It's earned it, unlike some of you. Predictions are back for the trials in February.",
  },
  pending: {
    title: "Predictions land Tuesday.",
    body: "Team lists come out about 4pm Sydney time and the Model has its say by about 5:15pm. Plenty of time to overthink it.",
  },
  error: {
    title: "Couldn't load the round.",
    body: "Probably the scraper having a lie-down. Try again in a minute.",
  },
};
