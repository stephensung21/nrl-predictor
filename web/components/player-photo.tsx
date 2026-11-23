"use client";

// A player's headshot, loaded straight from nrl.com (only the link is stored: pipeline/players.py).
// No link, or a link that fails, shows his team's badge in the same space instead.

import { useState } from "react";
import { TeamBadge } from "@/components/team-badge";
import type { TeamName } from "@/lib/teams";

const SIZE = { sm: "size-10", lg: "size-14" };

export function PlayerPhoto({ src, team, size = "sm" }: { src: string | null; team: TeamName; size?: keyof typeof SIZE }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center ${SIZE[size]}`}>
        <TeamBadge name={team} size={size === "lg" ? "md" : "sm"} />
      </span>
    );
  }
  return (
    // A plain img, not next/image: the optimiser would download and re-serve nrl.com's photos.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full bg-raised-2 object-cover ring-1 ring-line ${SIZE[size]}`}
    />
  );
}
