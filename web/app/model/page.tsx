import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SampleNote } from "@/components/sample-note";
import { ModelBadge, TeamBadge } from "@/components/team-badge";
import { modelRecord, type ModelCall } from "@/lib/model-record";
import { MATCH_DETAILS } from "@/lib/sample-archive";
import { SERIES } from "@/lib/odds";

export const metadata: Metadata = { title: "The Model · rugbyleague-tipper" };

const pct = (n: number, of: number) => Math.round((n / of) * 100);

export default function ModelPage() {
  const r = modelRecord("open");
  const { comp } = r;
  const place =
    comp.behind === 0
      ? comp.level === 0
        ? `ahead of all ${comp.tippers} tippers`
        : `level with the leader`
      : comp.ahead === 0
        ? `behind all ${comp.tippers} tippers`
        : `ahead of ${comp.ahead} of the ${comp.tippers} tippers`;

  return (
    <main>
      <div className="pt-4">
        <h1 className="flex items-center gap-2.5 font-display text-[26px] leading-none font-bold uppercase">
          <ModelBadge size="md" />
          The Model
        </h1>
        <p className="mt-2 text-[13px] text-ink-3">2026 so far, Rounds 1&ndash;{r.lastRound}</p>
      </div>

      <dl className="mt-4 grid grid-cols-3 border-y border-line-soft">
        {(
          [
            ["model", "The Model", r.model],
            ["market", "Bookies’ favourite", r.market],
            ["elo", "Elo", r.elo],
          ] as const
        ).map(([k, label, n]) => (
          <div key={k} className="py-3 pr-2">
            <dt className="flex min-h-[2lh] items-start gap-1.5 text-[12px] leading-tight text-ink-3">
              <span className="mt-[0.45em] h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: SERIES[k].colour }} aria-hidden />
              {label}
            </dt>
            <dd className={`mt-1 font-display text-[30px] leading-none font-bold ${k === "model" ? "text-ink" : "text-ink-2"}`}>
              {n}
              <span className="text-[16px] font-semibold text-ink-3">/{r.games}</span>
            </dd>
            <dd className="mt-0.5 text-[12px] text-ink-3">{pct(n, r.games)}% tipped right</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[15px] leading-snug text-ink">
        In the comp it has <span className="font-score text-[17px] font-semibold">{comp.points}</span> points, {place}.{" "}
        <Link href="/tipping/ladder" className="font-semibold whitespace-nowrap text-ink-2 underline decoration-line hover:text-ink">
          See the ladder
        </Link>
      </p>

      <section aria-labelledby="rounds" className="mt-8">
        <h2 id="rounds" className="font-display text-[24px] leading-none font-bold uppercase">
          Round by round
        </h2>
        <p className="mt-1.5 text-[13px] text-ink-3">Each lamp is one game, in kickoff order. Lit: it tipped the winner.</p>
        <table className="mt-3 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-[12px] font-semibold text-ink-3">
              <th scope="col" className="w-12 py-2 font-semibold">
                Round
              </th>
              <th scope="col" className="py-2 font-semibold">
                <span className="sr-only">Games</span>
              </th>
              <th scope="col" className="w-14 py-2 text-right font-semibold">
                Model
              </th>
              <th scope="col" className="w-20 py-2 text-right font-semibold">
                vs bookies
              </th>
            </tr>
          </thead>
          <tbody>
            {r.perRound.map((x) => {
              const diff = x.model - x.market;
              return (
                <tr key={x.round} className="border-b border-line-soft">
                  <th scope="row" className="py-2.5 text-left font-score text-[15px] font-semibold text-ink-3">
                    R{x.round}
                  </th>
                  <td className="py-2.5">
                    <span className="flex gap-[3px]" aria-label={`${x.model} of ${x.games} right`}>
                      {x.results.map((ok, i) => (
                        <span key={i} className={`size-[11px] rounded-[2px] ${ok ? "bg-lime" : "bg-raised-2 ring-1 ring-line ring-inset"}`} />
                      ))}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-score text-[19px] font-bold text-ink">
                    {x.model}
                    <span className="text-[14px] text-ink-3">/{x.games}</span>
                  </td>
                  <td className="py-2.5 text-right font-score text-[15px] text-ink-2">
                    {diff === 0 ? "Level" : `${diff > 0 ? "+" : "−"}${Math.abs(diff)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-[12px] text-ink-3">vs bookies: tips right compared with just picking the bookies&rsquo; opening favourite.</p>
      </section>

      <Calls
        title="Best calls"
        note="Right when the bookies had the other team favourite."
        calls={r.best}
        empty="None yet: it hasn't beaten the bookies' favourite on a game this season."
      />
      <Calls title="Worst misses" note="Wrong when it was most sure." calls={r.worst} empty="It hasn't missed yet." />

      <section aria-labelledby="tested" className="mt-10">
        <h2 id="tested" className="font-display text-[24px] leading-none font-bold uppercase">
          How it was tested
        </h2>
        <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">
          Before it tipped a single game, the Model was tested on seasons it never saw while being built. Its win
          chances were more accurate than Elo&rsquo;s and the bookies&rsquo; opening prices, and as accurate as their closing
          prices: level with the market at its sharpest, not ahead of it.
        </p>
        <div className="mt-4 flex flex-col gap-1 text-[15px] font-semibold">
          <Link href="/about" className="group flex items-center justify-between border-y border-line-soft py-3 text-ink hover:text-ink">
            How the Model works, and where it falls down
            <ChevronRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <Link href="/odds?tab=season" className="group flex items-center justify-between border-b border-line-soft py-3 text-ink">
            The Model without odds against the bookies, all of 2026
            <ChevronRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </section>

      <SampleNote>
        Real 2026 games and the Model&rsquo;s real tips from its test season. Round 10 is the sample&rsquo;s current round.
        Rounds 3 and 5 show the 7 games in their replays, so one game from each is left out. The tippers it&rsquo;s compared
        with are made up.
      </SampleNote>
    </main>
  );
}

function Row({ href, className, children }: { href?: string; className: string; children: React.ReactNode }) {
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

function Calls({ title, note, calls, empty }: { title: string; note: string; calls: ModelCall[]; empty: string }) {
  return (
    <section aria-label={title} className="mt-8">
      <h2 className="font-display text-[24px] leading-none font-bold uppercase">{title}</h2>
      <p className="mt-1.5 text-[13px] text-ink-3">{note}</p>
      {calls.length === 0 ? (
        <p className="mt-3 text-[14px] text-ink-2">{empty}</p>
      ) : (
        <ul className="mt-3 border-t border-line-soft">
          {calls.map((c) => {
            // Only the sample's replay rounds have match pages; the rest stay plain rows.
            const hasPage = !!MATCH_DETAILS[c.matchId];
            const cls = `flex items-center gap-3 border-b border-line-soft py-2.5 ${hasPage ? "hover:bg-raised" : ""}`;
            return (
            <li key={c.matchId}>
              <Row href={hasPage ? `/match/${c.matchId}` : undefined} className={cls}>
                <TeamBadge name={c.pick} size="sm" />
                <span className="min-w-0 flex-1 text-[14px] text-ink">
                  {c.pick} over the {c.opponent}
                  <span className="block text-[12px] text-ink-3">
                    Round {c.round} · {c.result}
                    {c.marketChance != null && <> · bookies {Math.round(c.marketChance * 100)}%</>}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="font-score text-[19px] font-bold text-ink">{Math.round(c.chance * 100)}%</span>
                  <span className="block text-[11px] text-ink-3">its chance</span>
                </span>
              </Row>
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
