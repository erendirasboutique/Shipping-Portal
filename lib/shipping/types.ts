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
export interface ParcelInput {
  length: number;
  width: number;
  height: number;
  weight_lb: number;
  weight_oz: number;
}
export interface ShipmentInput {
  to: ToAddress;
  parcel: ParcelInput;
  signature?: boolean;
  isReturn?: boolean;
  /**
   * A reference / note to print on the label (defaults to the EB order
   * number upstream). Each provider maps this to its own field — Shippo
   * prints it via transaction metadata.
   */
  reference?: string;
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
export function shipFromAddress() {
  return {
    name: process.env.SHIP_FROM_NAME!,
    company: process.env.SHIP_FROM_COMPANY,
    street1: process.env.SHIP_FROM_STREET1!,
    city: process.env.SHIP_FROM_CITY!,
    state: process.env.SHIP_FROM_STATE!,
    zip: process.env.SHIP_FROM_ZIP!,
    country: process.env.SHIP_FROM_COUNTRY || "US",
    phone: process.env.SHIP_FROM_PHONE,
    email: process.env.SHIP_FROM_EMAIL,
  };
}
