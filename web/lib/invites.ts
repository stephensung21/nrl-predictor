// Invite records, shared by the admin page (makes them) and the join page (uses them).
// Kept free of the sample data so the join and sign-in pages stay small.

export const INVITE_DAYS = 7;

export type AdminInvite = {
  code: string;
  createdAt: string;
  expiresAt: string;
  /** Display name of the admin who made it (shown on the join page). */
  createdBy: string;
  /** Who joined with it, once used. */
  usedBy?: string;
  cancelled?: boolean;
};

export type InviteStatus = "pending" | "used" | "expired" | "cancelled";

export function inviteStatus(i: AdminInvite, now: Date): InviteStatus {
  if (i.cancelled) return "cancelled";
  if (i.usedBy) return "used";
  return new Date(i.expiresAt) <= now ? "expired" : "pending";
}

const KEY = "rlt:admin:invites";
/** The sample's clock (Tuesday of Round 10); live, real time. */
export const SAMPLE_CLOCK = "2026-05-05T09:30:00Z";
const NOW = new Date(SAMPLE_CLOCK);
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();
export const sampleDays = days;

/** The sample's viewer runs the comp. */
export const SAMPLE_ADMIN = "Sully";

const SEED: AdminInvite[] = [
  { code: "MATES26", createdAt: days(-2), expiresAt: days(5), createdBy: SAMPLE_ADMIN },
  { code: "USED26", createdAt: days(-40), expiresAt: days(-33), createdBy: SAMPLE_ADMIN, usedBy: "Tom" },
  { code: "OLD25", createdAt: days(-200), expiresAt: days(-193), createdBy: SAMPLE_ADMIN },
];

export function readInvites(): AdminInvite[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AdminInvite[]) : SEED;
  } catch {
    return SEED;
  }
}

export function writeInvites(list: AdminInvite[]) {
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

/** Marks an invite used by whoever joined with it. */
export function redeemInvite(code: string, name: string) {
  writeInvites(readInvites().map((i) => (i.code === code ? { ...i, usedBy: name } : i)));
}
