"use client";

// Last man standing's pick for the open round (app/last-man-standing/page.tsx): the round's games as
// pairs of team buttons, a tap saves. Teams already used this game can't be picked; a game that has
// kicked off can't be picked, and once the picked game has kicked off the pick is locked in. Saved to
// the viewer's PickStore (this browser for the sample, the database live).

import Link from "next/link";
import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LocalTime } from "@/components/local-time";
import { TeamBadge } from "@/components/team-badge";
import { createPickStore, type SavedPick } from "@/lib/lms-store";
import type { TeamName } from "@/lib/teams";
import { LockedError } from "@/lib/tip-store";
import { clockFrom } from "@/lib/time";

export type PickGame = { id: string; kickoff: string; home: TeamName; away: TeamName };

type Status = "loading" | "idle" | "saving" | "saved" | "error" | "locked";

export function LmsPicker({ season, round, now, games, used }: { season: number; round: number; now: string; games: PickGame[]; used: TeamName[] }) {
  const clock = useMemo(() => clockFrom(now), [now]);
  const kickoff = useMemo(() => new Map(games.map((g) => [g.id, Date.parse(g.kickoff)])), [games]);
  const started = (id: string) => clock() >= (kickoff.get(id) ?? 0);
  const store = useMemo(() => createPickStore((id) => clock() >= (kickoff.get(id) ?? 0)), [clock, kickoff]);
  const [pick, setPick] = useState<SavedPick | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let live = true;
    store
      .load(season, round)
      .then((p) => {
        if (!live) return;
        setPick(p);
        setStatus("idle");
      })
      .catch(() => live && setStatus("idle"));
    return () => {
      live = false;
    };
  }, [store, season, round]);

  const lockedIn = pick != null && started(pick.matchId);
  const usedSet = new Set(used);

  async function choose(matchId: string, team: TeamName) {
    const before = pick;
    setPick({ matchId, team });
    setStatus("saving");
    try {
      await store.save(season, round, { matchId, team });
      setStatus("saved");
    } catch (e) {
      setPick(before);
      setStatus(e instanceof LockedError ? "locked" : "error");
    }
  }

  return (
    <div className="mt-3" aria-busy={status === "loading"}>
      <p role="status" className="min-h-5 text-[14px] text-ink-2">
        {status === "error" ? (
          <span className="text-miss">Couldn&rsquo;t save. Try again.</span>
        ) : status === "locked" ? (
          <span className="text-miss">That game has kicked off.</span>
        ) : status === "saving" ? (
          "Saving…"
        ) : pick == null ? (
          status === "loading" ? null : "No pick yet. Tap the team you're sure will win."
        ) : lockedIn ? (
          <>
            Locked in: <span className="font-semibold text-ink">{pick.team}</span>.
          </>
        ) : (
          <>
            {status === "saved" ? "Saved. " : ""}Your pick: <span className="font-semibold text-ink">{pick.team}</span>. You can change it until
            its game kicks off.
          </>
        )}
      </p>
      <ul className="mt-2 grid gap-3">
        {games.map((g) => {
          const off = started(g.id) || lockedIn;
          return (
            <li key={g.id}>
              <p className="text-[13px] text-ink-3">
                <LocalTime iso={g.kickoff} />
              </p>
              <div role="group" aria-label={`${g.home} v ${g.away}`} className="mt-1 grid grid-cols-2 gap-2">
                {([g.home, g.away] as const).map((t, i) => {
                  const chosen = pick?.team === t && pick.matchId === g.id;
                  const spent = usedSet.has(t);
                  const disabled = off || spent || status === "saving" || status === "loading";
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={chosen}
                      disabled={disabled}
                      onClick={() => void choose(g.id, t)}
                      className={`flex min-h-14 items-center gap-2.5 rounded-lg px-3 text-left text-[15px] font-semibold transition-[background-color,box-shadow] ${
                        chosen
                          ? "bg-lime-wash text-ink ring-2 ring-lime-fg ring-inset"
                          : disabled
                            ? "text-ink-3 ring-1 ring-line-soft ring-inset"
                            : "text-ink-2 ring-1 ring-line ring-inset hover:bg-raised hover:text-ink"
                      } ${i === 1 ? "flex-row-reverse text-right" : ""}`}
                    >
                      <TeamBadge name={t} size="md" dim={(disabled && !chosen) || spent} />
                      <span className="min-w-0 flex-1 leading-tight">
                        {t}
                        {spent && <span className="block text-[12px] font-normal text-ink-3">Used this game</span>}
                      </span>
                      {chosen && <Check className="tick-pop size-5 shrink-0 text-lime-fg" strokeWidth={3} aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The tipping page's reminder: shown while the viewer is still in and hasn't picked for the open round. */
export function LmsNudge({ season, round }: { season: number; round: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let live = true;
    createPickStore(() => false)
      .load(season, round)
      .then((p) => live && setShow(p == null))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [season, round]);
  if (!show) return null;
  return (
    <p className="mt-2 text-[14px] text-ink-2">
      <Link href="/last-man-standing" className="font-semibold text-ink underline underline-offset-2 hover:text-lime-fg">
        You&rsquo;re still in last man standing
      </Link>
      . Pick a team for Round {round}.
    </p>
  );
}
