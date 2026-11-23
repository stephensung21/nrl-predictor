"use client";

// The groups page (docs/superpowers/specs/2026-11-24-tipping-groups-design.md): your groups, each
// with its share link and members; the owner's controls; leaving; and starting a new group.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Copy, Check } from "lucide-react";
import { createAuthStore } from "@/lib/auth";
import { createGroupStore, groupCookie, groupNameProblem, joinLink, MAX_GROUPS, type Group } from "@/lib/groups";
import { YOU_ID } from "@/lib/sample";
import { tippingLive } from "@/lib/supabase";

const pill =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-lime px-5 py-3 text-[15px] font-bold text-lime-ink hover:bg-lime-hover disabled:opacity-60";
const quiet =
  "inline-flex min-h-11 items-center rounded-full px-3 text-[14px] font-semibold text-ink-2 ring-1 ring-line ring-inset hover:text-ink hover:ring-ink-3";
const field =
  "h-12 w-full rounded-lg bg-raised px-3 text-[16px] text-ink ring-1 ring-line ring-inset placeholder:text-ink-3 focus:ring-2 focus:ring-lime-fg focus:outline-none";

type State = { kind: "loading" } | { kind: "signed-out" } | { kind: "no-profile" } | { kind: "ready"; you: string; groups: Group[] };

export function GroupsPanel() {
  const auth = useMemo(() => createAuthStore(), []);
  const store = useMemo(() => createGroupStore(), []);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const session = await auth.session();
    if (!session) return setState({ kind: "signed-out" });
    if (!(await auth.profile())) return setState({ kind: "no-profile" });
    setState({ kind: "ready", you: tippingLive ? session.userId : YOU_ID, groups: await store.list() });
  }, [auth, store]);

  useEffect(() => {
    load().catch(() => setError("Couldn’t load your groups. Try again."));
  }, [load]);

  /** Runs a change, then reloads; the store's errors are already in the site's words. */
  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t do that. Try again.");
    }
  };

  if (state.kind === "loading") return <p className="pt-10 text-[15px] text-ink-3">Loading&hellip;</p>;
  if (state.kind === "signed-out" || state.kind === "no-profile") {
    const out = state.kind === "signed-out";
    return (
      <section className="pt-12">
        <h1 className="font-display text-[36px] leading-[0.92] font-bold uppercase">{out ? "Sign in for groups." : "Join the comp first."}</h1>
        <p className="mt-4 max-w-[38ch] text-[16px] leading-relaxed text-ink-2">
          A group is a ladder of your own mates, alongside the global one. {out ? "Sign in to start one or see yours." : "Three quick things and you’re in."}
        </p>
        <Link href={out ? "/sign-in" : "/join"} className={`${pill} mt-6`}>
          {out ? "Sign in" : "Join the comp"} <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden />
        </Link>
      </section>
    );
  }

  const { you, groups } = state;
  return (
    <section>
      <h1 className="pt-4 pb-3 font-display text-[26px] leading-none font-bold uppercase">Groups</h1>
      <p className="max-w-prose text-[15px] leading-snug text-ink-2">
        Everyone&rsquo;s on the global ladder. A group is a ladder of your own: share its link, and the ladder, last man standing and
        Dally M show just your mates. Your tips count in every group you&rsquo;re in.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-[14px] text-miss">
          {error}
        </p>
      )}

      {groups.length > 0 && (
        <ul className="mt-6 border-t border-line">
          {groups.map((g) => (
            <GroupRow key={g.id} group={g} you={you} act={act} />
          ))}
        </ul>
      )}

      {groups.length < MAX_GROUPS ? (
        <StartGroup first={groups.length === 0} onStart={(name) => act(() => store.create(name))} />
      ) : (
        <p className="mt-8 text-[14px] text-ink-3">You&rsquo;re in {MAX_GROUPS} groups, the most you can be. Leave one to start another.</p>
      )}
    </section>
  );
}

