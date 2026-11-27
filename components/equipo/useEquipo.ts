"use client";

// The team stations' data: one live sale's baskets. The sale picked last
// is remembered on this phone; ?sale= in the address wins.

import { useCallback, useEffect, useState } from "react";

export type EBasket = {
  id: string;
  number: number;
  status: string;
  total_cents: number;
  photo_url: string | null;
  customer: { id: string; name: string; token: string | null } | null;
  letter: string;
  sent: boolean;
  paid: boolean;
  to_confirm: boolean;
  paid_by: string | null;
  payment_method: string | null;
  order_id: string | null;
  messenger: { auto: boolean; reason: string; openUrl: string | null } | null;
};

export type ESale = { id: string; title: string | null; sale_date: string; status: string };

export type EquipoData = {
  sale: ESale | null;
  sales: ESale[];
  baskets: EBasket[];
  counts: { total: number; sent: number; paid: number; to_confirm: number; unpaid: number } | null;
  pagos_new: number;
};

const KEY = "eb-equipo-sale";

export function money(c: number | null | undefined) {
  if (c == null) return "—";
  return "$" + (c / 100).toFixed(2).replace(/\.00$/, "");
}

export function saleLabel(s: ESale | null) {
  if (!s) return "";
  if (s.title) return s.title;
  try {
    const [y, m, d] = s.sale_date.split("-").map(Number);
    return "Live del " + new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
  } catch {
    return s.sale_date;
  }
}

export function useEquipo() {
  const [data, setData] = useState<EquipoData | null>(null);
  const [error, setError] = useState("");
  const [saleId, setSaleIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let id: string | null = null;
    try {
      id = new URLSearchParams(window.location.search).get("sale") || window.localStorage.getItem(KEY);
    } catch {
      id = null;
    }
    setSaleIdState(id);
    setReady(true);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/equipo" + (saleId ? "?sale=" + encodeURIComponent(saleId) : ""), { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo cargar.");
      setData(json);
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }, [saleId]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const setSale = useCallback((id: string) => {
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      // private mode: just this visit
    }
    setSaleIdState(id);
  }, []);

  return { data, error, reload: load, setSale };
}
