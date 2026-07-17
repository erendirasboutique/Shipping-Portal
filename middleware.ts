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
  // Live sale — the customer's order page. The portal_token in the URL is
  // the credential, same idea as /return. These people are coming from a
  // Messenger link; a login wall here loses the sale.
  "/order",
  "/api/live/portal",
];

// A v4 uuid, which is what portal_token is. Used to spot a bare token at
// the root of order.erendirasboutique.com.
const UUID_PATH =
  /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // ------------------------------------------------------------------
  // order.erendirasboutique.com — the live sale customer page.
  // Same shape as the returns block above.
  //
  // Returns early on the token routes so the Supabase auth check below
  // never runs for them. That's deliberate: the token IS the auth.
  // ------------------------------------------------------------------
  if (host.startsWith("order.")) {
    const url = request.nextUrl.clone();

    // order.erendirasboutique.com/{token} -> /order/{token}
    if (UUID_PATH.test(url.pathname)) {
      url.pathname = `/order${url.pathname}`;
      return NextResponse.rewrite(url);
    }

    // order.erendirasboutique.com/buscar -> /order/buscar
    // "¿qué canasta soy?" — a short URL people can be told out loud
    // mid-live, which is the whole point.
    if (url.pathname === "/buscar" || url.pathname === "/buscar/") {
      url.pathname = "/order/buscar";
      return NextResponse.rewrite(url);
    }

    // Already the full path — let it through without an auth check.
    if (url.pathname.startsWith("/order")) {
      return NextResponse.next();
    }

    // The data the page reads. Public, token-scoped.
    if (url.pathname.startsWith("/api/live/portal")) {
      return NextResponse.next();
    }

    if (
      !url.pathname.startsWith("/_next") &&
      !url.pathname.startsWith("/fonts") &&
      !/\.(?:png|jpg|jpeg|svg|ico|pdf|woff2?)$/.test(url.pathname)
    ) {
      // Anything else on this host — a bare "/", a guessed path, the admin
      // — goes to the shop. Staff tools shouldn't answer on the customer
      // domain at all.
      return NextResponse.redirect("https://erendirasboutique.com");
    }
  }

  // ------------------------------------------------------------------
  // live.erendirasboutique.com — the staff live sale tools. i changed to app.
  //
  // Only rewrites the shortcuts. Everything else falls through to the
  // Supabase auth check below, which is the point: this host gets no
  // special treatment, so /admin/live is as protected here as it is on
  // ship. A redirect (not a rewrite) so the destination goes through
  // middleware again and gets checked properly.
  // ------------------------------------------------------------------
  if (host.startsWith("app.")) {
    const url = request.nextUrl.clone();

    if (
      url.pathname === "/" ||
      url.pathname === "/admin" ||
      url.pathname === "/admin/"
    ) {
      url.pathname = "/admin/live";
      return NextResponse.redirect(url);
    }

    // The customer pages belong on order., not here. Keeping the two
    // domains honest means a link can't quietly work on the wrong one.
    if (
      url.pathname.startsWith("/order") ||
      url.pathname === "/buscar" ||
      UUID_PATH.test(url.pathname)
    ) {
      const customer = new URL(request.url);
      customer.host = "order.erendirasboutique.com";
      customer.protocol = "https:";
      return NextResponse.redirect(customer);
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
