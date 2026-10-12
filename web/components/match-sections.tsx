import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check, ChevronLeft, Cloud, CloudRain, House, Wind, X } from "lucide-react";
import { driverView, type DriverRow } from "@/lib/drivers";
import { lineColours, type MatchElo } from "@/lib/elo";
import { oddsMove } from "@/lib/odds-history";
import { ordinal, roundName, type Game } from "@/lib/round";
import type { Verdict, Voice } from "@/lib/match";
import type { Preview } from "@/lib/source";
import type { Drivers, ListedPlayer, Match, MatchDetail, OddsHistory } from "@/lib/types";
import { weatherFlag, weatherParts } from "@/lib/weather";
import { team, type TeamName } from "@/lib/teams";
import { EloMatchChart } from "./elo-charts";
import { LocalTime } from "./local-time";
import { OddsChart } from "./odds-chart";
import { PitchBar } from "./pitch-bar";
import { ModelBadge, TeamBadge } from "./team-badge";

/* ---------- Heading: back link, teams, verdict ---------- */

const final = (g: Game) => g.status === "final";

/** Keeps team names whole ("Sea Eagles", "Wests Tigers") when a sentence wraps. */
function Unbroken({ text, teams }: { text: string; teams: TeamName[] }) {
  const parts = text.split(new RegExp(`(${teams.join("|")})`));
  return parts.map((p, i) => (teams.includes(p as TeamName) ? <span key={i} className="whitespace-nowrap">{p}</span> : p));
}

export function MatchHeading({ game, verdict, voices }: { game: Game; verdict: Verdict; voices: Voice[] }) {
  const { match, prediction } = game;
  const teams = [match.home, match.away];
  const market = voices.find((v) => v.id === "market");
  const said = `${final(game) ? "Model said" : "Model’s call:"} ${team(game.modelTip).name} by ${game.callMargin}, ${prediction.homePred}–${prediction.awayPred}.`;
  const isFinal = final(game);
  const when =
    game.status === "upcoming" ? <LocalTime iso={match.kickoff} /> : game.status === "live" ? "Live now" : isFinal ? "Full time" : "Full time · result soon";

  return (
    <div className="pt-4">
      <p className="flex items-center truncate text-[13px] font-medium whitespace-nowrap text-ink-3">
        <Link
          href={`/round/${match.season}/${match.round}`}
          className="-my-2 -ml-1 flex items-center gap-0.5 py-2 pr-1 font-semibold text-ink-2 hover:text-ink"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {roundName(match.round, match.roundTitle)}
        </Link>
        <span className="mx-1.5">·</span>
        {when}
        <span className="mx-1.5">·</span>
        {match.venue}
      </p>

      <div className="mt-3.5 flex items-center gap-2 text-[14px] font-semibold text-ink-2">
        <TeamBadge name={match.home} size="sm" />
        <span>{match.home}</span>
        <span className="font-medium text-ink-3">v</span>
        <span>{match.away}</span>
        <TeamBadge name={match.away} size="sm" />
      </div>

      {isFinal ? (
        <>
          <h1 className="mt-3 font-display text-[40px] leading-[0.92] font-extrabold uppercase">
            {game.winners!.length === 2 ? "Draw" : <><span className="whitespace-nowrap">{game.winners![0]}</span> won</>}{" "}
            <span className="font-score">
              {Math.max(match.homeScore!, match.awayScore!)}–{Math.min(match.homeScore!, match.awayScore!)}
            </span>
          </h1>
          <p className="mt-2.5 text-[16px] leading-snug font-semibold text-ink">
            <Unbroken text={verdict.lead} teams={teams} />{" "}
            {verdict.dissent && <span className="text-ink-3"><Unbroken text={verdict.dissent} teams={teams} /></span>}
          </p>
          <p className="mt-1.5 text-[14px] leading-snug text-ink-2">{said}</p>
        </>
      ) : (
        <>
          <h1 className="mt-3 font-display text-[34px] leading-[0.94] font-extrabold text-balance uppercase">
            <Unbroken text={verdict.lead} teams={teams} />{" "}
            {verdict.dissent && <span className="text-ink-3"><Unbroken text={verdict.dissent} teams={teams} /></span>}
          </h1>
          <p className="mt-2.5 text-[14px] leading-snug text-ink-2">
            {said}
            {/* Say the bookies' number outright: "18 points apart" reads like a score margin. */}
            {verdict.gap != null && market && (
              <> The bookies give the {team(game.modelTip).name} {Math.round((game.modelTip === match.home ? market.homeProb : 1 - market.homeProb) * 100)}%.</>
            )}
          </p>
        </>
      )}
    </div>
  );
}

