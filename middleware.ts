import { createServerClient } from "@supabase/ssr";
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
  // ---- returns.* host handling (must be INSIDE this function) ----
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
    if (!url.pathname.startsWith("/return") && !url.pathname.startsWith("/api") && !url.pathname.startsWith("/_next")) {
      url.pathname = "/return";
      return NextResponse.redirect(url);
    }
  }
  // ---- end returns.* block ----

  let response = NextResponse.next({ request });

  // ...everything else in the function stays exactly as you have it
