"use client";

// Global or one of your groups (lib/groups.ts): chips under a comp page's title. Choosing one saves
// it in the `fc-group` cookie, so every comp page shows it, and refreshes the page.

import { useRouter } from "next/navigation";
import { GLOBAL, groupCookie, type GroupChoice } from "@/lib/groups";

const chip = "shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors";

export function GroupSwitcher({ choice }: { choice: GroupChoice }) {
  const router = useRouter();
  if (!choice.options.length) return null;
  const options = [{ id: GLOBAL, name: "Global" }, ...choice.options];
  const on = choice.current?.id ?? GLOBAL;
  return (
    <div role="group" aria-label="Whose results" className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === on}
          onClick={() => {
            document.cookie = groupCookie(o.id);
            // A shared link's ?group= would win over the cookie: drop it, keep the rest.
            const url = new URL(window.location.href);
            if (url.searchParams.has("group")) {
              url.searchParams.delete("group");
              router.replace(url.pathname + url.search);
            } else router.refresh();
          }}
          className={`${chip} ${o.id === on ? "bg-ink text-ground" : "text-ink-2 ring-1 ring-line ring-inset hover:text-ink hover:ring-ink-3"}`}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}
