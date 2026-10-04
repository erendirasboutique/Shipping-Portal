// lib/shipping/veeqo.ts
// Veeqo Rate Shopping API helper (plain fetch, no SDK).
// Docs: https://developers.veeqo.com/rate-shopping-api/
// Env: VEEQO_API_KEY  (Veeqo > Settings > Users > Edit > API key)

const VEEQO_BASE = "https://api.veeqo.com";

export type VeeqoAddress = {
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string; // defaults to US
};

export type VeeqoParcel = {
  weightOz: number;
  length?: number;
  width?: number;
  height?: number;
};

export type VeeqoRate = {
  provider: "veeqo";
  rateId: string;
  remoteShipmentId: string;
  carrier: string; // e.g. "USPS", "UPS", "AMAZON", "ONTRAC"
  service: string;
  serviceId: string;
  amount: number;
  currency: string;
  deliveryDate: string | null;
  expiresAt: string | null;
};

export type VeeqoLabel = {
  trackingNumber: string;
  carrier: string;
  service: string;
  amount: number;
  remoteShipmentId: string;
  labelPdfBase64: string;
};

function apiKey(): string {
  const key = process.env.VEEQO_API_KEY;
  if (!key) throw new Error("VEEQO_API_KEY is not set");
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
      "Veeqo request failed (" + res.status + ")";
    throw new Error(msg);
  }
  return data;
}

function toVeeqoAddress(a: VeeqoAddress) {
  return {
    name: a.name,
    company: a.company || undefined,
    phone: a.phone || undefined,
    email: a.email || undefined,
    line1: a.line1,
    line2: a.line2 || undefined,
    town: a.city,
    county: a.state,
    postcode: a.zip,
    country_code: a.country || "US",
  };
}

export async function getVeeqoRates(opts: {
  from: VeeqoAddress;
  to: VeeqoAddress;
  parcel: VeeqoParcel;
  reference?: string; // e.g. EB-123
  value?: number;
}): Promise<VeeqoRate[]> {
  const p = opts.parcel;
  const body: any = {
    from_address: toVeeqoAddress(opts.from),
    to_address: toVeeqoAddress(opts.to),
    parcels: [
      {
        weight: p.weightOz,
        weight_unit: "oz",
        length: p.length,
        width: p.width,
        height: p.height,
        dimension_unit: "in",
      },
    ],
    customer_reference: opts.reference,
    seller_display_name: "Erendira's Boutique",
    include_unavailable_quotes: false,
  };
  if (opts.value) {
    body.estimated_value = opts.value.toFixed(2);
    body.currency_code = "USD";
  }

  const data = await veeqoFetch("/shipping/api/v1/rates", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const quotes: any[] = (data && data.quotes) || [];
  return quotes
    .map((q) => ({
      provider: "veeqo" as const,
      rateId: q.rate_id,
      remoteShipmentId: data.remote_shipment_id,
      carrier: String(q.carrier_id || q.service_carrier || "").toUpperCase(),
      service: q.service_name,
      serviceId: q.service_id,
      amount: Number(q.total_charge),
      currency: q.currency || q.currency_code || "USD",
      deliveryDate: q.delivery_estimate || q.delivery_date || null,
      expiresAt: data.expires_at || null,
    }))
    .sort((a, b) => a.amount - b.amount);
}

export async function buyVeeqoLabel(opts: {
  remoteShipmentId: string;
  rateId: string;
  insuranceAmount?: number;
}): Promise<VeeqoLabel> {
  const shipment: any = {
    remote_shipment_id: opts.remoteShipmentId,
    rate_id: opts.rateId,
  };
  if (opts.insuranceAmount) shipment.liability_amount = opts.insuranceAmount;

  const data = await veeqoFetch("/shipping/api/v1/shipments", {
    method: "POST",
    body: JSON.stringify({ label_format: "PDF", shipments: [shipment] }),
  });

  const failed = data && data.failed && data.failed[opts.remoteShipmentId];
  if (failed) {
    const errs = failed.error_messages || failed.errors || ["Label purchase failed"];
    throw new Error(errs.join("; "));
  }
  const ok = data && data.successful && data.successful[opts.remoteShipmentId];
  if (!ok) throw new Error("Veeqo returned no label for this shipment");

  return {
    trackingNumber: ok.tracking_number,
    carrier: String(ok.carrier_id || ok.service_carrier || "").toUpperCase(),
    service: ok.service_name,
    amount: Number(ok.total_charge && ok.total_charge.value),
    remoteShipmentId: opts.remoteShipmentId,
    labelPdfBase64: ok.label_content,
  };
}

// Re-download a label later (reprints). id = remote shipment id or tracking number.
export async function getVeeqoLabelPdf(id: string): Promise<ArrayBuffer> {
  const res = await fetch(
    VEEQO_BASE + "/shipping/api/v1/shipments/" + encodeURIComponent(id) + "/label.pdf",
    { headers: { "x-api-key": apiKey() }, cache: "no-store" }
  );
  if (!res.ok) throw new Error("Could not fetch Veeqo label (" + res.status + ")");
  return res.arrayBuffer();
}

// Void a label. id = remote shipment id or tracking number.
export async function voidVeeqoLabel(id: string): Promise<void> {
  await veeqoFetch("/shipping/api/v1/shipments/" + encodeURIComponent(id), {
    method: "DELETE",
  });
}
