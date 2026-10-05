"use client";

// Scan and Send — for packing day.
// 1) Scan the label with the phone camera  2) Take a photo of the package
// 3) Share the photo + tracking message to the customer on Messenger from
//    the phone's share button (or email it).

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
    museStatus?: string | null;
    museFlagReason?: string | null;
    museQueuedAt?: string | null;
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

// Where "Send to Messenger" opens. Customers who message the business Page
// are answered from Business Suite; a personal profile uses Messenger.
type AppTarget = "messenger" | "suite";
const APP_NAMES: Record<AppTarget, string> = { messenger: "Messenger", suite: "Business Suite" };

function appLink(target: AppTarget) {
  const android = /android/i.test(navigator.userAgent);
  if (target === "messenger") {
    return android ? "intent://#Intent;scheme=fb-messenger;package=com.facebook.orca;end" : "fb-messenger://";
  }
  // Opens the Business Suite app when installed, otherwise the inbox in the browser.
  return "https://business.facebook.com/latest/inbox/all";
}

// Photos have to be PNG to go on the phone's clipboard.
function toPng(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d")?.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("png"));
    };
    img.src = url;
  });
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
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [target, setTarget] = useState<AppTarget>("messenger");
  const [photoCopied, setPhotoCopied] = useState<boolean | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const [torchOk, setTorchOk] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

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
    setTorchOk(false);
    setTorchOn(false);
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
        setPhotoUploaded(false);
        setPhotoCopied(null);
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
        // Flashlight button shows only on phones that allow it (most Androids).
        setTorchOk(!!caps?.torch);
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

  // Opened from the Packing List with ?code=EB-123: go straight to that order.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      lookup(code);
      window.history.replaceState(null, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setPhotoUploaded(false);
    setPreview(URL.createObjectURL(blob));
    setBusy(null);
    // Save it to the order right away, so sending later is instant.
    if (found) {
      try {
        const fd = new FormData();
        fd.append("orderId", found.order.id);
        fd.append("mode", "save");
        fd.append("photo", blob, "package.jpg");
        const res = await fetch("/api/scan/send", { method: "POST", body: fd });
        if (res.ok) setPhotoUploaded(true);
      } catch {}
    }
  }

  // Remember which app to open on this phone.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("scanSendTarget");
      if (saved === "messenger" || saved === "suite") setTarget(saved);
    } catch {}
  }, []);

  function chooseTarget(t: AppTarget) {
    setTarget(t);
    try {
      localStorage.setItem("scanSendTarget", t);
    } catch {}
  }

  // Copies the photo, marks the order as sent, and opens the app.
  // Runs straight from the tap so the phone allows the copy.
  function openApp() {
    if (!found) return;
    const blob = photo || savedBlob;
    if (!blob) {
      setError("Take a photo of the package first.");
      return;
    }
    setError(null);
    const link = appLink(target);

    let copy: Promise<void>;
    try {
      const item = new ClipboardItem({ "image/png": toPng(blob) });
      copy = navigator.clipboard.write([item]).then(
        () => setPhotoCopied(true),
        () => setPhotoCopied(false)
      );
    } catch {
      setPhotoCopied(false);
      copy = Promise.resolve();
    }

    // Tiny request, allowed to finish even as the app opens.
    const fd = new FormData();
    fd.append("orderId", found.order.id);
    fd.append("mode", "shared");
    if (photo && !photoUploaded) fd.append("photo", photo, "package.jpg");
    fetch("/api/scan/send", { method: "POST", body: fd, keepalive: !(photo && !photoUploaded) }).catch(() => {});

    setResult({ via: "opened" });
    setSentCount((n) => n + 1);
    setStage("done");

    // Give the copy a moment to finish, then open the app.
    const go = () => {
      window.location.href = link;
    };
    Promise.race([copy, new Promise((res) => setTimeout(res, 700))]).then(go, go);
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
  async function record(mode: "shared" | "email" | "save" | "muse") {
    if (!found) return;
    setBusy(mode === "email" ? "Sending email…" : mode === "muse" ? "Adding to Muse queue…" : "Saving…");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("orderId", found.order.id);
      fd.append("mode", mode);
      if (photo && !photoUploaded) fd.append("photo", photo, "package.jpg");
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

  // Shares just the message text (Messenger drops text sent with a photo).
  function shareText() {
    if (!found) return;
    navigator.share({ text: found.message }).catch(() => {});
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

  async function toggleTorch() {
    const track: any = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const on = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: on }] });
      setTorchOn(on);
    } catch {
      setTorchOk(false);
    }
  }

  function next() {
    setFound(null);
    setPhoto(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setSavedBlob(null);
    setCopied(false);
    setPhotoUploaded(false);
    setPhotoCopied(null);
    lastCodeRef.current = null;
    setStage("scan");
  }

  const hasPhoto = !!(photo || savedBlob || found?.order.photo);
  const photoSrc = preview || found?.order.photo || null;
  const firstName = found?.order.name ? found.order.name.split(" ")[0] : null;
  const initials = (found?.order.name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const ICON = {
    back: "M15 18l-6-6 6-6",
    close: "M6 6l12 12M18 6 6 18",
    torch: "M8 2h8v5l-2 3v12h-4V10L8 7zM8 7h8M12 14v2",
    search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3",
    camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    list: "M9 4h6v3H9zM9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3M9 14l2 2 4-4",
    check: "M5 12l5 5L20 7",
    scan: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10",
    send: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
    copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  };
  const Ico = ({ d, size = 20, w = 1.9 }: { d: string; size?: number; w?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );

  const softBtn =
    "flex h-[50px] items-center justify-center gap-2 rounded-[14px] border border-sand/60 bg-white dark:bg-transparent px-4 text-[15px] text-ink disabled:opacity-50";
  const bigBtn =
    "flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-taupe text-base text-cream disabled:opacity-50";

  const errorBox = error && (
    <div role="alert" className="rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error}
    </div>
  );

  // ---------- Scan: full-screen camera with a bottom panel ----------
  if (stage === "scan") {
    return (
      <div className="fixed inset-0 overflow-hidden bg-black text-white">
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />

        {/* Scan frame; the dimmed area around it comes from the big shadow */}
        {cameraOn && (
          <div className="pointer-events-none absolute left-1/2 top-[42%] w-[88%] max-w-[420px] -translate-x-1/2 -translate-y-1/2" style={{ height: "min(52vw, 230px)" }}>
            <div className="absolute inset-0 rounded-[22px]" style={{ boxShadow: "0 0 0 9999px rgba(10,8,7,0.55)" }} />
            <span className="absolute left-0 top-0 h-9 w-9 rounded-tl-[22px] border-l-4 border-t-4 border-white" />
            <span className="absolute right-0 top-0 h-9 w-9 rounded-tr-[22px] border-r-4 border-t-4 border-white" />
            <span className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-[22px] border-b-4 border-l-4 border-white" />
            <span className="absolute bottom-0 right-0 h-9 w-9 rounded-br-[22px] border-b-4 border-r-4 border-white" />
            <span className="eb-scanline absolute inset-x-4 h-0.5 rounded bg-cream shadow-[0_0_12px_2px_rgba(255,255,255,0.6)]" />
            <p className="absolute inset-x-0 -bottom-10 text-center text-[15px] text-white/90">Line up the long barcode inside the frame</p>
          </div>
        )}
        <style>{`@keyframes ebScan{0%,100%{top:10%}50%{top:88%}}.eb-scanline{animation:ebScan 2.4s ease-in-out infinite}`}</style>

        {!cameraOn && !camError && (
          <div className="absolute inset-0 grid place-items-center pb-56 text-sm text-white/80">Starting camera…</div>
        )}
        {camError && (
          <div className="absolute inset-x-6 top-1/3 flex flex-col items-center gap-3 text-center text-[15px] text-white/90">
            <p>{camError}</p>
            <button onClick={startCamera} className="h-11 rounded-xl bg-white/15 px-5 text-sm text-white">Try again</button>
          </div>
        )}

        {/* Top bar */}
        <header className="absolute inset-x-4 flex items-center justify-between" style={{ top: "max(14px, env(safe-area-inset-top))" }}>
          <Link href="/" aria-label="Back to dashboard" className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur">
            <Ico d={ICON.back} />
          </Link>
          <div className="flex flex-col items-center">
            <span className="font-heading text-xl leading-tight">Scan &amp; Send</span>
            <span className="text-xs text-white/70">{sentCount > 0 ? `${sentCount} sent this session` : "Packing day"}</span>
          </div>
          {torchOk ? (
            <button onClick={toggleTorch} aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"} aria-pressed={torchOn} className={`grid h-11 w-11 place-items-center rounded-full backdrop-blur ${torchOn ? "bg-white text-ink" : "bg-white/15 text-white"}`}>
              <Ico d={ICON.torch} size={19} />
            </button>
          ) : (
            <span className="h-11 w-11" />
          )}
        </header>

        {busy && (
          <div className="absolute inset-x-0 top-[62%] flex justify-center">
            <span className="rounded-full bg-black/70 px-4 py-2 text-sm text-white">{busy}</span>
          </div>
        )}

        {/* Bottom panel */}
        <section className="absolute inset-x-0 bottom-0 flex flex-col gap-3.5 rounded-t-[28px] bg-cream px-5 pt-3 text-ink" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
          <span className="mx-auto h-[5px] w-10 rounded-full bg-sand" />
          {errorBox}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              lookup(typed);
            }}
          >
            <label className="flex h-[50px] min-w-0 flex-1 items-center gap-2 rounded-[14px] border border-sand/60 bg-white dark:bg-transparent px-3.5 text-ink/50">
              <Ico d={ICON.search} size={18} w={1.8} />
              <input
                className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink/40"
                placeholder="Tracking # or EB-123"
                aria-label="Tracking number or order number"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                inputMode="text"
                autoCapitalize="characters"
                enterKeyHint="search"
              />
            </label>
            <button type="submit" disabled={!typed.trim() || !!busy} className="h-[50px] shrink-0 rounded-[14px] bg-taupe px-5 text-[15px] text-cream disabled:opacity-40">
              Find
            </button>
          </form>
          <input ref={labelFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onLabelPhoto} />
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={() => labelFileRef.current?.click()} disabled={!!busy} className={softBtn}>
              <span className="text-taupe"><Ico d={ICON.camera} size={18} w={1.8} /></span>
              Photo of label
            </button>
            <Link href="/packing" className={softBtn}>
              <span className="text-taupe"><Ico d={ICON.list} size={18} w={1.8} /></span>
              Packing list
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // ---------- Found & Done: light pages ----------
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-4 bg-cream px-5 text-ink" style={{ paddingTop: "max(16px, env(safe-area-inset-top))", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
      <header className="flex items-center justify-between">
        <button onClick={next} aria-label={stage === "found" ? "Not this one, scan again" : "Back to scanning"} className="grid h-11 w-11 place-items-center rounded-full border border-sand/60 bg-white dark:bg-transparent">
          <Ico d={stage === "found" ? ICON.close : ICON.back} />
        </button>
        <span className="rounded-full bg-sand/30 px-3 py-1.5 text-[13px] text-taupe">
          {stage === "found" ? "Step 2 · Photo & send" : sentCount > 0 ? `${sentCount} sent this session` : "Done"}
        </span>
        <span className="h-11 w-11" />
      </header>

      {stage === "found" && found && (
        <>
          {/* Who it's for */}
          <section className="flex flex-col gap-3 rounded-[22px] border border-sand/60 bg-white dark:bg-transparent p-4">
            <span className="flex items-center gap-2 text-[13.5px] text-taupe">
              <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-sand/30"><Ico d={ICON.check} size={13} w={3} /></span>
              Label found
            </span>
            <div className="flex items-center gap-3.5">
              <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-sand/30 text-[17px] text-taupe">{initials}</span>
              <div className="min-w-0">
                <p className="truncate font-heading text-[26px] leading-tight">{found.order.name || "Customer"}</p>
                <p className="truncate text-sm text-ink/60">
                  {found.order.label}
                  {found.order.place ? " · " + found.order.place : ""}
                </p>
              </div>
            </div>
            {found.order.tracking && (
              <p className="break-all rounded-xl bg-cream px-3 py-2 font-mono text-xs text-ink/80">
                {found.order.carrier ? found.order.carrier + " · " : ""}
                {found.order.tracking}
              </p>
            )}
            {found.order.notifiedAt && (
              <p className="rounded-xl bg-[#fbf1dc] px-3.5 py-2.5 text-[13px] text-[#7a5a1e]">
                Already sent by {found.order.notifiedVia || "message"} on {timeAgo(found.order.notifiedAt)}.
              </p>
            )}
            {!found.order.notifiedAt && found.order.museStatus === "queued" && (
              <p className="rounded-xl bg-sand/20 px-3.5 py-2.5 text-[13px] text-ink/60">
                Waiting for Muse to send it
                {found.order.museQueuedAt ? " (queued " + timeAgo(found.order.museQueuedAt) + ")" : ""}. Sending it yourself now is fine too; Muse will skip it.
              </p>
            )}
            {!found.order.notifiedAt && found.order.museStatus === "flagged" && (
              <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
                Muse couldn&apos;t send this one
                {found.order.museFlagReason ? ": " + found.order.museFlagReason : ""}. Send it yourself below.
              </p>
            )}
          </section>

          {errorBox}

          {/* Package photo */}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhotoPicked} />
          {photoSrc ? (
            <section className="relative overflow-hidden rounded-[22px] bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoSrc} alt="Package" className="w-full object-cover" style={{ maxHeight: 380 }} />
              <button onClick={() => fileRef.current?.click()} className="absolute bottom-3 right-3 flex h-10 items-center gap-2 rounded-full bg-black/60 px-4 text-sm text-white backdrop-blur">
                <Ico d={ICON.camera} size={16} w={1.8} />
                Retake
              </button>
            </section>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={!!busy}
              className="flex h-[230px] w-full flex-col items-center justify-center gap-4 rounded-[22px] border-2 border-dashed border-taupe/40 bg-sand/20 text-taupe"
            >
              <span className="grid h-[76px] w-[76px] place-items-center rounded-full border-4 border-taupe p-1">
                <span className="block h-full w-full rounded-full bg-taupe" />
              </span>
              <span className="text-base">{busy || "Take a photo of the box"}</span>
            </button>
          )}

          {/* Send */}
          <section className="flex flex-col gap-2.5">
            <div role="radiogroup" aria-label="Open in" className="grid grid-cols-2 gap-1 rounded-[14px] bg-sand/30 p-1">
              {(["messenger", "suite"] as AppTarget[]).map((t) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={target === t}
                  onClick={() => chooseTarget(t)}
                  className={`h-10 rounded-[11px] text-sm ${target === t ? "bg-white dark:bg-transparent text-ink shadow-sm" : "text-ink/60"}`}
                >
                  {APP_NAMES[t]}
                </button>
              ))}
            </div>
            <button onClick={openApp} disabled={!!busy || !hasPhoto} className={bigBtn}>
              <Ico d={ICON.send} size={19} w={2} />
              {busy || "Send to " + APP_NAMES[target]}
            </button>
            <p className="text-center text-xs text-ink/60">
              Copies the photo and opens {APP_NAMES[target]}. In the chat, press and hold the message box and tap Paste.
            </p>
            <button
              onClick={() => record("muse")}
              disabled={!!busy || !hasPhoto || !!found.order.notifiedAt}
              className={softBtn + " h-[52px] w-full"}
            >
              {found.order.museStatus === "queued" ? "Queued for Muse ✓" : "Send with Muse"}
            </button>
          </section>

          {/* Message + other options */}
          <details className="group rounded-[18px] border border-sand/60 bg-white dark:bg-transparent">
            <summary className="flex h-[52px] cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden justify-between px-4 text-[15px]">
              Message &amp; other options
              <span className="text-ink/50 transition-transform group-open:rotate-90"><Ico d="M9 6l6 6-6 6" size={18} /></span>
            </summary>
            <div className="flex flex-col gap-2.5 px-4 pb-4">
              <p className="whitespace-pre-line rounded-xl bg-cream px-3.5 py-3 text-sm text-ink/80">{found.message}</p>
              <button onClick={copyMessage} className={softBtn}>
                <Ico d={ICON.copy} size={17} w={1.8} />
                {copied ? "Message copied" : "Copy message"}
              </button>
              {canShareFiles ? (
                <button onClick={share} disabled={!!busy || !hasPhoto} className={softBtn}>Share photo and message</button>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {photoSrc && (
                    <a href={photoSrc} download={"paquete-" + found.order.label + ".jpg"} className={softBtn}>Save photo</a>
                  )}
                  <button onClick={() => record("shared")} disabled={!!busy} className={softBtn}>Mark as sent</button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                {found.email && (
                  <button onClick={() => record("email")} disabled={!!busy || !hasPhoto} className={softBtn}>Email instead</button>
                )}
                <button onClick={() => record("save")} disabled={!!busy || !photo} className={softBtn + (found.email ? "" : " col-span-2")}>Save photo only</button>
              </div>
            </div>
          </details>
        </>
      )}

      {stage === "done" && found && result && (
        <>
          <section className="mt-2 flex flex-col items-center gap-2.5 text-center">
            <div className="relative h-[168px] w-[168px] overflow-hidden rounded-[28px] bg-sand/30 shadow-lg">
              {photoSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoSrc} alt="Package" className="h-full w-full object-cover" />
              )}
              <span className="absolute bottom-2.5 right-2.5 grid h-[34px] w-[34px] place-items-center rounded-full bg-taupe text-cream ring-[3px] ring-cream">
                <Ico d={ICON.check} size={18} w={3} />
              </span>
            </div>
            <h1 className="mt-1.5 font-heading text-[30px] leading-tight">
              {result.via === "muse"
                ? "Queued for Muse"
                : result.via === "opened"
                ? "Now paste the photo"
                : result.via === "shared"
                ? `Sent to ${firstName || "customer"}`
                : result.via === "email"
                ? "Email sent"
                : "Photo saved"}
            </h1>
            <p className="text-[15px] text-ink/60">
              {found.order.label}
              {firstName ? " · " + found.order.name : ""}
              {result.to ? " · " + result.to : ""}
            </p>
          </section>

          {result.via === "muse" && (
            <p className="rounded-2xl bg-white dark:bg-transparent px-4 py-3 text-sm text-ink/80 ring-1 ring-inset ring-sand/60">
              Muse will send the photo and message next time it runs. Anything it can&apos;t match shows up as flagged on the Packing List.
            </p>
          )}

          {result.via === "shared" && (
            <div className="flex flex-col gap-2.5 rounded-2xl bg-white dark:bg-transparent p-4 ring-1 ring-inset ring-sand/60">
              <p className="text-sm text-ink/80">
                Messenger only sends the photo. The message is already copied: in the chat, press and hold the message box and tap Paste.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={copyMessage} className={softBtn + (canShareFiles ? "" : " col-span-2")}>{copied ? "Message copied" : "Copy again"}</button>
                {canShareFiles && <button onClick={shareText} className={softBtn}>Share message</button>}
              </div>
            </div>
          )}

          {result.via === "opened" && (
            <div className="flex flex-col gap-3 rounded-2xl bg-white dark:bg-transparent p-4 ring-1 ring-inset ring-sand/60">
              {photoCopied === false && (
                <p className="rounded-xl bg-[#fbf1dc] px-3.5 py-2.5 text-[13px] text-[#7a5a1e]">
                  This phone didn&apos;t let the photo be copied. Use Share photo below instead.
                </p>
              )}
              <ol className="flex flex-col gap-2 text-sm text-ink/80">
                {[
                  `In ${APP_NAMES[target]}, open ${firstName ? firstName + "'s" : "the customer's"} chat.`,
                  "Press and hold the message box, tap Paste, and send the photo.",
                  "Come back here, tap Copy message, and paste that too.",
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sand/30 text-xs text-taupe">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={copyMessage} className={softBtn}>{copied ? "Copied" : "Copy message"}</button>
                <button onClick={() => { window.location.href = appLink(target); }} className={softBtn}>Open {APP_NAMES[target]}</button>
              </div>
              {canShareFiles && <button onClick={share} className={softBtn}>Share photo</button>}
            </div>
          )}

          <span className="flex-1" />
          <button onClick={next} className={bigBtn}>
            <Ico d={ICON.scan} size={19} w={2} />
            Scan next package
          </button>
        </>
      )}
    </div>
  );
}
