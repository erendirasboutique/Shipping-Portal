// app/api/equipo/canasta/enviar/route.ts
// Staff only. POST { basket_id, message }: send the basket photo and the
// message from the business Page on Messenger, the same way Scan & Send
// does. Only works when she messaged the Page in the last 24 hours;
// otherwise the screen uses the phone's share sheet instead.

import { NextResponse } from "next/server";
import { staffUser } from "@/lib/liveList";
import { getBasketDetail } from "@/lib/live/queries";
import { recordEvent } from "@/lib/live/timeline";
import { sendPackageMessage } from "@/lib/messenger";
import { messengerFor } from "@/lib/equipo/data";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await staffUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const basket = typeof body.basket_id === "string" ? await getBasketDetail(body.basket_id) : null;
    if (!basket) return NextResponse.json({ error: "Canasta no encontrada" }, { status: 404 });
    if (!basket.customer_id || !basket.photo_url) {
      return NextResponse.json({ error: "Falta la clienta o la foto" }, { status: 400 });
    }
    const text = String(body.message || "").slice(0, 1500);
    if (!text) return NextResponse.json({ error: "Falta el mensaje" }, { status: 400 });

    const m = (await messengerFor([basket.customer_id])).get(basket.customer_id);
    if (!m || !m.auto || !m.psid) {
      return NextResponse.json({ error: m?.reason || "No se puede mandar solo.", fallback: true }, { status: 409 });
    }

    await sendPackageMessage(m.psid, basket.photo_url, text);
    await recordEvent({
      basketId: basket.id,
      kind: "note",
      actor: (typeof body.by === "string" && body.by.trim()) || user.email || "staff",
      body: "Foto y total enviados por Messenger desde la página.",
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Messenger no lo mandó.", fallback: true }, { status: 502 });
  }
}
