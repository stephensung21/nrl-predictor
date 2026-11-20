"use client";

// The open round's Dally M ballot (app/dally-m/page.tsx): three picks, 3, 2 and 1 votes, each a search
// over the players who took the field that round. Saved to the viewer's VoteStore (this browser for the
// sample, the database live), where it can be changed until voting closes.

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { PlayerPhoto } from "@/components/player-photo";
import { ballotProblem, EMPTY_BALLOT, VOTE_SLOTS, type Ballot, type RoundPlayer, type VoteSlot } from "@/lib/dally-m";
import { createVoteStore } from "@/lib/dally-m-store";
import { LockedError } from "@/lib/tip-store";

type Status = "loading" | "idle" | "saving" | "saved" | "error" | "closed";

const label = (p: RoundPlayer) => `${p.name} (${p.team})`;

export function DallyMBallot({ season, round, closes, players }: { season: number; round: number; closes: string; players: RoundPlayer[] }) {
  const store = useMemo(() => createVoteStore(() => Date.now() >= Date.parse(closes)), [closes]);
  const [ballot, setBallot] = useState<Ballot>(EMPTY_BALLOT);
  const [saved, setSaved] = useState<Ballot>(EMPTY_BALLOT);
  const [status, setStatus] = useState<Status>("loading");
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const listId = useId();

  useEffect(() => {
    let live = true;
    store
      .load(season, round)
      .then((b) => {
        if (!live) return;
        setBallot(b);
        setSaved(b);
        setStatus("idle");
      })
      .catch(() => live && setStatus("idle"));
    return () => {
      live = false;
    };
  }, [store, season, round]);

  const problem = ballotProblem(ballot);
  const changed = VOTE_SLOTS.some((s) => ballot[s] !== saved[s]);
  const pick = (slot: VoteSlot, id: number | null) => {
    setBallot((b) => ({ ...b, [slot]: id }));
    if (status === "saved" || status === "error") setStatus("idle");
  };

  async function save() {
    if (problem) return;
    setStatus("saving");
    try {
      await store.save(season, round, ballot);
      setSaved(ballot);
      setStatus("saved");
    } catch (e) {
      setStatus(e instanceof LockedError ? "closed" : "error");
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="mt-3"
      aria-busy={status === "loading"}
    >
      <datalist id={listId}>
        {players.map((p) => (
          <option key={p.id} value={label(p)} />
        ))}
      </datalist>
      <ol className="grid gap-2">
        {VOTE_SLOTS.map((slot) => (
          <li key={slot}>
            <Slot slot={slot} player={ballot[slot] == null ? undefined : byId.get(ballot[slot]!)} players={players} listId={listId} onPick={(id) => pick(slot, id)} />
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="submit"
          disabled={!changed || !!problem || status === "saving" || status === "loading"}
          className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-[15px] font-semibold text-ground transition-colors hover:bg-ink-2 focus-visible:ring-2 focus-visible:ring-lime-fg focus-visible:ring-offset-2 focus-visible:ring-offset-ground focus-visible:outline-none disabled:bg-raised-2 disabled:text-ink-3"
        >
          {status === "saving" ? "Saving…" : "Save votes"}
        </button>
        <p role="status" className="text-[14px] text-ink-2">
          {problem ? (
            <span className="text-miss">{problem}</span>
          ) : status === "saved" ? (
            "Saved. You can change them until voting closes."
          ) : status === "closed" ? (
            <span className="text-miss">Voting has closed for this round.</span>
          ) : status === "error" ? (
            <span className="text-miss">Couldn&rsquo;t save. Try again.</span>
          ) : status === "idle" && !changed && VOTE_SLOTS.some((s) => saved[s] != null) ? (
            "Your votes are in."
          ) : null}
        </p>
      </div>
    </form>
  );
}

function Slot({
  slot, player, players, listId, onPick,
}: { slot: VoteSlot; player?: RoundPlayer; players: RoundPlayer[]; listId: string; onPick: (id: number | null) => void }) {
  const [text, setText] = useState("");
  const inputId = useId();
  const votes = `${slot} vote${slot === 1 ? "" : "s"}`;
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-lg bg-raised px-3 py-2">
      <span aria-hidden className="w-6 shrink-0 text-center font-score text-[24px] leading-none font-bold text-ink">
        {slot}
      </span>
      {player ? (
        <>
          <PlayerPhoto src={player.image} team={player.team} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] leading-tight font-semibold text-ink">{player.name}</span>
            <span className="text-[12px] text-ink-3">
              {player.team} · {votes}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onPick(null)}
            aria-label={`Change your ${votes}: ${player.name}`}
            className="inline-flex min-h-11 items-center rounded-full px-3 text-[14px] font-semibold text-ink-2 ring-1 ring-line ring-inset hover:text-ink hover:ring-ink-3 focus-visible:ring-2 focus-visible:ring-lime-fg focus-visible:outline-none"
          >
            Change
          </button>
        </>
      ) : (
        <span className="min-w-0 flex-1">
          <label htmlFor={inputId} className="sr-only">
            Your {votes}
          </label>
          <input
            id={inputId}
            list={listId}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const hit = players.find((p) => label(p) === e.target.value);
              if (hit) {
                setText("");
                onPick(hit.id);
              }
            }}
            placeholder={`Who gets your ${votes}?`}
            autoComplete="off"
            className="h-11 w-full rounded-md bg-ground px-3 text-[15px] font-medium text-ink ring-1 ring-line ring-inset placeholder:font-normal placeholder:text-ink-3 focus:ring-2 focus:ring-lime-fg focus:outline-none"
          />
        </span>
      )}
    </div>
  );
}

/** The tipping page's reminder: shown while a round is open and the viewer hasn't voted. */
export function DallyMNudge({ season, round, closes }: { season: number; round: number; closes: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let live = true;
    createVoteStore(() => Date.now() >= Date.parse(closes))
      .load(season, round)
      .then((b) => live && setShow(VOTE_SLOTS.every((s) => b[s] == null)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [season, round, closes]);
  if (!show) return null;
  return (
    <p className="mt-4 text-[14px] text-ink-2">
      <Link href="/dally-m" className="font-semibold text-ink underline underline-offset-2 hover:text-lime-fg">
        Dally M votes for Round {round} are open
      </Link>
      . Give your 3, 2 and 1 before the next round kicks off.
    </p>
  );
}
