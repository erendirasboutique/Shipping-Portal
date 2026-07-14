// lib/carriers/easyship.ts
//
// Easyship provider for erendira-shipping-studio.
// Mirrors the getRates / createLabel shape used by the EasyPost + Shippo providers.
//
// Env vars:
//   EASYSHIP_ENV                 "sandbox" | "production"  (defaults to "sandbox")
//   EASYSHIP_API_TOKEN_SANDBOX   Bearer token for the Sandbox integration
//   EASYSHIP_API_TOKEN_PROD      Bearer token for the Production integration
//
// Tokens are created in the Easyship dashboard (Connect > New Integration >
// API Integration > choose Sandbox or Production). You can tell them apart by
// prefix — production tokens are prefixed "prod". Endpoints and base URL are
// identical across environments; only the token differs.
//
// Sandbox notes:
//   - Rates/labels are illustrative and the courier list is NOT the full slate.
//     Verify coverage in production; use sandbox to shake out request shape.
//   - PATCH /sandbox/trackings/{id} can push fake tracking updates for testing
//     the webhook-driven notification email flow.

const API_BASE = "https://public-api.easyship.com";
const API_VERSION = "2024-09";

// ---------------------------------------------------------------------------
// Public input / output types
// ---------------------------------------------------------------------------

export interface Address {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string; // required for US/CA/MX/AU to get accurate rates
  zip: string;
  country?: string; // ISO 3166-1 alpha-2, defaults to "US"
  phone?: string;
  email?: string;
}

export interface Parcel {
  length: number;
  width: number;
  height: number;
  weight: number; // total weight in `units.weight`
}

export interface ShipmentItem {
  description?: string;
  quantity?: number;
  value?: number; // declared customs value
  currency?: string; // defaults to "USD"
  hsCode?: string;
}

export interface Units {
  weight: "lb" | "kg";
  dimensions: "in" | "cm";
}

export interface ShipmentInput {
  from: Address;
  to: Address;
  parcel: Parcel;
  units?: Units; // defaults to { weight: "lb", dimensions: "in" }
  items?: ShipmentItem[]; // needed for international (customs)
  international?: boolean;
}

// Normalized rate — align these field names with your EasyPost/Shippo output
// so the carrier selector treats all providers identically.
export interface NormalizedRate {
  provider: "easyship";
  serviceId: string; // pass back as courier_service_id when buying
  carrier: string;
  service: string;
  amount: number; // total incl. Easyship fees
  currency: string;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
  raw: EasyshipRate;
}

export interface NormalizedShipment {
  provider: "easyship";
  shipmentId: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  carrier: string | null;
  raw: EasyshipShipment;
}

// ---------------------------------------------------------------------------
// Easyship API response types (partial — only what we consume)
// ---------------------------------------------------------------------------

export interface EasyshipRate {
  courier_id?: string;
  courier_service_id?: string;
  courier_name?: string;
  umbrella_name?: string;
  full_description?: string;
  total_charge?: number;
  currency?: string;
  min_delivery_time?: number | null;
  max_delivery_time?: number | null;
  [key: string]: unknown;
}

export interface EasyshipShipment {
  easyship_shipment_id?: string;
  id?: string;
  tracking_number?: string | null;
  tracking_page_url?: string | null;
  label_url?: string | null;
  label_state?: "pending" | "generating" | "generated" | "failed" | string;
  label_paid_at?: string | null;
  courier_name?: string | null;
  courier?: { name?: string } | null;
  shipping_documents?: { label?: { url?: string } } | null;
  [key: string]: unknown;
}

interface RatesResponse {
  rates?: EasyshipRate[];
  [key: string]: unknown;
}

interface ShipmentResponse {
  shipment?: EasyshipShipment;
  [key: string]: unknown;
}

interface EasyshipError {
  error?: { code?: string; message?: string; details?: string };
}

export class EasyshipRequestError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "EasyshipRequestError";
    this.status = status;
    this.body = body;
  }
}

// ---------------------------------------------------------------------------
// Auth + low-level fetch
// ---------------------------------------------------------------------------

