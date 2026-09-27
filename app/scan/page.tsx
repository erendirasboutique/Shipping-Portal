"use client";

// Scan and Send — for packing day.
// 1) Scan the label with the phone camera  2) Take a photo of the package
// 3) Share the photo + tracking message to the customer on Messenger from
//    the phone's share button (or email it).

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";

declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

type Found = {
  order: {
    id: string;
    label: string;
    name: string | null;
    place: string;
    tracking: string | null;
    carrier: string;
    photo: string | null;
    notifiedAt: string | null;
    notifiedVia: string | null;
  };
  message: string;
  email: string | null;
};

type Stage = "scan" | "found" | "done";

// iPhones don't have a built-in barcode reader, so this loads a strong
// one (ZXing, compiled to WebAssembly) when needed. Android Chrome uses
// its own built-in reader.
const PONYFILL = "https://fastly.jsdelivr.net/npm/barcode-detector@3/dist/es/ponyfill.min.js";
const FORMATS = ["code_128", "data_matrix", "qr_code", "code_39", "pdf417"];
let detectorPromise: Promise<any> | null = null;

function getDetector(): Promise<any> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const Native = typeof window !== "undefined" ? window.BarcodeDetector : undefined;
      if (Native?.getSupportedFormats) {
        try {
          const supported: string[] = await Native.getSupportedFormats();
          if (supported.includes("code_128")) {
            return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
          }
        } catch {}
      }
      // Loaded from the CDN at runtime (kept out of the app bundle).
      const importFromUrl = new Function("u", "return import(u)") as (u: string) => Promise<any>;
      const mod = await importFromUrl(PONYFILL);
      return new mod.BarcodeDetector({ formats: FORMATS });
    })().catch((e) => {
      detectorPromise = null;
      throw e;
    });
  }
  return detectorPromise;
}

// Copy the current video frame (or just the middle band where the label
// barcode sits) onto a canvas for the reader.
function grabFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement, band: boolean) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (band) {
    sw = Math.round(vw * 0.94);
    sh = Math.round(Math.min(vh, vw * 0.6));
    sx = Math.round((vw - sw) / 2);
    sy = Math.round((vh - sh) / 2);
  }
  const scale = Math.min(1, 1600 / sw);
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Prefer the shipping barcode when a label has several.
function bestCode(values: string[]): string | null {
  const v = values.map((x) => (x || "").trim()).filter(Boolean);
  if (!v.length) return null;
  const clean = (s: string) => s.replace(/[^0-9A-Za-z]/g, "");
  return (
    v.find((s) => /^420\d/.test(clean(s))) ||
    v.find((s) => /^1Z/i.test(clean(s))) ||
    v.find((s) => /^9\d{19,}$/.test(clean(s))) ||
    v.sort((a, b) => b.length - a.length)[0]
  );
}

async function compressPhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new window.Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("decode"));
      i.src = url;
    });
    const max = 1600;
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b || file), "image/jpeg", 0.82)
    );
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

