"use client";

// Keyboard shortcuts for the whole portal (desktop keyboards).
// Single keys jump between pages; "?" shows the list; "/" jumps to the page's search box.
// They never fire while you're typing in a box, or with Cmd/Ctrl/Alt held.

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Shortcut = { key: string; label: string; href: string; group: string };

export const SHORTCUTS: Shortcut[] = [
  { key: "d", label: "Dashboard", href: "/", group: "Go to" },
  { key: "n", label: "Create a new label", href: "/create-label", group: "Shipping day" },
  { key: "b", label: "Batch Print", href: "/batch-print", group: "Shipping day" },
  { key: "k", label: "Packing List", href: "/packing", group: "Shipping day" },
  { key: "l", label: "Packing Slips", href: "/packing-slips", group: "Shipping day" },
  { key: "e", label: "Scan & Send", href: "/scan", group: "Shipping day" },
  { key: "s", label: "Scan a Label", href: "/label-tools", group: "Shipping day" },
  { key: "o", label: "Orders", href: "/orders", group: "Manage" },
  { key: "c", label: "Customers", href: "/customers", group: "Manage" },
  { key: "r", label: "Returns", href: "/returns", group: "Manage" },
  { key: "m", label: "Shipping Map", href: "/map", group: "Insights" },
  { key: "f", label: "Carrier Performance", href: "/carrier-performance", group: "Insights" },
  { key: "y", label: "Monthly Recap", href: "/recap", group: "Insights" },
];

function typingIn(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  if (!t) return false;
  return t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
}

// The first visible search-style box on the page, if there is one
function findSearchBox(): HTMLInputElement | null {
  const boxes = Array.from(document.querySelectorAll<HTMLInputElement>("main input"));
  return (
    boxes.find((i) => {
      const hint = (i.placeholder + " " + (i.getAttribute("aria-label") || "") + " " + i.type).toLowerCase();
      return /search|find|tracking|eb-|buscar|busca|rastreo/.test(hint) && i.offsetParent !== null && !i.disabled;
    }) || null
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid h-7 min-w-[28px] place-items-center rounded-lg border border-sand bg-white px-2 font-sans text-[13px] text-taupe shadow-[0_1px_0_rgba(149,127,103,0.35)] dark:bg-transparent">
      {children}
    </kbd>
  );
}

export default function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape" && helpOpen) {
        setHelpOpen(false);
        return;
      }
      if (typingIn(e.target)) return;

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (e.key === "/") {
        const box = findSearchBox();
        if (box) {
          e.preventDefault();
          box.focus();
          box.select();
        }
        return;
      }

      const s = SHORTCUTS.find((x) => x.key === e.key.toLowerCase());
      if (!s || e.shiftKey) return;
      e.preventDefault();
      setHelpOpen(false);
      if (s.href !== pathname) {
        setToast(s.label);
        router.push(s.href);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname, helpOpen]);

  // Small "Going to…" note while the page loads
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1200);
    return () => clearTimeout(t);
  }, [toast, pathname]);

  const groups = Array.from(new Set(SHORTCUTS.map((s) => s.group)));

  return (
    <>
      {toast && (
        <div role="status" className="pointer-events-none fixed bottom-6 left-1/2 z-[70] hidden -translate-x-1/2 rounded-full bg-taupe px-4 py-2 text-sm text-cream shadow-lg lg:block">
          {toast}
        </div>
      )}

      {helpOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]" onClick={() => setHelpOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-sand/60 bg-cream p-6 shadow-xl md:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Work faster</p>
                <h2 className="mt-1 text-4xl leading-[1.15]">Keyboard Shortcuts</h2>
              </div>
              <button onClick={() => setHelpOpen(false)} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full border border-sand text-taupe hover:border-taupe">
                ✕
              </button>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {groups.map((g) => (
                <section key={g} className="flex flex-col gap-2">
                  <p className="label">{g}</p>
                  {SHORTCUTS.filter((s) => s.group === g).map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-3 border-b border-sand/30 pb-2 text-[15px] last:border-0">
                      <span>{s.label}</span>
                      <Kbd>{s.key.toUpperCase()}</Kbd>
                    </div>
                  ))}
                </section>
              ))}
              <section className="flex flex-col gap-2">
                <p className="label">Anywhere</p>
                <div className="flex items-center justify-between gap-3 border-b border-sand/30 pb-2 text-[15px]">
                  <span>Jump to the search box</span>
                  <Kbd>/</Kbd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-sand/30 pb-2 text-[15px]">
                  <span>Show this list</span>
                  <Kbd>?</Kbd>
                </div>
                <div className="flex items-center justify-between gap-3 text-[15px]">
                  <span>Close / clear</span>
                  <Kbd>Esc</Kbd>
                </div>
              </section>
              <section className="flex flex-col gap-2">
                <p className="label">On certain pages</p>
                <div className="flex items-center justify-between gap-3 border-b border-sand/30 pb-2 text-[15px]">
                  <span>Batch Print: print</span>
                  <Kbd>P</Kbd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-sand/30 pb-2 text-[15px]">
                  <span>Batch Print: select all</span>
                  <Kbd>A</Kbd>
                </div>
                <div className="flex items-center justify-between gap-3 text-[15px]">
                  <span>Scan a Label: reprint</span>
                  <Kbd>P</Kbd>
                </div>
              </section>
            </div>

            <p className="mt-6 text-sm text-ink/55">Shortcuts pause while you&apos;re typing in a box, so they never get in the way.</p>
          </div>
        </div>
      )}
    </>
  );
}

/** Small button for the sidebar that opens the list (desktop only). */
export function ShortcutsHint() {
  return (
    <button
      onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }))}
      className="hidden items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-[13px] text-ink/55 hover:bg-sand/20 hover:text-taupe lg:flex"
    >
      Keyboard shortcuts
      <kbd className="rounded-md border border-sand px-1.5 font-sans text-xs text-taupe">?</kbd>
    </button>
  );
}
