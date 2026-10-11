// Supabase on the server, as the visitor (their session cookie) or, for the two things a tipper
// can't do for themselves, as the service role. Server code only.

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseConfig } from "./supabase";

/** The visitor's client, under row-level security as them; null when Supabase isn't configured. */
export async function serverClient(): Promise<SupabaseClient | null> {
  if (!supabaseConfig) return null;
  const store = await cookies();
  return createServerClient(supabaseConfig.url, supabaseConfig.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // Server components can't set cookies; the middleware refreshes the session instead.
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {}
      },
    },
  });
}

/**
 * The service role bypasses row-level security, so it's used only to delete an auth user (deleting
 * your own account, or the admin removing a tipper), after the caller has been checked. The key
 * lives only in the server's environment (Vercel), never in the browser, the repo or GitHub.
 */
export function serviceClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseConfig || !key) return null;
  return createClient(supabaseConfig.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
