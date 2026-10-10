import type { Metadata } from "next";
import { AdminGate, Invites, Margin, Runs, Section, Tippers } from "@/components/admin-panel";
import { SampleNote } from "@/components/sample-note";
import { round10 } from "@/lib/sample";

export const metadata: Metadata = { title: "Admin · rugbyleague-tipper", robots: { index: false } };

export default function AdminPage() {
  return (
    <main>
      <AdminGate>
        <div className="pt-4">
          <h1 className="font-display text-[26px] leading-none font-bold uppercase">Admin</h1>
          <p className="mt-1.5 text-[13px] text-ink-3">Round {round10.round} · tipping open · times in Sydney</p>
        </div>

        <Section id="invites" title="Invites">
          <Invites />
        </Section>

        <Section id="tippers" title="Tippers" meta={`Round ${round10.round}`}>
          <Tippers />
        </Section>

        <Section id="margin" title="Margin game">
          <Margin />
        </Section>

        <Section id="pipeline" title="Pipeline" meta="Last 4 runs">
          <Runs />
        </Section>
      </AdminGate>

      <SampleNote>
        The tippers, invites and pipeline runs are made up; the fixtures are the real Rounds {round10.round} and {round10.round + 1}.
        Removing someone here only takes them off this list; live, it deletes their account and tips. In the sample anyone can
        open this page; live, only the admin can.
      </SampleNote>
    </main>
  );
}
