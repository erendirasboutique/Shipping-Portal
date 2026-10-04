// lib/shipping/veeqo.ts
// Veeqo Rate Shopping API as a ShippingProvider (Amazon Shipping, OnTrac, UPS, USPS, FedEx…)
// Docs: https://developers.veeqo.com/rate-shopping-api/
// Env: VEEQO_API_KEY   (ship-from uses your existing SHIP_FROM_* vars)
//
// Veeqo returns the label as base64 PDF, so it's uploaded to a Supabase
// Storage bucket ("labels") and that URL is saved as label_url, like the
// other providers.

import { ShippingProvider, ShipmentInput, shipFromAddress, toOunces } from "./types";
import { supabaseAdmin } from "@/lib/supabase/admin";

const VEEQO_BASE = "https://api.veeqo.com";
const LABEL_BUCKET = "labels";
const SIG_KEY = "value_added_service__VAS_GROUP_ID_CONFIRMATION";

function apiKey(): string {
  const key = process.env.VEEQO_API_KEY;
  if (!key) throw new Error("VEEQO_API_KEY is not set in Vercel");
  return key;
}

async function veeqoFetch(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(VEEQO_BASE + path, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": apiKey(),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      (data && Array.isArray(data.error_messages) && data.error_messages.join("; ")) ||
      (data && data.error) ||
      "Veeqo error (" + res.status + ")";
    throw new Error(msg);
  }
  return data;
}

// Friendly carrier names so the rate cards read well.
function cleanCarrier(raw: string): string {
  const c = String(raw || "").toUpperCase();
  if (c.includes("AMZN") || c.includes("AMAZON")) return "Amazon";
  if (c.includes("ONTRAC")) return "OnTrac";
  if (c.includes("FEDEX")) return "FedEx";
  if (c.includes("UPS")) return "UPS";
  if (c.includes("USPS")) return "USPS";
  if (c.includes("DHL")) return "DHL";
  return c || "Veeqo";
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const d = Math.ceil((t - Date.now()) / 86400000);
  return d > 0 ? d : 1;
}

function trackingUrl(carrier: string, tn: string): string | null {
  if (!tn) return null;
  const t = encodeURIComponent(tn);
  switch (carrier) {
    case "USPS": return "https://tools.usps.com/go/TrackConfirmAction?tLabels=" + t;
    case "UPS": return "https://www.ups.com/track?tracknum=" + t;
    case "FedEx": return "https://www.fedex.com/fedextrack/?trknbr=" + t;
    case "OnTrac": return "https://www.ontrac.com/tracking/?number=" + t;
    case "Amazon": return "https://track.amazon.com/tracking/" + t;
    default: return null;
  }
}

function veeqoAddress(a: any) {
  return {
    name: a.name,
    company: a.company || undefined,
    phone: a.phone || undefined,
    email: a.email || undefined,
    line1: a.street1,
    line2: a.street2 || undefined,
    town: a.city,
    county: a.state,
    postcode: a.zip,
    country_code: a.country || "US",
  };
}

// Finds the signature value for a quote, plus its extra cost.
function signatureOption(q: any): { value: string; price: number } | null {
  const opts: any[] = q.shipping_service_options || [];
  const conf = opts.find((o) => o && o.key === SIG_KEY);
  if (!conf || !Array.isArray(conf.values)) return null;
  const sig = conf.values.find(
    (v: any) => String(v.value || "").toUpperCase().includes("SIGNATURE") &&
      !String(v.value || "").toUpperCase().includes("ADULT")
  );
  return sig ? { value: String(sig.value), price: Number(sig.price || 0) } : null;
}

async function uploadLabel(pdfBase64: string, tracking: string): Promise<string> {
  const admin = supabaseAdmin();
  // Creates the bucket the first time; ignored if it already exists.
  await admin.storage.createBucket(LABEL_BUCKET, { public: true }).catch(() => null);
  const rand = Math.random().toString(36).slice(2, 10);
  const path = "veeqo/" + (tracking || "label") + "-" + rand + ".pdf";
  const { error } = await admin.storage
    .from(LABEL_BUCKET)
    .upload(path, Buffer.from(pdfBase64, "base64"), {
      contentType: "application/pdf",
      upsert: true,
    });
  if (error) throw new Error("Label bought but upload failed: " + error.message);
  return admin.storage.from(LABEL_BUCKET).getPublicUrl(path).data.publicUrl;
}

