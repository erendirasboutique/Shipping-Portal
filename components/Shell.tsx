"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/create-label", label: "Create Label" },
  { href: "/orders", label: "Orders" },
  { href: "/customers", label: "Customers" },
  { href: "/returns", label: "Returns" },
  { href: "/batch-print", label: "Batch Print" },
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
    <div className="flex min-h-screen flex-col gap-8 p-4 lg:flex-row lg:p-8">
      <aside className="flex w-full flex-col lg:sticky lg:top-8 lg:w-60 lg:shrink-0 lg:self-start">
        <Link href="/">
          <Image src="/logo2.png" alt="Erendira's Boutique" width={150} height={64} className="h-auto w-36" />
        </Link>
        <p className="eyebrow mt-6">Erendira&apos;s Boutique</p>
        <p className="font-heading text-2xl leading-tight text-taupe">Shipping Studio</p>

        <div className="rule-dashed my-5" />

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-2.5 text-[11px] uppercase tracking-[0.2em] transition-colors ${
                pathname === item.href
                  ? "bg-taupe text-cream"
                  : "text-ink/70 hover:bg-taupe/10 hover:text-taupe"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="rule-dashed my-5" />

        <div className="rounded-2xl border border-dashed border-taupe/40 bg-cream p-4 dark:bg-transparent">
          <p className="eyebrow">Quick tip</p>
          <p className="mt-1 text-xs leading-relaxed text-ink/70">
            Purchased labels are saved automatically and can be printed from Batch Print.
          </p>
        </div>

        <button onClick={toggleDark} className="btn-secondary mt-5 w-full">
          {dark ? "Light Mode" : "Dark Mode"}
        </button>

        <div className="mt-4 flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 truncate text-ink/60">{email}</span>
          <button onClick={signOut} className="shrink-0 uppercase tracking-[0.15em] text-taupe hover:underline">
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
