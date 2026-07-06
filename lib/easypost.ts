// Thin EasyPost REST wrapper — server-side only.

const EP_BASE = "https://api.easypost.com/v2";

function authHeader() {
  const key = process.env.EASYPOST_API_KEY!;
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

export async function ep(path: string, init?: RequestInit) {
  const res = await fetch(`${EP_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `EasyPost error (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export function shipFromAddress() {
  return {
    name: process.env.SHIP_FROM_NAME,
    company: process.env.SHIP_FROM_COMPANY,
    street1: process.env.SHIP_FROM_STREET1,
    city: process.env.SHIP_FROM_CITY,
    state: process.env.SHIP_FROM_STATE,
    zip: process.env.SHIP_FROM_ZIP,
    country: process.env.SHIP_FROM_COUNTRY || "US",
    phone: process.env.SHIP_FROM_PHONE,
    email: process.env.SHIP_FROM_EMAIL,
  };
}

export interface ParcelInput {
  length: number;
  width: number;
  height: number;
  weight_lb: number;
  weight_oz: number;
}

export function toOunces(p: ParcelInput) {
  return Number(p.weight_lb || 0) * 16 + Number(p.weight_oz || 0);
}

export interface ToAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
  phone?: string;
  email?: string;
}

// Create a shipment and get rates (USPS / UPS / FedEx).
export async function createShipment(opts: {
  to: ToAddress;
  parcel: ParcelInput;
  signature?: boolean;
  isReturn?: boolean;
}) {
  const shipment: Record<string, unknown> = {
    to_address: { ...opts.to, country: opts.to.country || "US" },
    from_address: shipFromAddress(),
    parcel: {
      length: opts.parcel.length,
      width: opts.parcel.width,
      height: opts.parcel.height,
      weight: toOunces(opts.parcel),
    },
    options: {
      label_format: "PDF",
      label_size: "4x6",
      ...(opts.signature ? { delivery_confirmation: "SIGNATURE" } : {}),
    },
    ...(opts.isReturn ? { is_return: true } : {}),
  };
  return ep("/shipments", {
    method: "POST",
    body: JSON.stringify({ shipment }),
  });
}

const ALLOWED_CARRIERS = ["USPS", "UPS", "UPSDAP", "FedEx", "FedExDefault"];

export function filterRates(shipment: any) {
  return (shipment.rates || [])
    .filter((r: any) => ALLOWED_CARRIERS.includes(r.carrier))
    .sort((a: any, b: any) => Number(a.rate) - Number(b.rate))
    .map((r: any) => ({
      id: r.id,
      carrier: r.carrier.startsWith("UPS")
        ? "UPS"
        : r.carrier.startsWith("FedEx")
        ? "FedEx"
        : r.carrier,
      service: r.service,
      rate: r.rate,
      currency: r.currency,
      delivery_days: r.delivery_days,
    }));
}

export async function buyShipment(shipmentId: string, rateId: string) {
  return ep(`/shipments/${shipmentId}/buy`, {
    method: "POST",
    body: JSON.stringify({ rate: { id: rateId } }),
  });
}

export async function refundShipment(shipmentId: string) {
  return ep(`/shipments/${shipmentId}/refund`, { method: "POST" });
}
