// First-time setup: when there are no admins yet, the signed-in person can
// make themselves the admin. After that, this does nothing.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminCount, currentUser, isSharedAccount, normEmail } from "@/lib/team";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await currentUser();
  if (!user?.email) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (isSharedAccount(user.email)) {
    return NextResponse.json(
      { error: "Sign in with your own email or Google, not the shared access code." },
      { status: 400 }
    );
  }
  if ((await adminCount()) > 0) {
    return NextResponse.json({ error: "An admin is already set up." }, { status: 409 });
  }

  const db = supabaseAdmin();
  const email = normEmail(user.email);
  const fields = {
    email,
    full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
    role: "admin",
    active: true,
    auth_user_id: user.id,
  };
  const { data: existing } = await db.from("staff_users").select("id").eq("email", email).maybeSingle();
  const res = existing
    ? await db.from("staff_users").update(fields).eq("id", existing.id)
    : await db.from("staff_users").insert(fields);
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
