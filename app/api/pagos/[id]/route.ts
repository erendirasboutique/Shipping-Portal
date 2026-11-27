// app/api/pagos/[id]/route.ts
// Staff only. What a person decided about one forwarded payment:
//   { action: "confirm", basket_id }  -> basket marked paid (same as the
//                                         live tools' "mark paid": order for
//                                         Saturday + timeline), payment linked
//   { action: "ignore" }               -> not a live-sale payment
//   { action: "restore" }              -> back to "new" (an ignore by mistake)

import { NextResponse } from "next/server";
import { liveDb } from "@/lib/live/supabase";
import { staffUser } from "@/lib/liveList";
import { getBasketDetail } from "@/lib/live/queries";
import { createOrderForBasket } from "@/lib/live/orders";
import { recordEvent } from "@/lib/live/timeline";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

const METHOD: Record<string, string> = { venmo: "venmo", paypal: "paypal", cashapp: "cashapp", zelle: "zelle" };
const LABEL: Record<string, string> = { venmo: "Venmo", paypal: "PayPal", cashapp: "Cash App", zelle: "Zelle" };

function money(cents: number | null) {
  return cents == null ? "" : "$" + (cents / 100).toFixed(2);
}

export async function POST(req: Request, { params }: Ctx) {
  const user = await staffUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const by = (typeof body.by === "string" && body.by.trim()) || user.email || "staff";
    const db = liveDb();

    const { data: payment, error: pErr } = await db.from("inbound_payments").select("*").eq("id", params.id).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!payment) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });

    if (action === "ignore" || action === "restore") {
      if (payment.status === "confirmed") {
        return NextResponse.json({ error: "Este pago ya está confirmado en una canasta." }, { status: 409 });
      }
      const { error } = await db
        .from("inbound_payments")
        .update({ status: action === "ignore" ? "ignored" : "new", confirmed_by: action === "ignore" ? by : null, confirmed_at: action === "ignore" ? new Date().toISOString() : null })
        .eq("id", payment.id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    if (action !== "confirm") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    if (payment.status !== "new") return NextResponse.json({ error: "Este pago ya se revisó." }, { status: 409 });
    if (!METHOD[payment.source]) return NextResponse.json({ error: "Este correo no es un pago." }, { status: 400 });

    const basketId = typeof body.basket_id === "string" ? body.basket_id : "";
    const basket = basketId ? await getBasketDetail(basketId) : null;
    if (!basket) return NextResponse.json({ error: "Canasta no encontrada" }, { status: 404 });
    if (basket.status === "paid" || basket.status === "shipped" || basket.paid_at) {
      return NextResponse.json({ error: `La canasta #${basket.basket_number} ya está pagada.` }, { status: 409 });
    }

    const note = [LABEL[payment.source], payment.payer_name, money(payment.amount_cents), payment.reference ? "ref " + payment.reference : null]
      .filter(Boolean)
      .join(" · ");

    // Mark the payment first, guarded on status, so two people tapping at
    // once can't confirm it twice.
    const { data: claimed, error: cErr } = await db
      .from("inbound_payments")
      .update({ status: "confirmed", basket_id: basket.id, confirmed_by: by, confirmed_at: new Date().toISOString() })
      .eq("id", payment.id)
      .eq("status", "new")
      .select("id");
    if (cErr) throw new Error(cErr.message);
    if (!claimed?.length) return NextResponse.json({ error: "Este pago ya se revisó." }, { status: 409 });

    const { error: bErr } = await db
      .from("baskets")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_by: by,
        payment_method: METHOD[payment.source],
        payment_note: note.slice(0, 300),
      })
      .eq("id", basket.id);
    if (bErr) {
      // Put the payment back so it can be tried again.
      await db.from("inbound_payments").update({ status: "new", basket_id: null, confirmed_by: null, confirmed_at: null }).eq("id", payment.id);
      throw new Error(bErr.message);
    }

    await recordEvent({
      basketId: basket.id,
      kind: "paid",
      actor: by,
      detail: { method: METHOD[payment.source], note, inbound_payment_id: payment.id, amount_cents: payment.amount_cents },
    });

    // Same as the live tools: a paid basket becomes Saturday's draft order.
    let warning: string | null = null;
    try {
      await createOrderForBasket(basket.id);
    } catch (err: any) {
      warning = "Pagado, pero no se creó la orden de envío: " + err.message;
    }

    const mismatch =
      payment.amount_cents != null && payment.amount_cents !== basket.total_cents
        ? `Ojo: pagó ${money(payment.amount_cents)} y la canasta es ${money(basket.total_cents)}.`
        : null;

    return NextResponse.json({ ok: true, basket_number: basket.basket_number, ...(warning ? { warning } : {}), ...(mismatch ? { mismatch } : {}) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
