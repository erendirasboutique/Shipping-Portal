import { ShippingProvider } from "./types";
import { easypost } from "./easypost";
import { shippoProvider } from "./shippo";
import { shipstation } from "./shipstation";
import { easyshipProvider } from "./easyship";

export const PROVIDERS = [
  "easypost",
  "shippo",
  "shipstation",
  "easyship",
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
    case "easypost":
    default:
      return easypost;
  }
}
