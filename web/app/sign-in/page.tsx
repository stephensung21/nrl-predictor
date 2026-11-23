import type { Metadata } from "next";
import { SignInPage } from "@/components/auth-forms";
import { SampleNote } from "@/components/sample-note";
import { tippingLive } from "@/lib/supabase";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Sign in · Full Credit" };

export default function Page() {
  return (
    <main>
      <Suspense>
        <SignInPage />
      </Suspense>
      {!tippingLive && (
      <SampleNote>
        Sign-in is a stand-in until the real accounts exist. Join first at /join, or with a sample group&rsquo;s link at /groups/join/BOYS2026.
      </SampleNote>
      )}
    </main>
  );
}
