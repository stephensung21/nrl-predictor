import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ModelBadge } from "@/components/team-badge";
import { CompareBars, FlowDiagram, IconList } from "@/components/art/diagrams";
import { Pictogram } from "@/components/art/pictogram";

export const metadata: Metadata = { title: "How the Model works · Full Credit" };

// Every figure on this page comes from the project's reports: reports/final_2026.md (the 2026
// test season, all 213 games) and reports/backtest.md (2023-25). Nothing here is sample data.
const TEST_2026 = [
  { name: "The Model (with odds)", logLoss: 0.6516, brier: 0.2289, accuracy: 0.6714, main: true },
  { name: "The Model without odds", logLoss: 0.6553, brier: 0.2306, accuracy: 0.6291 },
  { name: "Bookies’ closing price", logLoss: 0.653, brier: 0.2286, accuracy: 0.615 },
  { name: "Bookies’ opening price", logLoss: 0.6632, brier: 0.2342, accuracy: 0.6244 },
  { name: "Elo", logLoss: 0.66, brier: 0.2333, accuracy: 0.6244 },
  { name: "Always the home team", logLoss: 0.6903, brier: 0.2486, accuracy: 0.5446 },
];
const BACKTEST = [
  { name: "The Model (with odds)", logLoss: 0.621 },
  { name: "The Model without odds", logLoss: 0.626 },
  { name: "Bookies’ opening price", logLoss: 0.633 },
  { name: "Elo", logLoss: 0.638 },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-9">
      <h2 id={id} className="font-display text-[24px] leading-none font-bold uppercase">
        {title}
      </h2>
      <div className="mt-3 max-w-[60ch] space-y-3 text-[16px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <main>
      <div className="pt-4">
        <h1 className="flex items-center gap-2.5 font-display text-[26px] leading-none font-bold uppercase">
          <ModelBadge size="md" />
          How the Model works
        </h1>
        <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-ink">
          It predicts every NRL game from results, team lists and player form, and it&rsquo;s graded against the bookies and Elo
          every week, losses included.
        </p>
      </div>

      <Link
        href="/model"
        className="group mt-5 flex items-center justify-between gap-3 border-y border-line-soft py-3.5 text-[15px] font-semibold text-ink"
      >
        See how it&rsquo;s going this season
        <ChevronRight className="size-5 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>

      <Section id="what" title="What it is">
        <p>
          A machine-learning model that gives every game a win chance, a margin and a total, which together make its predicted
          score. It tips whichever team it gives the better chance, and it&rsquo;s a tipper in the comp too: it tips its last
          prediction before kickoff and never forgets a game.
        </p>
      </Section>

      <Section id="inputs" title="What goes in">
        <FlowDiagram
          label="What goes into the Model and what comes out"
          inputs={[
            { icon: "ratings", title: "Team ratings", note: "Elo and a margin rating, from every result since 2009" },
            { icon: "lineup", title: "Tuesday’s team lists", note: "A rating for every player, the spine, stars out" },
            { icon: "calendar", title: "The situation", note: "Rest, travel, home ground, Origin, a wet ground" },
            { icon: "tag", title: "Opening prices", note: "The bookies’ first line: the main Model only" },
          ]}
          centre={{ title: "The Model", note: "Frozen before the season" }}
          outputs={[
            { icon: "dial", title: "Win chance", note: "Roosters 74%" },
            { icon: "short-bars", title: "Margin and total", note: "So a score: 32–18" },
            { icon: "tick", title: "Its tip", note: "Always the team it backs" },
          ]}
        />
      </Section>

      <Section id="versions" title="Two versions">
        <ul className="mt-1 grid gap-x-6 gap-y-4 border-y border-line-soft py-4 sm:grid-cols-2">
          <li className="flex items-start gap-3">
            <Pictogram name="tag" size={32} className="text-ink-2" />
            <span>
              <span className="block font-semibold text-ink">With odds: the main Model</span>
              <span className="block text-[14px] leading-snug text-ink-2">The more accurate one. It tips in the comp and shows on the Round page.</span>
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Pictogram name="hidden" size={32} className="text-ink-2" />
            <span>
              <span className="block font-semibold text-ink">Without odds</span>
              <span className="block text-[14px] leading-snug text-ink-2">
                Never sees a price, so it&rsquo;s an independent opinion of the bookies: the one on{" "}
                <Link href="/odds" className="font-semibold text-ink underline decoration-line">
                  Model vs market
                </Link>
                .
              </span>
            </span>
          </li>
        </ul>
      </Section>

      <Section id="tested" title="How it was tested">
        <p>
          Only ever on seasons it never saw while being built: 2023&ndash;25, then the whole 2026 season, predicted once with
          everything fixed in advance.
        </p>
        <CompareBars
          caption="Winners tipped in 2026, all 213 games, from a coin toss (50%)"
          min={50}
          max={75}
          rows={[
            { label: "The Model", value: Math.round(TEST_2026[0].accuracy * 100), series: "model" },
            { label: "Bookies’ favourite", value: Math.round(TEST_2026[3].accuracy * 100), series: "market" },
            { label: "Elo", value: Math.round(TEST_2026[4].accuracy * 100), series: "elo" },
          ]}
        />
        <p>
          Its win chances matched the bookies&rsquo; closing prices, the market&rsquo;s sharpest: level with the best, not ahead.
          It&rsquo;s frozen before each season; refitting it every week made no clear difference.
        </p>
      </Section>

      <Section id="limits" title="Where it falls down">
        <IconList
          className="text-[15px]"
          items={[
            { icon: "cross", title: "It’s wrong about a third of the time.", note: "A 70% favourite still loses three games in ten." },
            {
              icon: "tag",
              title: "The bookies are hard to beat.",
              note: "Over 2026 it matched their closing prices; over 2023–25 the closing prices were slightly better. It hasn’t beaten the market at its sharpest.",
            },
            { icon: "swap", title: "Late changes.", note: "It predicts from Tuesday’s lists and updates through the week, but a change an hour before kickoff can beat the last update." },
            { icon: "rain", title: "Weather.", note: "It isn’t known on Tuesday, so the predicted total doesn’t allow for rain." },
            { icon: "short-bars", title: "Not much data.", note: "About 200 games a season, and a new club like the Perth Bears starts with no history, so its early predictions will be rough." },
            { icon: "question", title: "It only knows the numbers.", note: "Mid-week injuries not on a team list, a coach under pressure or a dead rubber are invisible to it." },
          ]}
        />
      </Section>

      <details className="group mt-10 border-y border-line-soft">
        <summary className="flex cursor-pointer list-none items-center justify-between py-3.5 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
          The technical details
          <ChevronRight className="size-5 text-ink-3 transition-transform group-open:rotate-90" aria-hidden />
        </summary>
        <div className="max-w-[60ch] space-y-3 pb-5 text-[15px] leading-relaxed text-ink-2">
          <p>
            <span className="font-semibold text-ink">Models.</span> Each version is an ensemble: the average of a regularised
            linear model and a LightGBM model. There are three targets: home win (a probability), margin and total points. The
            main version adds the opening price, line and total as inputs.
          </p>
          <p>
            <span className="font-semibold text-ink">Features.</span> Elo and a team margin rating; player ratings (an adjusted
            plus-minus per player, summed over the named 17, with rookies, missing regulars and star absences); context (rest,
            travel, neutral venue, the Origin period, a wet ground); and, for the main version, the odds. Everything about a game is built only from
            what was known before it.
          </p>
          <p>
            <span className="font-semibold text-ink">Freezing.</span> Before each season the models are refitted once on
            every season since 2021 and frozen; during the season only the features update.
          </p>
          <p>
            <span className="font-semibold text-ink">2026 test season</span> (all 213 games, run once). Lower log loss and Brier
            score are better.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-line text-[12px] text-ink-3">
                  <th scope="col" className="py-1.5 pr-3 font-semibold">
                    Forecaster
                  </th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
                    Log loss
                  </th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
                    Brier
                  </th>
                  <th scope="col" className="py-1.5 text-right font-semibold">
                    Tips right
                  </th>
                </tr>
              </thead>
              <tbody className="font-score text-[15px]">
                {TEST_2026.map((r) => (
                  <tr key={r.name} className="border-b border-line-soft">
                    <th scope="row" className={`py-1.5 pr-3 text-left font-sans text-[14px] ${r.main ? "font-semibold text-ink" : "font-normal text-ink-2"}`}>
                      {r.name}
                    </th>
                    <td className="py-1.5 pr-3 text-right text-ink-2">{r.logLoss.toFixed(4)}</td>
                    <td className="py-1.5 pr-3 text-right text-ink-2">{r.brier.toFixed(4)}</td>
                    <td className="py-1.5 text-right text-ink-2">{(r.accuracy * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            <span className="font-semibold text-ink">2023&ndash;25 backtest</span> (each season predicted by models built only on
            the seasons before it), log loss:{" "}
            {BACKTEST.map((b, i) => (
              <span key={b.name}>
                {b.name.replace("The Model", "the Model").replace("Bookies", "bookies").replace("Elo", "Elo")}{" "}
                <span className="font-score text-[16px] text-ink">{b.logLoss.toFixed(3)}</span>
                {i < BACKTEST.length - 1 ? "; " : "."}
              </span>
            ))}
          </p>
          <p className="text-[13px] text-ink-3">Source: the project&rsquo;s reports (final_2026.md and backtest.md).</p>
        </div>
      </details>
    </main>
  );
}
