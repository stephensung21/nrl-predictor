import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ModelBadge } from "@/components/team-badge";
import { SERIES } from "@/lib/odds";

export const metadata: Metadata = { title: "How the Model works · rugbyleague-tipper" };

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
  { name: "The Model (with odds)", logLoss: 0.622 },
  { name: "The Model without odds", logLoss: 0.627 },
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
  const pct = (x: number) => `${Math.round(x * 100)}%`;
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
          A machine-learning model that gives every game a chance to win, a winning margin and a total score, which together
          make its predicted score. Its tip is whichever team it gives the better chance, so the score it shows always agrees
          with the tip.
        </p>
        <p>
          It&rsquo;s also a tipper in the comp. Every round it tips its prediction from just before kickoff, and it never forgets
          a game, so it never needs an auto-tip.
        </p>
      </Section>

      <Section id="inputs" title="What goes in">
        <ul className="list-disc space-y-2 pl-5 marker:text-ink-3">
          <li>
            <span className="font-semibold text-ink">Recent form</span> from every game&rsquo;s results and match stats since 2020:
            points, metres, line breaks, errors and the like.
          </li>
          <li>
            <span className="font-semibold text-ink">Elo ratings</span> built from every result since 2009, which say how
            strong each team is right now.
          </li>
          <li>
            <span className="font-semibold text-ink">Tuesday&rsquo;s team lists:</span> a rating for every player from how his
            teams have gone with him on the field, plus who&rsquo;s missing from the spine and whether stars are out.
          </li>
          <li>
            <span className="font-semibold text-ink">The situation:</span> rest days, travel and whether a team is at its own
            ground.
          </li>
          <li>
            <span className="font-semibold text-ink">The bookies&rsquo; opening prices,</span> for the main Model only.
          </li>
        </ul>
      </Section>

      <Section id="versions" title="Two versions">
        <p>
          The <span className="font-semibold text-ink">main Model</span> uses the bookies&rsquo; opening prices as one of its
          inputs. It&rsquo;s the more accurate one, so it&rsquo;s the one that tips in the comp and the one on the Round page.
        </p>
        <p>
          The <span className="font-semibold text-ink">Model without odds</span> never sees a price, so it&rsquo;s an independent
          opinion of the bookies. That&rsquo;s the one on the{" "}
          <Link href="/odds" className="font-semibold text-ink underline decoration-line">
            Model vs market
          </Link>{" "}
          page.
        </p>
      </Section>

      <Section id="tested" title="How it was tested">
        <p>
          It was only ever judged on seasons it never saw while it was being built. On 2023&ndash;25 its win chances were more
          accurate than Elo&rsquo;s and the bookies&rsquo; opening prices, though it tipped no more winners than the opening
          favourite, and the closing prices were slightly more accurate still. Then, with everything fixed in advance, it predicted the whole 2026 season once.
        </p>
      </Section>
      <dl className="mt-4 grid max-w-[40rem] grid-cols-3 border-y border-line-soft">
        {(
          [
            ["model", "The Model", TEST_2026[0].accuracy, true],
            ["market", "Bookies’ favourite", TEST_2026[3].accuracy, false],
            ["elo", "Elo", TEST_2026[4].accuracy, false],
          ] as const
        ).map(([k, label, acc, main]) => (
          <div key={label} className="py-3 pr-2">
            {/* The same comparison as /model and /odds, so the same series keys. */}
            <dt className="flex min-h-[2lh] items-start gap-1.5 text-[12px] leading-tight text-ink-3">
              <span className="mt-[0.45em] h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: SERIES[k].colour }} aria-hidden />
              {label}
            </dt>
            <dd className={`mt-1 font-display text-[30px] leading-none font-bold ${main ? "text-ink" : "text-ink-2"}`}>
              {pct(acc)}
            </dd>
            <dd className="mt-0.5 text-[12px] text-ink-3">of 2026 winners</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-ink-2">
        Its win chances were as accurate as the bookies&rsquo; closing prices, the market&rsquo;s sharpest numbers. That&rsquo;s
        level with the best there is, not ahead of it. The Model is frozen before each season and only its inputs update week to
        week: refitting it every week was tested, made no clear difference, and was worse late in the season.
      </p>

      <Section id="limits" title="Where it falls down">
        <ul className="list-disc space-y-2 pl-5 marker:text-ink-3">
          <li>
            <span className="font-semibold text-ink">It&rsquo;s wrong about a third of the time.</span> A 70% favourite still
            loses three games in ten.
          </li>
          <li>
            <span className="font-semibold text-ink">The bookies are hard to beat.</span> Over 2026 it matched their closing
            prices, and over 2023&ndash;25 the closing prices were slightly better. It hasn&rsquo;t beaten the market at its
            sharpest.
          </li>
          <li>
            <span className="font-semibold text-ink">Late changes.</span> The main prediction comes from Tuesday&rsquo;s lists.
            It updates through the week, but a change an hour before kickoff can beat the last update.
          </li>
          <li>
            <span className="font-semibold text-ink">Weather</span> isn&rsquo;t known on Tuesday, so the predicted total
            doesn&rsquo;t allow for rain.
          </li>
          <li>
            <span className="font-semibold text-ink">Not much data.</span> A season is only about 200 games, and a new club
            like the Perth Bears starts with no history at all, so its early predictions will be rough.
          </li>
          <li>
            <span className="font-semibold text-ink">It only knows the numbers.</span> Mid-week injuries that aren&rsquo;t on a
            team list, a coach under pressure or a dead-rubber round are invisible to it.
          </li>
        </ul>
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
            <span className="font-semibold text-ink">Features.</span> Elo and a team margin rating; rolling form from match
            stats; context (rest, travel, venue, finals); player ratings (an adjusted plus-minus per player, summed over the named
            17, with spine changes and absences); and, for the main version, the odds. Everything about a game is built only from
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
