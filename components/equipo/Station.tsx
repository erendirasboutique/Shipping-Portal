"use client";

// Frame for the team stations: back to Estaciones, title, the live sale
// picker. Phone first, big touch targets, Spanish.

import Link from "next/link";
import Shell from "@/components/Shell";
import { saleLabel, type ESale } from "@/components/equipo/useEquipo";

export default function Station({
  title,
  eyebrow,
  sale,
  sales,
  onSale,
  home = false,
  children,
}: {
  title: string;
  eyebrow?: string;
  sale?: ESale | null;
  sales?: ESale[];
  onSale?: (id: string) => void;
  home?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Shell>
      <div className="mx-auto max-w-xl">
        {!home && (
          <Link href="/equipo" className="mb-2 inline-flex min-h-[44px] items-center gap-1.5 text-[16px] text-ink/70">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
            Estaciones
          </Link>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1 className="mt-1 text-4xl md:text-5xl">{title}</h1>
          </div>
          {sales && sales.length > 0 && onSale && (
            <label className="flex flex-col text-[13px] text-ink/60">
              <span className="sr-only">Live</span>
              <select
                className="input !w-auto !rounded-full !py-2 !text-[15px]"
                value={sale?.id || ""}
                onChange={(e) => onSale(e.target.value)}
              >
                {sales.map((s) => (
                  <option key={s.id} value={s.id}>{saleLabel(s)}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="mt-4 space-y-4">{children}</div>
      </div>
    </Shell>
  );
}
