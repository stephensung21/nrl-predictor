// Sign-in, invites and the viewer's profile. Pages talk only to the AuthStore
// interface, so the browser mock used for the sample can be swapped for Supabase
// (auth with Google and email links, the `invites` and `profiles` tables; PLAN_WEB.md
// §2 and §3.5) by changing `createAuthStore()` below.
//
// The flow matches Supabase's: starting a sign-in leaves the page (Google) or sends an
// email; either way the browser comes back through /auth/callback, which completes it
// and returns to where the visitor started. Supabase notes for the swap:
// - `intent: "sign-in"` maps to `shouldCreateUser: false` for email, plus a
//   before-user-created hook for Google, so signing in never creates an account.
// - `checkInvite` needs a security-definer RPC returning only status and inviter
//   (invites are admin-only under row-level security).
// - `saveProfile` with an invite code must check and redeem the invite in one transaction.
// - `deleteAccount` needs a server route holding the service key to delete the auth user.
// - Google writes name and avatar into auth metadata: strip them, since we keep only
//   what PRODUCT.md lists.

import type { AutoTip } from "./rules";
import type { TeamName } from "./teams";

export type Session = { userId: string; email: string; provider: "google" | "email" };

export type Profile = { name: string; favTeam: TeamName; autoTip: AutoTip };

export type Invite =
  | { status: "valid"; code: string; invitedBy: string }
  | { status: "used" | "expired" | "unknown"; code: string };

/** Joining creates an account (needs an invite); signing in never does. */
export type Intent = "join" | "sign-in";

export type SignInMethod = { provider: "google" } | { provider: "email"; email: string };

export interface AuthStore {
  checkInvite(code: string): Promise<Invite>;
  session(): Promise<Session | null>;
  /**
   * Starts a sign-in. Google leaves the page; email sends a link and resolves with
   * "sent". Both come back through /auth/callback, then to `returnTo`.
   */
  startSignIn(method: SignInMethod, opts: { intent: Intent; returnTo: string }): Promise<"redirecting" | "sent">;
  /**
   * Completes a sign-in on /auth/callback. Returns where to go next. A sign-in (not a
   * join) for someone with no account signs straight back out: no dangling session.
   */
  completeSignIn(params: URLSearchParams): Promise<{ next: string }>;
  signOut(): Promise<void>;
  profile(): Promise<Profile | null>;
  /** Creating a profile needs a valid invite; changing one doesn't. */
  saveProfile(p: Profile, inviteCode?: string): Promise<void>;
  /** Deletes the account and every tip (PRODUCT.md). */
  deleteAccount(): Promise<void>;
}

/** Display names are what the ladder shows: short, and unique in the comp in production. */
export function nameProblem(name: string): string | null {
  const n = name.trim();
  if (n.length < 2) return "At least 2 letters.";
  if (n.length > 20) return "20 letters at most, so it fits on the ladder.";
  return null;
}

export const emailProblem = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : "That doesn't look like an email address.";

// ---------- Sample: everything lives in this browser ----------

const SAMPLE_INVITES: Record<string, Invite> = {
  MATES26: { status: "valid", code: "MATES26", invitedBy: "Sully" },
  USED26: { status: "used", code: "USED26" },
  OLD25: { status: "expired", code: "OLD25" },
};

const KEYS = { session: "rlt:session", profile: "rlt:profile" };

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  // Throws in private windows or when storage is blocked; the page shows the error.
  if (value == null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, JSON.stringify(value));
}

/** Only same-site paths are allowed as a return address. */
const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/");

/** The sample's stand-in for the link in the email: it goes straight to the callback. */
export function sampleEmailLink(email: string, intent: Intent, returnTo: string) {
  return `/auth/callback?${new URLSearchParams({ provider: "email", email: email.trim(), intent, next: returnTo })}`;
}

export class BrowserAuthStore implements AuthStore {
  async checkInvite(code: string): Promise<Invite> {
    return SAMPLE_INVITES[code.toUpperCase()] ?? { status: "unknown", code };
  }

  async session() {
    return read<Session>(KEYS.session);
  }

  async startSignIn(method: SignInMethod, opts: { intent: Intent; returnTo: string }) {
    if (method.provider === "email") {
      const problem = emailProblem(method.email);
      if (problem) throw new Error(problem);
      return "sent" as const;
    }
    window.location.assign(`/auth/callback?${new URLSearchParams({ provider: "google", intent: opts.intent, next: opts.returnTo })}`);
    return "redirecting" as const;
  }

  async completeSignIn(params: URLSearchParams) {
    const provider = params.get("provider") === "email" ? "email" : "google";
    const email = provider === "email" ? (params.get("email") ?? "") : "you@gmail.com";
    write(KEYS.session, { userId: `sample-${email.toLowerCase()}`, email, provider } satisfies Session);
    const next = safeNext(params.get("next"));
    if (params.get("intent") === "sign-in" && !read<Profile>(KEYS.profile)) {
      await this.signOut();
      return { next: "/sign-in?no-account=1" };
    }
    return { next };
  }

  async signOut() {
    write(KEYS.session, null);
  }

  async profile() {
    return (await this.session()) ? read<Profile>(KEYS.profile) : null;
  }

  async saveProfile(p: Profile, inviteCode?: string) {
    if (!(await this.session())) throw new Error("Sign in first.");
    const problem = nameProblem(p.name);
    if (problem) throw new Error(problem);
    const existing = read<Profile>(KEYS.profile);
    if (!existing) {
      const invite = inviteCode ? await this.checkInvite(inviteCode) : null;
      if (invite?.status !== "valid") throw new Error("Joining needs a valid invite link.");
    }
    write(KEYS.profile, { ...p, name: p.name.trim() });
  }

  async deleteAccount() {
    write(KEYS.profile, null);
    write(KEYS.session, null);
    try {
      for (const k of Object.keys(window.localStorage)) if (k.startsWith("rlt:tips:")) window.localStorage.removeItem(k);
    } catch {}
  }
}

/** The store the site uses. Replace with a Supabase-backed AuthStore when the backend exists. */
export function createAuthStore(): AuthStore {
  return new BrowserAuthStore();
}

/** Auto-tip can change until the season's first game locks (PLAN_WEB.md §3.5). The sample is mid-season. */
export const SEASON_UNDER_WAY_SAMPLE = true;

export const AUTO_TIP_OPTIONS: { value: AutoTip; label: string; explain: string }[] = [
  { value: "home", label: "Home team", explain: "The home team in the draw, even at a neutral ground." },
  { value: "crowd", label: "The crowd", explain: "Whoever most of the comp tipped. A tie goes to the home team." },
  { value: "ladder", label: "Ladder", explain: "The team higher on the NRL ladder. Level goes to the home team." },
];
