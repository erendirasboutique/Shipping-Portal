// The shipping notification sent to customers. Used by the order page's
// "Copy notification", Scan & Send, and Muse, so every message matches.
// Safe to use in the browser or on the server.

const TRACK_BASE = (process.env.NEXT_PUBLIC_TRACK_URL || "https://track.erendirasboutique.com").replace(/\/$/, "");

export type NoticeOrder = {
  to_name?: string | null;
  to_street1?: string | null;
  to_street2?: string | null;
  to_city?: string | null;
  to_state?: string | null;
  to_zip?: string | null;
  carrier?: string | null;
  mail_class?: string | null;
  tracking_number?: string | null;
  created_at?: string | null; // when the label was bought
};

export function shippingNotice(o: NoticeOrder): string {
  const carrier = o.carrier || "the shipping carrier";
  const shipDate = new Date(o.created_at || Date.now()).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  });
  const cityLine = [[o.to_city, o.to_state].filter(Boolean).join(", "), o.to_zip].filter(Boolean).join(" ");
  const address = [o.to_street1, o.to_street2, cityLine].filter((x) => x && String(x).trim()).join("\n");
  const tn = o.tracking_number || "";
  return (
    "A package was shipped to you via " + carrier + " and will be delivered to:\n\n" +
    (o.to_name || "") + "\n" +
    address + "\n\n" +
    "Shipment Date: " + shipDate + "\n" +
    "Mail Class: " + (o.mail_class || "") + "\n" +
    "Tracking Number: " + tn + "\n\n" +
    "Check the package status:\n" +
    TRACK_BASE + "/?tracking=" + encodeURIComponent(tn) + "\n\n" +
    "For questions about this package, please contact us or " + carrier + "."
  );
}
