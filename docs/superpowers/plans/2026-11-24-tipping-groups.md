# Tipping groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tippers create friend groups that each see their own ladder, last man standing and Dally M, while everyone is in one global comp that anyone can join.

**Architecture:** Groups are a filter over the one set of tips, picks and votes. Two new tables and security-definer functions in one migration; `ladder()` gains an optional group; the web stores filter tippers to the chosen group's members. The chosen group lives in the `fc-group` cookie so server pages read it.

**Tech Stack:** Postgres (Supabase, PGlite in tests), Next.js 15 App Router, React 19, Tailwind 4, vitest.

**Spec:** `docs/superpowers/specs/2026-11-24-tipping-groups-design.md`

## Global Constraints

- One new migration: `supabase/migrations/20261124000000_groups.sql`. Earlier migrations are never edited.
- Group name 1-30 characters (trimmed); at most 10 groups per tipper; codes 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
- Cookie `fc-group`: a group uuid or `global`; `?group=` overrides it.
- No scoring change: `tests/tipping/cases.json` and `lib/scoring.ts` untouched.
- `invites`, `check_invite` and `join_comp` stay (old links keep working); dropping them is later work.
- Copy follows DESIGN.md and the site's voice; no "invite-only" wording left on sign-in or account.
- Run from `web/`: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` all pass at the end.

## Review Focus

- A non-member asking for a group's ladder (`ladder(season, other_group)`) must get no rows: tested in Task 1.
- The owner leaving hands the group to the longest-standing member; the last member leaving deletes it: tested in Task 1.
- A stale `fc-group` cookie (group deleted, or the viewer removed) must fall back to global, never error: tested in Task 2.
- A Google sign-in with no profile must land on the profile step, not be signed out: covered in Task 3's callback change.
- A joining link for a tipper already in the group must be a no-op, not an error: tested in Task 1.

---

### Task 1: Groups in the database

**Files:**
- Create: `supabase/migrations/20261124000000_groups.sql`
- Test: `web/tests/groups.test.ts`

**Interfaces:**
- Produces (SQL): tables `groups(id uuid, name text, code text, owner uuid, created_at)`, `group_members(group_id, user_id, joined_at)`; `is_member(uuid) â†’ boolean`; `create_group(p_name text) â†’ uuid`; `join_group(p_code text) â†’ uuid`; `leave_group(p_group uuid) â†’ void`; `remove_member(p_group uuid, p_user uuid) â†’ void`; `rename_group(p_group uuid, p_name text) â†’ void`; `reset_group_code(p_group uuid) â†’ text`; `delete_group(p_group uuid) â†’ void`; `check_group(p_code text) â†’ table(name text, members int)`; `create_profile(p_display_name text, p_fav_team text, p_auto_tip text, p_group_code text default null) â†’ void`; `ladder(p_season int, p_group uuid default null)` (same columns as today).

- [ ] **Step 1: Write the failing tests** in `web/tests/groups.test.ts` (PGlite via `freshDatabase`, `as`, `uuid` from `./db`): create a group (creator is owner and member; name trimmed; empty and 31-char names refused; 11th group refused with `/10 groups/`); join by code (case-insensitive; joining twice is a no-op; bad code `/unknown group/`); members read their group and its members, a non-member reads neither; only the owner renames, resets the code (old code stops working), removes a member, deletes; leaving as owner hands ownership to the longest-standing member; the last member leaving deletes the group; `check_group` works signed out and returns only name and member count; `create_profile` without a code makes a profile, with a code also joins, and refuses a second profile with `/already in the comp/`; `ladder(2027)` lists everyone, `ladder(2027, g)` lists only members plus the Model with places re-ranked, and a non-member gets `[]`.
- [ ] **Step 2: Run** `npx vitest run tests/groups.test.ts`: FAIL (functions missing).
- [ ] **Step 3: Write the migration.** RLS on both tables, selects through `is_member` (security definer, `set search_path = public`); all writes through security-definer functions that check `auth.uid()`; revoke all on the new tables and functions from anon/authenticated, then grant select on the tables and execute on the functions to authenticated (`check_group` also to anon). `drop function ladder(int)` and recreate with the group parameter (an overload would make `ladder(2027)` ambiguous); re-grant execute as the old one was.
- [ ] **Step 4: Run** `npx vitest run`: all pass (the old ladder tests still pass with the default).
- [ ] **Step 5: Commit** `Groups: tables, functions and a group-aware ladder`.

### Task 2: The group store and the chosen group

**Files:**
- Create: `web/lib/groups.ts`
- Test: `web/tests/groups-lib.test.ts`

**Interfaces:**
- Produces: `type Group = { id: string; name: string; code: string; owner: string | null; members: GroupMember[] }`; `type GroupMember = { id: string; name: string; joinedAt: string }`; `const GROUP_COOKIE = "fc-group"`; `pickGroup(groups: Group[], wanted: string | undefined): Group | null` (null means global; unknown or stale ids fall back to global; `undefined` picks the most recently joined group, else global); `interface GroupStore { list(): Promise<Group[]>; create(name: string): Promise<Group>; join(code: string): Promise<string>; leave(id: string): Promise<void>; remove(id: string, userId: string): Promise<void>; rename(id: string, name: string): Promise<void>; resetCode(id: string): Promise<string>; deleteGroup(id: string): Promise<void>; check(code: string): Promise<{ name: string; members: number } | null> }`; `createGroupStore(): GroupStore` (Supabase when `tippingLive`, else a browser store in `localStorage` key `rlt:groups`); `readGroups(sb: SupabaseClient, userId: string): Promise<Group[]>` for server pages; `viewerGroups(searchParam?: string): Promise<{ groups: Group[]; current: Group | null; memberIds: Set<string> | null }>` (server; reads the cookie; `memberIds` null for global).
- [ ] **Step 1: Write failing tests** for `pickGroup`: explicit id found; `"global"` â†’ null; stale id â†’ null; undefined with two groups â†’ the later `joinedAt` of the viewer; undefined with none â†’ null. And the browser store round trip (create, join by code, leave) under a fake `localStorage`.
- [ ] **Step 2: Run** `npx vitest run tests/groups-lib.test.ts`: FAIL.
- [ ] **Step 3: Implement** `web/lib/groups.ts`.
- [ ] **Step 4: Run** the tests: PASS.
- [ ] **Step 5: Commit** `Groups: the store and the chosen group`.

### Task 3: Open sign-up

**Files:**
- Modify: `web/lib/auth.ts` (`saveProfile(p, join?: { invite?: string; group?: string })`; live: `create_profile` unless an invite is given; email `shouldCreateUser: true`; `completeSignIn` sends a profile-less sign-in to `/join` instead of signing out; header comment)
- Modify: `web/components/auth-forms.tsx` (`JoinFlow` takes `{ invite?: string; group?: { code: string; name: string } }`; with neither it's plain sign-up; sign-in and account copy lose "invite-only")
- Create: `web/app/join/page.tsx` (plain sign-up)
- Modify: `web/app/join/[code]/page.tsx`, `web/tests/sign-in-profile.test.ts` if it asserts the old copy

- [ ] **Step 1:** Update callers and copy; `npx tsc --noEmit` clean.
- [ ] **Step 2:** `npx vitest run`: PASS.
- [ ] **Step 3: Commit** `Open sign-up: anyone can join the global comp`.

### Task 4: Groups pages

**Files:**
- Create: `web/app/groups/page.tsx`, `web/app/groups/join/[code]/page.tsx`, `web/components/groups-panel.tsx`
- Modify: `web/components/app-nav.tsx` (More: "Groups" after "Last man standing")

- [ ] **Step 1:** `/groups`: signed out â†’ sign-in message; no profile â†’ link to `/join`; else your groups (name, member count, copy-link button, members list; owner: rename, reset link, remove member, delete; member: leave) and a "Start a group" form (name field, 30 max).
- [ ] **Step 2:** `/groups/join/<code>`: unknown code â†’ message; signed in with profile â†’ "Join <name>" button then `/tipping/ladder`; otherwise `JoinFlow` with the group.
- [ ] **Step 3:** `npx tsc --noEmit`, `npm run lint`: clean. **Commit** `Groups pages: start, share, join and run a group`.

### Task 5: The switcher and the filtered pages

**Files:**
- Create: `web/components/group-switcher.tsx` (client; chips "Global" + each group; sets `fc-group` cookie, `router.refresh()`; renders nothing when the viewer has no groups)
- Modify: `web/lib/comp.ts` (`readLadder(sb, season, group?: string)` passes `p_group` and keeps profiles/scores/tips to the ladder's rows; `readRoundComp(..., memberIds?: Set<string>)` keeps those profiles plus the Model)
- Modify: `web/lib/lms-store.ts` (`readPicks(sb, season, memberIds?)`), `web/lib/dally-m-store.ts` (group leaderboard summed from the readable closed-round votes of members), `web/lib/source.ts` (pass the viewer's group through)
- Modify: `web/app/tipping/ladder/page.tsx`, `web/app/last-man-standing/page.tsx`, `web/app/dally-m/page.tsx` (switcher under the title; heading notes the group name)
- Test: extend `web/tests/comp.test.ts` with a members filter case for `roundComp`'s inputs if the filter is pure

- [ ] **Step 1:** Implement; filtering happens before any ranking or game play, so a group's last man standing plays its own games.
- [ ] **Step 2:** `npx vitest run`, `npx tsc --noEmit`, `npm run lint`: clean.
- [ ] **Step 3: Commit** `Groups: switch the ladder, last man standing and Dally M to a group`.

### Task 6: Sample, docs and checks

- [ ] **Step 1:** Sample mode: the browser store seeds one sample group ("The boys") over the invented tippers so the switcher shows on the sample ladder.
- [ ] **Step 2:** Docs: PLAN_WEB.md status row and the live steps (push the migration), DESIGN.md (switcher uses chips), PRODUCT.md if it says invite-only.
- [ ] **Step 3:** `npm test`, `npm run lint`, `npm run build`; look at `/groups` and the ladder with the switcher in the dev server.
- [ ] **Step 4: Commit** `Groups: sample, docs`.
