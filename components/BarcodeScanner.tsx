"use client";

// Pop-up camera scanner. Calls onCode with what it reads; if onCode
// returns an error message, it shows it and keeps scanning.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { getDetector, grabFrame, bestCode, readFromPhoto } from "@/lib/barcode";

export default function BarcodeScanner({
  onCode,
  onClose,
  title = "Scan a label",
}: {
  onCode: (code: string) => Promise<string | null>;
  onClose: () => void;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number } | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const handle = useCallback(
    async (code: string) => {
      if (busyRef.current) return;
      const now = Date.now();
      const last = lastRef.current;
      if (last && last.code === code && now - last.at < 4000) return;
      lastRef.current = { code, at: now };
      busyRef.current = true;
      setBusy("Finding order…");
      setMsg(null);
      try {
        navigator.vibrate?.(60);
      } catch {}
      const err = await onCode(code);
      busyRef.current = false;
      setBusy(null);
      if (err) setMsg(err);
    },
    [onCode]
  );

  const start = useCallback(async () => {
    setMsg(null);
    const video = videoRef.current;
    if (!video) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setMsg("This browser can't use the camera. Use Photo of label instead.");
      return;
    }
    stop();
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
        setMsg("The barcode reader couldn't load. Check your connection.");
        return;
      }
      const canvas = document.createElement("canvas");
      let n = 0;
      const tick = async () => {
        if (!activeRef.current) return;
        if (!busyRef.current) {
          try {
            const frame = grabFrame(video, canvas, n++ % 3 !== 2);
            if (frame) {
              const codes = await detector.detect(frame);
              const best = bestCode((codes || []).map((c: any) => c.rawValue));
              if (best && activeRef.current) handle(best);
            }
          } catch {}
        }
        if (activeRef.current) timerRef.current = window.setTimeout(tick, 150);
      };
      tick();
    } catch (e: any) {
      activeRef.current = false;
      const denied = e?.name === "NotAllowedError" || e?.name === "SecurityError";
      setMsg(
        denied
          ? "Camera access is blocked. Allow the camera for this site in your browser settings, or use Photo of label."
          : "Couldn't start the camera. Use Photo of label instead."
      );
    }
  }, [handle, stop]);

  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  // Close with Escape on a computer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy("Reading barcode…");
    setMsg(null);
    try {
      const code = await readFromPhoto(f);
      setBusy(null);
      if (!code) {
        setMsg("Couldn't find a barcode in that photo. Get closer so the barcode fills the photo.");
        return;
      }
      lastRef.current = null;
      await handle(code);
    } catch {
      setBusy(null);
      setMsg("Couldn't read that photo. Try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-3 sm:items-center" onClick={onClose}>
      <div className="card w-full max-w-md !rounded-[2rem] !p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="font-heading text-2xl text-taupe">{title}</p>
          <button onClick={onClose} aria-label="Close" className="rounded-full px-3 py-1 text-xl leading-none text-taupe hover:bg-taupe/10">
            ×
          </button>
        </div>
        <div className="relative overflow-hidden rounded-[1.5rem] bg-black" style={{ aspectRatio: "3 / 4" }}>
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          {cameraOn && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-[34%] w-[86%] rounded-2xl border-2 border-white/90" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }} />
            </div>
          )}
          {!cameraOn && !msg && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Starting camera…</div>
          )}
          {busy && <div className="absolute inset-x-0 bottom-0 bg-black/60 py-3 text-center text-sm text-white">{busy}</div>}
        </div>
        {msg && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{msg}</p>}
        <p className="mt-3 text-center text-sm text-ink/70">Hold the long barcode across the box, about 6 inches away.</p>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
        <button onClick={() => fileRef.current?.click()} disabled={!!busy} className="btn-secondary mt-3 w-full">
          Not scanning? Take a photo of the label
        </button>
      </div>
    </div>
  );
}
