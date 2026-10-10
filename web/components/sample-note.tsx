import Link from "next/link";

/** Says plainly that a page runs on sample data, with optional links between sample states. */
export function SampleNote({ children, states }: { children: React.ReactNode; states?: { href: string; label: string; on: boolean }[] }) {
  return (
    <aside aria-label="Sample data" className="mt-10 rounded-xl border border-dashed border-line px-4 py-4">
      <p className="text-[13px] leading-relaxed text-ink-3">
        <span className="font-semibold text-ink-2">Sample data.</span> {children}
      </p>
      {states && (
        <div className="mt-3 flex flex-wrap gap-2">
          {states.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              aria-current={s.on ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                s.on ? "bg-ink text-ground" : "text-ink-2 ring-1 ring-line ring-inset hover:text-ink hover:ring-ink-3"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}
