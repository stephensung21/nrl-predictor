"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Plus, Share2 } from "lucide-react";
import {
  createAdminStore,
  INVITE_DAYS,
  inviteStatus,
  type AdminInvite,
  type AdminTipper,
  type MarginInfo,
  type PipelineRun,
} from "@/lib/admin";
import { eligibleForDraw } from "@/lib/rules";
import { sydney } from "@/lib/time";
import { TeamBadge } from "./team-badge";

const pill =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-lime px-5 py-3 text-[15px] font-bold text-lime-ink hover:bg-[oklch(0.94_0.19_126)]";
const ghost = "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-ink-2 ring-1 ring-line ring-inset hover:text-ink";
/** Text actions in a row: a 44px hit area without changing the row's look. */
const rowAction = "-my-2 -mr-2 inline-flex min-h-11 shrink-0 items-center px-2 text-[13px] font-semibold underline decoration-line";

function useStore() {
  return useMemo(() => createAdminStore(), []);
}

/** A polite announcement for changes that remove the control the visitor was on. */
function Announcer({ text }: { text: string }) {
  return (
    <p aria-live="polite" className="sr-only">
      {text}
    </p>
  );
}

/* ---------- Gate: only the admin gets the page ---------- */

export function AdminGate({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    store.isAdmin().then(setOk);
  }, [store]);
  if (ok === null) return <p className="pt-10 text-[15px] text-ink-3">Checking…</p>;
  if (!ok) {
    return (
      <section className="pt-12">
        <h1 className="font-display text-[36px] leading-[0.92] font-bold uppercase">This page is for whoever runs the comp.</h1>
        <Link href="/" className="mt-6 inline-block text-[15px] font-semibold text-ink underline decoration-line">
          Back to the round
        </Link>
      </section>
    );
  }
  return <>{children}</>;
}

export function Section({ id, title, meta, children }: { id: string; title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-9">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line pb-2">
        <h2 id={id} className="font-display text-[24px] leading-none font-bold uppercase">
          {title}
        </h2>
        {meta && <p className="text-[13px] text-ink-3">{meta}</p>}
      </div>
      {children}
    </section>
  );
}

/* ---------- Invites ---------- */

function InviteLink({ invite }: { invite: AdminInvite }) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const copyRef = useRef<HTMLButtonElement>(null);
  const url = `${window.location.origin}/join/${invite.code}`;
  useEffect(() => copyRef.current?.focus(), []);
  return (
    <div className="mt-3 rounded-lg bg-lime-wash px-4 py-3">
      <p className="text-[13px] font-semibold text-ink">New invite, good for one person for {INVITE_DAYS} days</p>
      <p className="mt-1 font-score text-[17px] break-all text-ink">{url}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          ref={copyRef}
          type="button"
          className={ghost}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopy("copied");
            } catch {
              setCopy("failed");
            }
          }}
        >
          {copy === "copied" ? <Check className="size-4" strokeWidth={2.5} aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copy === "copied" ? "Copied" : "Copy link"}
        </button>
        {"share" in navigator && (
          <button
            type="button"
            className={ghost}
            onClick={() => navigator.share({ title: "Join the tipping comp", text: "Join our NRL tipping comp", url }).catch(() => {})}
          >
            <Share2 className="size-4" aria-hidden />
            Share
          </button>
        )}
      </div>
      <p aria-live="polite" className={`mt-2 text-[13px] ${copy === "failed" ? "text-miss" : "sr-only"}`}>
        {copy === "failed" ? "Couldn’t copy. Press and hold the link above to copy it." : copy === "copied" ? "Link copied." : ""}
      </p>
    </div>
  );
}

