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
          // Shippo prints `reference_1` in the label's reference area for
          // carriers that support it (USPS/UPS/FedEx all do). Set it at the
          // shipment level so the printed rate/label carries it.
          ...(input.reference ? { reference_1: input.reference } : {}),
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

  async buy({ shipmentRef, rateId, reference }) {
    const t = await shippo("/transactions/", {
      method: "POST",
      body: JSON.stringify({
        rate: rateId,
        label_file_type: "PDF_4x6",
        async: false,
        // `metadata` is Shippo's per-transaction reference. It prints on the
        // label for carriers that support a reference field, and shows on the
        // Shippo dashboard. Defaults upstream to the EB order number.
        ...(reference ? { metadata: reference } : {}),
      }),
    });

    if (t.status !== "SUCCESS") {
      const msg = (t.messages || []).map((m: any) => m.text).join("; ");
      throw new Error(msg || "Shippo could not purchase the label");
    }

    // A genuine purchase always has a label. If SUCCESS comes back with no
    // label_url, treat it as a failure rather than saving a draft-looking order.
    if (!t.label_url) {
      const msg = (t.messages || []).map((m: any) => m.text).join("; ");
      throw new Error(
        msg || "Shippo returned SUCCESS but no label URL — label was not purchased."
      );
    }

    // On a transaction response Shippo returns `rate` as the rate ID *string*,
    // not the expanded object — so fetch it to recover carrier/service/amount.
    let rate: any = t.rate;
    if (typeof rate === "string") {
      try {
        rate = await shippo(`/rates/${rate}`);
      } catch {
        rate = null;
      }
    }

    return {
      shipmentRef,
      transactionRef: t.object_id,
      trackerRef: null,
      label_url: t.label_url ?? null,
      tracking_number: t.tracking_number ?? null,
      tracking_url: t.tracking_url_provider ?? null,
      carrier: rate?.provider ?? null,
      service: rate?.servicelevel?.name ?? null,
      rate: rate?.amount ? Number(rate.amount) : null,
      currency: rate?.currency ?? "USD",
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
