"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import KeyboardShortcuts, { ShortcutsHint } from "@/components/KeyboardShortcuts";
import PortalTranslator, { LanguageToggle } from "@/components/PortalTranslator";

const LOGO = "/EB_Logo_Fall BGBLANK.png";

const ICON = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  create: "M12 8v8M8 12h8M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
  print: "M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z",
  pack: "M9 4h6v3H9zM9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3M9 14l2 2 4-4",
  scan: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10",
  barcode: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M8 8v8M11 8v8M14 8v8M17 8v8",
  box: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  returns: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  map: "M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  speed: "M12 14l4-4M3.3 17A9 9 0 1 1 20.7 17",
  slip: "M6 2h9l5 5v15H6zM15 2v5h5M9 12h6M9 16h6M9 8h2",
  recap: "M3 3v18h18M8 17V11M13 17V7M18 17v-4",
  plus: "M12 5v14M5 12h14",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  truck: "M3 6h11v10H3zM14 9h4l3 3v4h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
};

type NavItem = { href: string; label: string; d: string };

const GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "", items: [{ href: "/", label: "Dashboard", d: ICON.home }] },
  {
    label: "Shipping day",
    items: [
      { href: "/create-label", label: "Create Label", d: ICON.create },
      { href: "/batch-print", label: "Batch Print", d: ICON.print },
      { href: "/packing", label: "Packing List", d: ICON.pack },
      { href: "/packing-slips", label: "Packing Slips", d: ICON.slip },
      { href: "/scan", label: "Scan & Send", d: ICON.scan },
      { href: "/label-tools", label: "Scan a Label", d: ICON.barcode },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/orders", label: "Orders", d: ICON.box },
      { href: "/customers", label: "Customers", d: ICON.users },
      { href: "/returns", label: "Returns", d: ICON.returns },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/map", label: "Shipping Map", d: ICON.map },
      { href: "/carrier-performance", label: "Carrier Performance", d: ICON.speed },
      { href: "/recap", label: "Monthly Recap", d: ICON.recap },
    ],
  },
];

function Icon({ d, size = 18, width = 1.8 }: { d: string; size?: number; width?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

// "Today" on Saturdays, otherwise the date of the coming Saturday.
function nextShipDay() {
  const now = new Date();
  const day = now.getDay();
  if (day === 6) return "Today";
  const sat = new Date(now);
  sat.setDate(now.getDate() + (6 - day));
  return sat.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const [shipDay, setShipDay] = useState("Saturday");

  useEffect(() => {
    supabaseBrowser().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    const saved = localStorage.getItem("theme") === "dark";
    setDark(saved);
    document.documentElement.classList.toggle("dark", saved);
    setShipDay(nextShipDay());
  }, []);

  // Close the phone menu whenever the page changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Phone top bar */}
      <header
        className={`sticky top-0 z-30 flex h-16 items-center justify-between border-b border-sand/60 bg-cream/95 px-4 backdrop-blur lg:hidden`}
      >
        <Link href="/" aria-label="Dashboard">
          <Image src={LOGO} alt="Erendira's Boutique" width={170} height={72} className="h-9 w-auto" priority />
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="grid h-11 w-11 place-items-center rounded-xl text-ink/80 hover:bg-sand/20"
        >
          <Icon d={ICON.menu} size={22} />
        </button>
      </header>

      {/* Dim background behind the phone menu */}
      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col gap-4 border-r border-sand/60 bg-cream px-3.5 pb-3.5 pt-5 transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:sticky lg:top-0 lg:h-screen lg:w-[264px] lg:shrink-0 lg:translate-x-0`}
      >
        <div className="flex items-center justify-between px-1.5">
          <Link href="/" aria-label="Dashboard">
            <Image src={LOGO} alt="Erendira's Boutique" width={170} height={72} className="h-11 w-auto" priority />
          </Link>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleDark}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              title={dark ? "Light mode" : "Dark mode"}
              className="grid h-9 w-9 place-items-center rounded-lg text-ink/50 hover:bg-sand/20"
            >
              <Icon d={dark ? ICON.sun : ICON.moon} size={17} />
            </button>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="grid h-9 w-9 place-items-center rounded-lg text-ink/50 hover:bg-sand/20 lg:hidden"
            >
              <Icon d={ICON.close} size={18} />
            </button>
          </div>
        </div>

        <Link
          href="/create-label"
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-taupe text-[15px] font-semibold text-cream transition-colors hover:bg-taupe/90"
        >
          <Icon d={ICON.plus} size={18} width={2.2} />
          Create label
        </Link>

        <nav aria-label="Main" className="-mx-1 flex flex-1 flex-col gap-[18px] overflow-y-auto px-1">
          {GROUPS.map((group) => (
            <div key={group.label || "top"} className="flex flex-col gap-0.5">
              {group.label && (
                <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/60">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-[38px] items-center gap-3 rounded-[10px] px-2.5 text-[14.5px] transition-colors ${
                      active
                        ? "bg-sand/20 font-semibold text-ink"
                        : "text-ink/80 hover:bg-sand/20"
                    }`}
                  >
                    <span className={active ? "text-taupe" : "text-ink/50"}>
                      <Icon d={item.d} />
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <ShortcutsHint />

        <div className="flex items-center justify-between gap-2 px-2">
          <span translate="no" className="text-[13px] text-ink/55">Language · Idioma</span>
          <LanguageToggle />
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-sand/60 bg-cream p-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-sand/30 text-taupe">
            <Icon d={ICON.truck} />
          </span>
          <div className="flex flex-col text-[13px] leading-tight">
            <b className="font-semibold text-ink">Next ship day</b>
            <span className="text-ink/60">{shipDay}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl p-2">
          <Image
            src={LOGO}
            alt=""
            width={34}
            height={34}
            className="h-[34px] w-[34px] shrink-0 rounded-full border border-sand/60 bg-white dark:bg-transparent object-contain p-1"
          />
          <div className="flex min-w-0 flex-1 flex-col text-[13px] leading-tight">
            <b className="font-semibold text-ink">Erendira&apos;s Boutique</b>
            <span translate="no" className="truncate text-ink/60">{email}</span>
          </div>
          <button
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink/50 hover:bg-sand/20 hover:text-red-700"
          >
            <Icon d={ICON.logout} size={17} />
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>

      <KeyboardShortcuts />
      <PortalTranslator />
    </div>
  );
}