/* ---------- Weather (live data only) ---------- */

/** The game's weather: the latest forecast before kickoff, what it was afterwards. Open-Meteo is CC BY 4.0, so it's credited here. */
export function WeatherLine({ match }: { match: Match }) {
  const w = match.weather;
  if (!w) return null;
  const flag = weatherFlag(w);
  const Icon = w.roofed ? House : flag?.kind === "rain" ? CloudRain : flag?.kind === "wind" ? Wind : Cloud;
  return (
    <p className="mt-3 flex gap-2 text-[13px] leading-snug text-ink-2">
      <Icon className="mt-px size-4 shrink-0 text-ink-3" strokeWidth={2} aria-hidden />
      <span>
        <span className="font-semibold text-ink">{w.kind === "forecast" ? "Forecast" : "On the day"}: </span>
        {weatherParts(w).join(" · ")}
        <span className="text-ink-3">
          {" · "}
          {w.kind === "forecast" && !w.roofed && (
            <>
              as of <LocalTime iso={w.fetchedAt} />,{" "}
            </>
          )}
          <a href="https://open-meteo.com/" className="whitespace-nowrap underline decoration-line underline-offset-2 hover:text-ink-2">
            Open-Meteo
          </a>
        </span>
      </span>
    </p>
  );
}

/* ---------- What drove the prediction ---------- */

const points = (n: number) => Math.abs(n).toFixed(1);

/** The prediction split into its parts, in points of margin: each bar grows from the halfway line
 * towards the side it favours, home to the left and away to the right, as on the pitch bars. */
export function DriversSection({ game, drivers }: { game: Game; drivers: Drivers }) {
  const { home, away } = game.match;
  const view = driverView(drivers, home, away);
  const colours = lineColours([home, away]);
  const all = [...(view.base ? [view.base] : []), ...view.rows];
  const scale = Math.max(...all.map((r) => Math.abs(r.points)), 1);
  const leads = team(view.total >= 0 ? home : away).name;
  const final = game.status === "final";

  const Row = ({ r, quiet }: { r: DriverRow; quiet?: boolean }) => {
    const width = `${(Math.abs(r.points) / scale) * 50}%`;
    return (
      <li className="border-b border-line-soft py-2">
        <div className="flex items-baseline justify-between gap-3 text-[14px]">
          <span className={quiet ? "text-ink-3" : "text-ink-2"}>{r.label}</span>
          <span className="shrink-0 text-[13px] font-semibold text-ink-3">
            {r.favours ? team(r.favours).code : "Even"}{" "}
            <span className="font-score text-[16px] text-ink">+{points(r.points)}</span>
          </span>
        </div>
        <div className="relative mt-1.5 h-[7px] rounded-[3px] bg-pitch" aria-hidden>
          {r.favours && (
            <div
              className={`absolute inset-y-0 ${r.points > 0 ? "right-1/2 rounded-l-[3px]" : "left-1/2 rounded-r-[3px]"}`}
              style={{ width, backgroundColor: colours[r.favours], opacity: quiet ? 0.5 : 1 }}
            />
          )}
          <div className="absolute inset-y-[-3px] left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-ink-3" />
        </div>
      </li>
    );
  };

  return (
    <section aria-labelledby="drivers" className="mt-6">
      <h2 id="drivers" className="text-[16px] font-semibold text-ink">
        What drove this
      </h2>
      <p className="mt-0.5 max-w-[60ch] text-[13px] leading-snug text-ink-3">
        The Model&rsquo;s margin, in points, split into what {final ? "pushed" : "pushes"} it each way.
        {drivers.variant === "no_odds" && " It had no odds for this game, so the bookies’ price isn’t in it."}
      </p>
      <div className="mt-3 flex justify-between text-[12px] font-semibold text-ink-3">
        <span className="flex items-center gap-1.5">
          <TeamBadge name={home} size="sm" />
          {home}
        </span>
        <span className="flex items-center gap-1.5">
          {away}
          <TeamBadge name={away} size="sm" />
        </span>
      </div>
      <ul className="mt-2 border-t border-line-soft">
        {view.base && <Row r={view.base} quiet />}
        {view.rows.map((r) => (
          <Row key={r.group} r={r} />
        ))}
        <li className="flex items-baseline justify-between gap-3 py-2.5 text-[14px] font-semibold text-ink">
          <span className="flex items-center gap-1.5">
            <ModelBadge size="sm" />
            Model&rsquo;s margin
          </span>
          <span>
            {leads} by <span className="font-score text-[17px]">{points(view.total)}</span>
          </span>
        </li>
      </ul>
      <p className="text-[12px] leading-snug text-ink-3">
        Rounded{view.trimmed ? ", and parts under 0.1 points left out" : ""}.
      </p>
    </section>
  );
}

