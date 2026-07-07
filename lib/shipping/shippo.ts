import {
  ShippingProvider, ShipmentInput, shipFromAddress, toOunces,
} from "./types";

const BASE = "https://api.goshippo.com";

async function shippo(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY!}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || JSON.stringify(data));
  return data;
}

const ALLOWED = ["USPS", "UPS", "FedEx"];

export const shippoProvider: ShippingProvider = {
  async getRates(input: ShipmentInput) {
    const from = shipFromAddress();
    const shipment = await shippo("/shipments/", {
      method: "POST",
      body: JSON.stringify({
        address_from: {
          name: from.name, company: from.company, street1: from.street1,
          city: from.city, state: from.state, zip: from.zip,
          country: from.country, phone: from.phone, email: from.email,
        },
        address_to: {
          name: input.to.name, street1: input.to.street1, street2: input.to.street2,
          city: input.to.city, state: input.to.state, zip: input.to.zip,
          country: input.to.country || "US", phone: input.to.phone, email: input.to.email,
        },
        parcels: [{
          length: String(input.parcel.length),
          width: String(input.parcel.width),
          height: String(input.parcel.height),
          distance_unit: "in",
          weight: String(toOunces(input.parcel)),
          mass_unit: "oz",
        }],
        extra: {
          ...(input.signature ? { signature_confirmation: "STANDARD" } : {}),
          ...(input.isReturn ? { is_return: true } : {}),
        },
        async: false,
      }),
    });
    return {
      shipmentRef: shipment.object_id,
      rates: (shipment.rates || [])
        .filter((r: any) => ALLOWED.includes(r.provider))
        .sort((a: any, b: any) => Number(a.amount) - Number(b.amount))
        .map((r: any) => ({
          id: r.object_id,
          carrier: r.provider,
          service: r.servicelevel?.name ?? r.servicelevel?.token ?? "",
          rate: r.amount,
          currency: r.currency,
          delivery_days: r.estimated_days ?? null,
        })),
    };
  },

  async buy({ shipmentRef, rateId }) {
    const t = await shippo("/transactions/", {
      method: "POST",
      body: JSON.stringify({
        rate: rateId,
        label_file_type: "PDF_4x6",
        async: false,
      }),
    });
    if (t.status !== "SUCCESS") {
      const msg = (t.messages || []).map((m: any) => m.text).join("; ");
      throw new Error(msg || "Shippo could not purchase the label");
    }
    return {
      shipmentRef,
      transactionRef: t.object_id,
      trackerRef: null,
      label_url: t.label_url ?? null,
      tracking_number: t.tracking_number ?? null,
      tracking_url: t.tracking_url_provider ?? null,
      carrier: t.rate?.provider ?? null,
      service: t.rate?.servicelevel?.name ?? null,
      rate: t.rate?.amount ? Number(t.rate.amount) : null,
      currency: t.rate?.currency ?? "USD",
    };
  },

  async refund({ transactionRef }) {
    if (!transactionRef) throw new Error("Missing Shippo transaction id");
    const r = await shippo("/refunds/", {
      method: "POST",
      body: JSON.stringify({ transaction: transactionRef, async: false }),
    });
    return { refund_status: (r.status || "PENDING").toLowerCase() };
  },
};
