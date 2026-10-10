import Link from "next/link";

export type SampleState = "recap" | "open" | "live" | "pending" | "offseason" | "error";

const WEEK: { state: SampleState; label: string; when: string }[] = [
  { state: "recap", label: "Recap", when: "Mon noon" },
  { state: "open", label: "Tipping open", when: "Tue 7:30pm" },
  { state: "live", label: "In progress", when: "Sat 6:20pm" },
];

const OTHER: { state: SampleState; label: string }[] = [
  { state: "pending", label: "Predictions pending" },
  { state: "offseason", label: "Off-season" },
  { state: "error", label: "Load error" },
];

const href = (state: SampleState, signedIn: boolean) => `/?state=${state}${signedIn ? "" : "&as=guest"}`;

/** Development aid until the pipeline publishes real rounds. Says plainly
 *  that everything above it is sample data. */
export function SampleBar({ state, signedIn }: { state: SampleState; signedIn: boolean }) {
  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
      on ? "bg-ink text-ground" : "text-ink-2 ring-1 ring-line ring-inset hover:text-ink hover:ring-ink-3"
    }`;
  return (
    <aside aria-label="Sample data" className="mt-10 rounded-xl border border-dashed border-line px-4 py-4">
      <p className="text-[13px] leading-relaxed text-ink-3">
        <span className="font-semibold text-ink-2">Sample data.</span> The real 2026 Round 10 replay: Tuesday predictions and
        the actual results. Tippers, tips and the ladder are made up.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {WEEK.map((w) => (
          <Link key={w.state} href={href(w.state, signedIn)} className={chip(state === w.state)} aria-current={state === w.state ? "page" : undefined}>
            {w.label} <span className="font-medium opacity-70">· {w.when}</span>
          </Link>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {OTHER.map((o) => (
          <Link key={o.state} href={href(o.state, signedIn)} className={chip(state === o.state)} aria-current={state === o.state ? "page" : undefined}>
            {o.label}
          </Link>
        ))}
        <Link href={href(state, !signedIn)} className={chip(false)}>
          {signedIn ? "View signed out" : "View signed in"}
        </Link>
      </div>
    </aside>
  );
}
