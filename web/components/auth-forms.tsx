"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Lock, Mail } from "lucide-react";
import {
  AUTO_TIP_OPTIONS,
  createAuthStore,
  nameProblem,
  sampleEmailLink,
  SEASON_UNDER_WAY_SAMPLE,
  type Intent,
  type Invite,
  type Profile,
  type Session,
} from "@/lib/auth";
import type { AutoTip } from "@/lib/rules";
import { TEAMS, type TeamName } from "@/lib/teams";
import { TeamBadge } from "./team-badge";

const pill =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-lime px-5 py-3 text-[15px] font-bold text-lime-ink hover:bg-[oklch(0.94_0.19_126)]";
const field =
  "h-12 w-full rounded-lg bg-raised px-3 text-[16px] text-ink ring-1 ring-line ring-inset placeholder:text-ink-3 focus:ring-2 focus:ring-lime focus:outline-none";

/** Moves focus to an element when it appears, so swapping a panel never drops focus to the page. */
function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => ref.current?.focus(), []);
  return ref;
}

/* ---------- Sign in: Google or an email link ---------- */

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}

function EmailSent({ email, intent, returnTo, onBack }: { email: string; intent: Intent; returnTo: string; onBack: () => void }) {
  const heading = useFocusOnMount<HTMLParagraphElement>();
  return (
    <div className="mt-5 rounded-lg bg-raised px-4 py-4">
      <p ref={heading} tabIndex={-1} className="flex items-center gap-2 text-[16px] font-semibold text-ink outline-none">
        <Mail className="size-5 text-ink-2" aria-hidden />
        Check your email
      </p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
        We sent a sign-in link to <span className="font-semibold text-ink">{email.trim()}</span>. Tap it on this phone and
        you&rsquo;re in. No password, ever.
      </p>
      <Link
        href={sampleEmailLink(email, intent, returnTo)}
        className="mt-4 block w-full rounded-lg border border-dashed border-line py-3 text-center text-[14px] font-semibold text-ink-2 hover:text-ink"
      >
        Sample only: open the link
      </Link>
      <button type="button" className="mt-3 text-[13px] font-semibold text-ink-3 underline decoration-line" onClick={onBack}>
        Use a different email
      </button>
    </div>
  );
}

