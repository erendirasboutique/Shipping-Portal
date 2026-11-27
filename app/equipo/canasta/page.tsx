"use client";

// B · Fotos y totales — Thursday night, any basket in any order.
// Number → photo → total with shipping → "Mandar e imprimir calcomanía":
// the basket is closed (waiting for payment), the photo + "Hola Chula
// Serian $X" go to her on Messenger (from the Page by itself when she wrote
// in the last 24 h, otherwise the share sheet), and the sticker prints.

import { useEffect, useMemo, useRef, useState } from "react";
import Station from "@/components/equipo/Station";
import { money, useEquipo, type EBasket } from "@/components/equipo/useEquipo";
import { copyText, preparePhoto, shareNow } from "@/components/equipo/share";
import { getOperator } from "@/lib/live/operator";

type Customer = { id: string; name: string; phone?: string | null; email?: string | null };

const PRINT_KEY = "eb-equipo-print";

export default function CanastaPage() {
  const { data, error, reload, setSale } = useEquipo();
  const [num, setNum] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [changingCustomer, setChangingCustomer] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Customer[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [total, setTotal] = useState("");
  const [print, setPrint] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; warn?: boolean } | null>(null);
  const [done, setDone] = useState<{ basket: EBasket; message: string; auto: "sent" | "failed" | "none" } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [shareFile, setShareFile] = useState<File | null>(null);

  // Get the photo ready for the share sheet before the tap.
  useEffect(() => {
    setShareFile(null);
    if (done && done.auto !== "sent") preparePhoto(done.basket.photo_url).then(setShareFile);
  }, [done]);

  useEffect(() => {
    try {
      setPrint(window.localStorage.getItem(PRINT_KEY) !== "0");
    } catch {
      // keep default
    }
  }, []);

  const n = Number(num);
  const current: EBasket | null = useMemo(
    () => (data && Number.isInteger(n) && n > 0 ? data.baskets.find((b) => b.number === n) || null : null),
    [data, n]
  );

  // When the number changes, show what that basket already has.
  useEffect(() => {
    setCustomer(current?.customer ? { id: current.customer.id, name: current.customer.name } : null);
    setChangingCustomer(false);
    setPhoto(current?.photo_url || null);
    setTotal(current && current.total_cents > 0 ? String(current.total_cents / 100) : "");
    setMsg(null);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Customer search
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setFound([]);
      return;
    }
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/live/customers/search?q=" + encodeURIComponent(term), { cache: "no-store" });
        const json = await res.json();
        setFound(json.customers || []);
      } catch {
        setFound([]);
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [q]);

  const left = (data?.baskets || []).filter((b) => !b.sent && !b.paid).sort((a, b) => a.number - b.number);
  const cents = Math.round(Number(String(total).replace(/[^0-9.]/g, "")) * 100);
  const needCustomer = !customer || changingCustomer;

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/live/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || "No se pudo subir la foto.");
      setPhoto(json.url);
    } catch (err: any) {
      setMsg({ text: err.message, warn: true });
    }
    setUploading(false);
  }

  function startOver() {
    setDone(null);
    setNum("");
    setPhoto(null);
    setTotal("");
    setCustomer(null);
    setMsg(null);
    window.scrollTo(0, 0);
  }

  async function send() {
    if (!data?.sale) return;
    if (!Number.isInteger(n) || n < 1) return setMsg({ text: "Escribe el número de la canasta.", warn: true });
    if (!customer) return setMsg({ text: "Elige a la clienta.", warn: true });
    if (!photo) return setMsg({ text: "Toma la foto de la canasta.", warn: true });
    if (!(cents > 0)) return setMsg({ text: "Escribe el total con envío.", warn: true });

    // Open the sticker tab now, while this is still the tap (phones block
    // pop-ups opened later).
    const stickerTab = print ? window.open("", "_blank") : null;

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/equipo/canasta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sale_id: data.sale.id, number: n, customer_id: customer.id, photo_url: photo, total_cents: cents, by: getOperator() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo guardar.");
      const basket: EBasket = json.basket;

      if (stickerTab) stickerTab.location.href = "/equipo/calcomania/" + basket.id + "?auto=1";

      let auto: "sent" | "failed" | "none" = "none";
      if (basket.messenger?.auto && json.message) {
        const r = await fetch("/api/equipo/canasta/enviar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ basket_id: basket.id, message: json.message, by: getOperator() || undefined }),
        });
        auto = r.ok ? "sent" : "failed";
      }
      if (auto !== "sent" && json.message) await copyText(json.message);
      setDone({ basket, message: json.message || "", auto });
      reload();
    } catch (err: any) {
      if (stickerTab) stickerTab.close();
      setMsg({ text: err.message, warn: true });
    }
    setBusy(false);
  }

  return (
    <Station title="Fotos y totales" eyebrow="Jueves noche" sale={data?.sale} sales={data?.sales} onSale={setSale}>
      {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      {done ? (
        <section className="card !p-6 text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-taupe text-cream">
            <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <h2 className="mt-3 text-3xl">Canasta #{done.basket.number} lista</h2>
          <p className="mt-1 text-[16px] text-ink/70">
            {done.basket.customer?.name} · {money(done.basket.total_cents)} · fila {done.basket.letter}
          </p>

          {done.auto === "sent" ? (
            <p className="mt-4 rounded-2xl bg-cream px-4 py-3 text-[15px] dark:bg-transparent dark:ring-1 dark:ring-taupe/30">Salió desde tu página de Facebook: foto y mensaje juntos.</p>
          ) : (
            <div className="mt-4 space-y-2">
              <button
                type="button"
                className="btn-primary w-full !py-4 !text-[17px]"
                onClick={() => {
                  shareNow(shareFile, done.message).then((r) => {
                    if (r === "copied") setMsg({ text: "Mensaje copiado. Abre su chat, pega el mensaje y adjunta la foto." });
                  });
                }}
              >
                Compartir foto en Messenger
              </button>
              <p className="text-[14px] text-ink/60">
                El mensaje ya está copiado. En su chat: mantén presionado y toca <b>Pegar</b>.
                {done.auto === "failed" ? " (No se pudo mandar solo desde la página.)" : ""}
              </p>
              {done.basket.messenger?.openUrl && (
                <a href={done.basket.messenger.openUrl} className="btn-secondary w-full !py-3">Abrir su chat</a>
              )}
            </div>
          )}

          {msg && <p role="status" className="mt-3 rounded-2xl bg-cream px-4 py-3 text-[15px] dark:bg-transparent">{msg.text}</p>}
          <p className="mt-4 text-[15px] text-ink/70">Pega la calcomanía en la canasta. La bolsa va en la fila <b className="font-heading text-xl text-ink">{done.basket.letter}</b>.</p>
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" className="btn-primary w-full !py-4 !text-[17px]" onClick={startOver}>Otra canasta</button>
            <a href={"/equipo/calcomania/" + done.basket.id + "?auto=1"} target="_blank" rel="noreferrer" className="text-[15px] underline">Imprimir la calcomanía otra vez</a>
          </div>
        </section>
      ) : (
        <>
          <section className="card !p-5 space-y-4">
            <div className="flex items-end gap-3">
              <label className="flex flex-col gap-1 text-[14px] text-ink/60">
                Canasta
                <span className="flex w-[120px] items-center rounded-2xl border-2 border-taupe bg-cream px-3 dark:bg-transparent">
                  <span className="font-heading text-3xl text-taupe">#</span>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label="Número de canasta"
                    value={num}
                    onChange={(e) => setNum(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="w-full min-w-0 bg-transparent py-2 font-heading text-4xl text-ink outline-none"
                  />
                </span>
              </label>
              <div className="min-w-0 flex-1 pb-1">
                {num && !needCustomer && (
                  <p className="truncate font-heading text-2xl">
                    {customer?.name}{" "}
                    <button type="button" className="ml-1 align-middle text-[14px] font-sans text-ink/60 underline" onClick={() => { setChangingCustomer(true); setQ(""); }}>Cambiar</button>
                  </p>
                )}
                {num && current?.messenger && !needCustomer && (
                  <p className="text-[13.5px] text-ink/60">{current.messenger.auto ? "Escribió hace poco: se manda sola desde la página" : "Se manda con Compartir"}</p>
                )}
                {num && !current && <p className="text-[14px] text-ink/60">Canasta nueva en este live</p>}
              </div>
            </div>

            {num && needCustomer && (
              <div>
                <label className="label" htmlFor="cust">¿De quién es?</label>
                <input id="cust" className="input !text-base" placeholder="Nombre de la clienta" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
                <ul className="mt-2 space-y-1.5">
                  {found.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="flex min-h-[48px] w-full items-center justify-between rounded-xl bg-white px-3 text-left text-[15px] ring-1 ring-taupe/20 hover:ring-taupe/60 dark:bg-transparent"
                        onClick={() => { setCustomer({ id: c.id, name: c.name }); setChangingCustomer(false); setQ(""); }}
                      >
                        <span>{c.name}</span>
                        <span className="text-[13px] text-ink/50">{c.phone || c.email || ""}</span>
                      </button>
                    </li>
                  ))}
                  {q.trim().length >= 2 && !found.length && <li className="px-1 text-[14px] text-ink/60">No la encontramos. Agrégala en Clientes primero.</li>}
                </ul>
              </div>
            )}

            <div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
              {photo ? (
                <div className="relative overflow-hidden rounded-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt="Foto de la canasta" className="h-64 w-full object-cover" />
                  <button type="button" className="btn-secondary absolute bottom-3 right-3 !py-2" onClick={() => fileRef.current?.click()}>Tomar otra</button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-taupe/40 bg-cream text-[16px] text-ink/70 dark:bg-transparent"
                >
                  <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                  {uploading ? "Subiendo…" : "Tomar foto de la canasta"}
                </button>
              )}
            </div>

            <label className="block">
              <span className="label">Total con envío</span>
              <span className="flex items-center gap-1 rounded-2xl border border-taupe/30 bg-cream px-4 dark:bg-transparent">
                <span className="font-heading text-3xl text-ink/50">$</span>
                <input
                  inputMode="decimal"
                  aria-label="Total con envío"
                  value={total}
                  onChange={(e) => setTotal(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="w-full min-w-0 bg-transparent py-3 font-heading text-4xl text-ink outline-none"
                />
              </span>
            </label>

            {cents > 0 && (
              <div className="ml-auto max-w-[320px] rounded-[22px_22px_6px_22px] bg-taupe px-4 py-3 text-[15.5px] leading-snug text-cream">
                Hola Chula Serian {money(cents)}
                <br />
                Ver tu pedido: <span className="underline">su enlace</span>
              </div>
            )}

            <label className="flex min-h-[44px] items-center gap-3 text-[15px]">
              <input
                type="checkbox"
                checked={print}
                onChange={(e) => {
                  setPrint(e.target.checked);
                  try { window.localStorage.setItem(PRINT_KEY, e.target.checked ? "1" : "0"); } catch { /* ignore */ }
                }}
                className="h-5 w-5 accent-[#957f67]"
              />
              Imprimir calcomanía (letra {customer ? customer.name.normalize("NFD").replace(/[̀-ͯ]/g, "").charAt(0).toUpperCase() : "?"} · #{num || "?"})
            </label>

            {msg && <p role="status" className={"rounded-2xl px-4 py-3 text-[15px] " + (msg.warn ? "bg-amber-50 text-amber-900" : "bg-cream")}>{msg.text}</p>}

            <button type="button" className="btn-primary w-full !py-4 !text-[18px]" disabled={busy || uploading || !data?.sale} onClick={send}>
              {busy ? "Mandando…" : print ? "Mandar e imprimir calcomanía" : "Mandar"}
            </button>
          </section>

          <section className="card !p-5" aria-labelledby="left-t">
            <h2 id="left-t" className="text-[16px] font-normal text-ink/70">Faltan por mandar · toca la que tienes en la mano</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {left.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={b.number === n}
                  onClick={() => setNum(String(b.number))}
                  className={"min-h-[48px] min-w-[62px] rounded-2xl px-3 font-heading text-xl ring-2 " + (b.number === n ? "bg-taupe text-cream ring-taupe" : "bg-white text-ink ring-taupe/20 dark:bg-transparent")}
                >
                  #{b.number}
                </button>
              ))}
              {data && !left.length && <p className="text-[15px] text-ink/60">No hay canastas abiertas en este live. Escribe el número arriba.</p>}
            </div>
          </section>
        </>
      )}
    </Station>
  );
}