/* ---------- Claude's preview (live data only) ---------- */

export function PreviewSection({ preview }: { preview: Preview }) {
  return (
    <section aria-labelledby="preview" className="mt-6">
      <h2 id="preview" className="text-[16px] font-semibold text-ink">
        Preview
      </h2>
      <p className="mt-0.5 text-[13px] text-ink-3">
        Written by Claude from the Model&rsquo;s numbers, <LocalTime iso={preview.writtenAt} />.
        {preview.stale && " The prediction has changed since, so the numbers above are the current ones."}
      </p>
      <div className="mt-2 max-w-[60ch] space-y-3 text-[15px] leading-relaxed text-ink-2">
        {preview.body.split(/\n\s*\n/).map((para, i) => (
          <p key={i}>{para.trim()}</p>
        ))}
      </div>
    </section>
  );
}

/* ---------- The voices, one pitch bar each ---------- */

export function VoiceList({ game, voices }: { game: Game; voices: Voice[] }) {
  const { home, away } = game.match;
  const noOdds = !voices.some((v) => v.id === "market");
  return (
    <section aria-label="Win chances" className="mt-5">
      <ul className="border-t border-line-soft">
        {voices.map((v) => (
          <li key={v.id} className="border-b border-line-soft py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                {v.correct === true && <Check className="size-3.5 text-ink-2" strokeWidth={2.5} aria-label="Right" />}
                {v.correct === false && <X className="size-3.5 text-ink-3" strokeWidth={2.5} aria-label="Wrong" />}
                {v.id === "model" && <ModelBadge size="sm" />}
                {v.label}
              </span>
              <span className="text-[13px] font-semibold text-ink-3">
                {team(v.backs).code} <span className="font-score text-[19px] text-ink">{Math.round(v.prob * 100)}%</span>
              </span>
            </div>
            <div className="mt-1.5">
              <PitchBar
                home={home}
                away={away}
                homeProb={v.homeProb}
                label={`${v.label}: ${v.backs} ${Math.round(v.prob * 100)}% to win`}
              />
            </div>
          </li>
        ))}
      </ul>
      {noOdds && <p className="mt-2 text-[12px] text-ink-3">No odds yet, so the Model is running without them.</p>}
    </section>
  );
}

/* ---------- Tip action or your graded tip ---------- */

export function TipLine({ game }: { game: Game }) {
  if (game.status === "upcoming") {
    return (
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[14px] text-ink-2">
          {game.yourTip ? (
            <>
              Your tip: <span className="font-semibold text-ink">{game.yourTip}</span>
            </>
          ) : (
            "Not tipped yet"
          )}
        </span>
        <Link
          href="/tipping"
          className="group flex shrink-0 items-center gap-1 rounded-full bg-lime px-4 py-2.5 text-[14px] font-bold text-lime-ink hover:bg-lime-hover"
        >
          {game.yourTip ? "Change tip" : "Tip this game"}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} aria-hidden />
        </Link>
      </div>
    );
  }
  if (!game.yourTip) return null;
  return (
    <p className="mt-4 flex items-center gap-1.5 text-[14px]">
      <span className="text-ink-3">Your tip:</span>
      <span
        className={`flex items-center gap-1 font-semibold ${game.yourCorrect === true ? "text-lime-fg" : game.yourCorrect === false ? "text-miss line-through decoration-2" : "text-ink"}`}
      >
        {game.yourCorrect === true && <Check className="tick-pop size-4" strokeWidth={3} aria-label="Correct" />}
        {game.yourCorrect === false && <X className="size-4" strokeWidth={3} aria-label="Wrong" />}
        {game.yourTip}
      </span>
    </p>
  );
}

/* ---------- Tabs (links, so they work without JavaScript) ---------- */

export type MatchTab = "teams" | "odds" | "elo" | "h2h";

export const matchTab = (t?: string): MatchTab => (t === "odds" || t === "elo" || t === "h2h" ? t : "teams");

