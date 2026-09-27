// app/api/label-tools/route.ts
// Staff only. Powers the "Scan a Label" page.
//   GET  ?code=...                          → the order for a scanned label
//   POST {action:"rts", orderId, reason, note} → mark it returned to sender
//   POST {action:"undo_rts", orderId}          → clear that
//   POST {action:"reship", orderId}            → new draft with the same customer + package, ready to fix the address and buy
//   POST {action:"rates", orderId, parcel, insurance}  → fresh rates for a changed package
//   POST {action:"rebuy", orderId, shipmentRef, rateId, parcel, insurance, reason}
//                                              → buy the new label, then void the old one (same EB number)
//   POST {action:"note", orderId, note}        → add a dated note to the customer's profile and the order
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findOrderByCode } from "@/lib/scanLookup";
import { getProvider } from "@/lib/shipping";

export const dynamic = "force-dynamic";

const FIELDS =
  "id, order_number, customer_id, to_name, to_street1, to_street2, to_city, to_state, to_zip, to_country, to_phone, to_email, length, width, height, weight_lb, weight_oz, signature_confirmation, carrier, mail_class, tracking_number, tracking_url, postage_amount, status, refund_status, label_url, printed_at, printed_by, packed_at, customer_notified_at, created_at, rts_at, rts_by, rts_reason, reshipped_to, reship_of, provider, easypost_shipment_id, provider_transaction_id, reference, insurance_amount, label_history, notes";

async function staff() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  return user;
}

async function loadFull(admin: any, id: string) {
  const { data, error } = await admin.from("shipping_orders").select(FIELDS).eq("id", id).single();
  if (error) {
    if (/column .*(rts_|reship|insurance_amount|label_history)/i.test(error.message)) {
      throw new Error("The database needs an update. Run supabase/label_tools.sql in Supabase.");
    }
    throw new Error(error.message);
  }
  let reshipLabel: string | null = null;
  if (data?.reshipped_to) {
    const { data: r } = await admin.from("shipping_orders").select("order_number, status").eq("id", data.reshipped_to).maybeSingle();
    if (r) reshipLabel = (r.order_number != null ? "EB-" + r.order_number : "new order") + (r.status === "draft" ? " (draft)" : "");
  }
  let customerNotes: string | null = null;
  if (data?.customer_id) {
    const { data: c } = await admin.from("shipping_customers").select("notes").eq("id", data.customer_id).maybeSingle();
    customerNotes = c?.notes || null;
  }
  return { ...data, reship_label: reshipLabel, customer_notes: customerNotes };
}

type ParcelIn = { length: number; width: number; height: number; weight_lb: number; weight_oz: number };

function cleanParcel(p: any, fallback: any): ParcelIn {
  const n = (v: any, d: any) => (v === "" || v == null || isNaN(Number(v)) ? Number(d) || 0 : Number(v));
  return {
    length: n(p?.length, fallback.length),
    width: n(p?.width, fallback.width),
    height: n(p?.height, fallback.height),
    weight_lb: n(p?.weight_lb, fallback.weight_lb),
    weight_oz: n(p?.weight_oz, fallback.weight_oz),
  };
}

function shipmentInput(order: any, parcel: ParcelIn, insurance: number | null) {
  const reference = order.reference || (order.order_number != null ? "EB-" + order.order_number : undefined);
  return {
    to: {
      name: order.to_name,
      street1: order.to_street1,
      street2: order.to_street2 || undefined,
      city: order.to_city,
      state: order.to_state,
      zip: order.to_zip,
      country: order.to_country || "US",
      phone: order.to_phone || undefined,
      email: order.to_email || undefined,
    },
    parcel,
    signature: !!order.signature_confirmation,
    reference,
    ...(insurance && insurance > 0 ? { insurance } : {}),
  };
}

function isVoided(o: any) {
  return String(o.status || "").toLowerCase() === "refunded" || !!o.refund_status;
}

