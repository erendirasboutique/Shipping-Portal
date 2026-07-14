import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/api/auth/code",
  "/return",
  "/api/returns/submit",
  "/api/returns/lookup",
  "/api/returns/slip",
];
type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};
export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  if (host.startsWith("returns.")) {
    const url = request.nextUrl.clone();
    if (url.pathname === "/") {
      url.pathname = "/return";
      return NextResponse.rewrite(url);
    }
    if (url.pathname === "/status") {
      url.pathname = "/return/status";
      return NextResponse.rewrite(url);
    }
    if (
      !url.pathname.startsWith("/return") &&
      !url.pathname.startsWith("/api") &&
      !url.pathname.startsWith("/_next") &&
      !url.pathname.startsWith("/fonts") &&
      !/\.(?:png|jpg|jpeg|svg|ico|pdf|woff2?)$/.test(url.pathname)
    ) {
      url.pathname = "/return";
      return NextResponse.redirect(url);
    }
  }
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
 const isStaticFile =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/fonts") ||
    pathname === "/favicon.ico" ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|pdf)$/.test(pathname);
  if (!user && !isPublicPath && !isStaticFile) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set(
      "redirect",
      pathname + request.nextUrl.search
    );
    return NextResponse.redirect(loginUrl);
  }
  if (user && pathname === "/login") {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