export function MatchTabs({ id, tab, query }: { id: string; tab: MatchTab; query: string }) {
  const tabs: [MatchTab, string][] = [
    ["teams", "Team lists"],
    ["odds", "Odds"],
    ["elo", "Elo"],
    ["h2h", "Head to head"],
  ];
  return (
    <nav aria-label="Match sections" className="mt-7 flex gap-1 border-b border-line">
      {tabs.map(([t, label]) => (
        <Link
          key={t}
          href={`/match/${id}?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(query)), tab: t })}`}
          scroll={false}
          aria-current={tab === t ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2.5 text-[14px] font-semibold transition-colors ${
            tab === t ? "border-lime-fg text-ink" : "border-transparent text-ink-3 hover:text-ink-2"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/* ---------- Team lists: home left, away right, row by row ---------- */

function InTag({ className = "" }: { className?: string }) {
  return <span className={`text-[11px] font-bold tracking-[0.06em] whitespace-nowrap text-live uppercase ${className}`}>In</span>;
}

export function TeamLists({ game, detail, before }: { game: Game; detail: MatchDetail; before: boolean }) {
  const { home, away } = detail.lists;
  // Before kickoff only Tuesday's list is known; afterwards, the 17 who played.
  const [h, a] = before ? [home.tuesday, away.tuesday] : [home.players, away.players];
  const rows = Array.from({ length: Math.max(h.length, a.length) }, (_, i) => [h[i], a[i]] as const);
  // A swap is one change: count the larger of ins and outs for each team.
  const changes = [home, away].reduce((n, t) => n + Math.max(t.out.length, t.players.filter((p) => p.isIn).length), 0);

  const Cell = ({ p, side }: { p?: ListedPlayer; side: "home" | "away" }) => (
    <span className={`flex min-w-0 items-baseline gap-2 ${side === "away" ? "flex-row-reverse text-right" : ""}`}>
      <span className="w-5 shrink-0 font-score text-[15px] font-semibold text-ink-3">{p?.n}</span>
      <span className={`min-w-0 leading-snug break-words ${p?.isIn ? "font-semibold text-ink" : "text-ink-2"}`}>
        {/* The tag sits inline so it stays with the last word when a long name wraps. */}
        {p?.isIn && side === "away" && <InTag className="mr-1.5" />}
        {p?.name}
        {p?.isIn && side === "home" && <InTag className="ml-1.5" />}
      </span>
    </span>
  );

  return (
    <section aria-label="Team lists" className="mt-3">
      <p className="text-[13px] text-ink-3">
        {before
          ? "As named on Tuesday. Changes show here after kickoff."
          : `Who played. ${changes === 0 ? "No changes since Tuesday." : `${changes} change${changes === 1 ? "" : "s"} since Tuesday.`}`}
        {!before &&
          ([[game.match.home, h], [game.match.away, a]] as const)
            .filter(([, list]) => list.length < 17)
            .map(([name, list]) => ` The stats are missing ${17 - list.length} ${name} player${17 - list.length === 1 ? "" : "s"}.`)}
      </p>
      <div className="mt-3 flex justify-between pb-2">
        <TeamBadge name={game.match.home} size="sm" />
        <TeamBadge name={game.match.away} size="sm" />
      </div>
      <ol className="border-t border-line-soft text-[14px]">
        {rows.map(([hp, ap], i) => (
          <li key={i} className={`grid grid-cols-2 gap-x-4 border-b py-[7px] ${i === 12 ? "border-line" : "border-line-soft"}`}>
            <Cell p={hp} side="home" />
            <Cell p={ap} side="away" />
          </li>
        ))}
      </ol>
      {!before && (home.out.length > 0 || away.out.length > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-4 text-[13px] leading-relaxed text-ink-3">
          {(["home", "away"] as const).map((side) => (
            <p key={side} className={side === "away" ? "text-right" : ""}>
              {detail.lists[side].out.length > 0 && (
                <>
                  <span className="font-semibold">Out: </span>
                  <span className="line-through decoration-ink-3/60">{detail.lists[side].out.join(", ")}</span>
                </>
              )}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- Head to head ---------- */

export function HeadToHead({ game, detail }: { game: Game; detail: MatchDetail }) {
  const { home, away } = game.match;
  const meetings = detail.headToHead;
  if (meetings.length === 0) return <p className="mt-4 text-[14px] text-ink-3">These two haven&rsquo;t met since 2020.</p>;
  const wins = (t: string) => meetings.filter((m) => (m.homeScore > m.awayScore ? m.home : m.awayScore > m.homeScore ? m.away : null) === t).length;
  const [hw, aw] = [wins(home), wins(away)];

  return (
    <section aria-label="Head to head" className="mt-4">
      <p className="text-[15px] font-semibold text-ink">
        Last {meetings.length}: {home} <span className="font-score text-[18px]">{hw}</span>, {away}{" "}
        <span className="font-score text-[18px]">{aw}</span>
        {meetings.length - hw - aw > 0 && <>, drawn {meetings.length - hw - aw}</>}
      </p>
      <ul className="mt-3 border-t border-line-soft">
        {meetings.map((m) => {
          const homeWon = m.homeScore > m.awayScore;
          const awayWon = m.awayScore > m.homeScore;
          return (
            <li key={m.matchId} className="flex items-center gap-3 border-b border-line-soft py-2.5">
              <span className="w-[112px] shrink-0 text-[12px] leading-tight text-ink-3">
                {m.season} · {m.roundTitle.replace("Round ", "R")}
                <span className="block truncate">{m.venue}</span>
              </span>
              <span className="flex flex-1 justify-end">
                <TeamBadge name={m.home} size="sm" />
              </span>
              <span className="w-[64px] shrink-0 text-center font-score text-[21px] leading-none">
                <span className={homeWon ? "font-bold text-ink" : "text-ink-3"}>{m.homeScore}</span>
                <span className="text-ink-3">–</span>
                <span className={awayWon ? "font-bold text-ink" : "text-ink-3"}>{m.awayScore}</span>
              </span>
              <span className="flex flex-1">
                <TeamBadge name={m.away} size="sm" />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- Odds: how the price moved before kickoff ---------- */

const handicap = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

export function OddsSection({ game, history }: { game: Game; history: OddsHistory | null }) {
  const { home, away } = game.match;
  const before = game.status === "upcoming";
  if (!history) {
    return (
      <p className="mt-4 text-[14px] text-ink-3">
        {before ? "No prices yet. Betr usually opens the market early in the week." : "No prices were recorded for this game."}
      </p>
    );
  }
  const m = oddsMove(history, home, away);
  const name = team(m.team).name;
  const one = history.points.length === 1;
  const sheet = history.source === "sheet";
  const now = before ? "now" : sheet ? "at the close" : "at kickoff";
  const moved = m.move === 0 ? "no change" : `${Math.abs(m.move)} point${Math.abs(m.move) === 1 ? "" : "s"} ${m.move > 0 ? "their way" : "against them"}`;

  return (
    <section aria-label="Odds" className="mt-3">
      <p className="text-[15px] leading-snug font-semibold text-ink">
        {one ? (
          <>
            {history.bookmaker} {sheet ? "opened" : before ? "has" : "had"} the {name} at <span className="font-score text-[18px]">{m.last}%</span>
            {sheet && !before ? "; the closing price isn’t reliable for this game." : "."}
          </>
        ) : (
          <>
            {history.bookmaker} opened the {name} at <span className="font-score text-[18px]">{m.first}%</span> and had them at{" "}
            <span className="font-score text-[18px]">{m.last}%</span> {now}: {moved}.
          </>
        )}
      </p>
      {m.lastLine != null && (
        <p className="mt-1 text-[14px] text-ink-2">
          Line: {name} <span className="font-score text-[16px] text-ink">{handicap(m.lastLine)}</span>
          {!one && m.firstLine != null && m.firstLine !== m.lastLine && (
            <>
              , from <span className="font-score text-[16px]">{handicap(m.firstLine)}</span> at opening
            </>
          )}
          .
        </p>
      )}
      {!one && <OddsChart history={history} team={m.team} isHome={m.team === home} />}
      <p className="mt-2 text-[12px] leading-snug text-ink-3">
        Head-to-head prices with the bookie&rsquo;s margin taken out.{" "}
        {sheet
          ? "From the aussportsbetting.com odds sheet: its opening and closing prices only."
          : `Every ${history.bookmaker} price the pipeline saw, through The Odds API.`}
      </p>
    </section>
  );
}

/* ---------- Elo: both teams going in ---------- */

/** "Round 12", or "the Grand Final" / "the Finals Week 1" reads as "the …" for a final. */
const intoRound = (round: number, title?: string) => {
  const name = roundName(round, title);
  return /^Round /.test(name) ? name : `the ${name}`;
};

const signed = (n: number) => `${Math.round(n) > 0 ? "+" : Math.round(n) < 0 ? "−" : ""}${Math.abs(Math.round(n))}`;

export function EloSection({ game, elo }: { game: Game; elo?: MatchElo }) {
  if (!elo) return <p className="mt-4 text-[14px] text-ink-3">No Elo ratings for this game yet.</p>;
  const { home, away } = elo;
  const colours = lineColours([home.team, away.team]);
  const gap = Math.round(home.rating) - Math.round(away.rating);
  const backs = elo.homeProb >= 0.5 ? home.team : away.team;
  const chance = Math.round((elo.homeProb >= 0.5 ? elo.homeProb : 1 - elo.homeProb) * 100);
  // The sample's ratings stop before its current round, so a game can be final without an "after".
  const graded = game.status === "final";

  const Side = ({ s, align }: { s: MatchElo["home"]; align: "left" | "right" }) => (
    <div className={align === "right" ? "text-right" : ""}>
      <p className={`flex items-center gap-1.5 text-[14px] font-semibold text-ink-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <TeamBadge name={s.team} size="sm" />
        {s.team}
      </p>
      <p className="mt-1.5 font-score text-[34px] leading-none font-bold text-ink">{Math.round(s.rating)}</p>
      <p className="mt-1 text-[13px] text-ink-3">
        {ordinal(s.rank)} of {elo.teamCount}
      </p>
      {graded && s.after && (
        <p className="mt-1 text-[13px] text-ink-2">
          After: <span className="font-score text-[15px] font-semibold text-ink">{Math.round(s.after.rating)}</span>{" "}
          <span className="font-score text-[15px]">({signed(s.after.change)})</span>
        </p>
      )}
    </div>
  );

  const rows: [string, ReactNode][] = [
    ["Rating gap", gap === 0 ? "Level" : <>{team(gap > 0 ? home.team : away.team).name} by <span className="font-score text-[17px] font-semibold text-ink">{Math.abs(gap)}</span></>],
    [
      "Home ground",
      elo.homeAdvantage === 0 ? "Neutral venue, so none" : <>{team(home.team).name} <span className="font-score text-[17px] font-semibold text-ink">+{elo.homeAdvantage}</span></>,
    ],
    ["Elo’s chance", <>{team(backs).name} <span className="font-score text-[17px] font-semibold text-ink">{chance}%</span></>],
  ];

  return (
    <section aria-label="Elo" className="mt-3">
      <p className="text-[13px] text-ink-3">
        Ratings going into {intoRound(game.match.round, game.match.roundTitle)}
        {elo.labels.length === 1 ? ", where every team starts the season" : ""}.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <Side s={home} align="left" />
        <Side s={away} align="right" />
      </div>

      <dl className="mt-4 border-t border-line-soft text-[14px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 border-b border-line-soft py-2">
            <dt className="text-ink-3">{k}</dt>
            <dd className="text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>

      {elo.labels.length > 1 && (
        <>
          <h3 className="mt-7 text-[16px] font-semibold text-ink">{elo.season} so far</h3>
          <EloMatchChart
            season={elo.season}
            labels={elo.labels}
            home={{ team: home.team, path: home.path, colour: colours[home.team] }}
            away={{ team: away.team, path: away.path, colour: colours[away.team] }}
          />
        </>
      )}

      <h3 className="mt-7 text-[16px] font-semibold text-ink">Last five games</h3>
      <div className="mt-2 grid gap-5 sm:grid-cols-2">
        {[home, away].map((s) => (
          <div key={s.team}>
            <p className="flex items-center gap-1.5 pb-2 text-[13px] font-semibold text-ink-2">
              <TeamBadge name={s.team} size="sm" />
              {s.team}
            </p>
            <ol className="border-t border-line-soft">
              {s.form.map((f) => (
                <li key={`${f.season}-${f.label}`} className="flex items-baseline gap-3 border-b border-line-soft py-2 text-[14px]">
                  <span className="w-10 shrink-0 font-score text-[16px] font-bold text-ink">{signed(f.change)}</span>
                  <span className="min-w-0 flex-1 text-ink-2">{f.text}</span>
                  <span className="shrink-0 text-[12px] text-ink-3">
                    {f.label === "Finals" ? "Finals" : f.label.replace("Round ", "R")}
                    {f.season !== elo.season && ` ${f.season}`}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <Link
        href={`/elo?season=${elo.season}&team=${encodeURIComponent(home.team)}#team`}
        className="mt-5 inline-flex items-center gap-1 text-[14px] font-semibold text-ink-2 hover:text-ink"
      >
        All Elo ratings
        <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden />
      </Link>
    </section>
  );
}
