import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Empty and error states are one of the four places the site is allowed some banter (DESIGN_BRIEF.md).
export const metadata: Metadata = { title: "Not found · rugbyleague-tipper" };

export default function NotFound() {
  return (
    <main>
      <section className="pt-16 pb-8">
        <h1 className="font-display text-[52px] leading-[0.9] font-bold uppercase">Knocked on.</h1>
        <p className="mt-4 max-w-[34ch] text-[16px] leading-relaxed text-ink-2">
          There&rsquo;s nothing at this address. The link might be old, or a game or round that doesn&rsquo;t exist.
        </p>
        <ul className="mt-6 max-w-[24rem] border-y border-line-soft text-[15px] font-semibold">
          {[
            ["/", "This round"],
            ["/tipping", "Your tips"],
            ["/tipping/ladder", "The ladder"],
          ].map(([href, label]) => (
            <li key={href} className="border-b border-line-soft last:border-b-0">
              <Link href={href} className="group flex items-center justify-between py-3 text-ink">
                {label}
                <ChevronRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
