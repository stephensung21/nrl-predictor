// The middleware (middleware.ts) refreshes a Supabase session only when there is one to refresh, and
// never for a router prefetch, so most requests don't wait on Supabase (docs/PLAN_PERF.md, Phase 1).

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn(async () => ({ data: null, error: null }));
const createServerClient = vi.fn(() => ({ auth: { getClaims } }));
vi.mock("@supabase/ssr", () => ({ createServerClient, createBrowserClient: vi.fn() }));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_test";
const { middleware } = await import("../middleware");

const request = (headers: Record<string, string> = {}) => new NextRequest("https://site.test/tipping", { headers });
const SESSION = { cookie: "sb-abcd-auth-token.0=base64-xyz; theme=dark" };

describe("middleware", () => {
  beforeEach(() => {
    createServerClient.mockClear();
    getClaims.mockClear();
  });

  it("lets a visitor with no session straight through", async () => {
    await middleware(request({ cookie: "theme=dark; fc-group=global" }));
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("skips router prefetches, which render only down to the loading skeleton", async () => {
    await middleware(request({ ...SESSION, "next-router-prefetch": "1" }));
    await middleware(request({ ...SESSION, "next-router-segment-prefetch": "/_tree" }));
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("refreshes and checks a signed-in tipper's session on a page request", async () => {
    await middleware(request(SESSION));
    expect(createServerClient).toHaveBeenCalledOnce();
    expect(getClaims).toHaveBeenCalledOnce();
  });
});
