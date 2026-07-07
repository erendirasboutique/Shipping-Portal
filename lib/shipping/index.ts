import { ShippingProvider } from "./types";
import { easypost } from "./easypost";
import { shippoProvider } from "./shippo";
import { shipstation } from "./shipstation";

export const PROVIDERS = ["easypost", "shippo", "shipstation"] as const;
export type ProviderName = (typeof PROVIDERS)[number];

export function getProvider(name: string | null | undefined): ShippingProvider {
  switch (name) {
    case "shippo": return shippoProvider;
    case "shipstation": return shipstation;
    case "easypost":
    default:
      return easypost;
  }
}
