// r/nrl posts for /news. Pages use only the NewsSource interface: the saved sample
// now, the Reddit API later (an OAuth app, cached about 10 minutes, low volume;
// PLAN_WEB.md §3.6). A live source hides NSFW and removed posts and supplies each
// post's real flair (Reddit's `link_flair_text`, which can be empty).

export type NewsPost = {
  id: string;
  title: string;
  /** The r/nrl thread. */
  link: string;
  /** The site a link post points to (e.g. "smh.com.au"); null for text posts. */
  domain: string | null;
  published: string;
  /** Null when the post has no flair. */
  flair: string | null;
};

export type NewsFeed = { posts: NewsPost[]; fetchedAt: string };

export interface NewsSource {
  /** Posts (newest first) and when they were fetched, from the same fetch. Throws if unreachable. */
  load(): Promise<NewsFeed>;
  /** The sample says what it is; a live source has no note. */
  sample?: { flairsGuessed: boolean; note: string };
}

class SampleNewsSource implements NewsSource {
  sample = {
    flairsGuessed: true,
    note: "A saved snapshot of r/nrl from the off-season, after the grand final. The headlines, links and times are real; the flairs are guessed from the titles until the Reddit API is connected.",
  };
  async load() {
    const { SAMPLE_NEWS, SNAPSHOT_AT } = await import("./sample-news");
    return { posts: SAMPLE_NEWS, fetchedAt: SNAPSHOT_AT };
  }
}

export function createNewsSource(): NewsSource {
  return new SampleNewsSource();
}

/** A post's flair for filtering and display. */
export const flairLabel = (p: NewsPost) => p.flair ?? "No flair";

/** Flairs in the order the filter shows them: most common first. */
export function flairsOf(posts: NewsPost[]) {
  const count = new Map<string, number>();
  for (const p of posts) count.set(flairLabel(p), (count.get(flairLabel(p)) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([flair, n]) => ({ flair, n }));
}

/** How a linked site reads in the meta line ("i.redd.it" is Reddit's own image host). */
export const domainLabel = (d: string | null) => (d == null ? null : d === "i.redd.it" ? "image" : d);
