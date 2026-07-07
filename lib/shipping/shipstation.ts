import {
  ShippingProvider, ShipmentInput, shipFromAddress, toOunces,
} from "./types";

const BASE = "https://api.shipstation.com/v2";

async function ss(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "API-Key": process.env.SHIPSTATION_API_KEY!,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.errors?.map((e: any) => e.message).join("; ");
    throw new Error(msg || `ShipStation error (${res.status})`);
  }
  return data;
}

function buildShipment(input: ShipmentInput) {
  const from = shipFromAddress();
  return {
    ship_from: {
      name: from.name, company_name: from.company,
      address_line1: from.street1, city_locality: from.city,
      state_province: from.state, postal_code: from.zip,
      country_code: from.country, phone: from.phone,
    },
    ship_to: {
      name: input.to.name,
      address_line1: input.to.street1,
      address_line2: input.to.street2 || undefined,
      city_locality: input.to.city, state_province: input.to.state,
      postal_code: input.to.zip, country_code: input.to.country || "US",
      phone: input.to.phone || undefined,
    },
    confirmation: input.signature ? "signature" : "none",
    packages: [{
      weight: { value: toOunces(input.parcel), unit: "ounce" },
      dimensions: {
        length: input.parcel.length, width: input.parcel.width,
        height: input.parcel.height, unit: "inch",
      },
    }],
    ...(input.isReturn ? { is_return: true } : {}),
  };
}

const totalAmount = (r: any) =>
  ["shipping_amount", "insurance_amount", "confirmation_amount", "other_amount"]
    .reduce((s, k) => s + Number(r?.[k]?.amount || 0), 0);

export const shipstation: ShippingProvider = {
  async getRates(input: ShipmentInput) {
    const carrierIds = (process.env.SHIPSTATION_CARRIER_IDS || "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    if (!carrierIds.length) {
      throw new Error("Set SHIPSTATION_CARRIER_IDS to your connected carrier ids (se-...)");
    }
    const data = await ss("/rates", {
      method: "POST",
      body: JSON.stringify({
        shipment: buildShipment(input),
        rate_options: { carrier_ids: carrierIds },
      }),
    });
    const rates = data.rate_response?.rates || [];
    const errors = data.rate_response?.errors || [];
    if (!rates.length && errors.length) {
      throw new Error(errors.map((e: any) => e.message).join("; "));
    }
    return {
      shipmentRef: data.shipment_id,
      rates: rates
        .sort((a: any, b: any) => totalAmount(a) - totalAmount(b))
        .map((r: any) => ({
          id: r.rate_id,
          carrier: r.carrier_friendly_name || r.carrier_code?.toUpperCase() || "",
          service: r.service_type || r.service_code,
          rate: totalAmount(r).toFixed(2),
          currency: r.shipping_amount?.currency?.toUpperCase() || "USD",
          delivery_days: r.delivery_days ?? null,
        })),
    };
  },

  async buy({ shipmentRef, rateId }) {
    const label = await ss(`/labels/rates/${rateId}`, {
      method: "POST",
      body: JSON.stringify({
        label_format: "pdf",
        label_layout: "4x6",
      }),
    });
    return {
      shipmentRef: label.shipment_id ?? shipmentRef,
      transactionRef: label.label_id ?? null, // needed for void
      trackerRef: null,
      label_url: label.label_download?.href ?? label.label_download?.pdf ?? null,
      tracking_number: label.tracking_number ?? null,
      tracking_url: label.tracking_number
        ? `https://track.erendirasboutique.com/?tracking=${label.tracking_number}`
        : null,
      carrier: label.carrier_code?.toUpperCase() ?? null,
      service: label.service_code ?? null,
      rate: label.shipment_cost?.amount != null ? Number(label.shipment_cost.amount) : null,
      currency: label.shipment_cost?.currency?.toUpperCase() ?? "USD",
    };
  },

  async refund({ transactionRef }) {
    if (!transactionRef) throw new Error("Missing ShipStation label id");
    const r = await ss(`/labels/${transactionRef}/void`, { method: "PUT" });
    if (r.approved === false) throw new Error(r.message || "Void was not approved");
    return { refund_status: "submitted" };
  },
};
