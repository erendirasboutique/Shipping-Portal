"use client";

// Reads a USB postal scale in Chrome/Edge on a computer (WebHID).
// Most USB shipping scales (DYMO, Stamps.com, Mettler Toledo, Pitney Bowes,
// Fairbanks and many generic ones) speak the standard USB "POS scale" format:
//   [status, unit, exponent, weight low byte, weight high byte]
// Plug it in, click "Connect scale" once; after that it reconnects by itself.

import { useCallback, useEffect, useRef, useState } from "react";

type Reading = { oz: number; status: "stable" | "moving" | "zero" | "negative" | "over" | "error" };

const STATUS: Record<number, Reading["status"]> = {
  1: "error",
  2: "zero",
  3: "moving",
  4: "stable",
  5: "negative",
  6: "over",
  7: "error",
  8: "error",
};

// Unit codes from the USB scale spec → ounces per unit
const TO_OZ: Record<number, number> = {
  1: 1 / 28349.5, // milligram
  2: 1 / 28.3495, // gram
  3: 35.27396, // kilogram
  11: 1, // ounce
  12: 16, // pound
};

function parse(view: DataView): Reading | null {
  let b = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  // Some scales include the report id (3) as the first byte.
  if (b.length >= 6 && b[0] === 3) b = b.subarray(1);
  if (b.length < 5) return null;
  const status = STATUS[b[0]] || "error";
  const unit = b[1];
  const exponent = b[2] > 127 ? b[2] - 256 : b[2];
  const raw = b[3] + b[4] * 256;
  const factor = TO_OZ[unit];
  if (factor == null) return null;
  const oz = raw * Math.pow(10, exponent) * factor;
  return { oz: Math.max(0, oz), status };
}

export function formatOz(oz: number) {
  const lb = Math.floor(oz / 16);
  const rest = Math.round((oz - lb * 16) * 10) / 10;
  if (rest >= 16) return lb + 1 + " lb 0 oz";
  return (lb ? lb + " lb " : "") + rest + " oz";
}

export default function ScaleReader({ onWeight }: { onWeight: (totalOz: number) => void }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [device, setDevice] = useState<any>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [auto, setAuto] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const lastApplied = useRef<number | null>(null);
  const autoRef = useRef(auto);
  const onWeightRef = useRef(onWeight);
  autoRef.current = auto;
  onWeightRef.current = onWeight;

  const attach = useCallback(async (d: any) => {
    try {
      if (!d.opened) await d.open();
      d.oninputreport = (e: any) => {
        const r = parse(e.data);
        if (!r) return;
        setReading(r);
        if (r.status === "stable" && r.oz > 0 && autoRef.current) {
          const rounded = Math.round(r.oz * 10) / 10;
          if (lastApplied.current == null || Math.abs(rounded - lastApplied.current) >= 0.1) {
            lastApplied.current = rounded;
            onWeightRef.current(rounded);
          }
        }
        if (r.status === "zero") lastApplied.current = null;
      };
      setDevice(d);
      setErr(null);
    } catch (e: any) {
      setErr("Couldn't open the scale. Unplug it, plug it back in, and try again.");
    }
  }, []);

  // Reconnect to a scale this browser was allowed to use before.
  useEffect(() => {
    const hid = (navigator as any).hid;
    setSupported(!!hid);
    if (!hid) return;
    hid.getDevices().then((list: any[]) => {
      if (list && list[0]) attach(list[0]);
    });
    const onConnect = (e: any) => attach(e.device);
    const onDisconnect = () => {
      setDevice(null);
      setReading(null);
    };
    hid.addEventListener("connect", onConnect);
    hid.addEventListener("disconnect", onDisconnect);
    return () => {
      hid.removeEventListener("connect", onConnect);
      hid.removeEventListener("disconnect", onDisconnect);
    };
  }, [attach]);

  // First show only USB scales (anything that reports itself as a standard
  // USB scale, plus DYMO). If it's not there, show every USB device.
  async function connect(showAll = false) {
    setErr(null);
    try {
      const filters = showAll
        ? []
        : [{ usagePage: 0x8d }, { vendorId: 0x0922 }];
      const list = await (navigator as any).hid.requestDevice({ filters });
      if (list && list[0]) await attach(list[0]);
      else setErr(showAll ? "No device was picked." : "No scale was picked.");
    } catch {
      setErr(showAll ? "No device was picked." : "No scale was picked.");
    }
  }

  async function disconnect() {
    try {
      device?.close?.();
      await device?.forget?.();
    } catch {}
    setDevice(null);
    setReading(null);
    lastApplied.current = null;
  }

  // Phones and Safari can't talk to USB scales; stay out of the way there.
  if (supported === null) return null;
  if (!supported) {
    const phone = typeof navigator !== "undefined" && /iphone|ipad|android/i.test(navigator.userAgent);
    if (phone) return null;
    return <p className="mt-2 text-xs text-ink/50">⚖️ To use your USB scale, open the portal in Chrome or Edge.</p>;
  }

  const r = reading;
  const statusText = !r
    ? "Waiting for the scale…"
    : r.status === "stable"
    ? r.oz > 0 ? "Stable" : "Place package"
    : r.status === "moving"
    ? "Settling…"
    : r.status === "zero"
    ? "Place package"
    : r.status === "negative"
    ? "Below zero, press Zero on the scale"
    : r.status === "over"
    ? "Too heavy for the scale"
    : "Scale error";

  return (
    <div className="mt-3 rounded-2xl border border-taupe/20 px-4 py-3">
      {!device ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-ink/70">⚖️ USB scale</span>
          <button onClick={() => connect(false)} className="btn-secondary !px-4 !py-1.5 text-xs">Connect scale</button>
          <p className="w-full text-[11px] text-ink/50">
            Turn the scale on first.{" "}
            <button onClick={() => connect(true)} className="text-taupe underline underline-offset-2">
              Scale not in the list? Show all USB devices
            </button>
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">⚖️</span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-2xl leading-none text-taupe">{r ? formatOz(r.oz) : "—"}</p>
            <p className={`mt-1 text-xs ${r?.status === "stable" && r.oz > 0 ? "text-[#4c7a3a] dark:text-[#a9cf98]" : "text-ink/60"}`}>
              {statusText}
            </p>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-ink/70">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Auto-fill
          </label>
          {!auto && (
            <button
              onClick={() => r && r.oz > 0 && onWeight(Math.round(r.oz * 10) / 10)}
              disabled={!r || r.oz <= 0}
              className="btn-secondary !px-3 !py-1.5 text-xs"
            >
              Use weight
            </button>
          )}
          <button onClick={disconnect} className="text-[11px] text-taupe underline underline-offset-2">
            Disconnect
          </button>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
    </div>
  );
}
