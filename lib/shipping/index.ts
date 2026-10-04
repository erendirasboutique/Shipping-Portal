import { ShippingProvider } from "./types";
import { easypost } from "./easypost";
import { shippoProvider } from "./shippo";
import { shipstation } from "./shipstation";
import { easyshipProvider } from "./easyship";
import { veeqo } from "./veeqo";

export const PROVIDERS = [
  "easypost",
  "shippo",
  "shipstation",
  "easyship",
  "veeqo",
] as const;
export type ProviderName = (typeof PROVIDERS)[number];

export function getProvider(name: string | null | undefined): ShippingProvider {
  switch (name) {
    case "shippo":
      return shippoProvider;
    case "shipstation":
      return shipstation;
    case "easyship":
      return easyshipProvider;
    case "veeqo":
      return veeqo;
    case "easypost":
    default:
      return easypost;
  }
}