function authHeaders(): Record<string, string> {
  const env = process.env.EASYSHIP_ENV || "sandbox";
  const token =
    env === "production"
      ? process.env.EASYSHIP_API_TOKEN_PROD
      : process.env.EASYSHIP_API_TOKEN_SANDBOX;
  if (!token) throw new Error(`EASYSHIP token missing for env: ${env}`);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function easyshipFetch<T>(
  path: string,
  { method = "POST", body }: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}/${API_VERSION}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const errBody = data as EasyshipError;
    const msg =
      errBody?.error?.message ||
      errBody?.error?.details ||
      `Easyship ${method} ${path} failed (${res.status})`;
    throw new EasyshipRequestError(msg, res.status, data);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------
// NOTE: confirm these address sub-field names against the Address object in the
// docs (rates_request reference keeps origin/destination collapsed). A wrong
// field name yields an EMPTY rate array rather than an error — first place to
// check if sandbox returns nothing.
function toEasyshipAddress(a: Address) {
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

function toEasyshipItems(items: ShipmentItem[] | undefined) {
  const source: ShipmentItem[] = items || [
    { description: "Merchandise", quantity: 1, value: 1, currency: "USD" },
  ];
  return source.map((it) => ({
    description: it.description || "Merchandise",
    quantity: it.quantity || 1,
    declared_currency: it.currency || "USD",
    declared_customs_value: it.value ?? 1,
    hs_code: it.hsCode || undefined,
  }));
}

function buildParcels(shipment: ShipmentInput) {
  return [
    {
      total_actual_weight: shipment.parcel.weight,
      box: {
        length: shipment.parcel.length,
        width: shipment.parcel.width,
        height: shipment.parcel.height,
      },
      items: toEasyshipItems(shipment.items),
    },
  ];
}

// ---------------------------------------------------------------------------
// getRates
// ---------------------------------------------------------------------------
export async function getRates(
  shipment: ShipmentInput
): Promise<NormalizedRate[]> {
  const units: Units = shipment.units || { weight: "lb", dimensions: "in" };
  const isIntl = !!shipment.international;

  const body = {
    origin_address: toEasyshipAddress(shipment.from),
    destination_address: toEasyshipAddress(shipment.to),
    incoterms: "DDU",
    parcels: buildParcels(shipment),
    shipping_settings: {
      units: { weight: units.weight, dimensions: units.dimensions },
    },
    calculate_tax_and_duties: isIntl,
  };

  const data = await easyshipFetch<RatesResponse>("/rates", {
    method: "POST",
    body,
  });
  const rates = data.rates || [];

  return rates.map((r) => ({
    provider: "easyship" as const,
    serviceId: (r.courier_id || r.courier_service_id) as string,
    carrier: (r.courier_name || r.umbrella_name || "") as string,
    service: (r.full_description || r.courier_name || "") as string,
    amount: r.total_charge ?? 0,
    currency: r.currency || "USD",
    deliveryDaysMin: r.min_delivery_time ?? null,
    deliveryDaysMax: r.max_delivery_time ?? null,
    raw: r,
  }));
}

// ---------------------------------------------------------------------------
// createLabel
// ---------------------------------------------------------------------------
// Easyship label generation is frequently ASYNC. The shipment often returns with
// label_state !== "generated" and label_url null; pollLabel() waits for it.
export async function createLabel({
  shipment,
  serviceId,
}: {
  shipment: ShipmentInput;
  serviceId: string;
}): Promise<NormalizedShipment> {
  const units: Units = shipment.units || { weight: "lb", dimensions: "in" };

  const body = {
    origin_address: toEasyshipAddress(shipment.from),
    destination_address: toEasyshipAddress(shipment.to),
    incoterms: "DDU",
    courier_service_id: serviceId,
    parcels: buildParcels(shipment),
    shipping_settings: {
      units: { weight: units.weight, dimensions: units.dimensions },
      buy_label: true,
      buy_label_synchronous: true,
    },
  };

  const data = await easyshipFetch<ShipmentResponse>("/shipments", {
    method: "POST",
    body,
  });
  const s: EasyshipShipment = data.shipment || (data as EasyshipShipment);

  const labelUrl = s.label_url || s.shipping_documents?.label?.url || null;
  if (labelUrl && (s.label_state === "generated" || s.label_paid_at)) {
    return normalizeShipment(s, labelUrl);
  }

  const id = s.easyship_shipment_id || s.id;
  if (!id) throw new Error("Easyship shipment created without an id");
  return await pollLabel(id);
}

export async function pollLabel(
  shipmentId: string,
  { attempts = 8, delayMs = 1500 }: { attempts?: number; delayMs?: number } = {}
): Promise<NormalizedShipment> {
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    const data = await easyshipFetch<ShipmentResponse>(
      `/shipments/${shipmentId}`,
      { method: "GET" }
    );
    const s: EasyshipShipment = data.shipment || (data as EasyshipShipment);
    const labelUrl = s.label_url || s.shipping_documents?.label?.url || null;
    if (labelUrl && s.label_state === "generated") {
      return normalizeShipment(s, labelUrl);
    }
    if (s.label_state === "failed") {
      throw new Error(`Easyship label generation failed for ${shipmentId}`);
    }
  }
  throw new Error(
    `Easyship label not ready after polling (${shipmentId}). Store the id and retry later.`
  );
}

function normalizeShipment(
  s: EasyshipShipment,
  labelUrl: string | null
): NormalizedShipment {
  return {
    provider: "easyship",
    shipmentId: (s.easyship_shipment_id || s.id) as string,
    trackingNumber: s.tracking_number ?? null,
    trackingUrl: s.tracking_page_url ?? null,
    labelUrl,
    carrier: s.courier?.name || s.courier_name || null,
    raw: s,
  };
}
