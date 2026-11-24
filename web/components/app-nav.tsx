"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Ellipsis, House, ListChecks, Medal, Trophy, type LucideIcon } from "lucide-react";
import { createAuthStore } from "@/lib/auth";

type Item = { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean };

const ITEMS: Item[] = [
  { href: "/", label: "Home", icon: House, match: (p) => p === "/" || p.startsWith("/round") || p.startsWith("/match") },
  { href: "/tipping", label: "Tips", icon: ListChecks, match: (p) => p === "/tipping" },
  { href: "/tipping/ladder", label: "Ladder", icon: Trophy, match: (p) => p.startsWith("/tipping/ladder") },
  { href: "/dally-m", label: "Dally M", icon: Medal, match: (p) => p.startsWith("/dally-m") },
];

// Elo moved here to make room for the Dally M (a layout with room for more tabs: PLAN_WEB.md §3.1a).
const MORE = [
  { href: "/elo", label: "Elo" },
  { href: "/last-man-standing", label: "Last man standing" },
  { href: "/groups", label: "Groups" },
  { href: "/players", label: "Players" },
  { href: "/odds", label: "Model vs market" },
  { href: "/news", label: "News" },
  { href: "/model", label: "The Model" },
  { href: "/about", label: "How the Model works" },
  { href: "/account", label: "Your account" },
  { href: "/tipping/admin", label: "Admin", adminOnly: true },
];

function MoreMenu({ placement }: { placement: "up" | "down" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const active = MORE.some((m) => pathname.startsWith(m.href));
  // The admin item shows only for whoever runs the comp.
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    createAuthStore().isAdmin().then(setAdmin);
  }, []);
  const items = MORE.filter((m) => !("adminOnly" in m) || admin);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const tab = placement === "up";
  return (
    <div ref={ref} className={tab ? "relative flex-1" : "relative"}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className={
          tab
            ? `flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold tracking-wide transition-colors hover:text-ink ${active || open ? "text-ink" : "text-ink-3"}`
            : `flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors hover:text-ink ${active || open ? "text-ink" : "text-ink-3"}`
        }
      >
        <Ellipsis className={tab ? "size-[22px]" : "size-4"} strokeWidth={2} aria-hidden />
        More
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-50 min-w-48 overflow-hidden rounded-lg border border-line bg-raised-2 py-1 shadow-[0_12px_32px_-8px_color-mix(in_oklab,var(--color-shadow)_60%,transparent)] ${
            tab ? "right-2 bottom-[calc(100%+8px)]" : "top-[calc(100%+6px)] right-0"
          }`}
        >
          {items.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              role="menuitem"
              className="block px-4 py-3 text-[15px] font-medium text-ink-2 hover:bg-raised hover:text-ink"
            >
              {m.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The Full Credit symbol: a goal kick sailing between the posts. On load the ball is kicked from
 * close up, turns end over end as it climbs away, and comes to rest between the uprights above the
 * crossbar; the posts light once for the goal. Hovering the logo kicks it again. At rest (and under
 * reduced motion) it shows the ball through the posts.
 */
function FullCreditMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0 overflow-visible" aria-hidden>
      <rect width="32" height="32" rx="7" className="fill-pitch" />
      <path d="M10 4.5v23M22 4.5v23M10 18.5h12" className="fc-posts stroke-ink" strokeWidth="2" strokeLinecap="round" fill="none" />
      <g className="fc-ball">
        <ellipse cx="16" cy="11" rx="5" ry="3.2" transform="rotate(-30 16 11)" className="fill-lime stroke-lime-ink" strokeWidth="0.8" />
        <path d="M13.8 12.3 18.2 9.7" className="stroke-lime-ink" strokeWidth="0.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function AppNav() {
  const pathname = usePathname();
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line-soft bg-ground/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[34rem] items-center justify-between px-4 md:max-w-5xl">
          <Link href="/" className="fc-logo flex items-center gap-2.5" aria-label="Full Credit, home">
            <FullCreditMark />
            <span className="flex flex-col">
              <span className="font-display text-[22px] leading-[0.9] font-bold tracking-[0.02em] text-ink uppercase">Full Credit</span>
              <span className="mt-0.5 text-[11px] leading-none font-semibold tracking-[0.06em] text-ink-3">to the boys</span>
            </span>
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {ITEMS.map((item) => {
              const on = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={on ? "page" : undefined}
                  className={`relative rounded-md px-3 py-2 text-sm font-semibold transition-colors hover:text-ink ${on ? "text-ink" : "text-ink-3"}`}
                >
                  {item.label}
                  {on && <span className="absolute inset-x-3 -bottom-[11px] h-[2px] rounded-full bg-lime-fg" />}
                </Link>
              );
            })}
            <MoreMenu placement="down" />
          </nav>
        </div>
      </header>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className="mx-auto flex h-16 max-w-[34rem]">
          {ITEMS.map((item) => {
            const on = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={`relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold tracking-wide ${on ? "text-ink" : "text-ink-3"}`}
              >
                {on && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-lime-fg" />}
                <Icon className={`size-[22px] ${on ? "text-lime-fg" : ""}`} strokeWidth={on ? 2.25 : 2} aria-hidden />
                {item.label}
              </Link>
            );
          })}
          <MoreMenu placement="up" />
        </div>
      </nav>
    </>
  );
}
