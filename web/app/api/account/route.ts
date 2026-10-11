// Deletes the signed-in tipper's account (PRODUCT.md: your account and every tip). Deleting the
// sign-in removes the profile, and with it every tip, through the tables' cascades. Only the
// service role can delete a sign-in, so this runs on the server, for the caller's own account only.

import { NextResponse } from "next/server";
import { serverClient, serviceClient } from "@/lib/supabase-server";

export async function DELETE() {
  const sb = await serverClient();
  const admin = serviceClient();
  if (!sb || !admin) return NextResponse.json({ error: "accounts aren't set up" }, { status: 503 });
  // getUser checks the session with Supabase, rather than trusting the cookie.
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) return NextResponse.json({ error: "couldn't delete" }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
