---
version: 1
slug: "web-app-join-code-page-tsx"
primary_target: "web/app/join/[code]/page.tsx"
related_targets: ["web/app/sign-in/page.tsx","web/app/account/page.tsx"]
---

# Join, sign-in and account (`/join/[code]`, `/sign-in`, `/account`)

Visitor mode: **Operate**. A friend opening an invite link on their phone for the first time, a returning friend signing in, and anyone changing their details or leaving.

## Scope
Production Next.js routes in `web/`. Sign-in with Google or an email link (no passwords). Joining asks for display name, favourite team and auto-tip choice (home team / the crowd / ladder, explained plainly, changeable until the season's first game locks). Account: change those, sign out, delete the account and all tips (PRODUCT.md promise). No public sign-up: without an invite there is no account. Until Supabase exists, a working mock behind an `AuthStore` interface (`web/lib/auth.ts`, browser storage, one swap point like `TipStore`); the email step offers a clearly labelled sample button in place of the real email.

## States
Valid invite, used or expired invite, signing in, email link sent, signed in without a profile (joining steps), joined, returning sign-in with no account (needs an invite), account with auto-tip locked (season under way), delete confirmation, deleted.

## Direction contract
THESIS: Joining as three quick answers on one screen after one tap to sign in: the invite, who you are, how you'll be auto-tipped. Refuses the multi-page sign-up funnel and the settings maze.
OWN-WORLD: DESIGN.md unchanged: Saira headings, Sofia body, the lime pill for the one primary action per screen, team badges as the favourite-team picker, hairline-ruled choice rows for the auto-tip options with the selected one lit (it's yours), coral only for the delete confirmation and errors.
STORY: See who invited you and what this is, sign in, answer three things, land on the Tips page. Later: find your details, change them, or leave cleanly.
FIRST VIEWPORT: Phone 390px: the invite line ("Sully's invited you to the comp") as the heading, one line on what the comp is, a "Continue with Google" button and an email field with "Email me a link", and the footer line about no passwords.
FORM: Pinned by the user's answers and PLAN_WEB.md §3.5 (joining); standard sign-in controls; no roll.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
