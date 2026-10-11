// The admin removes a tipper: their sign-in is deleted, and with it their profile and every tip
// (the tables' cascades). Only the service role can delete a sign-in, so this runs on the server,
// and only for the comp's admin, never on themselves or the Model.

import { NextResponse, type NextRequest } from "next/server";
import { serverClient, serviceClient } from "@/lib/supabase-server";

export async function DELETE(request: NextRequest) {
  const sb = await serverClient();
  const admin = serviceClient();
  if (!sb || !admin) return NextResponse.json({ error: "accounts aren't set up" }, { status: 503 });
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  // Asked as the caller, so it's their admin flag that counts.
  const { data: isAdmin } = await sb.rpc("is_admin");
  if (isAdmin !== true) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id || id === auth.user.id) return NextResponse.json({ error: "pick someone else" }, { status: 400 });
  const { data: target } = await sb.from("profiles").select("is_model").eq("id", id).maybeSingle();
  if (!target || target.is_model) return NextResponse.json({ error: "no such tipper" }, { status: 404 });

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: "couldn't remove" }, { status: 500 });
  return NextResponse.json({ removed: true });
}
