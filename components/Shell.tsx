"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const NAV = [
  { href: "/", label: "Dashboard", d: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" },
  { href: "/create-label", label: "Create Label", d: "M12 3l2.1 5.4L20 10l-5.9 1.6L12 17l-2.1-5.4L4 10l5.9-1.6z" },
  { href: "/orders", label: "Orders", d: "M6 6h12v12H6z" },
  { href: "/customers", label: "Customers", d: "M12 4l7 8-7 8-7-8z" },
  { href: "/returns", label: "Returns", d: "M12 5a7 7 0 1 1-7 7m0 0 3-3m-3 3-3-3" },
  { href: "/batch-print", label: "Batch Print", d: "M12 3a9 9 0 0 1 0 18z" },
  { href: "/scan", label: "Scan & Send", d: "M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M7 12h10" },
  { href: "/map", label: "Shipping Map", d: "M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    supabaseBrowser().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    const saved = localStorage.getItem("theme") === "dark";
    setDark(saved);
    document.documentElement.classList.toggle("dark", saved);
  }, []);

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

  return (
    <div className="flex min-h-screen flex-col gap-6 p-4 lg:flex-row lg:p-6">
      <aside className="card flex w-full flex-col !rounded-[2rem] lg:sticky lg:top-6 lg:w-72 lg:shrink-0 lg:self-start">
        <Image src="/EB_Logo_Fall BGBLANK.png" alt="Erendira's Boutique" width={170} height={72} className="h-auto w-40" />
        <p className="eyebrow mt-6">Erendira&apos;s Boutique</p>
        <h1 className="text-4xl leading-[1.05]">Shipping Studio</h1>
        <p className="mt-2 text-sm text-ink/70">Welcome, Erendira&apos;s</p>

        <div className="my-5 h-px bg-taupe/20" />

        <nav className="flex flex-col gap-2.5">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-full border px-5 py-3 text-sm transition-colors ${
                  active
                    ? "border-taupe/60 bg-white text-ink shadow-[0_2px_12px_rgba(149,127,103,0.12)]"
                    : "border-taupe/15 bg-cream/60 text-ink/80 hover:border-taupe/40 dark:bg-transparent"
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-taupe/30">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-taupe">
                    <path d={item.d} />
                  </svg>
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 rounded-2xl border border-dashed border-taupe/40 bg-[#eef1e8] p-4 dark:bg-transparent">
          <p className="text-xs font-medium text-taupe">Quick tip</p>
          <p className="mt-1 text-xs leading-relaxed text-ink/70">
            Purchased labels are saved automatically and can be printed from Batch Print.
          </p>
        </div>

        <button onClick={toggleDark} className="btn-secondary mt-6 w-full !py-3">
          {dark ? "Light Mode" : "Dark Mode"}
        </button>

        <div className="mt-4 flex items-center gap-3 rounded-full border border-taupe/15 bg-cream/60 px-3 py-2.5 dark:bg-transparent">
          <Image src="/EB_Logo_Fall BGBLANK.png" alt="" width={30} height={30} className="h-8 w-8 shrink-0 rounded-full border border-taupe/20 object-contain p-1" />
          <span className="min-w-0 flex-1 truncate text-xs text-ink/70">{email}</span>
          <button onClick={signOut} className="shrink-0 text-xs text-taupe hover:underline">
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