export function Invites() {
  const store = useStore();
  const now = store.now();
  const [list, setList] = useState<AdminInvite[] | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const summary = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    store.invites().then(setList);
  }, [store]);
  if (!list) return <p className="mt-3 text-[14px] text-ink-3">Loading…</p>;
  const pending = list.filter((i) => inviteStatus(i, now) === "pending");
  const newest = list.find((i) => i.code === fresh);

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={pill}
          onClick={async () => {
            setError(null);
            try {
              const inv = await store.createInvite();
              setList(await store.invites());
              setFresh(inv.code);
            } catch {
              setError("Couldn’t make an invite. Try again.");
            }
          }}
        >
          <Plus className="size-4" strokeWidth={2.5} aria-hidden />
          Create invite
        </button>
        <p ref={summary} tabIndex={-1} className="text-[13px] text-ink-3 outline-none">
          One person, {INVITE_DAYS} days. {pending.length === 0 ? "None waiting." : `${pending.length} waiting.`}
        </p>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[14px] text-miss">
          {error}
        </p>
      )}
      {/* Keyed by code, so a second invite starts fresh ("Copy link", not the last one's "Copied"). */}
      {newest && <InviteLink key={newest.code} invite={newest} />}
      <Announcer text={said} />
      <ul className="mt-4 divide-y divide-line-soft border-y border-line-soft">
        {list.map((i) => {
          const status = inviteStatus(i, now);
          return (
            <li key={i.code} className="flex items-center gap-3 py-2.5 text-[14px]">
              <span className="w-20 shrink-0 font-score text-[16px] text-ink">{i.code}</span>
              <span className="min-w-0 flex-1 text-ink-3">
                {status === "pending" && <>Waiting · expires {sydney(i.expiresAt, "day")}</>}
                {status === "used" && <>Used by {i.usedBy}</>}
                {status === "expired" && <>Expired {sydney(i.expiresAt, "day")}</>}
                {status === "cancelled" && <>Cancelled</>}
              </span>
              {status === "pending" && (
                <button
                  type="button"
                  className={`${rowAction} text-ink-2 hover:text-ink`}
                  onClick={async () => {
                    await store.cancelInvite(i.code);
                    setList(await store.invites());
                    if (fresh === i.code) setFresh(null);
                    setSaid(`Invite ${i.code} cancelled.`);
                    summary.current?.focus();
                  }}
                >
                  Cancel<span className="sr-only"> invite {i.code}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/* ---------- Tippers ---------- */

export function Tippers() {
  const store = useStore();
  const [list, setList] = useState<AdminTipper[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const keepRef = useRef<HTMLButtonElement>(null);
  const removeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const summary = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    store.tippers().then(setList);
  }, [store]);
  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);
  if (!list) return <p className="mt-3 text-[14px] text-ink-3">Loading…</p>;
  const owing = list.filter((t) => t.missing > 0);

  return (
    <>
      <p ref={summary} tabIndex={-1} className="mt-3 text-[14px] text-ink-2 outline-none">
        {owing.length === 0
          ? "Everyone’s tipped every game this round."
          : `${owing.length} still to tip: ${owing.map((t) => `${t.name} (${t.missing})`).join(", ")}.`}
      </p>
      <Announcer text={said} />
      <ul className="mt-3 divide-y divide-line-soft border-y border-line-soft">
        {list.map((t) => (
          <li key={t.id} className="py-2.5">
            <div className="flex items-center gap-3 text-[14px]">
              {t.favTeam && <TeamBadge name={t.favTeam} size="sm" />}
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-ink">{t.name}</span>
                {t.isYou && <span className="ml-1.5 text-[11px] font-bold tracking-[0.06em] text-lime uppercase">You</span>}
                <span className="block text-[12px] text-ink-3">Joined {sydney(t.joined, "day")}</span>
              </span>
              <span className={`shrink-0 text-right text-[13px] ${t.missing ? "font-semibold text-ink" : "text-ink-3"}`}>
                {t.missing ? `${t.missing} to tip` : "All tipped"}
              </span>
              {!t.isYou && confirming !== t.id && (
                <button
                  ref={(el) => {
                    removeRefs.current[t.id] = el;
                  }}
                  type="button"
                  className={`${rowAction} text-ink-3 hover:text-ink-2`}
                  onClick={() => setConfirming(t.id)}
                >
                  Remove<span className="sr-only"> {t.name}</span>
                </button>
              )}
            </div>
            {confirming === t.id && (
              <div className="mt-2 rounded-lg bg-miss-wash px-3 py-2.5 ring-1 ring-miss/50 ring-inset">
                <p className="text-[14px] font-semibold text-ink">Remove {t.name} and all their tips from the comp?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="min-h-11 rounded-full bg-miss px-4 text-[13px] font-bold text-ground"
                    onClick={async () => {
                      await store.removeTipper(t.id);
                      setConfirming(null);
                      setList(await store.tippers());
                      setSaid(`${t.name} removed.`);
                      summary.current?.focus();
                    }}
                  >
                    Yes, remove {t.name}
                  </button>
                  <button
                    ref={keepRef}
                    type="button"
                    className={ghost}
                    onClick={() => {
                      setConfirming(null);
                      requestAnimationFrame(() => removeRefs.current[t.id]?.focus());
                    }}
                  >
                    Keep {t.name}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------- Margin game ---------- */

function Fixture({ home, away, strong }: { home: string; away: string; strong?: boolean }) {
  return (
    <span className={`text-[14px] ${strong ? "font-semibold text-ink" : "text-ink-2"}`}>
      {home} v {away}
    </span>
  );
}

export function Margin() {
  const store = useStore();
  const [m, setM] = useState<MarginInfo | null>(null);
  useEffect(() => {
    store.margin().then(setM);
  }, [store]);
  if (!m) return <p className="mt-3 text-[14px] text-ink-3">Loading…</p>;
  const { current, previous, next } = m;
  const clear = previous && ![previous.game.home, previous.game.away].some((t) => t === current.game.home || t === current.game.away);
  const { eligible, excluded } = eligibleForDraw(next.games, current.game);

  return (
    <ul className="divide-y divide-line-soft border-b border-line-soft">
      <li className="flex gap-3 py-3">
        <span className="w-12 shrink-0 pt-0.5 font-score text-[15px] font-semibold text-ink-3">R{current.round}</span>
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <TeamBadge name={current.game.home} size="sm" />
            <Fixture home={current.game.home} away={current.game.away} strong />
            <TeamBadge name={current.game.away} size="sm" />
          </span>
          <p className="mt-1 text-[13px] text-ink-3">
            {current.how === "drawn" ? "Drawn at random." : "The round’s first game; the random draw starts next round."}
            {previous &&
              (clear
                ? ` Neither team was in Round ${previous.round}’s (${previous.game.home} v ${previous.game.away}).`
                : ` It shares a team with Round ${previous.round}’s (${previous.game.home} v ${previous.game.away}).`)}
          </p>
        </div>
      </li>
      <li className="flex gap-3 py-3">
        <span className="w-12 shrink-0 pt-0.5 font-score text-[15px] font-semibold text-ink-3">R{next.round}</span>
        <div className="min-w-0 flex-1 text-[13px] text-ink-3">
          {next.drawn ? (
            <span className="flex items-center gap-2">
              <TeamBadge name={next.drawn.home} size="sm" />
              <Fixture home={next.drawn.home} away={next.drawn.away} strong />
              <TeamBadge name={next.drawn.away} size="sm" />
            </span>
          ) : (
            <p className="text-[14px] text-ink-2">Drawn at random when its predictions publish, {sydney(next.drawsAt, "dayDateTime")}.</p>
          )}
          <p className="mt-1">
            {eligible.length} of {next.games.length} games in the draw.
            {excluded.length > 0 && <> Left out (they include the {current.game.home} or {current.game.away}): {excluded.map((g) => `${g.home} v ${g.away}`).join(", ")}.</>}
          </p>
          <details className="group mt-1">
            <summary className="-my-2 inline-flex min-h-11 cursor-pointer items-center font-semibold text-ink-2 underline decoration-line">
              <span className="group-open:hidden">Show the {eligible.length} games in the draw</span>
              <span className="hidden group-open:inline">Hide them</span>
            </summary>
            <ul className="mt-1 space-y-1">
              {eligible.map((g) => (
                <li key={g.matchId}>
                  <Fixture home={g.home} away={g.away} />
                </li>
              ))}
            </ul>
          </details>
        </div>
      </li>
    </ul>
  );
}

/* ---------- Pipeline runs ---------- */

const JOB = { results: "Results", predict: "Predictions", refresh: "Refresh" } as const;

/** Worked out from the runs: did each failure get re-run, and what did it cost if not. */
function runSummary(runs: PipelineRun[]) {
  const failed = runs.filter((r) => r.status === "failed");
  if (failed.length === 0) return `All ${runs.length} runs succeeded.`;
  const lines = failed.map((f) => {
    const later = runs.find((r) => r.job === f.job && r.startedAt > f.startedAt && r.status === "ok");
    const when = sydney(f.startedAt);
    if (later) return `The ${JOB[f.job].toLowerCase()} run on ${when} failed; the next one, ${sydney(later.startedAt)}, worked.`;
    return f.job === "refresh"
      ? `The refresh on ${when} failed and Round ${f.round} had no refresh after it, so its later games kept the earlier predictions.`
      : `The ${JOB[f.job].toLowerCase()} run on ${when} failed and hasn’t run again since. Run it by hand.`;
  });
  return `${failed.length} of the last ${runs.length} runs failed. ${lines.join(" ")}`;
}

export function Runs() {
  const store = useStore();
  const [runs, setRuns] = useState<PipelineRun[] | null>(null);
  useEffect(() => {
    store.runs().then(setRuns);
  }, [store]);
  if (!runs) return <p className="mt-3 text-[14px] text-ink-3">Loading…</p>;
  return (
    <>
      <p className="mt-3 text-[14px] text-ink-2">{runSummary(runs)}</p>
      <ul className="mt-3 divide-y divide-line-soft border-y border-line-soft">
        {runs.map((r) => (
          <li key={r.startedAt + r.job} className="py-2.5 text-[14px]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold text-ink">
                {JOB[r.job]} <span className="font-normal text-ink-3">· Round {r.round}</span>
              </span>
              <span
                className={`shrink-0 text-[12px] font-bold tracking-[0.06em] uppercase ${
                  r.status === "failed" ? "text-miss" : r.status === "running" ? "text-live" : "text-ink-3"
                }`}
              >
                {r.status === "ok" ? "OK" : r.status === "failed" ? "Failed" : "Running"}
              </span>
            </div>
            <p className="mt-0.5 text-[13px] text-ink-2">{r.note}</p>
            <p className="mt-0.5 text-[12px] text-ink-3">
              {sydney(r.startedAt)} · model {r.modelVersion} · {r.commit}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