function StartGroup({ first, onStart }: { first: boolean; onStart: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <form
      className="mt-8"
      onSubmit={async (e) => {
        e.preventDefault();
        const p = groupNameProblem(name);
        setProblem(p);
        if (p) return;
        await onStart(name);
        setName("");
      }}
    >
      <h2 className="font-display text-[24px] leading-none font-bold uppercase">{first ? "Start a group" : "Start another"}</h2>
      <label htmlFor="group-name" className="mt-4 block text-[13px] font-semibold text-ink-2">
        Its name
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="group-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setProblem(null);
          }}
          maxLength={30}
          placeholder="e.g. The boys"
          className={field}
          aria-invalid={!!problem}
          aria-describedby={problem ? "group-name-problem" : undefined}
        />
        <button type="submit" className={`${pill} shrink-0`}>
          Start it
        </button>
      </div>
      {problem && (
        <p id="group-name-problem" className="mt-1.5 text-[13px] text-miss">
          {problem}
        </p>
      )}
    </form>
  );
}

function GroupRow({ group, you, act }: { group: Group; you: string; act: (fn: () => Promise<unknown>) => Promise<void> }) {
  const store = useMemo(() => createGroupStore(), []);
  const router = useRouter();
  const owner = group.owner === you;
  const [confirm, setConfirm] = useState<"leave" | "delete" | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group.name);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = joinLink(origin, group.code);
  const members = [...group.members].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <li className="border-b border-line-soft py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-[22px] leading-none font-bold uppercase">{group.name}</h2>
        <p className="text-[13px] text-ink-3">
          {group.members.length} {group.members.length === 1 ? "tipper" : "tippers"}
          {owner ? " · you run it" : ""}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={quiet}
          onClick={() => {
            document.cookie = groupCookie(group.id);
            router.push("/tipping/ladder");
          }}
        >
          See its ladder
        </button>
      </div>

      <label htmlFor={`link-${group.id}`} className="mt-4 block text-[13px] font-semibold text-ink-2">
        Its link: anyone with it can join
      </label>
      <div className="mt-1.5 flex gap-2">
        <input id={`link-${group.id}`} readOnly value={link} className={`${field} text-[14px]`} onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className={`${quiet} shrink-0 gap-1.5`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {}
          }}
        >
          {copied ? <Check className="size-4 text-lime-fg" strokeWidth={3} aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <h3 className="mt-5 text-[13px] font-semibold text-ink-2">Who&rsquo;s in</h3>
      <ul className="mt-1">
        {members.map((m) => (
          <li key={m.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-line-soft last:border-b-0">
            <span className={`text-[15px] ${m.id === you ? "font-semibold text-ink" : "text-ink-2"}`}>
              {m.name}
              {m.id === you ? " (you)" : ""}
              {m.id === group.owner ? <span className="ml-1.5 text-[12px] font-normal text-ink-3">runs it</span> : null}
            </span>
            {owner && m.id !== you && (
              <button type="button" className="min-h-11 px-2 text-[13px] font-semibold text-ink-3 hover:text-miss" onClick={() => act(() => store.remove(group.id, m.id))}>
                Remove<span className="sr-only"> {m.name}</span>
              </button>
            )}
          </li>
        ))}
      </ul>

      {owner && renaming && (
        <form
          className="mt-4 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await act(() => store.rename(group.id, name));
            setRenaming(false);
          }}
        >
          <label htmlFor={`rename-${group.id}`} className="sr-only">
            New name for {group.name}
          </label>
          <input id={`rename-${group.id}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={30} className={field} />
          <button type="submit" className={`${pill} shrink-0`}>
            Save
          </button>
        </form>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {owner && !renaming && (
          <button type="button" className={quiet} onClick={() => setRenaming(true)}>
            Rename
          </button>
        )}
        {owner && (
          <button type="button" className={quiet} onClick={() => act(() => store.resetCode(group.id))}>
            New link
          </button>
        )}
        {confirm ? (
          <>
            <button
              type="button"
              className={`${quiet} text-miss ring-miss`}
              onClick={() => act(() => (confirm === "delete" ? store.deleteGroup(group.id) : store.leave(group.id)))}
            >
              {confirm === "delete" ? `Yes, delete ${group.name}` : `Yes, leave ${group.name}`}
            </button>
            <button type="button" className={quiet} onClick={() => setConfirm(null)}>
              Keep it
            </button>
          </>
        ) : (
          <>
            <button type="button" className={quiet} onClick={() => setConfirm("leave")}>
              Leave
            </button>
            {owner && (
              <button type="button" className={quiet} onClick={() => setConfirm("delete")}>
                Delete group
              </button>
            )}
          </>
        )}
      </div>
      {owner && (
        <p className="mt-2 text-[13px] text-ink-3">A new link stops the old one working. If you leave, the longest-standing member runs it.</p>
      )}
    </li>
  );
}
