"use client";

import { useEffect, useState } from "react";
import { formatTime, type TimeFormat } from "@/lib/time";

export { formatTime, type TimeFormat };

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
