// Invite / sign-in links from the Team page land here. Checks the one-time
// token, signs the person in, then sends them on (to /welcome).

import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/team";

export const dynamic = "force-dynamic";

const TYPES: EmailOtpType[] = ["invite", "email", "magiclink", "signup", "recovery"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next") || "/welcome";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/welcome";

  if (!tokenHash || !type || !TYPES.includes(type)) {
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
  }

  if (!(await isAllowed(data.user.email))) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_staff`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
