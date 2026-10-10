import { team, type TeamName } from "@/lib/teams";

const SIZES = {
  sm: "h-6 w-[38px] text-[13px]",
  md: "h-7 w-11 text-[15px]",
  lg: "h-11 w-[66px] text-[23px]",
};

/** A team as its two colours and 3-letter code. No club logos. */
export function TeamBadge({ name, size = "md", dim = false }: { name: TeamName; size?: keyof typeof SIZES; dim?: boolean }) {
  const t = team(name);
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[5px] font-display leading-none font-bold tracking-[0.04em] ring-1 ring-white/10 ring-inset ${SIZES[size]} ${dim ? "opacity-55" : ""}`}
      style={{ backgroundColor: t.primary, color: t.ink ?? t.secondary }}
      aria-hidden
    >
      <span className="relative -mb-px">{t.code}</span>
      <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ backgroundColor: t.secondary, opacity: 0.85 }} />
    </span>
  );
}

/** The Model's own badge: floodlight white, lime stripe. */
export function ModelBadge({ size = "md" }: { size?: keyof typeof SIZES }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-ink font-display leading-none font-extrabold tracking-[0.04em] text-ground ${SIZES[size]}`}
      aria-hidden
    >
      <span className="relative -mb-px">MDL</span>
      <span className="absolute inset-x-0 bottom-0 h-[3px] bg-lime" />
    </span>
  );
}
