// Time formatting that works on the server and in the browser. Times are stored in UTC.

const FORMATS = {
  /** Fri 6:00pm */
  dayTime: { weekday: "short", hour: "numeric", minute: "2-digit" },
  /** 6:00pm */
  time: { hour: "numeric", minute: "2-digit" },
  /** Fri */
  weekday: { weekday: "short" },
  /** Fri 8 May */
  day: { weekday: "short", day: "numeric", month: "short" },
  /** Tue 12 May 5:15pm */
  dayDateTime: { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type TimeFormat = keyof typeof FORMATS;

export function formatTime(iso: string, format: TimeFormat, timeZone?: string) {
  return new Intl.DateTimeFormat("en-AU", { ...FORMATS[format], timeZone })
    .format(new Date(iso))
    .replace(/\s?(am|pm)/i, (m) => m.trim().toLowerCase())
    .replace(",", "");
}

/** Sydney time, the comp's clock (admin and run logs are read against it). */
export const sydney = (iso: string, format: TimeFormat = "dayTime") => formatTime(iso, format, "Australia/Sydney");

/**
 * The page's clock, in ms, running on from `nowIso`: real time on the live site, the sample's fixed
 * instant on the sample site (where real time is long past its kickoffs). Client components use it to
 * decide what has locked, so the sample stays open however long after its round it's viewed.
 */
export function clockFrom(nowIso: string): () => number {
  const skew = Date.parse(nowIso) - Date.now();
  return () => Date.now() + skew;
}
