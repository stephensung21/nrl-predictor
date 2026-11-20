"use client";

// The players page's controls (app/players/page.tsx). Every choice lives in the address, so the page
// stays a server component and each view can be linked to.

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

const field =
  "h-11 rounded-md bg-raised px-2 text-[15px] font-semibold text-ink ring-1 ring-line ring-inset focus:ring-2 focus:ring-lime-fg focus:outline-none";

/** A select that sets one query parameter, keeping the others. */
export function QuerySelect({
  label, param, value, options, query,
}: { label: string; param: string; value: string; options: { value: string; label: string }[]; query: Record<string, string> }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-[13px] text-ink-3">
      {label}
      <select
        value={value}
        onChange={(e) => {
          const q = new URLSearchParams({ ...query, [param]: e.target.value });
          if (param === "season") q.delete("player"); // a player may not have played that season
          router.push(`/players?${q}`, { scroll: false });
        }}
        className={`${field} font-score text-[16px]`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Type a name and pick from the season's players; Enter or a match from the list opens them. */
export function PlayerSearch({
  players, query,
}: { players: { id: number; label: string }[]; query: Record<string, string> }) {
  const router = useRouter();
  const listId = useId();
  const [text, setText] = useState("");
  const [miss, setMiss] = useState(false);
  const open = (value: string) => {
    const v = value.trim().toLowerCase();
    const hit = players.find((p) => p.label.toLowerCase() === v) ?? (v.length >= 3 ? players.find((p) => p.label.toLowerCase().includes(v)) : undefined);
    if (!hit) return false;
    setMiss(false);
    setText("");
    router.push(`/players?${new URLSearchParams({ ...query, tab: "stats", player: String(hit.id) })}`, { scroll: false });
    return true;
  };
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        setMiss(!open(text));
      }}
    >
      <label htmlFor={`${listId}-input`} className="block text-[13px] font-semibold text-ink-3">
        Find a player
      </label>
      <input
        id={`${listId}-input`}
        list={listId}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          // Picking from the list fills the whole label: open it straight away.
          if (players.some((p) => p.label === e.target.value)) open(e.target.value);
        }}
        placeholder="Start typing a name"
        autoComplete="off"
        aria-describedby={miss ? `${listId}-miss` : undefined}
        className={`${field} mt-1.5 w-full px-3 font-sans font-medium placeholder:font-normal placeholder:text-ink-3`}
      />
      <datalist id={listId}>
        {players.map((p) => (
          <option key={p.id} value={p.label} />
        ))}
      </datalist>
      {miss && (
        <p id={`${listId}-miss`} className="mt-1.5 text-[13px] text-miss">
          No player by that name this season. Try part of a surname.
        </p>
      )}
    </form>
  );
}
