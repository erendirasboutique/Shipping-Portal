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
export type PackageType = "box" | "envelope";
export interface ParcelInput {
  length: number;
  width: number;
  height: number;
  weight_lb: number;
  weight_oz: number;
  /**
   * "envelope" = #10 envelope shipped as a USPS First-Class letter
   * (EasyPost only). Missing or "box" = a regular package.
   */
  package_type?: PackageType;
}
export interface ShipmentInput {
  to: ToAddress;
  /**
   * Optional override for the ship-from slot (normally the boutique, from the
   * SHIP_FROM_* env vars). On return labels (isReturn) the carrier swaps the
   * two addresses, so this is where the return package gets DELIVERED — used to
   * send a mis-delivered package straight to the right customer.
   */
  from?: ToAddress & { company?: string };
  parcel: ParcelInput;
  signature?: boolean;
  isReturn?: boolean;
  /**
   * A reference / note to print on the label (defaults to the EB order
   * number upstream). Each provider maps this to its own field — Shippo
   * prints it via transaction metadata.
   */
  reference?: string;
  /** Declared value in USD to insure the package for (EasyPost and Shippo). */
  insurance?: number;
}
export interface RateOption {
  id: string;
  carrier: string;
  service: string;
  rate: string;
  currency: string;
  delivery_days: number | null;
  retail_rate?: string | null;
}
export interface RatesResult {
  shipmentRef: string; // provider-side shipment id (or synthetic ref for PB)
  rates: RateOption[];
}
export interface PurchasedLabel {
  shipmentRef: string;
  transactionRef: string | null;
  trackerRef: string | null;
  label_url: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier: string | null;
  service: string | null;
  rate: number | null;
  currency: string;
}
export interface ShippingProvider {
  getRates(input: ShipmentInput): Promise<RatesResult>;
  buy(args: {
    shipmentRef: string;
    rateId: string;
    input: ShipmentInput;
    /** Reference to print on the label; forwarded from the buy route. */
    reference?: string;
  }): Promise<PurchasedLabel>;
  refund(args: { shipmentRef: string | null; transactionRef: string | null }): Promise<{ refund_status: string }>;
}
export function toOunces(p: ParcelInput) {
  return Number(p.weight_lb || 0) * 16 + Number(p.weight_oz || 0);
}
export function isEnvelope(p: ParcelInput) {
  return p.package_type === "envelope";
}
export function shipFromAddress(override?: ShipmentInput["from"]) {
  if (override) {
    return {
      name: override.name,
      company: override.company,
      street1: override.street1,
      street2: override.street2,
      city: override.city,
      state: override.state,
      zip: override.zip,
      country: override.country || "US",
      phone: override.phone,
      email: override.email,
    };
  }
  return {
    name: process.env.SHIP_FROM_NAME!,
    company: process.env.SHIP_FROM_COMPANY,
    street1: process.env.SHIP_FROM_STREET1!,
    street2: process.env.SHIP_FROM_STREET2 as string | undefined,
    city: process.env.SHIP_FROM_CITY!,
    state: process.env.SHIP_FROM_STATE!,
    zip: process.env.SHIP_FROM_ZIP!,
    country: process.env.SHIP_FROM_COUNTRY || "US",
    phone: process.env.SHIP_FROM_PHONE,
    email: process.env.SHIP_FROM_EMAIL,
  };
}
