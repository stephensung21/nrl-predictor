import type { Metadata } from "next";
import { AccountPanel } from "@/components/auth-forms";
import { SampleNote } from "@/components/sample-note";
import { tippingLive } from "@/lib/supabase";

export const metadata: Metadata = { title: "Your account · rugbyleague-tipper" };

export default function Page() {
  return (
    <main>
      <AccountPanel />
      {!tippingLive && (
      <SampleNote>
        Your details are saved in this browser until the real accounts exist.
      </SampleNote>
      )}
    </main>
  );
}
