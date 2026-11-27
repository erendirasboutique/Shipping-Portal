"use client";

// Send a photo + message to Messenger from the phone: the share sheet with
// the photo attached, and the message copied (Messenger keeps the photo but
// drops text shared with it, so it's pasted in the chat).
//
// iPhones only open the share sheet straight from a tap, so the photo is
// fetched BEFORE the tap (preparePhoto) and shared instantly (shareNow).

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function preparePhoto(photoUrl: string | null): Promise<File | null> {
  if (!photoUrl) return null;
  try {
    const res = await fetch(photoUrl);
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const file = new File([blob], "canasta." + ext, { type: blob.type || "image/jpeg" });
    const nav: any = navigator;
    return nav.canShare && nav.canShare({ files: [file] }) ? file : null;
  } catch {
    return null;
  }
}

/** Call directly from a tap. */
export function shareNow(file: File | null, text: string): Promise<"shared" | "copied" | "cancelled"> {
  const nav: any = navigator;
  const copying = copyText(text);
  if (nav.share) {
    const payload = file ? { files: [file], text } : { text };
    return nav
      .share(payload)
      .then(() => "shared" as const)
      .catch((e: any) => (e && e.name === "AbortError" ? ("cancelled" as const) : copying.then((ok) => (ok ? ("copied" as const) : ("cancelled" as const)))));
  }
  return copying.then((ok) => (ok ? ("copied" as const) : ("cancelled" as const)));
}