export default function ScanPage() {
  const [stage, setStage] = useState<Stage>("scan");
  const [found, setFound] = useState<Found | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<{ via: string; to?: string } | null>(null);
  const [savedBlob, setSavedBlob] = useState<Blob | null>(null);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const labelFileRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);

  const stopCamera = useCallback(() => {
    activeRef.current = false;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const lookup = useCallback(
    async (code: string) => {
      const c = code.trim();
      if (!c) return;
      setBusy("Finding order…");
      setError(null);
      try {
        const res = await fetch("/api/scan/lookup?code=" + encodeURIComponent(c), { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Lookup failed.");
        stopCamera();
        setFound(data);
        setSavedBlob(null);
        setCopied(false);
        if (data.order?.photo) {
          fetch(data.order.photo)
            .then((pr) => (pr.ok ? pr.blob() : null))
            .then((b) => b && setSavedBlob(b))
            .catch(() => {});
        }
        setPhoto(null);
        setPreview(null);
        setResult(null);
        setTyped("");
        setStage("found");
      } catch (e: any) {
        setError(e.message);
      } finally {
        setBusy(null);
      }
    },
    [stopCamera]
  );

  const onCode = useCallback(
    (code: string) => {
      const now = Date.now();
      const last = lastCodeRef.current;
      if (last && last.code === code && now - last.at < 4000) return;
      lastCodeRef.current = { code, at: now };
      try {
        navigator.vibrate?.(60);
      } catch {}
      lookup(code);
    },
    [lookup]
  );

  const startCamera = useCallback(async () => {
    setCamError(null);
    const video = videoRef.current;
    if (!video) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("This browser can't use the camera. Use Photo of label, or type the number below.");
      return;
    }
    stopCamera();
    activeRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (!activeRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.muted = true;
      await video.play();
      setCameraOn(true);

      // Ask for continuous autofocus where the phone supports it.
      try {
        const track: any = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.();
        if (caps?.focusMode?.includes?.("continuous")) {
          await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
        }
      } catch {}

      let detector: any;
      try {
        detector = await getDetector();
      } catch {
        setCamError("The barcode reader couldn't load. Check your connection, or type the number below.");
        return;
      }
      if (!activeRef.current) return;

      const canvas = canvasRef.current || document.createElement("canvas");
      canvasRef.current = canvas;
      let n = 0;
      const tick = async () => {
        if (!activeRef.current) return;
        try {
          // Mostly read the middle band (faster, sharper), sometimes the whole frame.
          const frame = grabFrame(video, canvas, n++ % 3 !== 2);
          if (frame) {
            const codes = await detector.detect(frame);
            const best = bestCode((codes || []).map((c: any) => c.rawValue));
            if (best && activeRef.current) onCode(best);
          }
        } catch {}
        if (activeRef.current) timerRef.current = window.setTimeout(tick, 150);
      };
      tick();
    } catch (e: any) {
      activeRef.current = false;
      const denied = e?.name === "NotAllowedError" || e?.name === "SecurityError";
      setCamError(
        denied
          ? "Camera access is blocked. Allow the camera for this site in your browser settings, or use Photo of label."
          : "Couldn't start the camera. Use Photo of label, or type the number below."
      );
    }
  }, [onCode, stopCamera]);

  // Backup: read the barcode from a still photo (sharpest, always focused).
  async function onLabelPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy("Reading barcode…");
    setError(null);
    const url = URL.createObjectURL(f);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new window.Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("decode"));
        i.src = url;
      });
      const detector = await getDetector();
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const codes = await detector.detect(canvas);
      const best = bestCode((codes || []).map((c: any) => c.rawValue));
      if (!best) {
        setError("Couldn't find a barcode in that photo. Get closer so the barcode fills the photo, and hold steady.");
        setBusy(null);
        return;
      }
      setBusy(null);
      lookup(best);
    } catch {
      setError("Couldn't read that photo. Try again, or type the number below.");
      setBusy(null);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Camera runs only on the scan screen.
  useEffect(() => {
    if (stage === "scan") startCamera();
    return () => stopCamera();
  }, [stage, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onPhotoPicked(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy("Preparing photo…");
    const blob = await compressPhoto(f);
    setPhoto(blob);
    setPreview(URL.createObjectURL(blob));
    setBusy(null);
  }

  // Detect once whether this phone can share a photo to other apps.
  useEffect(() => {
    try {
      const probe = new File([new Blob([""])], "probe.jpg", { type: "image/jpeg" });
      setCanShareFiles(!!navigator.share && !!navigator.canShare?.({ files: [probe] }));
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  // Save the photo on the order and record how the customer was told.
  async function record(mode: "shared" | "email" | "save") {
    if (!found) return;
    setBusy(mode === "email" ? "Sending email…" : "Saving…");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("orderId", found.order.id);
      fd.append("mode", mode);
      if (photo) fd.append("photo", photo, "package.jpg");
      const res = await fetch("/api/scan/send", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Saving failed.");
      setResult({ via: mode, to: data.to });
      if (mode !== "save") setSentCount((n) => n + 1);
      setStage("done");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  function copyMessage() {
    if (!found) return;
    navigator.clipboard?.writeText(found.message).then(
      () => setCopied(true),
      () => setCopied(false)
    );
  }

  // Opens the phone's share sheet with the photo and message. Must run
  // straight from the tap (no waiting first), or the phone blocks it.
  function share() {
    if (!found) return;
    const blob = photo || savedBlob;
    if (!blob) {
      setError("Take a photo of the package first.");
      return;
    }
    setError(null);
    // Some apps drop the text when a photo is attached, so it's also copied.
    try {
      navigator.clipboard?.writeText(found.message).then(() => setCopied(true), () => {});
    } catch {}
    const file = new File([blob], "paquete-" + found.order.label + ".jpg", { type: "image/jpeg" });
    navigator
      .share({ files: [file], text: found.message } as any)
      .then(() => record("shared"))
      .catch((e: any) => {
        if (e?.name === "AbortError") return;
        setError("Sharing didn't open. Use Copy message and Save photo instead.");
      });
  }

  function next() {
    setFound(null);
    setPhoto(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setSavedBlob(null);
    setCopied(false);
    lastCodeRef.current = null;
    setStage("scan");
  }

  const hasPhoto = !!(photo || savedBlob || found?.order.photo);
  const photoSrc = preview || found?.order.photo || null;

  return (
    <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-10 pt-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm text-taupe">← Dashboard</Link>
        <Image src="/EB_Logo_Fall BGBLANK.png" alt="Erendira's Boutique" width={110} height={46} className="h-auto w-24" />
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Packing day</p>
          <h1 className="text-4xl leading-tight">Scan &amp; Send</h1>
        </div>
        {sentCount > 0 && (
          <span className="pill !normal-case !tracking-normal !text-xs">{sentCount} sent</span>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ---------- Scan ---------- */}
      {stage === "scan" && (
        <div className="card mt-4 !rounded-[2rem] !p-4">
          <div className="relative overflow-hidden rounded-[1.5rem] bg-black" style={{ aspectRatio: "3 / 4" }}>
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            {cameraOn && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[34%] w-[86%] rounded-2xl border-2 border-white/90" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }} />
              </div>
            )}
            {!cameraOn && !camError && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Starting camera…</div>
            )}
            {camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white/90">
                <p>{camError}</p>
                <button onClick={startCamera} className="btn-secondary !py-2">Try again</button>
              </div>
            )}
            {busy && (
              <div className="absolute inset-x-0 bottom-0 bg-black/60 py-3 text-center text-sm text-white">{busy}</div>
            )}
          </div>
          <p className="mt-3 text-center text-sm text-ink/70">
            Hold the phone about 6 inches away with the long barcode across the box. It scans by itself.
          </p>
          <input ref={labelFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onLabelPhoto} />
          <button onClick={() => labelFileRef.current?.click()} disabled={!!busy} className="btn-secondary mt-3 w-full">
            Not scanning? Take a photo of the label
          </button>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              lookup(typed);
            }}
          >
            <input
              className="input"
              placeholder="Or type tracking or EB-123"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              inputMode="text"
              autoCapitalize="characters"
            />
            <button type="submit" className="btn-secondary shrink-0 !px-4" disabled={!typed.trim() || !!busy}>
              Find
            </button>
          </form>
        </div>
      )}

      {/* ---------- Found ---------- */}
      {stage === "found" && found && (
        <div className="mt-4 space-y-4">
          <div className="card !rounded-[2rem] !p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">{found.order.label}</p>
                <p className="mt-1 truncate font-heading text-3xl text-taupe">{found.order.name || "Customer"}</p>
                <p className="text-sm text-ink/70">{found.order.place}</p>
              </div>
              <button onClick={next} className="shrink-0 text-sm text-taupe underline underline-offset-2">Not this one</button>
            </div>
            {found.order.tracking && (
              <p className="mt-3 break-all rounded-2xl bg-cream px-3 py-2 font-mono text-xs text-ink/70 dark:bg-transparent">
                {found.order.carrier ? found.order.carrier + " · " : ""}{found.order.tracking}
              </p>
            )}
            {found.order.notifiedAt && (
              <p className="mt-3 rounded-2xl bg-[#fbf1dc] px-4 py-2.5 text-xs text-[#7a5a1e] dark:bg-transparent dark:text-[#e6c88f]">
                Already sent by {found.order.notifiedVia || "message"} on {timeAgo(found.order.notifiedAt)}.
              </p>
            )}
          </div>

          <div className="card !rounded-[2rem] !p-5">
            <p className="label">Package photo</p>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhotoPicked} />
            {photoSrc ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoSrc} alt="Package" className="w-full rounded-[1.5rem] object-cover" style={{ maxHeight: 420 }} />
                <button onClick={() => fileRef.current?.click()} className="btn-secondary mt-3 w-full">Retake photo</button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed border-taupe/40 bg-cream/60 py-12 text-taupe dark:bg-transparent"
              >
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                <span className="text-base">Take package photo</span>
              </button>
            )}
          </div>

          <div className="card !rounded-[2rem] !p-5">
            <p className="label">Message</p>
            <p className="whitespace-pre-line rounded-2xl bg-cream/70 px-4 py-3 text-sm text-ink/80 dark:bg-transparent dark:ring-1 dark:ring-taupe/20">{found.message}</p>
            <button onClick={copyMessage} className="mt-2 text-sm text-taupe underline underline-offset-2">
              {copied ? "Message copied" : "Copy message"}
            </button>
          </div>

          {canShareFiles ? (
            <>
              <button onClick={share} disabled={!!busy || !hasPhoto} className="btn-primary w-full !py-4 !text-base">
                {busy || "Share to Messenger"}
              </button>
              <p className="-mt-2 text-center text-xs text-ink/60">
                Pick Messenger (or Business Suite), then the customer&apos;s chat. The message is copied too, in case it doesn&apos;t show up. Paste it if needed.
              </p>
            </>
          ) : (
            <div className="card !rounded-[2rem] !p-5 text-sm text-ink/70">
              <p>This browser can&apos;t share photos to apps. Save the photo and copy the message, send them in Messenger, then tap &quot;Mark as sent.&quot;</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {photoSrc && (
                  <a href={photoSrc} download={"paquete-" + found.order.label + ".jpg"} className="btn-secondary">Save photo</a>
                )}
                <button onClick={copyMessage} className="btn-secondary">{copied ? "Copied" : "Copy message"}</button>
                <button onClick={() => record("shared")} disabled={!!busy} className="btn-primary">Mark as sent</button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {found.email && (
              <button onClick={() => record("email")} disabled={!!busy || !hasPhoto} className="btn-secondary flex-1">
                Email instead
              </button>
            )}
            <button onClick={() => record("save")} disabled={!!busy || !photo} className="btn-secondary flex-1">
              Save photo only
            </button>
          </div>
        </div>
      )}

      {/* ---------- Done ---------- */}
      {stage === "done" && found && result && (
        <div className="card mt-4 !rounded-[2rem] !p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e6efdf] text-[#4c7a3a] dark:bg-transparent">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
          </div>
          <p className="mt-4 font-heading text-3xl text-taupe">
            {result.via === "shared" ? "Marked as sent" : result.via === "email" ? "Email sent" : "Photo saved"}
          </p>
          <p className="mt-1 text-sm text-ink/70">
            {found.order.label}
            {result.to ? " · " + result.to : ""}
          </p>
          <button onClick={next} className="btn-primary mt-6 w-full !py-4 !text-base">Scan next package</button>
        </div>
      )}
    </div>
  );
}
