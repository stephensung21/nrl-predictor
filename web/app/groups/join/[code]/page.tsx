import type { Metadata } from "next";
import { JoinFlow } from "@/components/auth-forms";
import { PageMessage } from "@/components/page-message";
import { SampleNote } from "@/components/sample-note";
import { SAMPLE_GROUPS } from "@/lib/groups";
import { tippingLive } from "@/lib/supabase";
import { serverClient } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Join a group · Full Credit" };
export const dynamic = "force-dynamic";

/** What check_group() says about a code: the group's name and size, or null. */
async function checkGroup(code: string): Promise<{ name: string; members: number } | null> {
  if (!tippingLive) {
    const g = SAMPLE_GROUPS.find((x) => x.code === code.toUpperCase());
    return g ? { name: g.name, members: g.members.length } : null;
  }
  const sb = (await serverClient())!;
  const { data, error } = await sb.rpc("check_group", { p_code: code });
  if (error) throw new Error(`check_group: ${error.message}`);
  return ((data ?? []) as { name: string; members: number }[])[0] ?? null;
}

export default async function JoinGroupPage({ params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code).trim().toUpperCase();
  const group = await checkGroup(code);
  if (!group) {
    return (
      <PageMessage
        title="That group link doesn’t work."
        body="Check you copied the whole link, or ask for a fresh one: the group's owner may have made a new link. You can still join the global comp."
        action={{ href: "/join", label: "Join the comp" }}
      />
    );
  }
  return (
    <main>
      <JoinFlow group={{ code, ...group }} />
      {!tippingLive && <SampleNote>Sign-in is a stand-in until the real accounts exist: nothing is sent, and your details stay in this browser.</SampleNote>}
    </main>
  );
}
