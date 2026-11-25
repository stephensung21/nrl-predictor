// Keeps a signed-in tipper's Supabase session fresh: an expired access token is refreshed here, on
// the way in, and the new cookies go to both the page being rendered and the browser. Does nothing
// when Supabase isn't configured (the sample).
//
// It runs before every page request, so it does as little as it can (docs/PLAN_PERF.md, Phase 1):
// - no session cookie, nothing to refresh: straight through, with no call to Supabase;
// - a router prefetch renders only down to the page's loading skeleton, which reads no session;
// - getClaims() checks the token itself when the project signs tokens with an asymmetric key (one
//   cached fetch of its public keys) and asks Supabase Auth, as getUser() does, only otherwise. Either
//   way it refreshes an expired token first.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase";

/** Supabase's session cookie is `sb-<project>-auth-token`, split into `.0`, `.1`… when it's long. */
const hasSession = (request: NextRequest) =>
  request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));

const isPrefetch = (request: NextRequest) =>
  request.headers.has("next-router-prefetch") || request.headers.has("next-router-segment-prefetch");

export async function middleware(request: NextRequest) {
  if (!supabaseConfig || !hasSession(request) || isPrefetch(request)) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  // Refreshes the token if it has expired, then checks it.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Pages only: not static files, images, the icon or Vercel's own scripts (Speed Insights).
  matcher: ["/((?!_next/static|_next/image|_vercel|icon.svg|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
