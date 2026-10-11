// Keeps a signed-in tipper's Supabase session fresh: an expired access token is refreshed here, on
// the way in, and the new cookies go to both the page being rendered and the browser. Does nothing
// when Supabase isn't configured (the sample).

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase";

export async function middleware(request: NextRequest) {
  if (!supabaseConfig) return NextResponse.next();
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
  // Checks the token with Supabase and refreshes it if it has expired.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Pages only: not static files, images or the icon.
  matcher: ["/((?!_next/static|_next/image|icon.svg|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
