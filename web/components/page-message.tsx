import Link from "next/link";

/** A whole page that's only a message: signed out, not in the comp, the off-season. */
export function PageMessage({ title, body, action }: { title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <main>
      <section className="pt-12">
        <h1 className="font-display text-[36px] leading-[0.92] font-bold uppercase">{title}</h1>
        <p className="mt-4 max-w-[38ch] text-[16px] leading-relaxed text-ink-2">{body}</p>
        {action && (
          <Link
            href={action.href}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-lime px-5 py-3 text-[15px] font-bold text-lime-ink"
          >
            {action.label}
          </Link>
        )}
      </section>
    </main>
  );
}
