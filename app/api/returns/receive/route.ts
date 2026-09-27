// app/api/returns/receive/route.ts
// Staff only.
//   GET  ?code=...  → the return request for a scanned return label (or typed return code)
//   POST formData {requestId, condition, notes, photo?} → mark it received
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { trackingCandidates } from "@/lib/scanLookup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "package-photos";
const MAX_BYTES = 4 * 1024 * 1024;
const FIELDS =
  "id, return_code, order_id, from_name, from_city, from_state, reason, status, tracking_number, carrier, created_at, received_at, received_by, receive_condition, receive_notes, receive_photo_url";
const CONDITIONS = ["like_new", "worn", "damaged", "missing_items", "wrong_item"];

async function staff() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  return user;
}

export async function GET(req: Request) {
  if (!(await staff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const raw = (new URL(req.url).searchParams.get("code") || "").trim();
  if (!raw) return NextResponse.json({ error: "Nothing was scanned." }, { status: 400 });

  const admin = supabaseAdmin();
  let found: any = null;

  // A typed return code
  const { data: byCode } = await admin.from("return_requests").select(FIELDS).ilike("return_code", raw.replace(/[%_\\]/g, "")).limit(1);
  if (byCode && byCode.length) found = byCode[0];

  // A scanned return label
  if (!found) {
    const cands = trackingCandidates(raw);
    if (cands.length) {
      const { data } = await admin.from("return_requests").select(FIELDS).in("tracking_number", cands).limit(1);
      if (data && data.length) found = data[0];
      if (!found) {
        const code = cands[0];
        const { data: recent } = await admin
          .from("return_requests")
          .select(FIELDS)
          .not("tracking_number", "is", null)
          .order("created_at", { ascending: false })
          .limit(500);
        found =
          (recent || []).find((r: any) => {
            const t = String(r.tracking_number || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
            return t.length >= 10 && (code.endsWith(t) || code.includes(t) || t.endsWith(code));
          }) || null;
      }
    }
  }

  if (!found) {
    // Scanned an outgoing label by mistake?
    const cands = trackingCandidates(raw);
    if (cands.length) {
      const { data: out } = await admin.from("shipping_orders").select("id").in("tracking_number", cands).limit(1);
      if (out && out.length) {
        return NextResponse.json(
          { error: "That's an outgoing shipping label, not a return label. Scan the return label on the package." },
          { status: 404 }
        );
      }
    }
    return NextResponse.json({ error: "No return matches that label. Try again, or type the return code." }, { status: 404 });
  }

  let orderLabel: string | null = null;
  if (found.order_id) {
    const { data: o } = await admin.from("shipping_orders").select("order_number").eq("id", found.order_id).maybeSingle();
    if (o?.order_number != null) orderLabel = "EB-" + o.order_number;
  }
  return NextResponse.json({ request: { ...found, order_label: orderLabel } });
}

export async function POST(req: Request) {
  const user = await staff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const form = await req.formData();
    const id = String(form.get("requestId") || "");
    const condition = String(form.get("condition") || "");
    const notes = String(form.get("notes") || "").trim();
    const photo = form.get("photo");
    if (!id) return NextResponse.json({ error: "Missing return." }, { status: 400 });
    if (!CONDITIONS.includes(condition)) return NextResponse.json({ error: "Pick the item's condition." }, { status: 400 });

    const admin = supabaseAdmin();
    let photoUrl: string | null = null;
    if (photo && typeof photo !== "string") {
      const file = photo as File;
      if (file.size > MAX_BYTES) return NextResponse.json({ error: "That photo is too large. Try again." }, { status: 413 });
      const path = "returns/" + id + "/" + crypto.randomUUID() + ".jpg";
      const up = await admin.storage
        .from(BUCKET)
        .upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type || "image/jpeg", cacheControl: "31536000" });
      if (up.error) {
        const msg = /bucket not found/i.test(up.error.message)
          ? "The package-photos storage bucket is missing. Run supabase/returns_receive.sql in Supabase."
          : up.error.message;
        return NextResponse.json({ error: msg }, { status: 500 });
      }
      photoUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }

    const now = new Date().toISOString();
    const update: any = {
      status: "received",
      received_at: now,
      received_by: user.email || null,
      receive_condition: condition,
      receive_notes: notes || null,
    };
    if (photoUrl) update.receive_photo_url = photoUrl;
    const { data, error } = await admin.from("return_requests").update(update).eq("id", id).select(FIELDS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, request: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Couldn't save." }, { status: 500 });
  }
}
