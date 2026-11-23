import type { Metadata } from "next";
import { JoinFlow } from "@/components/auth-forms";
import { SampleNote } from "@/components/sample-note";
import { tippingLive } from "@/lib/supabase";

export const metadata: Metadata = { title: "Join the comp · Full Credit" };

/** Anyone can join the global comp: sign in, then three answers. */
export default function JoinPage() {
  return (
    <main>
      <JoinFlow />
      {!tippingLive && (
        <SampleNote>Sign-in is a stand-in until the real accounts exist: nothing is sent, and your details stay in this browser.</SampleNote>
      )}
    </main>
  );
}
