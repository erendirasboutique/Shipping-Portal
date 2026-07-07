import { ShippingProvider } from "./types";
import { easypost } from "./easypost";
import { shippoProvider } from "./shippo";
import { pitneybowes } from "./pitneybowes";

export const PROVIDERS = ["easypost", "shippo", "pitneybowes"] as const;
export type ProviderName = (typeof PROVIDERS)[number];

export function getProvider(name: string | null | undefined): ShippingProvider {
  switch (name) {
    case "shippo": return shippoProvider;
    case "pitneybowes": return pitneybowes;
    case "easypost":
    default:
      return easypost;
  }
}
