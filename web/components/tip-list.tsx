"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Lock, Minus, Plus, X } from "lucide-react";
import type { GameStatus } from "@/lib/round";
import { team, type TeamName } from "@/lib/teams";
import { DEFAULT_MARGIN } from "@/lib/rules";
import { createTipStore, LockedError } from "@/lib/tip-store";
import { LocalTime } from "./local-time";
import { ModelBadge, TeamBadge } from "./team-badge";

export type TipGame = {
  matchId: string;
  home: TeamName;
  away: TeamName;
  kickoff: string;
  venue: string;
  status: GameStatus;
  featured: boolean;
  modelTip: TeamName;
  modelPct: number;
  /** Once final. */
  winners?: TeamName[];
  score?: [number, number];
  /** How the comp tipped, shown only after lockout (tips are hidden before kickoff). */
  tally?: { team: TeamName; count: number }[];
  tippers: number;
  /** What the viewer's auto-tip choice gives this game, if they leave it untipped past lockout. */
  autoTeam?: TeamName;
};

type Save = "saving" | "saved" | "error" | "locked";

const HINT_KEY = "rlt:showModelHint";

export function TipList({
  season,
  round,
  games,
  initialTips,
  initialMargin,
}: {
  season: number;
  round: number;
  games: TipGame[];
  /** The viewer's tips as the server knows them (sample: made up). */
  initialTips: Record<string, TeamName>;
  initialMargin: number | null;
}) {
  const locked = useMemo(() => new Set(games.filter((g) => g.status !== "upcoming").map((g) => g.matchId)), [games]);
  const store = useMemo(() => createTipStore((id) => locked.has(id)), [locked]);
  const [tips, setTips] = useState(initialTips);
  const [margin, setMargin] = useState<number | null>(initialMargin);
  const [saves, setSaves] = useState<Record<string, Save>>({});
  const [showHint, setShowHint] = useState(true);
  const timers = useRef<Record<string, number>>({});

  useEffect(() => {
    store.load(season, round).then((saved) => {
      if (!saved) return;
      // Saved tips win for open games; locked games keep what was in at lockout.
      setTips((t) => ({ ...t, ...Object.fromEntries(Object.entries(saved.tips).filter(([id]) => !locked.has(id))) }));
      setMargin(saved.margin);
    });
    try {
      setShowHint(window.localStorage.getItem(HINT_KEY) !== "0");
    } catch {}
  }, [store, season, round, locked]);

  const flash = (key: string, state: Save) => {
    setSaves((s) => ({ ...s, [key]: state }));
    window.clearTimeout(timers.current[key]);
    if (state === "saved") timers.current[key] = window.setTimeout(() => setSaves((s) => ({ ...s, [key]: undefined as never })), 1800);
  };

  async function pick(g: TipGame, t: TeamName) {
    if (locked.has(g.matchId) || tips[g.matchId] === t) return;
    const before = tips[g.matchId];
    setTips((x) => ({ ...x, [g.matchId]: t }));
    flash(g.matchId, "saving");
    try {
      await store.setTip(season, round, g.matchId, t);
      flash(g.matchId, "saved");
    } catch (e) {
      setTips((x) => ({ ...x, [g.matchId]: before as TeamName }));
      flash(g.matchId, e instanceof LockedError ? "locked" : "error");
    }
  }

  async function changeMargin(next: number | null) {
    setMargin(next);
    flash("margin", "saving");
    try {
      await store.setMargin(season, round, next);
      flash("margin", "saved");
    } catch {
      flash("margin", "error");
    }
  }

  function toggleHint() {
    setShowHint((v) => {
      try {
        window.localStorage.setItem(HINT_KEY, v ? "0" : "1");
      } catch {}
      return !v;
    });
  }

  const open = games.filter((g) => !locked.has(g.matchId));
  const tipped = games.filter((g) => tips[g.matchId]).length;
  const nextLock = open[0];

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-4 pb-1">
        <h1 className="font-display text-[26px] leading-none font-bold uppercase">Round {round} tips</h1>
        <p className="text-[13px] font-medium text-ink-3">
          <span className={tipped < games.length ? "font-semibold text-ink" : ""}>
            <span className="font-score">{tipped}</span> of <span className="font-score">{games.length}</span> tipped
          </span>
          {nextLock && (
            <>
              <span className="mx-1.5">·</span>
              Next lockout <LocalTime iso={nextLock.kickoff} />
            </>
          )}
        </p>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 border-y border-line-soft py-2.5">
        <span id="hint-label" className="flex items-center gap-2 text-[14px] text-ink-2">
          <ModelBadge size="sm" />
          Show the Model&rsquo;s pick
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={showHint}
          aria-labelledby="hint-label"
          onClick={toggleHint}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${showHint ? "bg-ink-2" : "bg-raised-2 ring-1 ring-line ring-inset"}`}
        >
          <span
            className={`absolute top-1 left-1 size-5 rounded-full bg-ground transition-transform duration-200 ease-[var(--ease-out-expo)] ${showHint ? "translate-x-5" : ""}`}
          />
        </button>
      </div>

      <ul className="divide-y divide-line-soft">
        {games.map((g) => (
          <TipRow
            key={g.matchId}
            game={g}
            tip={tips[g.matchId]}
            save={saves[g.matchId]}
            locked={locked.has(g.matchId)}
            showHint={showHint}
            onPick={(t) => pick(g, t)}
          >
            {g.featured && (
              <MarginInput
                game={g}
                tip={tips[g.matchId]}
                margin={margin}
                locked={locked.has(g.matchId)}
                save={saves.margin}
                onChange={changeMargin}
              />
            )}
          </TipRow>
        ))}
      </ul>
    </>
  );
}

function SaveNote({ save }: { save?: Save }) {
  const text = { saving: "Saving…", saved: "Saved", error: "Couldn’t save. Tap again.", locked: "Locked at kickoff" };
  return (
    <span aria-live="polite" className={`text-[12px] font-semibold ${save === "error" || save === "locked" ? "text-miss" : "text-ink-3"}`}>
      {save && (
        <span className="inline-flex items-center gap-1">
          {save === "saved" && <Check className="size-3.5" strokeWidth={2.5} aria-hidden />}
          {text[save]}
        </span>
      )}
    </span>
  );
}

function TipRow({
  game: g,
  tip,
  save,
  locked,
  showHint,
  onPick,
  children,
}: {
  game: TipGame;
  tip?: TeamName;
  save?: Save;
  locked: boolean;
  showHint: boolean;
  onPick: (t: TeamName) => void;
  children?: React.ReactNode;
}) {
  const final = g.status === "final";
  const right = final && tip ? g.winners!.includes(tip) : undefined;

  return (
    <li className="py-3.5">
      <div className="flex items-center justify-between gap-3 text-[13px] text-ink-3">
        <span className="flex min-w-0 items-center truncate whitespace-nowrap">
          {g.featured && <span className="font-semibold text-ink-2">Margin game<span className="mx-1.5 font-normal text-ink-3">·</span></span>}
          {locked ? (
            <span className="flex items-center gap-1">
              <Lock className="size-3.5" aria-hidden />
              {final ? "Full time" : g.status === "live" ? "Live" : g.status === "postponed" ? "Postponed" : "Locked"}
            </span>
          ) : (
            <LocalTime iso={g.kickoff} />
          )}
          <span className="mx-1.5">·</span>
          {g.venue}
        </span>
        <SaveNote save={save} />
      </div>

      <div role="group" aria-label={`${g.home} v ${g.away}`} className="mt-2 grid grid-cols-2 gap-2">
        {([g.home, g.away] as const).map((t, i) => {
          const chosen = tip === t;
          const won = final && g.winners!.includes(t);
          return (
            <button
              key={t}
              type="button"
              aria-pressed={chosen}
              disabled={locked}
              onClick={() => onPick(t)}
              className={`flex min-h-14 items-center gap-2.5 rounded-lg px-3 text-left text-[15px] font-semibold transition-[background-color,box-shadow] ${
                chosen
                  ? locked
                    ? right === false
                      ? "bg-miss-wash text-ink ring-1 ring-miss/60 ring-inset"
                      : "bg-lime-wash text-ink ring-1 ring-lime/50 ring-inset"
                    : "bg-lime-wash text-ink ring-2 ring-lime ring-inset"
                  : locked
                    ? "text-ink-3 ring-1 ring-line-soft ring-inset"
                    : "text-ink-2 ring-1 ring-line ring-inset hover:bg-raised hover:text-ink"
              } ${i === 1 ? "flex-row-reverse text-right" : ""}`}
            >
              <TeamBadge name={t} size="md" dim={locked && !chosen} />
              <span
                className={`min-w-0 flex-1 leading-tight ${chosen && right === false ? "line-through decoration-miss decoration-2" : ""}`}
              >
                {t}
                {final && <span className="ml-1.5 font-score text-[17px] text-ink-3">{g.score![i]}</span>}
              </span>
              {chosen && !locked && <Check className="tick-pop size-5 shrink-0 text-lime" strokeWidth={3} aria-hidden />}
              {chosen && right === true && <Check className="size-5 shrink-0 text-lime" strokeWidth={3} aria-label="Right" />}
              {chosen && right === false && <X className="size-5 shrink-0 text-miss" strokeWidth={3} aria-label="Wrong" />}
              {won && !chosen && <span className="sr-only">(won)</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex min-h-5 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px] text-ink-3">
        {showHint ? (
          <span>
            Model: <span className="font-semibold text-ink-2">{g.modelTip}</span>{" "}
            <span className="font-score text-[14px] text-ink-2">{g.modelPct}%</span>
          </span>
        ) : (
          <span />
        )}
        {g.tally && (
          <span>
            {g.tally
              .filter((x) => x.count > 0)
              .map((x) => `${x.count} of ${g.tippers} on ${team(x.team).code}`)
              .join(" · ")}
          </span>
        )}
        {locked && !tip && g.autoTeam && (
          <span className="text-ink-2">
            Not tipped. Auto-tip: <span className="font-semibold">{g.autoTeam}</span>
          </span>
        )}
      </div>

      {children}
    </li>
  );
}

/** "Roosters won by 14. You were 4 off." A wrong-team margin counts against you. */
function marginResult(g: TipGame, tip: TeamName, margin: number) {
  const [h, a] = g.score!;
  const actual = h - a;
  const predicted = tip === g.home ? margin : -margin;
  const winner = actual === 0 ? null : actual > 0 ? g.home : g.away;
  const off = Math.abs(predicted - actual);
  return `${winner ? `${winner} won by ${Math.abs(actual)}` : "A draw"}. ${off === 0 ? "Spot on." : `You were ${off} off.`}`;
}

function MarginInput({
  game,
  tip,
  margin,
  locked,
  save,
  onChange,
}: {
  game: TipGame;
  tip?: TeamName;
  margin: number | null;
  locked: boolean;
  save?: Save;
  onChange: (m: number | null) => void;
}) {
  const value = margin ?? DEFAULT_MARGIN;
  const step = (d: number) => onChange(Math.min(99, Math.max(1, value + d)));
  const disabled = locked || !tip;
  const btn = "grid size-11 place-items-center rounded-full ring-1 ring-line ring-inset text-ink-2 hover:text-ink disabled:text-ink-3/40 disabled:hover:text-ink-3/40";

  return (
    <div className="mt-3 rounded-lg bg-raised px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="margin" className="text-[14px] font-semibold text-ink">
          {tip ? (
            <>
              {tip} by<span className="sr-only"> how many points</span>
            </>
          ) : (
            "Winning margin"
          )}
        </label>
        <div className="flex items-center gap-2">
          <button type="button" className={btn} disabled={disabled || value <= 1} onClick={() => step(-1)} aria-label="One point less">
            <Minus className="size-4" aria-hidden />
          </button>
          <input
            id="margin"
            type="number"
            inputMode="numeric"
            min={1}
            max={99}
            disabled={disabled}
            value={value}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= 99) onChange(n);
            }}
            className="h-11 w-14 rounded-md bg-ground text-center font-score text-[24px] font-bold text-ink ring-1 ring-line ring-inset [appearance:textfield] focus:ring-2 focus:ring-lime focus:outline-none disabled:text-ink-3 [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button type="button" className={btn} disabled={disabled || value >= 99} onClick={() => step(1)} aria-label="One point more">
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <p className="mt-1.5 flex items-center justify-between gap-3 text-[12px] text-ink-3">
        <span>
          {game.status === "final" && tip
            ? marginResult(game, tip, value)
            : !tip
            ? "Pick a team first."
            : margin == null
              ? `Leave it and ${DEFAULT_MARGIN} applies. Closest margin breaks ladder ties.`
              : "Closest margin breaks ladder ties."}
        </span>
        <SaveNote save={save} />
      </p>
    </div>
  );
}