export const veeqo: ShippingProvider = {
  async getRates(input: ShipmentInput) {
    const from = shipFromAddress();
    const p = input.parcel;
    const data = await veeqoFetch("/shipping/api/v1/rates", {
      method: "POST",
      body: JSON.stringify({
        from_address: veeqoAddress(from),
        to_address: veeqoAddress(input.to),
        parcels: [
          {
            weight: toOunces(p),
            weight_unit: "oz",
            length: Number(p.length) || undefined,
            width: Number(p.width) || undefined,
            height: Number(p.height) || undefined,
            dimension_unit: "in",
          },
        ],
        // Veeqo requires a reference. Use the order's reference (EB-123) when
        // the rates route passes one through, otherwise a unique fallback.
        customer_reference:
          String(input.reference || "").trim() || "EB-" + Date.now().toString(36).toUpperCase(),
        seller_display_name: from.company || from.name,
        include_unavailable_quotes: false,
      }),
    });

    const quotes: any[] = (data && data.quotes) || [];
    const rates = quotes
      .map((q) => {
        const sig = input.signature ? signatureOption(q) : null;
        // Skip rates that can't do signature when it's required.
        if (input.signature && !sig) return null;
        const total = Number(q.total_charge || 0) + (sig ? sig.price : 0);
        return {
          // rate id carries the signature choice so buy() can send it back
          id: q.rate_id + (sig ? "|" + sig.value : ""),
          carrier: cleanCarrier(q.carrier_id || q.service_carrier || q.carrier),
          service: q.service_name,
          rate: total.toFixed(2),
          currency: q.currency || q.currency_code || "USD",
          delivery_days: daysUntil(q.delivery_estimate || q.delivery_date),
        };
      })
      .filter(Boolean) as any[];

    return { shipmentRef: data.remote_shipment_id, rates };
  },

  async buy({ shipmentRef, rateId, input, reference }) {
    const [quoteId, sigValue] = rateId.split("|");
    const shipment: any = { remote_shipment_id: shipmentRef, rate_id: quoteId };
    if (sigValue) shipment[SIG_KEY] = sigValue;
    // Print the order reference (EB-123) on the label.
    const ref = String(reference || (input && input.reference) || "").trim();
    if (ref) shipment.custom_messages = ["Ref " + ref];

    const data = await veeqoFetch("/shipping/api/v1/shipments", {
      method: "POST",
      body: JSON.stringify({ label_format: "PDF", shipments: [shipment] }),
    });

    const failed = data && data.failed && data.failed[shipmentRef];
    if (failed) {
      const errs: string[] = failed.error_messages || failed.errors || ["Label purchase failed"];
      const msg = errs.join("; ");
      throw new Error(
        /expire/i.test(msg) ? "Veeqo rate expired — click Refresh rates and try again." : msg
      );
    }
    const ok = data && data.successful && data.successful[shipmentRef];
    if (!ok || !ok.label_content) throw new Error("Veeqo returned no label");

    const carrier = cleanCarrier(ok.carrier_id || ok.service_carrier);
    const tn = String(ok.tracking_number || "");
    const label_url = await uploadLabel(ok.label_content, tn);

    return {
      shipmentRef,
      transactionRef: ok.external_shipment_id || null,
      trackerRef: null,
      label_url,
      tracking_number: tn || null,
      tracking_url: trackingUrl(carrier, tn),
      carrier,
      service: ok.service_name || null,
      rate: ok.total_charge && ok.total_charge.value != null ? Number(ok.total_charge.value) : null,
      currency: (ok.total_charge && ok.total_charge.unit) || "USD",
    };
  },

  async refund({ shipmentRef }) {
    if (!shipmentRef) throw new Error("Missing Veeqo shipment id");
    await veeqoFetch("/shipping/api/v1/shipments/" + encodeURIComponent(shipmentRef), {
      method: "DELETE",
    });
    return { refund_status: "submitted" };
  },
};
