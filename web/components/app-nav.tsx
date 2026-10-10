"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarRange, ChartLine, Ellipsis, ListChecks, Trophy, type LucideIcon } from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean };

const ITEMS: Item[] = [
  { href: "/", label: "Round", icon: CalendarRange, match: (p) => p === "/" || p.startsWith("/round") || p.startsWith("/match") },
  { href: "/tipping", label: "Tips", icon: ListChecks, match: (p) => p === "/tipping" },
  { href: "/tipping/ladder", label: "Ladder", icon: Trophy, match: (p) => p.startsWith("/tipping/ladder") },
  { href: "/elo", label: "Elo", icon: ChartLine, match: (p) => p.startsWith("/elo") },
];

const MORE = [
  { href: "/odds", label: "Model vs market" },
  { href: "/news", label: "News" },
  { href: "/model", label: "The Model" },
  { href: "/about", label: "How the Model works" },
];

function MoreMenu({ placement }: { placement: "up" | "down" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const active = MORE.some((m) => pathname.startsWith(m.href));

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
            ? `flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold tracking-wide ${active || open ? "text-ink" : "text-ink-3"}`
            : `flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors hover:text-ink ${active || open ? "text-ink" : "text-ink-3"}`
        }
      >
        <Ellipsis className={tab ? "size-[22px]" : "size-4"} strokeWidth={2} aria-hidden />
        More
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-50 min-w-48 overflow-hidden rounded-lg border border-line bg-raised-2 py-1 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.6)] ${
            tab ? "right-2 bottom-[calc(100%+8px)]" : "top-[calc(100%+6px)] right-0"
          }`}
        >
          {MORE.map((m) => (
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

export function AppNav() {
  const pathname = usePathname();
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line-soft bg-ground/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[34rem] items-center justify-between px-4 md:max-w-5xl">
          <Link href="/" className="flex items-baseline gap-2.5" aria-label="rugbyleague-tipper, home">
            <span className="font-display text-[23px] leading-none font-bold tracking-[0.01em] text-ink">
              rugbyleague<span className="text-lime">-</span>tipper
            </span>
            <span className="rounded-sm border border-line px-1.5 py-[3px] text-[10px] leading-none font-semibold tracking-[0.06em] text-ink-3 uppercase">
              personal project
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
                  {on && <span className="absolute inset-x-3 -bottom-[11px] h-[2px] rounded-full bg-lime" />}
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
                {on && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-lime" />}
                <Icon className={`size-[22px] ${on ? "text-lime" : ""}`} strokeWidth={on ? 2.25 : 2} aria-hidden />
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
