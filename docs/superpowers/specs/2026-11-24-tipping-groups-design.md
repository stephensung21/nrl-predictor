# Tipping groups: design

Separate friend circles (work, family, mates) each get their own ladder, last man standing and Dally
M, while everyone who signs up is also in one global comp that anyone can see.

## Why

The comp today is one invite-only group run by one admin. The user wants other friend circles to use
the site without mixing everyone into one ladder: "so separate friend circles can have their own
ladder and group". A global comp catches everyone, including people nobody invited.

## Decided by the user (24 November 2026)

- **Anyone can create a group.** A group is one view over all the comps: tips ladder, last man
  standing and the Dally M together. No separate groups per comp.
- **Everyone is automatically in the global comp.** Its ladder shows every tipper on the site, and
  everyone can see it. A group is a smaller view of the same tippers.
- **People who aren't invited anywhere can still join** (open sign-up) and play in the global comp.
- **A tipper can switch** between the global comp and their group(s); someone who only cares about
  their group can live in that view.
- **Approach: groups as a filter** (below), chosen over a stored "Global" group and per-group tips.

## Goals, non-goals, anti-goals

- Goals: create a group, share a link, friends join (signing up on the way if they're new); every
  comp page shows the chosen group or global; nothing about scoring changes.
- Non-goals: public group directory or search; per-group rules (bonus points, margin game, late-join
  cap stay site-wide); per-group chat; paid anything.
- Anti-goals: anything that makes a tipper enter tips twice; a group whose ladder disagrees with
  global on a tipper's points; strangers seeing a private group's member list.

## Approaches

1. **Groups as a filter (chosen).** `groups` and `group_members` tables. Global isn't stored: it
   means every profile. Ladder, last man standing and Dally M take an optional group and keep only
   its members. Tips, picks and votes are unchanged. Smallest change; one set of tips by design.
2. **Global as a stored group.** A trigger adds every new profile to a "Global" row, so every query
   filters the same way. Rejected: a membership row per tipper that must never go missing, for no
   gain over "everyone".
3. **Tips per group.** Rejected: someone in three groups would tip three times.

## Rules (my calls, stated to the user)

- **Scores belong to the tipper.** One set of tips, picks and votes counts in global and in every
  group they're in. A group shows the full season for its members whenever they joined it (the
  existing late-joiner rule still applies from when they joined the *site*).
- **Several groups each**, at most 10 per tipper. Group name 1-30 characters. No member cap.
- **The Model** appears in every group's ladder as it does now (listed, unranked).
- **Joining a group:** a reusable link `/groups/join/<code>` (8 characters). The owner can reset the
  code (old links stop working). A new person following the link signs up, makes their profile and
  joins the group in one go.
- **Owner powers:** rename the group, reset its link, remove a member, delete the group. If the owner
  leaves, the longest-standing member becomes owner; a group with no members is deleted.
- **Members can leave** any time. Leaving or being removed changes nothing about their scores.
- **Privacy:** a group's name and member list are visible to its members only. Everything a group
  page shows is already visible in global (tips after kickoff, picks after kickoff, votes after
  close), so the group adds no new exposure. A non-member opening a group URL gets "not in this
  group".
- **Default view:** the group you joined most recently, else global. The choice is remembered in a
  cookie (`fc-group`) so server-rendered pages read it; `?group=<id>` overrides for a shared link.
  "global" is a valid value.
- **Crowd auto-tip** stays the consensus of every tipper on the site (global), not of a group.
- **Site admin** (`profiles.is_admin`) keeps the admin page, pipeline view and removing a tipper from
  the site (an abusive name in global). The admin's single-use invites retire.

## Data (one new migration)

- `groups(id uuid pk default gen_random_uuid(), name text check 1-30, code text unique, owner uuid
  references profiles on delete set null, created_at timestamptz)`.
- `group_members(group_id uuid references groups on delete cascade, user_id uuid references profiles
  on delete cascade, joined_at timestamptz default now(), primary key (group_id, user_id))`.
- `is_member(p_group uuid) returns boolean` (security definer: avoids RLS recursion on
  `group_members`).
- RLS: members read their groups and their groups' member rows. Writes only through security-definer
  functions: `create_group(name)` (creator becomes owner and member; enforces the 10-group cap),
  `join_group(code)`, `leave_group(id)` (hands ownership on or deletes), `remove_member(group, user)`
  (owner only, not themself), `rename_group(id, name)`, `reset_group_code(id)`, `delete_group(id)`
  (owner only). `check_group(code)` for anon/authenticated returns only the group's name and member
  count, for the join page.
- **Sign-up without an invite:** `join_comp(p_code, ...)` is replaced by
  `create_profile(p_display_name, p_fav_team, p_auto_tip, p_group_code text default null)`: makes the
  profile and, given a code, joins that group, in one transaction. `check_invite`/`join_comp` and the
  `invites` table are dropped after the site stops calling them.
- `ladder(p_season int, p_group uuid default null)`: null is global (today's behaviour); a group keeps
  its members plus the Model, and ranks among them. Callers who aren't members of `p_group` get no
  rows (`is_member` check).
- Grants revoked from anon/authenticated first, then execute on the functions above; tests in PGlite
  like the other migrations.

## Site

- **Auth:** email sign-in may create users (`shouldCreateUser: true`); Google sign-ins without a
  profile go to a "Set up your profile" step (name, favourite team, auto-tip) instead of being signed
  out. `/join/<code>` (old invite links) redirects to sign-up.
- **Group switcher:** at the top of the ladder, last man standing, Dally M, and the home/round comp
  strip: "Global" plus each of the viewer's groups, as filter chips (DESIGN.md chips). Choosing one
  sets the cookie.
- **Filtering:** `readLadder` calls `ladder(season, group)` and keeps profiles/scores/tips to the
  members. `readRoundComp`, `readPicks` (last man standing plays its games over the members only, so
  each group has its own games and winners) and the Dally M store filter tippers and votes to members.
  The Dally M group leaderboard is summed from the closed-round votes the store already reads.
- **Groups page** `/groups` (More menu): your groups with member counts, Create a group, and per group
  the share link (copy button), members, and owner actions; Leave for members.
- **Join page** `/groups/join/<code>`: "Join <name> (n tippers)": signed in with a profile, one
  button; signed out, sign up first and land back here; signed in without a profile, the profile step
  then join.
- **Sample site:** two sample groups over the invented tippers, kept in this browser, so the switcher
  and groups page work without a database.

## Constraints

- Tipping rules stay in SQL and `lib/scoring.ts`, checked against `tests/tipping/cases.json`; this
  change adds no scoring rule.
- Global pages fetch every tipper's rows (as now). Fine to a few hundred tippers; past that, the
  ladder's tip history needs paging or a summary view (left for later).
- Every new function and policy gets PGlite tests (membership, owner-only actions, non-members get
  nothing, the cap, leave hand-over, ladder ranks within a group).

## Left to the builder

- Copy on the new pages (site voice, DESIGN.md).
- Code alphabet (no lookalike characters) and how a reset code is generated.
- Whether the switcher remembers per page or site-wide (site-wide is the default above).
