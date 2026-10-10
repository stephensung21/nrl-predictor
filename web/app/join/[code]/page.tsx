import type { Metadata } from "next";
import { JoinFlow } from "@/components/auth-forms";
import { SampleNote } from "@/components/sample-note";

export const metadata: Metadata = { title: "Join the comp · rugbyleague-tipper" };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <main>
      <JoinFlow code={decodeURIComponent(code)} />
      <SampleNote
        states={[
          { href: "/join/MATES26", label: "Valid invite", on: code.toUpperCase() === "MATES26" },
          { href: "/join/USED26", label: "Used invite", on: code.toUpperCase() === "USED26" },
          { href: "/join/OLD25", label: "Expired invite", on: code.toUpperCase() === "OLD25" },
        ]}
      >
        Sign-in is a stand-in until the real accounts exist: nothing is sent, and your details stay in this browser.
      </SampleNote>
    </main>
  );
}
