import type { ToAddress } from "@/lib/shipping/types";

// Where a return label is headed. Left out (or null) = the boutique, as always.
// Staff can send it somewhere else when a package went to the wrong customer,
// so the label takes it straight to the right person.
export type ShipTo = ToAddress;

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Reads `ship_to` from a request body. Returns null for the default (boutique),
 * the cleaned address when it's filled in, or throws a readable error when a
 * different address was chosen but is missing something.
 */
export function parseShipTo(raw: unknown): ShipTo | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;

  const addr: ShipTo = {
    name: clean(a.name),
    street1: clean(a.street1),
    street2: clean(a.street2) || undefined,
    city: clean(a.city),
    state: clean(a.state).toUpperCase(),
    zip: clean(a.zip),
    country: clean(a.country).toUpperCase() || "US",
    phone: clean(a.phone) || undefined,
    email: clean(a.email) || undefined,
  };

  const missing = (
    [
      ["name", "Name"],
      ["street1", "Street address"],
      ["city", "City"],
      ["state", "State"],
      ["zip", "ZIP"],
    ] as const
  ).filter(([k]) => !addr[k]).map(([, label]) => label);
  if (missing.length) throw new Error(`Ship-to address is missing: ${missing.join(", ")}`);
  if (addr.country === "US" && !/^\d{5}(-\d{4})?$/.test(addr.zip)) throw new Error("Ship-to ZIP should be 5 digits");

  return addr;
}

/** Columns saved on return_requests when a label is redirected. */
export function shipToColumns(addr: ShipTo) {
  return {
    ship_to_name: addr.name,
    ship_to_street1: addr.street1,
    ship_to_street2: addr.street2 ?? null,
    ship_to_city: addr.city,
    ship_to_state: addr.state,
    ship_to_zip: addr.zip,
    ship_to_country: addr.country || "US",
    ship_to_phone: addr.phone ?? null,
  };
}
