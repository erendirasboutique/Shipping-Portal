import {
  ShippingProvider, ShipmentInput, shipFromAddress, toOunces,
} from "./types";

const BASE = "https://api.easypost.com/v2";
const auth = () =>
  "Basic " + Buffer.from(`${process.env.EASYPOST_API_KEY!}:`).toString("base64");

async function ep(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: auth(), "Content-Type": "application/json" },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `EasyPost error (${res.status})`);
  return data;
}

const ALLOWED = ["USPS", "UPS", "UPSDAP", "FedEx", "FedExDefault"];
const cleanCarrier = (c: string) =>
  c.startsWith("UPS") ? "UPS" : c.startsWith("FedEx") ? "FedEx" : c;

export const easypost: ShippingProvider = {
  async getRates(input: ShipmentInput) {
    const shipment = await ep("/shipments", {
      method: "POST",
      body: JSON.stringify({
        shipment: {
          to_address: { ...input.to, country: input.to.country || "US" },
          from_address: shipFromAddress(),
          parcel: {
            length: input.parcel.length,
            width: input.parcel.width,
            height: input.parcel.height,
            weight: toOunces(input.parcel),
          },
          options: {
            label_format: "PDF",
            label_size: "4x6",
            ...(input.signature ? { delivery_confirmation: "SIGNATURE" } : {}),
          },
          ...(input.isReturn ? { is_return: true } : {}),
        },
      }),
    });
    return {
      shipmentRef: shipment.id,
      rates: (shipment.rates || [])
        .filter((r: any) => ALLOWED.includes(r.carrier))
        .sort((a: any, b: any) => Number(a.rate) - Number(b.rate))
        .map((r: any) => ({
          id: r.id,
          carrier: cleanCarrier(r.carrier),
          service: r.service,
          rate: r.rate,
          currency: r.currency,
          delivery_days: r.delivery_days ?? null,
          retail_rate: r.retail_rate ?? r.list_rate ?? null,
        })),
    };
  },

  async buy({ shipmentRef, rateId, input }) {
    const insure = input?.insurance && input.insurance > 0 ? Number(input.insurance).toFixed(2) : null;
    const b = await ep(`/shipments/${shipmentRef}/buy`, {
      method: "POST",
      body: JSON.stringify({ rate: { id: rateId }, ...(insure ? { insurance: insure } : {}) }),
    });
    return {
      shipmentRef: b.id,
      transactionRef: null,
      trackerRef: b.tracker?.id ?? null,
      label_url: b.postage_label?.label_url ?? null,
      tracking_number: b.tracking_code ?? null,
      tracking_url: b.tracker?.public_url ?? null,
      carrier: cleanCarrier(b.selected_rate?.carrier ?? ""),
      service: b.selected_rate?.service ?? null,
      rate: b.selected_rate?.rate ? Number(b.selected_rate.rate) : null,
      currency: b.selected_rate?.currency ?? "USD",
    };
  },

  async refund({ shipmentRef }) {
    if (!shipmentRef) throw new Error("Missing EasyPost shipment id");
    const r = await ep(`/shipments/${shipmentRef}/refund`, { method: "POST" });
    return { refund_status: r.refund_status || "submitted" };
  },
};
