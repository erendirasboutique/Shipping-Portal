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
  invite_token: string | null;
  invite_expires_at: string | null;
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

const INVITE_DAYS = 7;

/** Make sure this email has a login, and return its id. */
export async function ensureAuthUser(email: string, fullName: string | null): Promise<string | { error: string }> {
  const existing = await findAuthUser(email);
  if (existing) return existing.id;
  const { data, error } = await supabaseAdmin().auth.admin.createUser({
    email: normEmail(email),
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });
  if (error || !data.user) return { error: error?.message || "Couldn't create their login." };
  return data.user.id;
}

/**
 * A fresh invite link for this staff row, good for 7 days. Making a new
 * one replaces the old one.
 */
export async function makeInviteLink(origin: string, staffId: string): Promise<string | { error: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const expires = new Date(Date.now() + INVITE_DAYS * 86400 * 1000).toISOString();
  const { error } = await supabaseAdmin()
    .from("staff_users")
    .update({ invite_token: token, invite_expires_at: expires })
    .eq("id", staffId);
  if (error) return { error: error.message };
  return `${origin}/join/${token}`;
}

/**
 * Sign this person in right now, inside the current request. Makes a
 * Supabase sign-in token and uses it immediately, so it can't expire or be
 * used up by a link preview in between.
 */
export async function signInNow(email: string): Promise<{ ok: true } | { error: string }> {
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({
    type: "magiclink",
    email: normEmail(email),
  });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) return { error: "generateLink: " + (error?.message || "no token") };

  const supabase = supabaseServer();
  let last = "";
  for (const type of ["magiclink", "email"] as const) {
    const res = await supabase.auth.verifyOtp({ token_hash: hash, type });
    if (!res.error && res.data.user) return { ok: true };
    last = res.error?.message || "no user";
  }
  return { error: "verifyOtp: " + last };
}

/** Turn a person's login on or off. Off = they can't sign in or stay signed in. */
export async function setLoginBlocked(authUserId: string, blocked: boolean) {
  await supabaseAdmin().auth.admin.updateUserById(authUserId, {
    ban_duration: blocked ? "876000h" : "none",
  });
}
