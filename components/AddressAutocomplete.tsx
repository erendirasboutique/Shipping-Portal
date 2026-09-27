"use client";

// Street address input with Google address suggestions (Places API New).
// Needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in Vercel. Without it, this is a normal input.

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

export type PickedAddress = {
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
};

type Suggestion = { placeId: string; main: string; secondary: string };

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

function newSessionToken(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {}
  return String(Date.now()) + "-" + Math.random().toString(36).slice(2);
}

function parsePlace(place: any, fallbackStreet: string): PickedAddress {
  const comps: any[] = Array.isArray(place?.addressComponents) ? place.addressComponents : [];
  function get(type: string, short = false): string {
    const c = comps.find((x) => Array.isArray(x.types) && x.types.includes(type));
    if (!c) return "";
    return (short ? c.shortText : c.longText) || c.longText || c.shortText || "";
  }
  const number = get("street_number");
  const route = get("route", true);
  const street1 = number && route ? number + " " + route : route || fallbackStreet;
  const sub = get("subpremise");
  const city =
    get("locality") ||
    get("postal_town") ||
    get("sublocality_level_1") ||
    get("sublocality") ||
    get("neighborhood") ||
    get("administrative_area_level_3");
  return {
    street1,
    street2: sub ? "#" + sub : "",
    city,
    state: get("administrative_area_level_1", true).toUpperCase(),
    zip: get("postal_code"),
  };
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  className = "input",
  placeholder,
  poweredBy = "Powered by Google",
  id,
}: {
  value: string;
  onChange: (text: string) => void;
  onSelect: (address: PickedAddress) => void;
  className?: string;
  placeholder?: string;
  poweredBy?: string;
  id?: string;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const sessionRef = useRef<string>("");
  const reqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function lookup(text: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = text.trim();
    if (!API_KEY || q.length < 3) {
      setItems([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      const reqId = ++reqRef.current;
      if (!sessionRef.current) sessionRef.current = newSessionToken();
      try {
        const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": API_KEY },
          body: JSON.stringify({
            input: q,
            sessionToken: sessionRef.current,
            includedRegionCodes: ["us"],
            includedPrimaryTypes: ["street_address", "premise", "subpremise"],
            languageCode: "en",
          }),
        });
        if (reqId !== reqRef.current) return;
        if (!res.ok) {
          setItems([]);
          setOpen(false);
          return;
        }
        const data = await res.json();
        const list: Suggestion[] = (data?.suggestions || [])
          .map((s: any) => s?.placePrediction)
          .filter(Boolean)
          .slice(0, 5)
          .map((p: any) => ({
            placeId: p.placeId,
            main: p.structuredFormat?.mainText?.text || p.text?.text || "",
            secondary: (p.structuredFormat?.secondaryText?.text || "").replace(/, USA$/, ""),
          }));
        setItems(list);
        setActive(0);
        setOpen(list.length > 0);
      } catch {
        if (reqId === reqRef.current) {
          setItems([]);
          setOpen(false);
        }
      }
    }, 250);
  }

  async function pick(s: Suggestion) {
    setOpen(false);
    setItems([]);
    reqRef.current++;
    const token = sessionRef.current;
    sessionRef.current = "";
    try {
      const url =
        "https://places.googleapis.com/v1/places/" +
        encodeURIComponent(s.placeId) +
        (token ? "?sessionToken=" + encodeURIComponent(token) : "");
      const res = await fetch(url, {
        headers: { "X-Goog-Api-Key": API_KEY, "X-Goog-FieldMask": "addressComponents" },
      });
      if (!res.ok) throw new Error("details failed");
      const place = await res.json();
      onSelect(parsePlace(place, s.main));
    } catch {
      onChange(s.main);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        className={className}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          lookup(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (items.length) setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && items.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-taupe/20 bg-white shadow-lg">
          {items.map((s, i) => (
            <button
              key={s.placeId}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              onMouseEnter={() => setActive(i)}
              className={`block w-full px-4 py-2.5 text-left text-sm ${i === active ? "bg-cream" : "hover:bg-cream"}`}
            >
              <span className="block font-medium">📍 {s.main}</span>
              {s.secondary && <span className="block pl-6 text-xs text-ink/60">{s.secondary}</span>}
            </button>
          ))}
          <div className="border-t border-taupe/10 px-4 py-1 text-right text-[11px] text-ink/40">{poweredBy}</div>
        </div>
      )}
    </div>
  );
}
