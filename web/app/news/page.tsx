import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, RotateCw } from "lucide-react";
import { SampleNote } from "@/components/sample-note";
import { createNewsSource, domainLabel, flairLabel, flairsOf, type NewsFeed } from "@/lib/news";
import { sydney } from "@/lib/time";

export const metadata: Metadata = { title: "News · rugbyleague-tipper" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

/** Empty and error states are one of the places the brief allows a little banter. */
function Quiet({ title, body, retry }: { title: string; body: string; retry: string }) {
  return (
    <section className="pt-16 pb-8">
      <h1 className="font-display text-[52px] leading-[0.9] font-bold uppercase">{title}</h1>
      <p className="mt-4 max-w-[34ch] text-[16px] leading-relaxed text-ink-2">{body}</p>
      <a
        href={retry}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-lime px-5 py-3 text-[15px] font-bold text-lime-ink hover:bg-[oklch(0.94_0.19_126)]"
      >
        <RotateCw className="size-4" strokeWidth={2.5} aria-hidden />
        Try again
      </a>
    </section>
  );
}

export default async function NewsPage({ searchParams }: Props) {
  const source = createNewsSource();
  const q = await searchParams;
  const wanted = q.flair;
  // The sample can show its error and empty states for review; a live source can't be forced.
  const forced = source.sample ? q.sample : undefined;
  const here = wanted ? `/news?flair=${encodeURIComponent(wanted)}` : "/news";
  let feed: NewsFeed | null = null;
  try {
    feed = forced === "error" ? null : await source.load();
    if (feed && forced === "empty") feed = { ...feed, posts: [] };
  } catch {
    feed = null;
  }
  const states = (on: string | undefined) =>
    source.sample && (
      <SampleNote
        states={[
          { href: "/news", label: "Feed", on: !on },
          { href: "/news?sample=empty", label: "Empty", on: on === "empty" },
          { href: "/news?sample=error", label: "Can't reach Reddit", on: on === "error" },
        ]}
      >
        {source.sample.note}
      </SampleNote>
    );

  if (!feed) {
    return (
      <main>
        <Quiet title={"Reddit’s gone quiet."} body={"Couldn’t reach r/nrl just now. It’s usually back in a minute."} retry={here} />
        {states(forced)}
      </main>
    );
  }
  if (feed.posts.length === 0) {
    return (
      <main>
        <Quiet title="Nothing doing." body="r/nrl has nothing new right now. Must be the off-season." retry={here} />
        {states(forced)}
      </main>
    );
  }

  const { posts, fetchedAt } = feed;
  const flairs = flairsOf(posts);
  const known = !wanted || flairs.some((f) => f.flair === wanted);
  const active = wanted && known ? wanted : undefined;
  const shown = active ? posts.filter((p) => flairLabel(p) === active) : posts;
  const chip = (on: boolean) =>
    `inline-flex min-h-9 items-center rounded-full px-3 text-[13px] font-semibold whitespace-nowrap transition-colors ${
      on ? "bg-ink text-ground" : "text-ink-2 ring-1 ring-line ring-inset hover:text-ink hover:ring-ink-3"
    }`;

  return (
    <main>
      <div className="pt-4">
        <h1 className="font-display text-[26px] leading-none font-bold uppercase">News</h1>
        <p className="mt-1.5 text-[13px] text-ink-3">
          From r/nrl · fetched {sydney(fetchedAt, "dayDateTime")}
          {source.sample?.flairsGuessed && " · flairs guessed"}
        </p>
      </div>

      <nav aria-label="Filter by flair" className="mt-4 -mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-1">
          <li>
            <Link href="/news" scroll={false} aria-current={!active && known ? "page" : undefined} className={chip(!active && known)}>
              All <span className="ml-1 font-normal opacity-70">{posts.length}</span>
              <span className="sr-only"> posts</span>
            </Link>
          </li>
          {flairs.map((f) => (
            <li key={f.flair}>
              <Link
                href={`/news?flair=${encodeURIComponent(f.flair)}`}
                scroll={false}
                aria-current={active === f.flair ? "page" : undefined}
                className={chip(active === f.flair)}
              >
                {f.flair} <span className="ml-1 font-normal opacity-70">{f.n}</span>
                <span className="sr-only"> posts</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!known ? (
        <p className="mt-4 border-y border-line-soft py-4 text-[15px] text-ink-2">
          No &ldquo;{wanted}&rdquo; posts in this feed.{" "}
          <Link href="/news" className="font-semibold text-ink underline decoration-line">
            Show all {posts.length}
          </Link>
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line-soft border-y border-line-soft">
          {shown.map((p) => (
            <li key={p.id}>
              <a href={p.link} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] leading-snug font-semibold text-ink group-hover:underline">{p.title}</span>
                  <span className="mt-1 block text-[12px] text-ink-3">
                    {flairLabel(p)} · {sydney(p.published, "dayTime")}
                    {domainLabel(p.domain) && <> · {domainLabel(p.domain)}</>}
                  </span>
                </span>
                <ExternalLink className="mt-1 size-4 shrink-0 text-ink-3" aria-hidden />
                <span className="sr-only"> (opens Reddit in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {states(forced)}
    </main>
  );
}
