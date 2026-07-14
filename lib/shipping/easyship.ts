// lib/shipping/easyship.ts
//
// Easyship provider implementing the ShippingProvider interface (API 2024-09).
//
// Flow:
//   getRates -> POST /shipments (buy_label:false). Easyship creates a draft
//               shipment AND returns rates in shipment.rates. shipmentRef is the
//               easyship_shipment_id. Drafts aren't charged until a label is
//               generated, and this path avoids the metered /rates endpoint.
//   buy      -> POST /batches/labels { easyship_shipment_id, courier_service_id }.
//               Label generation is ASYNC; we poll GET /shipments/{id} until
//               label_state === "generated".
//   refund   -> POST /shipments/{id}/cancel.
//
// Env:
//   EASYSHIP_ENV                 "sandbox" | "production" (defaults to "sandbox")
//   EASYSHIP_API_TOKEN_SANDBOX   Bearer token for the Sandbox integration
//   EASYSHIP_API_TOKEN_PROD      Bearer token for the Production integration
//
// Token scopes: public.shipment:write, public.batch:write, public.label:write.

import {
  ShippingProvider, ShipmentInput, shipFromAddress,
} from "./types";

const BASE = "https://public-api.easyship.com";
const VERSION = "2024-09";

function token() {
  const env = process.env.EASYSHIP_ENV || "sandbox";
  const t = env === "production"
    ? process.env.EASYSHIP_API_TOKEN_PROD
    : process.env.EASYSHIP_API_TOKEN_SANDBOX;
  if (!t) throw new Error(`EASYSHIP token missing for env: ${env}`);
  return t;
}

async function easyship(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}/${VERSION}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.error?.details || JSON.stringify(data));
  }
  return data;
}

// Total weight in lb (Easyship units support lb/kg, not oz).
function weightLb(p: ShipmentInput["parcel"]) {
  return Number(p.weight_lb || 0) + Number(p.weight_oz || 0) / 16;
}

// NOTE: confirm these address field names against the Create-a-Shipment
// reference. A wrong name yields an EMPTY rates array (no error) -- check here
// first if rates come back blank.
function esAddress(a: any) {
  return {
    line_1: a.street1,
    line_2: a.street2 || undefined,
    city: a.city,
    state: a.state,
    postal_code: a.zip,
    country_alpha2: a.country || "US",
    contact_name: a.name,
    company_name: a.company || undefined,
    contact_phone: a.phone || undefined,
    contact_email: a.email || undefined,
  };
}

function shipmentBody(input: ShipmentInput, buyLabel: boolean) {
  return {
    origin_address: esAddress(shipFromAddress()),
    destination_address: esAddress(input.to),
    incoterms: "DDU",
    return: !!input.isReturn,
    courier_settings: { apply_shipping_rules: true, allow_fallback: false },
    shipping_settings: {
      units: { weight: "lb", dimensions: "in" },
      buy_label: buyLabel,
      buy_label_synchronous: false,
      printing_options: { format: "pdf", label: "4x6" },
      // TODO(signature): Easyship treats signature-on-delivery as a courier-level
      // value-added service, not a simple boolean like Shippo/EasyPost. To wire
      // input.signature, either select a signature-requiring courier_service_id
      // or enforce it via account shipping rules. Confirm the additional_services
      // key before adding it here -- a wrong key can 422 the request.
    },
    parcels: [{
      total_actual_weight: weightLb(input.parcel),
      box: {
        length: input.parcel.length,
        width: input.parcel.width,
        height: input.parcel.height,
      },
      // Minimal generic item -- Easyship wants >=1. Fine for domestic; for
      // international pass real line items + hs_code + declared value.
      items: [{
        description: "Merchandise",
        quantity: 1,
        declared_currency: "USD",
        declared_customs_value: 1,
      }],
    }],
  };
}

async function pollLabel(shipmentRef: string, attempts = 10, delayMs = 1500) {
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    const { shipment: s } = await easyship(`/shipments/${shipmentRef}`, { method: "GET" });
    const labelUrl = s?.label_url ?? s?.shipping_documents?.label?.url ?? s?.label?.url ?? null;
    if (s?.label_state === "generated" && labelUrl) return s;
    if (s?.label_state === "failed") {
      throw new Error(`Easyship label generation failed for ${shipmentRef}`);
    }
  }
  throw new Error(
    `Easyship label not ready for ${shipmentRef}. Store the ref and retry, or rely on the shipment.label.created webhook.`
  );
}

export const easyshipProvider: ShippingProvider = {
  async getRates(input: ShipmentInput) {
    const { shipment } = await easyship("/shipments", {
      method: "POST",
      body: JSON.stringify(shipmentBody(input, false)),
    });
    if (!shipment?.easyship_shipment_id) {
      throw new Error("Easyship did not return a shipment id");
    }
    return {
      shipmentRef: shipment.easyship_shipment_id,
      rates: (shipment.rates || [])
        // Optional: to match the Shippo UX you can filter to a carrier allow-list
        // here, e.g. .filter((r:any) => ["USPS","UPS","FedEx"].includes(r.courier_name))
        .sort((a: any, b: any) => Number(a.total_charge) - Number(b.total_charge))
        .map((r: any) => ({
          id: r.courier_service?.id ?? r.courier_service_id ?? r.courier_id,
          carrier: r.courier_name ?? r.umbrella_name ?? "",
          service: r.full_description ?? r.courier_name ?? "",
          rate: r.total_charge != null ? String(r.total_charge) : "0",
          currency: r.currency ?? "USD",
          delivery_days: r.max_delivery_time ?? r.min_delivery_time ?? null,
        })),
    };
  },

  async buy({ shipmentRef, rateId }) {
    // Confirm the shipment + start (async) label generation.
    await easyship("/batches/labels", {
      method: "POST",
      body: JSON.stringify({
        shipments: [{ easyship_shipment_id: shipmentRef, courier_service_id: rateId }],
      }),
    });

    const s = await pollLabel(shipmentRef);
    const labelUrl = s?.label_url ?? s?.shipping_documents?.label?.url ?? s?.label?.url ?? null;

    return {
      shipmentRef,
      transactionRef: null, // Easyship has no separate transaction id
      trackerRef: null,
      label_url: labelUrl,
      tracking_number: s?.tracking_number ?? null,
      tracking_url: s?.tracking_page_url ?? null,
      carrier: s?.courier?.name ?? s?.selected_courier?.name ?? s?.courier_name ?? null,
      service: s?.courier?.full_description ?? null,
      rate: s?.total_charge != null ? Number(s.total_charge) : null,
      currency: s?.currency ?? "USD",
    };
  },

  async refund({ shipmentRef }) {
    if (!shipmentRef) throw new Error("Missing Easyship shipment id");
    // Allowed if the label failed, or the label is generated but not yet in transit.
    await easyship(`/shipments/${shipmentRef}/cancel`, { method: "POST" });
    return { refund_status: "cancelled" };
  },
};
