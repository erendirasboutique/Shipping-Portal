// app/api/public/unsubscribe/route.ts
// Public. Unsubscribes an email from Send-a-message emails.
//  - Gmail/Apple "Unsubscribe" button posts here (List-Unsubscribe-Post one-click).
//  - The /unsubscribe page's button posts here with &r=1 and is sent back to the page.
// The link carries a signed token, so nobody can unsubscribe someone else.
import { NextResponse } from "next/server";
import { unsubscribeEmail, validUnsub } from "@/lib/broadcast";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const email = (url.searchParams.get("e") || "").trim().toLowerCase();
  const token = url.searchParams.get("t") || "";
  const back = url.searchParams.get("r") === "1";
  if (!email || !validUnsub(email, token)) {
    return back ? NextResponse.redirect(new URL("/unsubscribe?bad=1", url), 303) : new Response("Invalid link", { status: 400 });
  }
  await unsubscribeEmail(email, back ? "link" : "one-click");
  return back ? NextResponse.redirect(new URL("/unsubscribe?done=1", url), 303) : new Response("OK");
}
