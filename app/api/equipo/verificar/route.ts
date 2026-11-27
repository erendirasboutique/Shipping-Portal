// app/api/equipo/verificar/route.ts
// Staff only. Saturday: a customer reported she paid (with a photo of the
// payment). POST { basket_id, ok, by? }
//   ok: true  -> it arrived: keep it paid, record who checked, make sure the
//                Saturday shipping order exists
//   ok: false -> not found: back to "waiting for payment"

import { NextResponse } from "next/server";
import { staffUser } from "@/lib/liveList";
import { liveDb } from "@/lib/live/supabase";
import { getBasketDetail } from "@/lib/live/queries";
import { recordEvent } from "@/lib/live/timeline";
import { createOrderForBasket } from "@/lib/live/orders";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await staffUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const by = (typeof body.by === "string" && body.by.trim()) || user.email || "staff";
    const basket = typeof body.basket_id === "string" ? await getBasketDetail(body.basket_id) : null;
    if (!basket) return NextResponse.json({ error: "Canasta no encontrada" }, { status: 404 });
    if (basket.status !== "paid") return NextResponse.json({ error: "Esta canasta no está por confirmar." }, { status: 409 });

    if (body.ok) {
      const { error } = await liveDb().from("baskets").update({ paid_by: by }).eq("id", basket.id);
      if (error) throw new Error(error.message);
      await recordEvent({ basketId: basket.id, kind: "note", actor: by, body: "Pago revisado: sí llegó." });
      let warning: string | null = null;
      try {
        await createOrderForBasket(basket.id);
      } catch (err: any) {
        warning = "Confirmado, pero no se creó la orden de envío: " + err.message;
      }
      return NextResponse.json({ ok: true, ...(warning ? { warning } : {}) });
    }

    const { error } = await liveDb()
      .from("baskets")
      .update({ status: "finalized", paid_at: null, paid_by: null, payment_method: null, payment_note: null })
      .eq("id", basket.id)
      .eq("status", "paid");
    if (error) throw new Error(error.message);
    await recordEvent({ basketId: basket.id, kind: "note", actor: by, body: "Pago revisado: no llegó. Regresó a esperando pago." });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
