import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({ code: "" }));

  const expected = process.env.ACCESS_CODE;
  if (!expected) {
    return NextResponse.json(
      { error: "Access code login isn't configured" },
      { status: 500 }
    );
  }
  if (!code || code.trim() !== expected) {
    return NextResponse.json({ error: "Wrong access code" }, { status: 401 });
  }

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

  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.STAFF_SHARED_EMAIL!,
    password: process.env.STAFF_SHARED_PASSWORD!,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
