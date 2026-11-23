import type { Metadata } from "next";
import { GroupsPanel } from "@/components/groups-panel";
import { SampleNote } from "@/components/sample-note";
import { tippingLive } from "@/lib/supabase";

export const metadata: Metadata = { title: "Groups · Full Credit" };

export default function GroupsPage() {
  return (
    <main>
      <GroupsPanel />
      {!tippingLive && (
        <SampleNote>
          Two made-up groups over the sample tippers. Changes here stay in this browser; the sample ladder keeps to the two made-up groups.
        </SampleNote>
      )}
    </main>
  );
}
