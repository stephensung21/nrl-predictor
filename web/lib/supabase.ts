// The tipping comp's connection to Supabase (PLAN_WEB.md step 10): sign-in, profiles, invites and
// tips, through Supabase's client so row-level security applies to each tipper. The model's data
// comes the other way (lib/db.ts, read-only, server side).
//
// Live when NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set (the project URL and
// its publishable key, which are meant to be public). Without them the tipping pages keep the
// browser stand-ins, so the sample site works with no backend.

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Spelled out in full: Next.js inlines NEXT_PUBLIC_ variables only where they're written like this.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfig = URL && KEY ? { url: URL, key: KEY } : null;

/** Whether the tipping comp is live (Supabase) or the sample (this browser). */
export const tippingLive = supabaseConfig != null;

let browser: SupabaseClient | undefined;

/** The browser's client: one per tab, its session kept in cookies so the server can read it too. */
export function browserClient(): SupabaseClient {
  if (!supabaseConfig) throw new Error("Supabase isn't configured");
  browser ??= createBrowserClient(supabaseConfig.url, supabaseConfig.key);
  return browser;
}

/** Postgres's code for a row-level security refusal: for tips, the game has kicked off. */
export const RLS_DENIED = "42501";
