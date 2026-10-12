"use client";

import { useEffect, useState } from "react";
import { readThemeChoice, saveThemeChoice, type ThemeChoice } from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string; explain: string }[] = [
  { value: "device", label: "Device default", explain: "Light or dark to match your phone or computer." },
  { value: "light", label: "Light", explain: "Day game: a light ground, whatever your device says." },
  { value: "dark", label: "Dark", explain: "Night game: a dark ground, whatever your device says." },
];

/** Light or dark mode, saved in this browser. It applies on the next page load,
 *  so the page never repaints half-way through. Shown signed in or not. */
export function ThemeSetting() {
  const [loaded, setLoaded] = useState<ThemeChoice | null>(null);
  const [choice, setChoice] = useState<ThemeChoice>("device");

  useEffect(() => {
    const c = readThemeChoice();
    setLoaded(c);
    setChoice(c);
  }, []);

  const pending = loaded !== null && choice !== loaded;

  return (
    <section className="mt-10 border-t border-line-soft pt-5">
      <fieldset>
        <legend className="text-[16px] font-semibold text-ink">Appearance</legend>
        <p className="mt-1 text-[13px] text-ink-3">Saved in this browser. Changes apply when you refresh the page.</p>
        <div className="mt-2 space-y-1 border-y border-line-soft py-1">
          {OPTIONS.map((o) => {
            const on = choice === o.value;
            return (
              <label key={o.value} className={`flex cursor-pointer items-start gap-3 rounded-md px-2 py-3 ${on ? "bg-lime-wash" : ""}`}>
                <input
                  type="radio"
                  name="theme"
                  value={o.value}
                  checked={on}
                  onChange={() => {
                    saveThemeChoice(o.value);
                    setChoice(o.value);
                  }}
                  className="mt-1 size-4 accent-[var(--color-lime-fg)]"
                />
                <span>
                  <span className={`block text-[15px] font-semibold ${on ? "text-ink" : "text-ink-2"}`}>{o.label}</span>
                  <span className="block text-[13px] text-ink-3">{o.explain}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <p aria-live="polite" className="mt-3 flex min-h-9 items-center gap-3 text-[14px] font-semibold text-ink-2">
        {pending && (
          <>
            Saved. Refresh to apply.
            <button
              type="button"
              className="text-ink underline decoration-line hover:decoration-ink-3"
              onClick={() => window.location.reload()}
            >
              Refresh now
            </button>
          </>
        )}
      </p>
    </section>
  );
}
