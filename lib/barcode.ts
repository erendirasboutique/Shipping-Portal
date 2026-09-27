// Browser-only barcode helpers shared by the scanners.
// Android Chrome has a built-in reader; iPhones get a strong one
// (ZXing compiled to WebAssembly) loaded from the CDN when needed.

const PONYFILL = "https://fastly.jsdelivr.net/npm/barcode-detector@3/dist/es/ponyfill.min.js";
const FORMATS = ["code_128", "data_matrix", "qr_code", "code_39", "pdf417"];
let detectorPromise: Promise<any> | null = null;

export function getDetector(): Promise<any> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const Native = typeof window !== "undefined" ? (window as any).BarcodeDetector : undefined;
      if (Native?.getSupportedFormats) {
        try {
          const supported: string[] = await Native.getSupportedFormats();
          if (supported.includes("code_128")) {
            return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
          }
        } catch {}
      }
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

// Copy the current video frame (or just the middle band) onto a canvas.
export function grabFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement, band: boolean) {
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
export function bestCode(values: string[]): string | null {
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

// Read a barcode from a still photo (sharper than live video).
export async function readFromPhoto(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
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
    return bestCode((codes || []).map((c: any) => c.rawValue));
  } finally {
    URL.revokeObjectURL(url);
  }
}
