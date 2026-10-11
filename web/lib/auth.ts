// Sign-in, invites and the viewer's profile. Pages talk only to the AuthStore interface:
// the browser mock for the sample, or Supabase when it's configured (auth with Google and
// email links, the `invites` and `profiles` tables; PLAN_WEB.md §2 and §3.5).
//
// The flow is Supabase's: starting a sign-in leaves the page (Google) or sends an email;
// either way the browser comes back through /auth/callback, which completes it and returns
// to where the visitor started. How the live store keeps to the comp's rules:
// - Joining is the only way into the comp: `join_comp()` checks and redeems the invite and
//   makes the profile in one transaction. An email sign-in (not a join) never creates a
//   sign-in (`shouldCreateUser: false`). Google always creates one, but without an invite
//   there's no profile, so it's signed straight back out and can do nothing.
// - `checkInvite` is the security-definer `check_invite()`: only the status and who sent it.
// - Deleting an account goes through a server route holding the service key (/api/account).
// - Still to do: strip the name and avatar Google writes into the sign-in's metadata, since we
//   keep only what PRODUCT.md lists (a trigger on auth.users in the live project).

import type { SupabaseClient } from "@supabase/supabase-js";
import { inviteStatus, readInvites, redeemInvite, SAMPLE_CLOCK } from "./invites";
import { browserClient, tippingLive } from "./supabase";
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
  /** The admin flag on `profiles`: shows the admin page and its menu item. */
  isAdmin(): Promise<boolean>;
  /** Whether the auto-tip choice is fixed: once the season's first game has kicked off (PLAN_WEB.md §3.5). */
  autoTipLocked(): Promise<boolean>;
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
  async isAdmin() {
    return true; // the sample's viewer runs the comp
  }

  async autoTipLocked() {
    return SEASON_UNDER_WAY_SAMPLE;
  }

  async checkInvite(code: string): Promise<Invite> {
    // The same invites the admin page makes (one store, so a new link works straight away).
    const invite = readInvites().find((i) => i.code === code.toUpperCase());
    if (!invite) return { status: "unknown", code };
    const status = inviteStatus(invite, new Date(SAMPLE_CLOCK)); // live: the database's clock
    if (status === "pending") return { status: "valid", code: invite.code, invitedBy: invite.createdBy };
    return { status: status === "cancelled" ? "unknown" : status, code: invite.code };
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
      // Joining uses the invite up (Supabase: check and redeem in one transaction).
      redeemInvite(invite.code, p.name.trim());
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

// ---------- Live: Supabase ----------

/** What join_comp() and the profile constraints say, in the site's words. */
function joinProblem(message: string): string {
  if (message.includes("invite already used")) return "That invite’s been used. Ask for a fresh link.";
  if (message.includes("invite expired")) return "That invite has expired. Ask for a fresh link.";
  if (message.includes("unknown invite")) return "That invite link doesn’t work. Ask for a fresh one.";
  if (message.includes("already in the comp")) return "You’re already in the comp.";
  if (message.includes("sign in first")) return "Sign in first.";
  if (message.includes("auto-tip choice is locked")) return "The auto-tip choice is locked for this season.";
  return "Couldn’t save. Try again.";
}

const callbackUrl = (intent: Intent, returnTo: string) =>
  `${window.location.origin}/auth/callback?${new URLSearchParams({ intent, next: safeNext(returnTo) })}`;

export class SupabaseAuthStore implements AuthStore {
  constructor(private readonly sb: SupabaseClient = browserClient()) {}

  async checkInvite(code: string): Promise<Invite> {
    const clean = code.trim().toUpperCase();
    const { data, error } = await this.sb.rpc("check_invite", { p_code: clean });
    if (error) throw error;
    const row = (data as { status: Invite["status"]; invited_by: string | null }[])[0];
    if (row?.status === "valid") return { status: "valid", code: clean, invitedBy: row.invited_by ?? "A mate" };
    return { status: row?.status === "used" || row?.status === "expired" ? row.status : "unknown", code: clean };
  }

  async session(): Promise<Session | null> {
    const { data } = await this.sb.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    return { userId: user.id, email: user.email ?? "", provider: user.app_metadata?.provider === "google" ? "google" : "email" };
  }

  async startSignIn(method: SignInMethod, opts: { intent: Intent; returnTo: string }) {
    const redirectTo = callbackUrl(opts.intent, opts.returnTo);
    if (method.provider === "google") {
      // Always ask which Google account, so nobody joins with the wrong one by accident.
      const { error } = await this.sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, queryParams: { prompt: "select_account" } },
      });
      if (error) throw new Error("Couldn’t reach Google. Try again.");
      return "redirecting" as const;
    }
    const problem = emailProblem(method.email);
    if (problem) throw new Error(problem);
    const { error } = await this.sb.auth.signInWithOtp({
      email: method.email.trim(),
      // Only joining (with an invite) may create an account.
      options: { shouldCreateUser: opts.intent === "join", emailRedirectTo: redirectTo },
    });
    if (error) {
      if (opts.intent === "sign-in" && /signups? not allowed|user not found/i.test(error.message)) {
        throw new Error("No account for that email. The comp is invite-only: use the address you joined with.");
      }
      if (error.status === 429) throw new Error("Too many emails just now. Wait a minute and try again.");
      throw new Error("Couldn’t send the email. Try again.");
    }
    return "sent" as const;
  }

  async completeSignIn(params: URLSearchParams) {
    const next = safeNext(params.get("next"));
    // The client exchanges the one-time code in the address by itself as it starts, and getSession
    // waits for that. Exchanging it again would fail (each code works once), so only do it when
    // there's still no session.
    if (!(await this.session())) {
      const code = params.get("code");
      if (!code) return { next: "/sign-in?link-failed=1" };
      const { error } = await this.sb.auth.exchangeCodeForSession(code);
      if (error && !(await this.session())) return { next: "/sign-in?link-failed=1" };
    }
    if (params.get("intent") === "sign-in" && !(await this.profile())) {
      await this.signOut();
      return { next: "/sign-in?no-account=1" };
    }
    return { next };
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  async profile(): Promise<Profile | null> {
    const s = await this.session();
    if (!s) return null;
    const { data, error } = await this.sb.from("profiles").select("display_name, fav_team, auto_tip").eq("id", s.userId).maybeSingle();
    if (error) throw error;
    return data ? { name: data.display_name, favTeam: data.fav_team as TeamName, autoTip: data.auto_tip as AutoTip } : null;
  }

  async saveProfile(p: Profile, inviteCode?: string) {
    const s = await this.session();
    if (!s) throw new Error("Sign in first.");
    const problem = nameProblem(p.name);
    if (problem) throw new Error(problem);
    const existing = await this.profile();
    if (!existing) {
      if (!inviteCode) throw new Error("Joining needs a valid invite link.");
      const { error } = await this.sb.rpc("join_comp", {
        p_code: inviteCode, p_display_name: p.name.trim(), p_fav_team: p.favTeam, p_auto_tip: p.autoTip,
      });
      if (error) throw new Error(joinProblem(error.message));
      return;
    }
    // The auto-tip is sent only when it changes: once the season starts the database refuses any change.
    const change: Record<string, string> = { display_name: p.name.trim(), fav_team: p.favTeam };
    if (p.autoTip !== existing.autoTip) change.auto_tip = p.autoTip;
    const { error } = await this.sb.from("profiles").update(change).eq("id", s.userId);
    if (error) throw new Error(joinProblem(error.message));
  }

  async deleteAccount() {
    const res = await fetch("/api/account", { method: "DELETE" });
    if (!res.ok) throw new Error("Couldn’t delete your account. Try again.");
    await this.sb.auth.signOut();
  }

  async isAdmin() {
    if (!(await this.session())) return false;
    const { data, error } = await this.sb.rpc("is_admin");
    return !error && data === true;
  }

  async autoTipLocked() {
    // As the database's lock_auto_tip(): this calendar year's season, once a game has kicked off.
    const now = new Date();
    const { count, error } = await this.sb
      .from("matches").select("id", { count: "exact", head: true })
      .eq("season", now.getFullYear()).lte("kickoff", now.toISOString());
    return !error && (count ?? 0) > 0;
  }
}

/**
 * Email links need custom SMTP (Supabase's own email reaches only the project's members), so the
 * live comp offers Google only for now. The sample keeps both, to show the design.
 */
export const EMAIL_SIGN_IN = !tippingLive;

/** The store the site uses: Supabase when it's configured, this browser otherwise. */
export function createAuthStore(): AuthStore {
  return tippingLive ? new SupabaseAuthStore() : new BrowserAuthStore();
}

/** Auto-tip can change until the season's first game locks (PLAN_WEB.md §3.5). The sample is mid-season. */
export const SEASON_UNDER_WAY_SAMPLE = true;

export const AUTO_TIP_OPTIONS: { value: AutoTip; label: string; explain: string }[] = [
  { value: "home", label: "Home team", explain: "The home team in the draw, even at a neutral ground." },
  { value: "crowd", label: "The crowd", explain: "Whoever most of the comp tipped. A tie goes to the home team." },
  { value: "ladder", label: "Ladder", explain: "The team higher on the NRL ladder. Level goes to the home team." },
];
