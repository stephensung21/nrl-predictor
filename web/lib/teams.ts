// Team identity for badges and probability bars. No club logos: each team is
// its two colours and a 3-letter code. Colours are lightened where the real
// shade (navy, maroon, black) would disappear on the dark ground.

export type TeamName =
  | "Broncos" | "Raiders" | "Bulldogs" | "Sharks" | "Dolphins" | "Titans"
  | "Sea Eagles" | "Storm" | "Knights" | "Cowboys" | "Eels" | "Panthers"
  | "Rabbitohs" | "Dragons" | "Roosters" | "Warriors" | "Wests Tigers";

export type Team = {
  name: TeamName;
  code: string;
  /** Badge fill. */
  primary: string;
  /** Badge lettering and stripe. */
  secondary: string;
  /** Code lettering when the secondary colour is too dark against the fill. */
  ink?: string;
  /** Probability-bar fill: whichever of the two reads best on the dark ground. */
  bar: string;
};

export const TEAMS: Record<TeamName, Team> = {
  Broncos: { name: "Broncos", code: "BRI", primary: "#8f2246", secondary: "#fbbf15", bar: "#c23b66" },
  Raiders: { name: "Raiders", code: "CAN", primary: "#4f9a1c", secondary: "#ffffff", bar: "#62b028" },
  Bulldogs: { name: "Bulldogs", code: "CBY", primary: "#1d5fb0", secondary: "#ffffff", bar: "#3f7fd0" },
  Sharks: { name: "Sharks", code: "CRO", primary: "#0096c4", secondary: "#0b0f12", bar: "#1fb3e0" },
  Dolphins: { name: "Dolphins", code: "DOL", primary: "#d42630", secondary: "#f4c430", bar: "#e8414a" },
  Titans: { name: "Titans", code: "GLD", primary: "#0091cc", secondary: "#f8b818", bar: "#f2b42a" },
  "Sea Eagles": { name: "Sea Eagles", code: "MAN", primary: "#8a1f4f", secondary: "#ffffff", bar: "#b73c72" },
  Storm: { name: "Storm", code: "MEL", primary: "#5e2a8c", secondary: "#ffc72c", bar: "#9157c8" },
  Knights: { name: "Knights", code: "NEW", primary: "#24519e", secondary: "#ee3524", ink: "#ffffff", bar: "#ee4a3a" },
  Cowboys: { name: "Cowboys", code: "NQL", primary: "#1f4a80", secondary: "#ffc425", bar: "#f0b92a" },
  Eels: { name: "Eels", code: "PAR", primary: "#0a6cb0", secondary: "#ffd200", bar: "#f5cc1a" },
  Panthers: { name: "Panthers", code: "PEN", primary: "#2b2d30", secondary: "#e8414a", bar: "#f07ab4" },
  Rabbitohs: { name: "Rabbitohs", code: "SOU", primary: "#14713f", secondary: "#e0262f", ink: "#ffffff", bar: "#2a9a5c" },
  Dragons: { name: "Dragons", code: "SGI", primary: "#e2231a", secondary: "#ffffff", bar: "#ec4038" },
  Roosters: { name: "Roosters", code: "SYD", primary: "#22457f", secondary: "#e31e26", ink: "#ffffff", bar: "#5a83c8" },
  Warriors: { name: "Warriors", code: "NZW", primary: "#34405e", secondary: "#9dcb3c", bar: "#8c9bbf" },
  "Wests Tigers": { name: "Wests Tigers", code: "WST", primary: "#f2801f", secondary: "#121212", bar: "#f58d2e" },
};

export const team = (name: TeamName) => TEAMS[name];
