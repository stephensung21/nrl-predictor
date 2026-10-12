// Team identity for badges and probability bars. No club logos: each team is
// its two colours and a 3-letter code. Bar colours are lightened where the real
// shade (navy, maroon, black) would disappear on the dark ground; light mode
// uses the real club colour instead (lightBar).

export type TeamName =
  | "Broncos" | "Raiders" | "Bulldogs" | "Sharks" | "Dolphins" | "Titans"
  | "Sea Eagles" | "Storm" | "Knights" | "Cowboys" | "Eels" | "Panthers"
  | "Rabbitohs" | "Dragons" | "Roosters" | "Warriors" | "Wests Tigers" | "Bears";

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
  /** Probability-bar fill in light mode: the real club colour, at least 3:1 on white. */
  lightBar: string;
};

export const TEAMS: Record<TeamName, Team> = {
  Broncos: { name: "Broncos", code: "BRI", primary: "#8f2246", secondary: "#fbbf15", bar: "#c23b66", lightBar: "#6c1d45" },
  Raiders: { name: "Raiders", code: "CAN", primary: "#4f9a1c", secondary: "#ffffff", bar: "#62b028", lightBar: "#3f8a17" },
  Bulldogs: { name: "Bulldogs", code: "CBY", primary: "#1d5fb0", secondary: "#ffffff", bar: "#3f7fd0", lightBar: "#1d5fb0" },
  Sharks: { name: "Sharks", code: "CRO", primary: "#0096c4", secondary: "#0b0f12", bar: "#1fb3e0", lightBar: "#0080a8" },
  Dolphins: { name: "Dolphins", code: "DOL", primary: "#d42630", secondary: "#f4c430", bar: "#e8414a", lightBar: "#c8102e" },
  Titans: { name: "Titans", code: "GLD", primary: "#0091cc", secondary: "#f8b818", bar: "#f2b42a", lightBar: "#0079b0" },
  "Sea Eagles": { name: "Sea Eagles", code: "MAN", primary: "#8a1f4f", secondary: "#ffffff", bar: "#b73c72", lightBar: "#6f163d" },
  Storm: { name: "Storm", code: "MEL", primary: "#5e2a8c", secondary: "#ffc72c", bar: "#9157c8", lightBar: "#5b2389" },
  Knights: { name: "Knights", code: "NEW", primary: "#24519e", secondary: "#ee3524", ink: "#ffffff", bar: "#ee4a3a", lightBar: "#d2281a" },
  Cowboys: { name: "Cowboys", code: "NQL", primary: "#1f4a80", secondary: "#ffc425", bar: "#f0b92a", lightBar: "#1f4a80" },
  Eels: { name: "Eels", code: "PAR", primary: "#0a6cb0", secondary: "#ffd200", bar: "#f5cc1a", lightBar: "#0a6cb0" },
  Panthers: { name: "Panthers", code: "PEN", primary: "#f07ab4", secondary: "#2b2d30", bar: "#f07ab4", lightBar: "#e0418f" },
  Rabbitohs: { name: "Rabbitohs", code: "SOU", primary: "#14713f", secondary: "#e0262f", ink: "#ffffff", bar: "#2a9a5c", lightBar: "#14713f" },
  Dragons: { name: "Dragons", code: "SGI", primary: "#e2231a", secondary: "#ffffff", bar: "#ec4038", lightBar: "#d21f26" },
  Roosters: { name: "Roosters", code: "SYD", primary: "#22457f", secondary: "#e31e26", ink: "#ffffff", bar: "#5a83c8", lightBar: "#22457f" },
  Warriors: { name: "Warriors", code: "NZW", primary: "#34405e", secondary: "#9dcb3c", bar: "#8c9bbf", lightBar: "#2f3d63" },
  "Wests Tigers": { name: "Wests Tigers", code: "WST", primary: "#f2801f", secondary: "#121212", bar: "#f58d2e", lightBar: "#d4640a" },
  // Joins in 2027. Red and black (the North Sydney Bears' colours); check against the club's kit.
  Bears: { name: "Bears", code: "PER", primary: "#c8102e", secondary: "#111111", ink: "#ffffff", bar: "#e0403f", lightBar: "#b50e28" },
};

export const team = (name: TeamName) => TEAMS[name];
