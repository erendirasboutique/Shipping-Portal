// components/CopyPortalLinkButton.tsx  (goes in the SHIPPING portal repo)
// Drop this next to a customer's row/detail view:
//   <CopyPortalLinkButton token={customer.portal_token} />
// Make sure portal_token is included in the columns you select for customers.

"use client";

import { useState } from "react";

export default function CopyPortalLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = `https://my.erendirasboutique.com/account?t=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers / non-HTTPS contexts
      window.prompt("Copy this link:", url);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      style={{
        background: copied ? "#5c7a52" : "#806a52",
        color: "#F5F3EF",
        border: "none",
        borderRadius: 999,
        padding: "6px 16px",
        fontSize: 13,
        cursor: "pointer",
        transition: "background 0.2s ease",
      }}
    >
      {copied ? "Copied!" : "Copy portal link"}
    </button>
  );
}
