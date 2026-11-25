// /api/revalidate (app/api/revalidate/route.ts): only the pipeline's secret expires the cached model data.

import { afterEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag, unstable_cache: (fn: unknown) => fn }));

const { POST } = await import("../app/api/revalidate/route");
const call = (authorization?: string) =>
  POST(new Request("http://localhost/api/revalidate", { method: "POST", headers: authorization ? { authorization } : {} }));

describe("/api/revalidate", () => {
  afterEach(() => {
    delete process.env.REVALIDATE_SECRET;
    revalidateTag.mockClear();
  });

  it("refuses everything until the site has a secret", async () => {
    expect((await call("Bearer anything")).status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses a missing or wrong secret", async () => {
    process.env.REVALIDATE_SECRET = "s3cret";
    for (const header of [undefined, "Bearer wrong", "s3cret", "Bearer s3cret2", "bearer s3cret"]) {
      expect((await call(header)).status).toBe(401);
    }
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("expires the model data's tag for the pipeline's secret", async () => {
    process.env.REVALIDATE_SECRET = "s3cret";
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledExactlyOnceWith("model-data");
  });
});