export async function GET(req: Request) {
  if (!(await staff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const code = new URL(req.url).searchParams.get("code") || "";
  if (!code.trim()) return NextResponse.json({ error: "Nothing was scanned." }, { status: 400 });
  try {
    const admin = supabaseAdmin();
    const hit = await findOrderByCode(admin, code);
    if (!hit) {
      return NextResponse.json(
        { error: "No order matches that label. Try again, or type the tracking or EB number." },
        { status: 404 }
      );
    }
    return NextResponse.json({ order: await loadFull(admin, hit.id) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lookup failed." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await staff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const { action, orderId, reason, note } = body;
    if (!orderId) return NextResponse.json({ error: "Missing order." }, { status: 400 });
    const admin = supabaseAdmin();

    if (action === "rts") {
      const text = [reason, note].filter((x: any) => x && String(x).trim()).join(" · ");
      const { error } = await admin
        .from("shipping_orders")
        .update({ rts_at: new Date().toISOString(), rts_by: user.email || null, rts_reason: text || null })
        .eq("id", orderId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ order: await loadFull(admin, orderId) });
    }

    if (action === "undo_rts") {
      const { error } = await admin.from("shipping_orders").update({ rts_at: null, rts_by: null, rts_reason: null }).eq("id", orderId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ order: await loadFull(admin, orderId) });
    }

    if (action === "reship") {
      const old = await loadFull(admin, orderId);
      if (old.reshipped_to) {
        // Already made one; send them back to it instead of making another.
        return NextResponse.json({ draftId: old.reshipped_to, existing: true });
      }
      const oldLabel = old.order_number != null ? "EB-" + old.order_number : "earlier order";
      const { data: draft, error } = await admin
        .from("shipping_orders")
        .insert({
          customer_id: old.customer_id,
          to_name: old.to_name,
          to_street1: old.to_street1,
          to_street2: old.to_street2,
          to_city: old.to_city,
          to_state: old.to_state,
          to_zip: old.to_zip,
          to_country: old.to_country || "US",
          to_phone: old.to_phone,
          to_email: old.to_email,
          length: old.length,
          width: old.width,
          height: old.height,
          weight_lb: old.weight_lb,
          weight_oz: old.weight_oz,
          signature_confirmation: old.signature_confirmation,
          status: "draft",
          notes: "Re-ship of " + oldLabel + " (returned to sender" + (old.rts_reason ? ": " + old.rts_reason : "") + ")",
          reship_of: old.id,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await admin.from("shipping_orders").update({ reshipped_to: draft.id }).eq("id", old.id);
      return NextResponse.json({ draftId: draft.id });
    }

    if (action === "rates" || action === "rebuy") {
      const { parcel, insurance, shipmentRef, rateId } = body;
      const why: string | null = body.reason || null;
      const order = await loadFull(admin, orderId);
      if (isVoided(order)) throw new Error("This label was already voided. Make a new label from Create Label instead.");
      if (!order.tracking_number) throw new Error("This order doesn't have a label yet.");
      const p = cleanParcel(parcel, order);
      if (p.weight_lb * 16 + p.weight_oz <= 0) throw new Error("Enter a weight above 0.");
      const ins = insurance != null && insurance !== "" && Number(insurance) > 0 ? Math.round(Number(insurance) * 100) / 100 : null;
      const provider = getProvider(order.provider);
      const input = shipmentInput(order, p, ins);

      if (action === "rates") {
        const result = await provider.getRates(input as any);
        return NextResponse.json({ shipmentRef: result.shipmentRef, rates: result.rates, provider: order.provider || "easypost" });
      }

      if (!shipmentRef || !rateId) throw new Error("Pick a rate first.");

      // 1) Buy the replacement. If this fails, nothing changes.
      const bought = await provider.buy({ shipmentRef, rateId, input: input as any, reference: input.reference });
      if (!bought?.label_url || !bought?.tracking_number) {
        throw new Error("The new label wasn't fully bought, so nothing was changed. Try again.");
      }

      // 2) Void the old one.
      let oldRefund = "not attempted";
      try {
        const r = await provider.refund({ shipmentRef: order.easypost_shipment_id, transactionRef: order.provider_transaction_id });
        oldRefund = r.refund_status || "submitted";
      } catch (e: any) {
        oldRefund = "failed: " + (e?.message || "unknown error");
      }

      // 3) Keep the old label in the order's history, then switch the order to the new label.
      const history = Array.isArray(order.label_history) ? order.label_history : [];
      history.push({
        replaced_at: new Date().toISOString(),
        replaced_by: user.email || null,
        reason: why || null,
        tracking_number: order.tracking_number,
        carrier: order.carrier,
        mail_class: order.mail_class,
        postage_amount: order.postage_amount,
        insurance_amount: order.insurance_amount ?? null,
        weight_lb: order.weight_lb,
        weight_oz: order.weight_oz,
        length: order.length,
        width: order.width,
        height: order.height,
        provider: order.provider || "easypost",
        shipment_ref: order.easypost_shipment_id,
        transaction_ref: order.provider_transaction_id,
        label_url: order.label_url,
        refund_status: oldRefund,
      });

      const { error: upErr } = await admin
        .from("shipping_orders")
        .update({
          length: p.length,
          width: p.width,
          height: p.height,
          weight_lb: p.weight_lb,
          weight_oz: p.weight_oz,
          insurance_amount: ins,
          easypost_shipment_id: bought.shipmentRef,
          provider_transaction_id: bought.transactionRef,
          easypost_tracker_id: bought.trackerRef,
          label_url: bought.label_url,
          tracking_number: bought.tracking_number,
          tracking_url: bought.tracking_url,
          carrier: bought.carrier,
          mail_class: bought.service,
          postage_amount: bought.rate,
          postage_currency: bought.currency,
          status: "purchased",
          print_status: "not_printed",
          printed_at: null,
          label_history: history,
        })
        .eq("id", order.id);
      if (upErr) {
        throw new Error(
          "The new label was bought (tracking " + bought.tracking_number + ") but saving it failed: " + upErr.message
        );
      }
      return NextResponse.json({ order: await loadFull(admin, order.id), oldRefund });
    }

    if (action === "note") {
      const text = String(body.note || "").trim();
      if (!text) throw new Error("Write a note first.");
      const order = await loadFull(admin, orderId);
      const stamp =
        new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" }) +
        (order.order_number != null ? " · EB-" + order.order_number : "");
      const line = "[" + stamp + "] " + text;

      let customerId = order.customer_id;
      if (!customerId && order.to_email) {
        const { data: c } = await admin.from("shipping_customers").select("id").ilike("email", order.to_email).limit(1);
        customerId = c && c[0] ? c[0].id : null;
      }
      if (customerId) {
        const { data: c } = await admin.from("shipping_customers").select("notes").eq("id", customerId).maybeSingle();
        const notes = c?.notes ? c.notes + "\n" + line : line;
        const { error: cErr } = await admin.from("shipping_customers").update({ notes }).eq("id", customerId);
        if (cErr) throw new Error(cErr.message);
      }
      const orderNotes = order.notes ? order.notes + "\n" + line : line;
      await admin.from("shipping_orders").update({ notes: orderNotes }).eq("id", order.id);
      return NextResponse.json({ order: await loadFull(admin, order.id), savedToCustomer: !!customerId });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Something went wrong." }, { status: 500 });
  }
}
