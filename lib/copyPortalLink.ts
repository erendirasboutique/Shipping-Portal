// lib/copyPortalLink.ts  (browser)
// Used by "Copy portal link" on the order page and the customer profile.
// Gets the customer's my.ebtq.io short link (made on first use) and copies it.

export type CopiedLink = { url: string; short: boolean; created: boolean; reason?: string };

async function getLink(customerId: string): Promise<CopiedLink> {
  const res = await fetch("/api/customers/" + encodeURIComponent(customerId) + "/portal-short-link", {
    method: "POST",
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.url) throw new Error(data?.error || "Couldn't get the portal link.");
  return data;
}

// Safari only allows copying during the click itself, so the clipboard is handed
// a promise of the text while the link is fetched. Other browsers fall back to
// copying once the link arrives.
export async function copyCustomerPortalLink(customerId: string): Promise<CopiedLink> {
  const pending = getLink(customerId);
  const AnyClipboardItem = (globalThis as any).ClipboardItem;
  if (AnyClipboardItem && navigator.clipboard?.write) {
    try {
      const blob = pending.then((l) => new Blob([l.url], { type: "text/plain" }));
      await navigator.clipboard.write([new AnyClipboardItem({ "text/plain": blob })]);
      return await pending;
    } catch {
      // fall through
    }
  }
  const link = await pending;
  try {
    await navigator.clipboard.writeText(link.url);
  } catch {
    window.prompt("Copy this link:", link.url);
  }
  return link;
}

export function copiedMessage(link: CopiedLink) {
  if (link.short) return "Portal link copied: " + link.url.replace(/^https?:\/\//, "");
  return "Couldn't make a short link" + (link.reason ? " (" + link.reason + ")" : "") + ". Copied the full portal link instead.";
}
