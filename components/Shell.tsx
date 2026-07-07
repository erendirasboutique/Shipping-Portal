"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const NAV = [
  { href: "/", label: "Dashboard", icon: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" },
  { href: "/create-label", label: "Create Label", icon: "M12 3l2.1 5.4L20 10l-5.9 1.6L12 17l-2.1-5.4L4 10l5.9-1.6z" },
  { href: "/orders", label: "Orders", icon: "M5 5h14v14H5z" },
  { href: "/customers", label: "Customers", icon: "M12 4l7 8-7 8-7-8z" },
  { href: "/returns", label: "Returns", icon: "M12 5a7 7 0 1 1-7 7m0 0 3-3m-3 3-3-3" },
  { href: "/batch-print", label: "Batch Print", icon: "M12 3a9 9 0 0 1 0 18z" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
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
      <aside className="card flex w-full flex-col !p-5 lg:w-64 lg:shrink-0 lg:self-start lg:sticky lg:top-6">
        <Image src="/logo2.png" alt="Erendira's Boutique" width={140} height={60} className="h-auto w-32" />
        <p className="mt-5 text-[10px] uppercase tracking-[0.2em] text-taupe/70">Erendira&apos;s Boutique</p>
        <h1 className="text-3xl leading-tight">Shipping Studio</h1>
        <p className="mt-1 text-sm text-ink/70">Welcome, Erendira&apos;s</p>
        <div className="my-4 h-px bg-sand/60" />

        <nav className="flex flex-col gap-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors ${
                pathname === item.href
                  ? "border-taupe bg-cream text-taupe dark:bg-transparent"
                  : "border-sand/50 bg-white/60 text-ink/80 hover:bg-sand/20 dark:bg-transparent"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-taupe">
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-5 rounded-2xl border border-dashed border-sand bg-sand/10 p-4">
          <p className="text-xs font-medium text-taupe">Quick tip</p>
          <p className="mt-1 text-xs leading-relaxed text-ink/70">
            Purchased labels are saved automatically and can be printed from Batch Print.
          </p>
        </div>

        <button onClick={toggleDark} className="btn-secondary mt-5 w-full">
          {dark ? "Light Mode" : "Dark Mode"}
        </button>

        <div className="mt-3 flex items-center justify-between gap-2 rounded-full border border-sand/60 bg-white/60 px-3 py-2 dark:bg-transparent">
          <div className="flex min-w-0 items-center gap-2">
            <Image src="/logo2.png" alt="" width={26} height={26} className="shrink-0 rounded-full" />
            <span className="truncate text-xs text-ink/70">{email || "…"}</span>
          </div>
          <button onClick={signOut} className="shrink-0 text-xs text-taupe underline-offset-2 hover:underline">
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
