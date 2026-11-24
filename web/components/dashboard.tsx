// The home dashboard (docs/superpowers/specs/2026-11-25-home-dashboard-design.md): a signed-in tipper's
// week at a glance. To do is the page's one board; the comps follow as hairline sections.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { DallyMGlance } from "@/lib/dashboard-data";
import type { LmsGlance, Todo } from "@/lib/dashboard";
import type { GroupChoice } from "@/lib/groups";
import type { RoundView } from "@/lib/round";
import { ordinal } from "@/lib/round";
import { sydney } from "@/lib/time";
import { Pictogram, type PictogramName } from "./art/pictogram";
import { GroupSwitcher } from "./group-switcher";
import { RoundHeading } from "./home-sections";
import { PlayerPhoto } from "./player-photo";
import { ModelBadge, TeamBadge } from "./team-badge";

const ICON: Record<Todo["key"], PictogramName> = { tips: "ball", margin: "short-bars", lms: "crown", dallym: "podium" };

const pill =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-lime px-4 text-[14px] font-bold whitespace-nowrap text-lime-ink transition-colors hover:bg-lime-hover";
const more = "-my-2 inline-flex min-h-11 items-center text-[14px] font-semibold text-ink-2 underline decoration-line underline-offset-[3px] hover:text-ink hover:decoration-ink-3";

