"use client";

// English / Español for the staff portal.
//
// The pages stay written in English. When Español is on, this swaps every
// piece of text on screen (plus placeholders, tooltips and pop-up questions)
// for the Spanish in lib/portalSpanish.ts, and keeps doing it as pages change.
// Switching back to English puts the original text back.
//
// The choice is saved per browser (same setting as the Live sales language).

import { useEffect, useLayoutEffect, useState } from "react";
import { toSpanish } from "@/lib/portalSpanish";

export type PortalLocale = "en" | "es";

const STORAGE_KEY = "eb-live-locale";
const CHANGE_EVENT = "eb-locale-change";
const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const SVG_NS = "http://www.w3.org/2000/svg";

export function getPortalLocale(): PortalLocale {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

export function setPortalLocale(next: PortalLocale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The saved language, kept in sync across the page and other tabs. */
export function usePortalLocale(): PortalLocale {
  const [locale, setLocale] = useState<PortalLocale>("en");
  useEffect(() => {
    const sync = () => setLocale(getPortalLocale());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return locale;
}

/* ---------------- the swapping ---------------- */

type Rec = { en: string; es: string };
const textRecs = new WeakMap<Text, Rec>();
const attrRecs = new WeakMap<Element, Record<string, Rec>>();

// Text inside these is never changed (typed text, code, drawings, or anything marked translate="no").
function leaveAlone(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    const tag = e.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "CODE" || tag === "PRE" || tag === "NOSCRIPT") return true;
    if (e.namespaceURI === SVG_NS) return true;
    if (e.getAttribute("translate") === "no" || e.hasAttribute("data-no-translate")) return true;
    if ((e as HTMLElement).isContentEditable) return true;
  }
  return false;
}

function doText(node: Text, es: boolean) {
  const value = node.nodeValue || "";
  const rec = textRecs.get(node);
  if (!es) {
    if (rec) {
      if (value === rec.es) node.nodeValue = rec.en;
      textRecs.delete(node);
    }
    return;
  }
  if (rec && value === rec.es) return; // already Spanish
  if (leaveAlone(node.parentElement)) return;
  const t = toSpanish(value);
  if (t === null) {
    if (rec) textRecs.delete(node);
    return;
  }
  textRecs.set(node, { en: value, es: t });
  if (t !== value) node.nodeValue = t;
}

function doAttr(el: Element, name: string, es: boolean) {
  const recs = attrRecs.get(el);
  const rec = recs ? recs[name] : undefined;
  const value = el.getAttribute(name);
  if (!es) {
    if (rec && recs) {
      if (value === rec.es) el.setAttribute(name, rec.en);
      delete recs[name];
    }
    return;
  }
  if (value === null) return;
  if (rec && value === rec.es) return;
  if (el.getAttribute("translate") === "no" || el.hasAttribute("data-no-translate")) return;
  const t = toSpanish(value);
  if (t === null) return;
  const next = recs || {};
  next[name] = { en: value, es: t };
  attrRecs.set(el, next);
  if (t !== value) el.setAttribute(name, t);
}

function doTree(root: Node, es: boolean) {
  if (root.nodeType === Node.TEXT_NODE) {
    doText(root as Text, es);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) {
    const el = root as Element;
    for (const a of ATTRS) if (el.hasAttribute(a)) doAttr(el, a, es);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let n = walker.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) doText(n as Text, es);
    else {
      const el = n as Element;
      for (const a of ATTRS) if (el.hasAttribute(a)) doAttr(el, a, es);
    }
    n = walker.nextNode();
  }
}

/* ---------------- component ---------------- */

// Runs before the screen paints (so no flash of English); plain effect on the server.
const useBeforePaint = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Put this once on a page (Shell does it for every page with the sidebar).
 * `toggle` shows a small English / Español switch in the corner (for pages without the sidebar).
 */
export default function PortalTranslator({ toggle = false }: { toggle?: boolean }) {
  const [version, setVersion] = useState(0);

  useBeforePaint(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(CHANGE_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(CHANGE_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  useBeforePaint(() => {
    const es = getPortalLocale() === "es";
    document.documentElement.lang = es ? "es" : "en";
    doTree(document.body, es);
    if (!es) return;

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData") {
          doText(m.target as Text, true);
        } else if (m.type === "attributes") {
          if (m.attributeName) doAttr(m.target as Element, m.attributeName, true);
        } else {
          m.addedNodes.forEach((n) => doTree(n, true));
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });

    // Pop-up questions ("Void the label…?") and notices
    const origConfirm = window.confirm;
    const origAlert = window.alert;
    window.confirm = (message?: string) => {
      const m = message == null ? message : toSpanish(String(message)) ?? message;
      return origConfirm.call(window, m);
    };
    window.alert = (message?: any) => {
      const m = message == null ? message : toSpanish(String(message)) ?? message;
      origAlert.call(window, m);
    };

    return () => {
      observer.disconnect();
      window.confirm = origConfirm;
      window.alert = origAlert;
      document.documentElement.lang = "en";
    };
  }, [version]);

  if (!toggle) return null;
  return (
    <div className="fixed right-3 top-3 z-[60]" style={{ top: "max(12px, env(safe-area-inset-top))" }}>
      <LanguageToggle />
    </div>
  );
}

/** EN | ES switch. */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const locale = usePortalLocale();
  const base = "rounded-md px-2 py-1 text-[12px] font-semibold tracking-wide transition-colors";
  return (
    <div
      translate="no"
      role="group"
      aria-label="Language / Idioma"
      className={"inline-flex items-center gap-0.5 rounded-lg border border-sand/60 bg-cream p-0.5 " + className}
    >
      <button
        type="button"
        onClick={() => setPortalLocale("en")}
        aria-pressed={locale === "en"}
        title="English"
        className={base + (locale === "en" ? " bg-taupe text-cream" : " text-ink/60 hover:text-taupe")}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setPortalLocale("es")}
        aria-pressed={locale === "es"}
        title="Español"
        className={base + (locale === "es" ? " bg-taupe text-cream" : " text-ink/60 hover:text-taupe")}
      >
        ES
      </button>
    </div>
  );
}
