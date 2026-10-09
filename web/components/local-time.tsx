"use client";

import { useEffect, useState } from "react";

const FORMATS = {
  /** Fri 6:00pm */
  dayTime: { weekday: "short", hour: "numeric", minute: "2-digit" },
  /** 6:00pm */
  time: { hour: "numeric", minute: "2-digit" },
  /** Fri */
  weekday: { weekday: "short" },
  /** Fri 8 May */
  day: { weekday: "short", day: "numeric", month: "short" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type TimeFormat = keyof typeof FORMATS;

export function formatTime(iso: string, format: TimeFormat, timeZone?: string) {
  return new Intl.DateTimeFormat("en-AU", { ...FORMATS[format], timeZone })
    .format(new Date(iso))
    .replace(/\s?(am|pm)/i, (m) => m.trim().toLowerCase())
    .replace(",", "");
}

/** Shows a time in the viewer's zone. Renders Sydney time on the server, then
 *  switches to the browser's zone once mounted. */
export function LocalTime({ iso, format = "dayTime" }: { iso: string; format?: TimeFormat }) {
  const [text, setText] = useState(() => formatTime(iso, format, "Australia/Sydney"));
  useEffect(() => setText(formatTime(iso, format)), [iso, format]);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
