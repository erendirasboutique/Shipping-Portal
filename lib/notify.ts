// Server-only helpers for package updates: the message text and email (Resend).

const TRACK_BASE = (process.env.NEXT_PUBLIC_TRACK_URL || "https://track.erendirasboutique.com").replace(/\/$/, "");

export function trackingLink(trackingNumber: string) {
  return TRACK_BASE + "/?tracking=" + encodeURIComponent(trackingNumber);
}

export function emailConfigured() {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

function firstName(name: string | null | undefined) {
  const n = (name || "").trim().split(/\s+/)[0] || "";
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : "";
}

// The text that goes with the photo when sharing to Messenger.
export function packageMessage(name: string | null, trackingNumber: string | null) {
  const hi = firstName(name);
  const link = trackingNumber ? trackingLink(trackingNumber) : "";
  return (
    "¡Hola" + (hi ? " " + hi : "") + "! 📦 Tu paquete ya está empacado y listo para salir." +
    (link ? "\nSíguelo aquí: " + link : "") +
    "\n\nHi" + (hi ? " " + hi : "") + "! Your package is packed and on its way." +
    (link ? "\nTrack it here: " + link : "") +
    "\n\n— Erendira's Boutique 🧡"
  );
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export async function sendEmailPackage(opts: {
  to: string;
  name: string | null;
  photoUrl: string | null;
  trackingNumber: string | null;
  orderLabel: string;
}) {
  const hi = esc(firstName(opts.name));
  const link = opts.trackingNumber ? trackingLink(opts.trackingNumber) : "";
  const photo = opts.photoUrl
    ? '<img src="' + esc(opts.photoUrl) + '" alt="Tu paquete / Your package" width="440" style="display:block;width:100%;max-width:440px;height:auto;border-radius:16px;margin:0 auto 24px;" />'
    : "";
  const button = link
    ? '<p style="text-align:center;margin:0 0 28px;"><a href="' + esc(link) + '" style="display:inline-block;background:#957f67;color:#F5F3EF;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:15px;">Rastrear mi paquete · Track package</a></p>'
    : "";
  const html =
    '<div style="background:#F5F3EF;padding:32px 16px;font-family:Georgia,serif;color:#332b23;">' +
    '<div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e6ddd2;border-radius:24px;padding:32px 24px;">' +
    '<p style="margin:0 0 4px;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#957f67;text-align:center;">Erendira&#39;s Boutique</p>' +
    '<h1 style="margin:0 0 20px;font-size:28px;font-weight:400;color:#957f67;text-align:center;">¡Tu paquete va en camino!</h1>' +
    photo +
    '<p style="font-size:16px;line-height:1.6;margin:0 0 12px;">¡Hola' + (hi ? " " + hi : "") + "! Tu paquete ya está empacado y listo para salir. Aquí puedes ver cómo se ve y seguirlo.</p>" +
    '<p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#6b5d4f;">Hi' + (hi ? " " + hi : "") + "! Your package is packed and on its way. Here&#39;s a peek, and you can track it below.</p>" +
    button +
    '<p style="font-size:12px;color:#957f67;text-align:center;margin:0;">' + esc(opts.orderLabel) + (opts.trackingNumber ? " · " + esc(opts.trackingNumber) : "") + "</p>" +
    "</div></div>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [opts.to],
      subject: "📦 Tu paquete va en camino · Your package is on its way",
      html,
      text: packageMessage(opts.name, opts.trackingNumber),
    }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Email error (" + res.status + ")");
}
