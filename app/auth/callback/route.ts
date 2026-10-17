import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isAllowed } from "@/lib/team";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(
            cookiesToSet: { name: string; value: string; options: CookieOptions }[]
          ) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    // Only people on the Team page (or anyone, until an admin is set up).
    if (data?.user && !(await isAllowed(data.user.email))) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=not_staff`);
    }
  }

  // Send them back to the page they were trying to open (e.g. /e).
  const saved = decodeURIComponent(cookies().get("eb-after-login")?.value || "/");
  const next = saved.startsWith("/") && !saved.startsWith("//") ? saved : "/";
  const res = NextResponse.redirect(`${origin}${next}`);
  res.cookies.set("eb-after-login", "", { path: "/", maxAge: 0 });
  return res;
}
