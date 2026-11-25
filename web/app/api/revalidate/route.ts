// Expires the site's cached model data (lib/cache.ts) after the pipeline publishes, so the next visitor
// sees the new predictions, results and odds straight away. pipeline/publish.py calls it after every
// publish: POST with `Authorization: Bearer <REVALIDATE_SECRET>` to REVALIDATE_URL (this route on the
// live site). Without REVALIDATE_SECRET in the site's environment it refuses everything, and cached data
// refreshes on its own every five minutes instead (MODEL_TTL).

import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { MODEL_TAG } from "@/lib/cache";

/** Whether the request carries the secret, compared in constant time. */
function authorised(header: string | null, secret: string): boolean {
  const given = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return NextResponse.json({ error: "revalidation isn't set up" }, { status: 503 });
  if (!authorised(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "not allowed" }, { status: 401 });
  }
  revalidateTag(MODEL_TAG);
  return NextResponse.json({ revalidated: MODEL_TAG, at: new Date().toISOString() });
}
