// Team page API — list, invite, change role, remove/restore access.
// Every action requires the signed-in person to be an active admin.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  adminCount,
  currentUser,
  findAuthUser,
  isSharedAccount,
  ensureAuthUser,
  makeInviteLink,
  normEmail,
  requireAdmin,
  setLoginBlocked,
  type StaffRow,
} from "@/lib/team";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function notAdmin() {
  const user = await currentUser();
  const admins = await adminCount();
  return NextResponse.json(
    {
      error: "Only admins can manage the team.",
      needsSetup: admins === 0,
      canClaim: admins === 0 && !!user?.email && !isSharedAccount(user.email),
      me: user?.email ?? null,
    },
    { status: 403 }
  );
}

export async function GET() {
  const me = await requireAdmin();
  if (!me) return notAdmin();

  const { data, error } = await supabaseAdmin()
    .from("staff_users")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // When each person last signed in.
  const lastSeen: Record<string, string | null> = {};
  const { data: users } = await supabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of users?.users ?? []) {
    if (u.email) lastSeen[normEmail(u.email)] = u.last_sign_in_at ?? null;
  }

  const staff = ((data ?? []) as StaffRow[]).map((s) => ({
    ...s,
    last_sign_in_at: lastSeen[normEmail(s.email)] ?? null,
  }));
  return NextResponse.json({ me: me.staff.email, staff });
}

export async function POST(req: Request) {
  const me = await requireAdmin();
  if (!me) return notAdmin();

  const body = await req.json().catch(() => ({}));
  const origin = new URL(req.url).origin;
  const db = supabaseAdmin();

  // New link for someone already on the list.
  if (body.action === "link") {
    const { data: row } = await db.from("staff_users").select("*").eq("id", body.id).maybeSingle();
    const staff = row as StaffRow | null;
    if (!staff) return NextResponse.json({ error: "Person not found." }, { status: 404 });
    if (staff.active === false) {
      return NextResponse.json({ error: "Restore their access first." }, { status: 400 });
    }
    const authId = staff.auth_user_id || (await ensureAuthUser(staff.email, staff.full_name));
    if (typeof authId !== "string") return NextResponse.json({ error: authId.error }, { status: 500 });
    const link = await makeInviteLink(origin, staff.id);
    if (typeof link !== "string") return NextResponse.json({ error: link.error }, { status: 500 });
    await db
      .from("staff_users")
      .update({ invited_at: new Date().toISOString(), invited_by: me.staff.email, auth_user_id: authId })
      .eq("id", staff.id);
    return NextResponse.json({ link, staff });
  }

  // Invite a new person.
  const email = normEmail(body.email);
  const fullName = String(body.full_name || "").trim() || null;
  const phone = String(body.phone || "").trim() || null;
  const role = body.role === "admin" ? "admin" : "staff";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (isSharedAccount(email)) {
    return NextResponse.json({ error: "That's the shared access-code login." }, { status: 400 });
  }

  const authId = await ensureAuthUser(email, fullName);
  if (typeof authId !== "string") return NextResponse.json({ error: authId.error }, { status: 500 });

  // If they were removed before, let them sign in again.
  await setLoginBlocked(authId, false);

  const fields = {
    email,
    full_name: fullName,
    phone,
    role,
    active: true,
    auth_user_id: authId,
    invited_at: new Date().toISOString(),
    invited_by: me.staff.email,
  };
  const { data: existing } = await db.from("staff_users").select("id").eq("email", email).maybeSingle();
  const saved = existing
    ? await db.from("staff_users").update(fields).eq("id", existing.id).select("*").single()
    : await db.from("staff_users").insert(fields).select("*").single();
  if (saved.error) return NextResponse.json({ error: saved.error.message }, { status: 500 });

  const link = await makeInviteLink(origin, saved.data.id);
  if (typeof link !== "string") return NextResponse.json({ error: link.error }, { status: 500 });
  return NextResponse.json({ link, staff: saved.data });
}

export async function PATCH(req: Request) {
  const me = await requireAdmin();
  if (!me) return notAdmin();

  const body = await req.json().catch(() => ({}));
  const db = supabaseAdmin();
  const { data: row } = await db.from("staff_users").select("*").eq("id", body.id).maybeSingle();
  const staff = row as StaffRow | null;
  if (!staff) return NextResponse.json({ error: "Person not found." }, { status: 404 });

  const isMe = normEmail(staff.email) === normEmail(me.staff.email);
  const changes: Partial<StaffRow> = {};

  if (body.role === "admin" || body.role === "staff") {
    if (isMe && body.role !== "admin") {
      return NextResponse.json({ error: "You can't remove your own admin access." }, { status: 400 });
    }
    changes.role = body.role;
  }
  if (typeof body.full_name === "string") changes.full_name = body.full_name.trim() || null;
  if (typeof body.phone === "string") changes.phone = body.phone.trim() || null;

  if (typeof body.active === "boolean") {
    if (isMe && !body.active) {
      return NextResponse.json({ error: "You can't remove yourself." }, { status: 400 });
    }
    changes.active = body.active;
    if (!body.active) {
      changes.invite_token = null;
      changes.invite_expires_at = null;
    }
    const authId = staff.auth_user_id || (await findAuthUser(staff.email))?.id || null;
    if (authId) {
      await setLoginBlocked(authId, !body.active);
      changes.auth_user_id = authId;
    }
  }

  const { data, error } = await db.from("staff_users").update(changes).eq("id", staff.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}
