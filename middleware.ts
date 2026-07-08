import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/api/auth/code",
  "/return",
  "/api/returns/submit",
  "/api/returns/lookup",
];
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

 if (user && !isPublic) {
    const email = (user.email || "").toLowerCase();
    const ALLOWED_DOMAINS = [
      "shoperendirasboutique.com",
      "erendirasboutique.com",
      "dylanmontoya.com",
      "lucilamontoya.com",
      "erendiramoreno.com",
    ];
    const ALLOWED_EMAILS = ["staff@erendirasboutique.com"];

    const domain = email.split("@")[1] || "";
    const allowed =
      ALLOWED_EMAILS.includes(email) || ALLOWED_DOMAINS.includes(domain);

    if (!allowed) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "not_staff");
      return NextResponse.redirect(url);
    }
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo2.png|og.png|fonts|.*\\.(?:png|jpg|jpeg|svg|pdf|ico)$).*)",
  ],
};
