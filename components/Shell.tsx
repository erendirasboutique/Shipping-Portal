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
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="pt-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-4">
            <Image src="/logo2.png" alt="Erendira's Boutique" width={56} height={56} className="h-12 w-auto" />
            <div className="hidden sm:block">
              <p className="eyebrow">Erendira&apos;s Boutique</p>
              <p className="font-heading text-xl leading-tight text-taupe">Shipping Studio</p>
            </div>
          </Link>
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.15em] text-taupe">
            <span className="hidden max-w-[180px] truncate normal-case tracking-normal text-ink/60 md:block">{email}</span>
            <button onClick={toggleDark} className="hover:underline">{dark ? "Light" : "Dark"}</button>
            <span className="text-taupe/40">/</span>
            <button onClick={signOut} className="hover:underline">Sign out</button>
          </div>
        </div>

        <div className="rule mt-5" />
        <nav className="flex flex-wrap items-center gap-x-7 gap-y-1 py-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`border-b pb-0.5 text-[11px] uppercase tracking-[0.2em] transition-colors ${
                pathname === item.href
                  ? "border-taupe text-taupe"
                  : "border-transparent text-ink/60 hover:text-taupe"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="rule-dashed" />
      </header>

      <main className="pt-8">{children}</main>
    </div>
  );
}
