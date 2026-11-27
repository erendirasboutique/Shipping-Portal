// app/unsubscribe/page.tsx — "Darse de baja" link in Send-a-message emails.
// Shows a button first (email link-scanners open links, and must not unsubscribe
// anyone). Shipping updates for their own orders still go out.
import { validUnsub } from "@/lib/broadcast";

import { BRAND_LOGO } from "@/lib/brand";
export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Darse de baja — Erendira's Boutique" }, robots: { index: false, follow: false } };

export default function UnsubscribePage({ searchParams }: { searchParams: { e?: string; t?: string; done?: string; bad?: string } }) {
  const email = String(searchParams?.e || "").trim().toLowerCase();
  const token = String(searchParams?.t || "");
  const done = searchParams?.done === "1";
  const valid = !!email && validUnsub(email, token);
  const title = done ? "Listo, te diste de baja" : valid ? "¿Darte de baja?" : "Este enlace no es válido";
  const text = done
    ? "Ya no te enviaremos correos de anuncios y ofertas. Seguirás recibiendo las actualizaciones de envío de tus pedidos."
    : valid
      ? `Dejaremos de enviar correos de anuncios y ofertas a ${email}. Seguirás recibiendo las actualizaciones de envío de tus pedidos.`
      : "Abre el enlace completo desde el correo, o escríbenos a hello@erendirasboutique.com y te damos de baja.";
  return (
    <div style={{ minHeight: "100vh", background: "#F5F3EF", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 440, background: "#fff", borderRadius: 24, padding: "32px 28px", textAlign: "center", fontFamily: "'Avenir Next', Avenir, Helvetica, Arial, sans-serif", color: "#332b23" }}>
        <img src={BRAND_LOGO} alt="Erendira's Boutique" style={{ width: 160, height: "auto", margin: "0 auto 20px", display: "block" }} />
        <h1 style={{ margin: "0 0 10px", fontFamily: "Palatino, 'Palatino Linotype', Georgia, serif", fontWeight: 400, fontSize: 28, color: "#332b23" }}>{title}</h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#6b5f53" }}>{text}</p>
        {valid && !done ? (
          <form method="post" action={`/api/public/unsubscribe?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}&r=1`} style={{ marginTop: 22 }}>
            <button type="submit" style={{ minHeight: 48, padding: "0 26px", border: 0, borderRadius: 99, background: "#957f67", color: "#fff", fontSize: 16, cursor: "pointer" }}>
              Sí, darme de baja
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