function Section({ id, title, link, children }: { id: string; title: string; link?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-display text-[24px] leading-none font-bold uppercase">
          {title}
        </h2>
        {link && (
          <Link href={link.href} className={more}>
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function TodoBoard({ items, firstLock }: { items: Todo[]; firstLock?: string }) {
  const open = items.filter((t) => !t.done).length;
  return (
    <section aria-labelledby="todo" className="rounded-xl border border-line bg-raised px-4 pt-3.5 pb-1">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="todo" className="font-display text-[22px] leading-none font-bold uppercase">
          {open ? `To do · ${open}` : "All done"}
        </h2>
        {firstLock && open > 0 && <p className="text-[13px] text-ink-3">next lockout {sydney(firstLock)}</p>}
      </div>
      <ul className="mt-1.5">
        {items.map((t) => (
          <li key={t.key} className="flex items-center gap-3 border-t border-line-soft py-3 first:border-t-0">
            {t.done ? (
              <Pictogram name="tick" size={24} className="text-lime-fg" />
            ) : (
              <Pictogram name={ICON[t.key]} size={24} className="text-ink-2" />
            )}
            <span className="min-w-0 flex-1">
              <span className={`block text-[15px] leading-snug ${t.done ? "font-medium text-ink-2" : "font-semibold text-ink"}`}>{t.title}</span>
              {t.note && !t.done && <span className="block text-[13px] leading-snug text-ink-3">{t.note}</span>}
            </span>
            {t.action && !t.done && (
              <Link href={t.action.href} className={pill}>
                {t.action.label}
              </Link>
            )}
            {t.done && <span className="sr-only">Done.</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function LadderGlance({ view, youId }: { view: RoundView; youId: string }) {
  const field = view.ladder.filter((s) => !s.tipper.isModel);
  const you = field.find((s) => s.tipper.id === youId);
  const model = view.ladder.find((s) => s.tipper.isModel);
  const leader = field[0];
  if (!you || !leader) return null;
  const rows = [...field.slice(0, 2), ...(field.slice(0, 2).includes(you) ? [] : [you])];
  const gap = (n: number) => `${n} pt${n === 1 ? "" : "s"}`;
  return (
    <Section id="ladder" title="Ladder" link={{ href: "/tipping/ladder", label: "Full ladder" }}>
      <ul className="border-b border-line-soft">
        {rows.map((s) => {
          const mine = s.tipper.id === youId;
          return (
            <li key={s.tipper.id} className={`flex items-center gap-3 border-t border-line-soft px-2 py-2.5 ${mine ? "rounded-md bg-lime-wash" : ""}`}>
              <span className={`w-6 font-score text-[20px] font-bold ${mine ? "text-lime-fg" : "text-ink-2"}`}>{s.position}</span>
              {s.tipper.favTeam ? <TeamBadge name={s.tipper.favTeam} size="sm" /> : <span className="w-[38px]" />}
              <span className="flex-1 truncate text-[15px] font-semibold text-ink">
                {s.tipper.name}
                {mine && <span className="ml-1.5 text-[11px] font-bold tracking-[0.06em] text-lime-fg uppercase">You</span>}
              </span>
              <span className="font-score text-[22px] font-bold text-ink">{s.points}</span>
            </li>
          );
        })}
        {model && (
          <li className="flex items-center gap-3 border-t border-line-soft px-2 py-2.5">
            <span className="w-6" />
            <ModelBadge size="sm" />
            <span className="flex-1 text-[15px] font-medium text-ink">the Model</span>
            <span className="font-score text-[22px] font-bold text-ink-2">{model.points}</span>
          </li>
        )}
      </ul>
      <p className="mt-2 text-[13px] text-ink-3">
        {you === leader ? "Top of the ladder" : `${ordinal(you.position)}, ${gap(leader.points - you.points)} off the lead`}
        {model && model.points !== you.points && (model.points > you.points ? ` · ${gap(model.points - you.points)} behind the Model` : ` · ${gap(you.points - model.points)} ahead of the Model`)}
      </p>
    </Section>
  );
}

function TipsGlance({ view }: { view: RoundView }) {
  const decided = view.games.filter((g) => g.status === "final");
  const right = decided.filter((g) => g.yourCorrect).length;
  const tipped = view.games.filter((g) => g.yourTip).length;
  return (
    <Section id="your-tips" title={`Your tips · ${view.title}`} link={{ href: "/tipping", label: "All games" }}>
      <ol className="flex gap-1.5" aria-label={`${tipped} of ${view.games.length} games tipped`}>
        {view.games.map((g) => {
          const state = g.status === "final" && g.yourTip ? (g.yourCorrect ? "right" : "wrong") : g.yourTip ? "tipped" : "open";
          const look = { right: "bg-lime", tipped: "bg-ink-2", wrong: "bg-miss/60", open: "bg-raised-2 ring-1 ring-line ring-inset" }[state];
          return <li key={g.match.id} className={`h-2.5 flex-1 rounded-[2px] ${look}`} title={`${g.match.home} v ${g.match.away}`} />;
        })}
      </ol>
      <p className="mt-2 text-[13px] text-ink-3">
        {decided.length ? `${right} of ${decided.length} right so far · ` : ""}
        {tipped} of {view.games.length} tipped
      </p>
    </Section>
  );
}

function LmsGlanceSection({ lms }: { lms: LmsGlance }) {
  return (
    <Section id="lms" title="Last man standing" link={{ href: "/last-man-standing", label: `Game ${lms.game}` }}>
      <dl className="grid grid-cols-3 border-y border-line-soft py-3">
        <div>
          <dt className="sr-only">You</dt>
          <dd className={`font-display text-[30px] leading-none font-bold uppercase ${lms.alive ? "text-lime-fg" : "text-ink-3"}`}>{lms.alive ? "In" : "Out"}</dd>
          <dd className="mt-1 text-[12px] text-ink-3">this game</dd>
        </div>
        <div>
          <dt className="sr-only">Still in</dt>
          <dd className="font-score text-[30px] leading-none font-bold text-ink">
            {lms.stillIn}
            <span className="text-[16px] text-ink-3">/{lms.field}</span>
          </dd>
          <dd className="mt-1 text-[12px] text-ink-3">still in</dd>
        </div>
        <div>
          <dt className="sr-only">Games won</dt>
          <dd className="font-score text-[30px] leading-none font-bold text-ink">{lms.wins}</dd>
          <dd className="mt-1 text-[12px] text-ink-3">game{lms.wins === 1 ? "" : "s"} won this season</dd>
        </div>
      </dl>
      {lms.used.length > 0 && (
        <div className="mt-3">
          <p className="text-[12px] text-ink-3">Teams you&rsquo;ve used this game</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {lms.used.map((t) => (
              <li key={t}>
                <TeamBadge name={t} size="sm" dim />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

function DallyMGlanceSection({ dallyM }: { dallyM: DallyMGlance }) {
  if (!dallyM.top.length) return null;
  return (
    <Section id="dally-m" title="Dally M" link={{ href: "/dally-m", label: "Leaderboard" }}>
      <ol className="border-b border-line-soft">
        {dallyM.top.map((t) => (
          <li key={t.playerId} className="flex items-center gap-3 border-t border-line-soft px-2 py-2">
            <span className="w-6 font-score text-[20px] font-bold text-ink-2">
              {t.tied ? "=" : ""}
              {t.rank}
            </span>
            <PlayerPhoto src={t.image} team={t.team} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-ink">{t.name}</span>
              <span className="block text-[12px] text-ink-3">{t.team}</span>
            </span>
            <span className="font-score text-[22px] font-bold text-ink">
              {t.votes}
              <span className="sr-only"> votes</span>
            </span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function Dashboard({
  view,
  items,
  youId,
  lms,
  dallyM,
  groups,
}: {
  view: RoundView;
  items: Todo[];
  youId: string;
  lms: LmsGlance | null;
  dallyM: DallyMGlance | null;
  groups?: GroupChoice;
}) {
  const firstLock = view.games.find((g) => g.status === "upcoming" && !g.yourTip)?.match.kickoff;
  return (
    <>
      <RoundHeading view={view} />
      {groups && <GroupSwitcher choice={groups} />}
      <TodoBoard items={items} firstLock={firstLock} />
      <LadderGlance view={view} youId={youId} />
      <TipsGlance view={view} />
      {lms && <LmsGlanceSection lms={lms} />}
      {dallyM && <DallyMGlanceSection dallyM={dallyM} />}
      <Link
        href={`/round/${view.season}/${view.round}`}
        className="group mt-8 flex items-center justify-between gap-3 border-y border-line-soft py-3.5 text-[15px] font-semibold text-ink"
      >
        This round: every game, the margin game, the Model&rsquo;s calls
        <ChevronRight className="size-5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </>
  );
}
