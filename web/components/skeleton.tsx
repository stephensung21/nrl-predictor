// Loading skeletons for app/**/loading.tsx (docs/PLAN_PERF.md, Phase 1). Next.js shows one the moment a
// link is tapped, while the server renders the page, so a tap always answers at once instead of
// leaving the old page on screen. Each is the page's own frame in placeholder blocks: the heading and
// meta line, the lit board, hairline rows, the empty pitch field where a win-chance bar will be. Static,
// with no shimmer: DESIGN.md keeps motion for things that earn it. `data-loading` marks it for
// web/scripts/perf.mjs.

function Block({ className }: { className: string }) {
  return <span aria-hidden className={`block rounded-[4px] bg-raised-2 ${className}`} />;
}

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <main data-loading aria-busy="true">
      <p role="status" className="sr-only">
        Loading {label}
      </p>
      {children}
    </main>
  );
}

/** The page heading and its meta line (RoundHeading's spacing). */
function Heading({ wide = false }: { wide?: boolean }) {
  return (
    <div className="pt-4 pb-3">
      <Block className={`h-[26px] ${wide ? "w-56" : "w-40"}`} />
      <Block className="mt-2 h-[13px] w-32" />
    </div>
  );
}

/** The empty pitch: what a win-chance bar is before its fills. */
function Pitch({ lg = false }: { lg?: boolean }) {
  return <span aria-hidden className={`block rounded-[3px] bg-pitch ${lg ? "h-3.5" : "h-[7px]"}`} />;
}

/** Hairline rows of two lines; `pitch` adds a win-chance bar to each (game rows). */
function Rows({ count, pitch = false }: { count: number; pitch?: boolean }) {
  return (
    <ul aria-hidden className="divide-y divide-line-soft">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="py-3.5">
          <Block className={`h-4 ${i % 3 === 1 ? "w-3/5" : i % 3 === 2 ? "w-2/3" : "w-1/2"}`} />
          <Block className="mt-2 h-3 w-1/3" />
          {pitch && (
            <div className="mt-3">
              <Pitch />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The lit board (the margin game's, the match page's). */
function Board({ tall = false }: { tall?: boolean }) {
  return (
    <div aria-hidden className="mt-3 rounded-xl border border-line bg-raised px-4 py-4">
      <Block className="h-[13px] w-2/5" />
      <Block className="mt-3 h-[30px] w-3/5" />
      {tall && <Block className="mt-3 h-4 w-4/5" />}
      <div className="mt-4">
        <Pitch lg />
      </div>
    </div>
  );
}

/** Any page: a heading and rows. The site-wide fallback (app/loading.tsx). */
export function PageSkeleton() {
  return (
    <Frame label="the page">
      <Heading />
      <Rows count={6} />
    </Frame>
  );
}

/** A round: heading, the margin game's board, the other games (the home and round pages). */
export function RoundSkeleton() {
  return (
    <Frame label="the round">
      <Heading wide />
      <Board />
      <div className="mt-2">
        <Rows count={6} pitch />
      </div>
    </Frame>
  );
}

/** One game: the board, then its panels. */
export function MatchSkeleton() {
  return (
    <Frame label="the game">
      <Heading />
      <Board tall />
      <div className="mt-6">
        <Rows count={4} />
      </div>
    </Frame>
  );
}

/** The tipping page: each game's line and its two tip buttons. */
export function TipsSkeleton() {
  return (
    <Frame label="your tips">
      <Heading wide />
      <ul aria-hidden className="divide-y divide-line-soft border-t border-line-soft">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="py-3.5">
            <Block className="h-[13px] w-1/2" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <span className="block min-h-14 rounded-lg ring-1 ring-line ring-inset" />
              <span className="block min-h-14 rounded-lg ring-1 ring-line ring-inset" />
            </div>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

/** A data page: heading, a chart, rows (Elo, Model vs market, the Model). */
export function ChartSkeleton() {
  return (
    <Frame label="the page">
      <Heading wide />
      <div aria-hidden className="mt-2 h-[200px] rounded-lg bg-raised" />
      <div className="mt-4">
        <Rows count={5} />
      </div>
    </Frame>
  );
}
