// Server-only: checks the password Muse sends with every request.
// Set MUSE_API_TOKEN in Vercel to a long random value, and give the same
// value to Muse when it asks for the "bearer token".
import crypto from "crypto";

export function museAuthorized(req: Request): boolean {
  const expected = process.env.MUSE_API_TOKEN || "";
  if (expected.length < 24) return false; // not set up, or too short to be safe
  const header = req.headers.get("authorization") || "";
  const given = header.replace(/^Bearer\s+/i, "").trim();
  if (!given || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export function museDenied() {
  return new Response(JSON.stringify({ error: "Unauthorized. Send the portal's Muse token as a Bearer token." }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
