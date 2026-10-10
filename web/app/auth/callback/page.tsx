import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCallback } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Signing in · rugbyleague-tipper" };

/** Where Google and the email link return to. With Supabase this exchanges the code for a session. */
export default function Page() {
  return (
    <main>
      <Suspense fallback={<p className="pt-10 text-[15px] text-ink-3">Signing you in…</p>}>
        <AuthCallback />
      </Suspense>
    </main>
  );
}
