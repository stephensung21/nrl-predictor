// The name and photo Google sends with a sign-in are dropped as they arrive
// (supabase/migrations/20261015000000_no_google_profile.sql); the email and Google's account id stay.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { freshDatabase, uuid } from "./db";

const amy = uuid(2);

/** What Google sends, as Supabase stores it. */
const fromGoogle = {
  iss: "https://accounts.google.com",
  sub: "1234567890",
  provider_id: "1234567890",
  email: "amy@example.com",
  email_verified: true,
  name: "Amy Example",
  full_name: "Amy Example",
  given_name: "Amy",
  family_name: "Example",
  picture: "https://lh3.googleusercontent.com/a/photo",
  avatar_url: "https://lh3.googleusercontent.com/a/photo",
};
const kept = { iss: fromGoogle.iss, sub: fromGoogle.sub, provider_id: fromGoogle.provider_id, email: fromGoogle.email, email_verified: true };

describe("what a Google sign-in leaves behind", () => {
  let db: PGlite;
  const meta = async () => (await db.query<{ m: object }>("select raw_user_meta_data as m from auth.users where id = $1", [amy])).rows[0].m;
  const identity = async () => (await db.query<{ d: object }>("select identity_data as d from auth.identities where user_id = $1", [amy])).rows[0].d;

  beforeAll(async () => {
    db = await freshDatabase();
    // Supabase writes as its own role, not a tipper's, so no role switch here.
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [amy, fromGoogle.email, fromGoogle]);
    await db.query(
      "insert into auth.identities (id, user_id, provider, provider_id, identity_data) values ($1, $2, 'google', $3, $4)",
      [uuid(100), amy, fromGoogle.sub, fromGoogle],
    );
  });

  it("drops the name and photo on the first sign-in, keeping the email and account id", async () => {
    expect(await meta()).toEqual(kept);
    expect(await identity()).toEqual(kept);
  });

  it("drops them again when a later sign-in refreshes them", async () => {
    await db.query("update auth.users set raw_user_meta_data = $2 where id = $1", [amy, fromGoogle]);
    await db.query("update auth.identities set identity_data = $2 where user_id = $1", [amy, fromGoogle]);
    expect(await meta()).toEqual(kept);
    expect(await identity()).toEqual(kept);
  });

  it("can't be called through the API", async () => {
    await db.exec("set role authenticated");
    try {
      await expect(db.query("select public.strip_sign_in_profile()")).rejects.toThrow(/permission denied|trigger functions can only be called as triggers/);
    } finally {
      await db.exec("reset role");
    }
  });
});