export function SignInPanel({ intent, returnTo }: { intent: Intent; returnTo: string }) {
  const store = useMemo(() => createAuthStore(), []);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [cameBack, setCameBack] = useState(false);
  useEffect(() => {
    if (cameBack) emailRef.current?.focus();
  }, [cameBack]);

  if (sent) {
    return (
      <EmailSent
        email={email}
        intent={intent}
        returnTo={returnTo}
        onBack={() => {
          setSent(false);
          setCameBack(true);
        }}
      />
    );
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => store.startSignIn({ provider: "google" }, { intent, returnTo }).catch((e) => setError(e.message))}
        className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-ink text-[15px] font-semibold text-ground hover:bg-white"
      >
        <GoogleMark />
        Continue with Google
      </button>
      <p className="my-4 flex items-center gap-3 text-[12px] text-ink-3">
        <span className="h-px flex-1 bg-line-soft" />
        or
        <span className="h-px flex-1 bg-line-soft" />
      </p>
      <form
        // The page's own message, not the browser's bubble, says what's wrong with the address.
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await store.startSignIn({ provider: "email", email }, { intent, returnTo });
            setSent(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
            emailRef.current?.focus();
          }
        }}
      >
        <label htmlFor="email" className="text-[13px] font-semibold text-ink-2">
          Email
        </label>
        <input
          ref={emailRef}
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={`${field} mt-1.5`}
          aria-invalid={!!error}
          aria-describedby={error ? "auth-error" : undefined}
        />
        <button type="submit" className={`${pill} mt-3 w-full`}>
          Email me a link
        </button>
      </form>
      {error && (
        <p id="auth-error" role="alert" className="mt-3 text-[14px] text-miss">
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------- Profile fields: name, favourite team, auto-tip ---------- */

const TEAM_NAMES = (Object.keys(TEAMS) as TeamName[]).sort();

function TeamPicker({ value, onChange }: { value?: TeamName; onChange: (t: TeamName) => void }) {
  // One of 17, so native radios: screen readers announce the choice and its position, and arrow keys move between teams.
  return (
    <fieldset>
      <legend className="text-[13px] font-semibold text-ink-2">Favourite team</legend>
      <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {TEAM_NAMES.map((t) => {
          const on = value === t;
          return (
            <label
              key={t}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lime ${
                on ? "bg-lime-wash text-ink ring-2 ring-lime ring-inset" : "text-ink-3 ring-1 ring-line-soft ring-inset hover:text-ink-2"
              }`}
            >
              <input type="radio" name="favTeam" value={t} checked={on} onChange={() => onChange(t)} className="sr-only" />
              <TeamBadge name={t} size="md" />
              <span className="w-full truncate text-center">{t}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function AutoTipPicker({ value, onChange, mode }: { value?: AutoTip; onChange: (a: AutoTip) => void; mode: "open" | "joining-mid-season" | "locked" }) {
  const locked = mode === "locked";
  const note = {
    open: "You can change this until the first game of the season kicks off.",
    "joining-mid-season": "The season's under way, so pick one now: it stays for the rest of the season.",
    locked: "Locked for this season: it can only change before the first game of the season.",
  }[mode];
  return (
    <fieldset disabled={locked}>
      <legend className="text-[13px] font-semibold text-ink-2">If you forget to tip a game</legend>
      <p className="mt-1 text-[13px] text-ink-3">{note}</p>
      <div className="mt-2 space-y-1 border-y border-line-soft py-1">
        {AUTO_TIP_OPTIONS.map((o) => {
          const on = value === o.value;
          return (
            <label
              key={o.value}
              // The chosen option is yours, so it's lit like your tip and your ladder row.
              className={`flex items-start gap-3 rounded-md px-2 py-3 ${on ? "bg-lime-wash" : ""} ${locked ? "cursor-not-allowed" : "cursor-pointer"} ${!on && locked ? "opacity-60" : ""}`}
            >
              <input
                type="radio"
                name="autoTip"
                value={o.value}
                checked={on}
                onChange={() => onChange(o.value)}
                className="mt-1 size-4 accent-[var(--color-lime)]"
              />
              <span>
                <span className={`block text-[15px] font-semibold ${on ? "text-ink" : "text-ink-2"}`}>{o.label}</span>
                <span className="block text-[13px] text-ink-3">{o.explain}</span>
              </span>
              {locked && on && <Lock className="ml-auto size-4 shrink-0 text-ink-3" aria-label="Locked" />}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ProfileFields({
  draft,
  setDraft,
  autoTipMode,
}: {
  draft: Partial<Profile>;
  setDraft: (p: Partial<Profile>) => void;
  autoTipMode: "open" | "joining-mid-season" | "locked";
}) {
  const problem = draft.name != null && draft.name !== "" ? nameProblem(draft.name) : null;
  return (
    <div className="space-y-7">
      <div>
        <label htmlFor="name" className="text-[13px] font-semibold text-ink-2">
          Your name on the ladder
        </label>
        <input
          id="name"
          autoComplete="nickname"
          value={draft.name ?? ""}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="e.g. Sully"
          maxLength={24}
          className={`${field} mt-1.5`}
          aria-invalid={!!problem}
          aria-describedby="name-help"
        />
        <p id="name-help" className={`mt-1.5 text-[13px] ${problem ? "text-miss" : "text-ink-3"}`}>
          {problem ?? "What everyone sees on the ladder and in the recap."}
        </p>
      </div>
      <TeamPicker value={draft.favTeam} onChange={(t) => setDraft({ ...draft, favTeam: t })} />
      <AutoTipPicker value={draft.autoTip} onChange={(a) => setDraft({ ...draft, autoTip: a })} mode={autoTipMode} />
    </div>
  );
}

const complete = (d: Partial<Profile>): d is Profile => !!d.name && !nameProblem(d.name) && !!d.favTeam && !!d.autoTip;

/* ---------- Join: invite → sign in → three answers ---------- */

const INVALID_INVITE: Record<Exclude<Invite["status"], "valid">, { title: string; body: string }> = {
  used: { title: "This invite’s been used.", body: "Each invite works once. Ask whoever runs the comp for a fresh link." },
  expired: { title: "This invite has expired.", body: "Invites last 7 days. Ask whoever runs the comp for a fresh link." },
  unknown: { title: "That invite link doesn’t work.", body: "Check you copied the whole link, or ask whoever runs the comp for a new one." },
};

function JoinForm({ code, session }: { code: string; session: Session }) {
  const store = useMemo(() => createAuthStore(), []);
  const router = useRouter();
  const [draft, setDraft] = useState<Partial<Profile>>({ autoTip: "home" });
  const [error, setError] = useState<string | null>(null);
  const heading = useFocusOnMount<HTMLParagraphElement>();
  return (
    <form
      className="mt-7"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (!complete(draft)) return setError("Fill in all three to join: a name, a team and an auto-tip.");
        try {
          await store.saveProfile(draft, code);
          router.push("/tipping");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn’t save. Try again.");
        }
      }}
    >
      <p ref={heading} tabIndex={-1} className="mb-5 flex items-start gap-2 text-[14px] text-ink-2 outline-none">
        <Check className="mt-0.5 size-4 shrink-0 text-lime" strokeWidth={3} aria-hidden />
        <span>
          Signed in as <span className="font-semibold text-ink">{session.email}</span>. Three quick things:
        </span>
      </p>
      <ProfileFields
        draft={draft}
        setDraft={(d) => {
          setDraft(d);
          setError(null); // an answer changed, so the old message may no longer be true
        }}
        autoTipMode={SEASON_UNDER_WAY_SAMPLE ? "joining-mid-season" : "open"}
      />
      {error && (
        <p role="alert" className="mt-4 text-[14px] text-miss">
          {error}
        </p>
      )}
      <button type="submit" className={`${pill} mt-6 w-full`}>
        Join the comp <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden />
      </button>
    </form>
  );
}

export function JoinFlow({ code }: { code: string }) {
  const store = useMemo(() => createAuthStore(), []);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    store.checkInvite(code).then(setInvite);
    store.session().then(setSession);
    store.profile().then((p) => setHasProfile(!!p));
  }, [store, code]);

  if (!invite || session === undefined) return <p className="pt-10 text-[15px] text-ink-3">Checking your invite…</p>;

  if (invite.status !== "valid") {
    const c = INVALID_INVITE[invite.status];
    return (
      <section className="pt-12">
        <h1 className="font-display text-[40px] leading-[0.92] font-bold uppercase">{c.title}</h1>
        <p className="mt-4 max-w-[36ch] text-[16px] leading-relaxed text-ink-2">
          {c.body} Already in?{" "}
          <Link href="/sign-in" className="font-semibold text-ink underline decoration-line">
            Sign in
          </Link>
          .
        </p>
      </section>
    );
  }

  if (session && hasProfile) {
    return (
      <section className="pt-12">
        <h1 className="font-display text-[40px] leading-[0.92] font-bold uppercase">You&rsquo;re already in.</h1>
        <Link href="/tipping" className={`${pill} mt-6`}>
          Go to your tips <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden />
        </Link>
      </section>
    );
  }

  return (
    <section className="pt-6">
      <h1 className="font-display text-[36px] leading-[0.92] font-bold uppercase">{invite.invitedBy}&rsquo;s invited you to the comp.</h1>
      <p className="mt-3 max-w-[40ch] text-[15px] leading-relaxed text-ink-2">
        Tip every NRL game, climb the ladder, and see if you can beat the Model.
      </p>
      {!session ? (
        <>
          <SignInPanel intent="join" returnTo={`/join/${encodeURIComponent(code)}`} />
          <p className="mt-5 text-[13px] text-ink-3">No passwords. We keep your email, what you pick here, and your tips.</p>
        </>
      ) : (
        <JoinForm code={code} session={session} />
      )}
    </section>
  );
}

/* ---------- The way back in from Google or an email link ---------- */

export function AuthCallback() {
  const store = useMemo(() => createAuthStore(), []);
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    store.completeSignIn(new URLSearchParams(params.toString())).then(({ next }) => router.replace(next));
  }, [store, params, router]);
  return <p className="pt-10 text-[15px] text-ink-3">Signing you in…</p>;
}

/* ---------- Returning friends ---------- */

export function SignInPage() {
  const params = useSearchParams();
  const noAccount = params.get("no-account") === "1";
  const heading = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (noAccount) heading.current?.focus();
  }, [noAccount]);

  return (
    <section className="pt-6">
      <h1 className="font-display text-[36px] leading-[0.92] font-bold uppercase">Sign in</h1>
      <p className="mt-3 text-[15px] text-ink-2">Welcome back. Same email or Google account you joined with.</p>
      {noAccount && (
        <div className="mt-6 rounded-lg bg-raised px-4 py-4">
          <p ref={heading} tabIndex={-1} className="text-[16px] font-semibold text-ink outline-none">
            No account for that one.
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
            The comp is invite-only. Try the address you joined with, or ask whoever runs it for an invite link.
          </p>
        </div>
      )}
      <SignInPanel intent="sign-in" returnTo="/tipping" />
    </section>
  );
}

/* ---------- Account ---------- */

export function AccountPanel() {
  const store = useMemo(() => createAuthStore(), []);
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [draft, setDraft] = useState<Partial<Profile>>({});
  const [hasProfile, setHasProfile] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saved" | "error">("idle");
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const goneRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    store.session().then(setSession);
    store.profile().then((p) => {
      if (p) {
        setDraft(p);
        setHasProfile(true);
      }
    });
  }, [store]);
  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);
  useEffect(() => {
    if (deleted) goneRef.current?.focus();
  }, [deleted]);

  if (deleted) {
    return (
      <section className="pt-12">
        <h1 ref={goneRef} tabIndex={-1} className="font-display text-[40px] leading-[0.92] font-bold uppercase outline-none">
          Gone.
        </h1>
        <p className="mt-4 max-w-[34ch] text-[16px] leading-relaxed text-ink-2">Your account and every tip are deleted. Thanks for playing.</p>
        <Link href="/" className="mt-6 inline-flex items-center gap-1 text-[15px] font-semibold text-ink underline decoration-line">
          Back to the round
        </Link>
      </section>
    );
  }
  if (session === undefined) return <p className="pt-10 text-[15px] text-ink-3">Loading…</p>;
  if (!session) {
    return (
      <section className="pt-12">
        <h1 className="font-display text-[36px] leading-[0.92] font-bold uppercase">You&rsquo;re not signed in.</h1>
        <Link href="/sign-in" className={`${pill} mt-6`}>
          Sign in
        </Link>
      </section>
    );
  }
  if (!hasProfile) {
    return (
      <section className="pt-12">
        <h1 className="font-display text-[36px] leading-[0.92] font-bold uppercase">Signed in, but not in the comp.</h1>
        <p className="mt-4 max-w-[36ch] text-[16px] leading-relaxed text-ink-2">Joining needs an invite link from whoever runs the comp.</p>
      </section>
    );
  }

  return (
    <section className="pt-6">
      <h1 className="flex items-center gap-2.5 font-display text-[26px] leading-none font-bold uppercase">
        {draft.favTeam && <TeamBadge name={draft.favTeam} size="sm" />}
        Your account
      </h1>
      <p className="mt-2 text-[13px] text-ink-3">
        Signed in with {session.provider === "google" ? "Google" : "an email link"} as {session.email}
      </p>

      <form
        className="mt-6"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await store.saveProfile(draft as Profile);
            setSaved("saved");
          } catch {
            setSaved("error");
          }
        }}
      >
        <ProfileFields
          draft={draft}
          setDraft={(d) => {
            setDraft(d);
            setSaved("idle");
          }}
          autoTipMode={SEASON_UNDER_WAY_SAMPLE ? "locked" : "open"}
        />
        <div className="mt-6 flex items-center gap-4">
          <button type="submit" className={pill}>
            Save changes
          </button>
          <span aria-live="polite" className={`text-[14px] font-semibold ${saved === "error" ? "text-miss" : "text-ink-3"}`}>
            {saved === "saved" && (
              <span className="inline-flex items-center gap-1">
                <Check className="size-4" strokeWidth={2.5} aria-hidden />
                Saved
              </span>
            )}
            {saved === "error" && "Couldn’t save. Check your name and try again."}
          </span>
        </div>
      </form>

      <div className="mt-10 border-t border-line-soft pt-5">
        <button
          type="button"
          className="text-[15px] font-semibold text-ink-2 underline decoration-line hover:text-ink"
          onClick={async () => {
            await store.signOut();
            router.push("/");
          }}
        >
          Sign out
        </button>
      </div>

      <div className="mt-8 border-t border-line-soft pt-5">
        <h2 className="text-[16px] font-semibold text-ink">Delete your account</h2>
        <p className="mt-1 max-w-[50ch] text-[14px] leading-relaxed text-ink-3">
          Removes your account, your name from the ladder and every tip you&rsquo;ve made. It can&rsquo;t be undone.
        </p>
        {confirming ? (
          <div className="mt-3 rounded-lg bg-miss-wash px-4 py-3 ring-1 ring-miss/50 ring-inset">
            <p className="text-[15px] font-semibold text-ink">Delete everything for {draft.name}?</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-full bg-miss px-4 py-2.5 text-[14px] font-bold text-ground"
                onClick={async () => {
                  await store.deleteAccount();
                  setDeleted(true);
                }}
              >
                Yes, delete it all
              </button>
              <button
                ref={keepRef}
                type="button"
                className="rounded-full px-4 py-2.5 text-[14px] font-semibold text-ink-2 ring-1 ring-line ring-inset"
                onClick={() => {
                  setConfirming(false);
                  requestAnimationFrame(() => deleteRef.current?.focus());
                }}
              >
                Keep my account
              </button>
            </div>
          </div>
        ) : (
          <button
            ref={deleteRef}
            type="button"
            className="mt-3 text-[14px] font-semibold text-ink-2 underline decoration-line hover:text-ink"
            onClick={() => setConfirming(true)}
          >
            Delete my account
          </button>
        )}
      </div>
    </section>
  );
}
