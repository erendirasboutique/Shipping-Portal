"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-4 py-6">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo2.png" alt="Erendira's Boutique" width={48} height={48} className="rounded-full" />
          <span className="font-heading text-2xl text-taupe">Erendira Shipping Studio</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                pathname === item.href
                  ? "bg-taupe text-cream"
                  : "text-taupe hover:bg-sand/40"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <button onClick={signOut} className="ml-2 rounded-full border border-sand px-4 py-2 text-sm text-taupe hover:bg-sand/30">
            Sign out
          </button>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
