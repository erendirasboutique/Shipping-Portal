// Team / staff access helpers. Server-side only.

import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type StaffRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  active: boolean | null;
  created_at: string;
  auth_user_id: string | null;
  phone: string | null;
  invited_at: string | null;
  invited_by: string | null;
};

export function normEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

/** The one login behind the shared access code. It's never a "person" on the team. */
export function isSharedAccount(email: string | null | undefined): boolean {
  const shared = normEmail(process.env.STAFF_SHARED_EMAIL);
  return !!shared && normEmail(email) === shared;
}

export async function currentUser(): Promise<User | null> {
  const { data } = await supabaseServer().auth.getUser();
  return data.user ?? null;
}

export async function staffByEmail(email: string): Promise<StaffRow | null> {
  const { data } = await supabaseAdmin()
    .from("staff_users")
    .select("*")
    .eq("email", normEmail(email))
    .maybeSingle();
  return (data as StaffRow | null) ?? null;
}

export async function adminCount(): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("staff_users")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("active", true);
  return count ?? 0;
}

/** The signed-in admin, or null if the person isn't an active admin. */
export async function requireAdmin(): Promise<{ user: User; staff: StaffRow } | null> {
  const user = await currentUser();
  if (!user?.email || isSharedAccount(user.email)) return null;
  const staff = await staffByEmail(user.email);
  if (!staff || staff.role !== "admin" || staff.active === false) return null;
  return { user, staff };
}

/**
 * Can this email use the portal? Until an admin exists, everyone who could
 * sign in before still can, so setting up the Team page never locks you out.
 */
export async function isAllowed(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  if (isSharedAccount(email)) return true;
  if ((await adminCount()) === 0) return true;
  const staff = await staffByEmail(email);
  return !!staff && staff.active !== false;
}

export async function findAuthUser(email: string): Promise<User | null> {
  const admin = supabaseAdmin();
  const want = normEmail(email);
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const hit = data.users.find((u) => normEmail(u.email) === want);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

/**
 * A one-time sign-in link for this person. New people get an invite link;
 * people who already have a login get a fresh sign-in link.
 */
export async function makeSignInLink(
  origin: string,
  email: string,
  fullName: string | null
): Promise<{ link: string; userId: string | null } | { error: string }> {
  const admin = supabaseAdmin().auth.admin;
  const clean = normEmail(email);

  let res = await admin.generateLink({
    type: "invite",
    email: clean,
    options: { data: fullName ? { full_name: fullName } : undefined },
  });
  let type = "invite";

  if (res.error && /already|registered|exists/i.test(res.error.message)) {
    res = await admin.generateLink({ type: "magiclink", email: clean });
    type = "email";
  }
  if (res.error || !res.data?.properties?.hashed_token) {
    return { error: res.error?.message || "Couldn't make a link." };
  }

  const q = new URLSearchParams({
    token_hash: res.data.properties.hashed_token,
    type,
    next: "/welcome",
  });
  return { link: `${origin}/auth/confirm?${q.toString()}`, userId: res.data.user?.id ?? null };
}

/** Turn a person's login on or off. Off = they can't sign in or stay signed in. */
export async function setLoginBlocked(authUserId: string, blocked: boolean) {
  await supabaseAdmin().auth.admin.updateUserById(authUserId, {
    ban_duration: blocked ? "876000h" : "none",
  });
}
