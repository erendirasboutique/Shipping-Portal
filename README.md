# Erendira Shipping Studio

Internal shipping portal for Erendira's Boutique. Next.js (App Router) + Supabase + EasyPost, deployed on Vercel.

## Setup

### 1. Install
```bash
npm install
cp .env.example .env.local   # fill in every value
```

### 2. Supabase
1. Run `supabase/schema.sql` in the SQL editor (safe to re-run).
2. Seed your staff allowlist:
   ```sql
   insert into staff_users (email, full_name, role)
   values ('you@erendirasboutique.com', 'Dylan', 'admin');
   ```
3. **Auth → Providers → Google**: enable it, paste `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. **Auth → URL Configuration**: set Site URL to your production URL and add
   `https://YOUR-DOMAIN/auth/callback` and `http://localhost:3000/auth/callback` to redirect URLs.

### 3. Google Cloud Console
- Create an OAuth 2.0 Web client.
- Authorized redirect URI: `https://YOUR-SUPABASE-REF.supabase.co/auth/v1/callback`

### 4. EasyPost
- Paste your production key into `EASYPOST_API_KEY` (test key works for testing; test labels are voidable).
- Enable USPS, UPS, and FedEx carrier accounts in the EasyPost dashboard. UPS/FedEx show up as
  `UPSDAP` / `FedExDefault` for EasyPost-managed accounts — the app already normalizes those names.

### 5. Brand assets — drop these into place
| File | Where | Notes |
|---|---|---|
| `logo2.png` | `public/logo2.png` | Main logo (nav, login, apple icon) |
| `favicon.ico` | `app/favicon.ico` | Favicon |
| `og.png` | `public/og.png` | 1200×630 social preview |
| `return-instructions-half.pdf` | `public/` | Half-page return instructions |
| `return-instructions-full.pdf` | `public/` | Full-page return instructions |
|  `LaLuxesSerif.woff2` | `public/fonts/` | Licensed heading font |
| `Recoleta-Regular.woff2`, `Recoleta-Medium.woff2`, `Recoleta-SemiBold.woff2` | `public/fonts/` | Licensed body font |

Fonts fall back to Georgia until the .woff2 files are added — the build never fails on missing fonts.

### 6. Vercel
- Import the repo, add every variable from `.env.example`, set `NEXT_PUBLIC_SITE_URL` to the production URL.
- `app/api/batch/merge/route.ts` sets `maxDuration = 60` for big batch merges (Pro plan; Hobby caps lower).

## How it works

- **Auth** — Google OAuth through Supabase. `middleware.ts` blocks every page for non-staff:
  after sign-in the email must exist in `staff_users` with `active = true`, otherwise the session
  is dropped and login shows "not on the staff list."
- **Rates & labels** — `/api/rates` creates an EasyPost shipment (4×6 PDF label format,
  optional signature confirmation) and returns USPS/UPS/FedEx rates sorted by price.
  `/api/labels/buy` buys the chosen rate and writes shipment id, tracker id, label URL,
  tracking number/URL, carrier, service, postage, and status to `shipping_orders`, then the UI
  redirects home.
- **Refunds** — `/api/labels/refund` submits the refund to EasyPost and stores `refund_status`.
- **Batch print** — `/api/batch/merge` downloads each selected `label_url`, merges them with
  pdf-lib, marks rows printed (`printed_at`, `print_status`, `printed_by`), and returns one PDF.
  The client opens it in a new tab via a blob URL — no auto-download. Reprint calls the same
  endpoint with `mark_printed: false`.
- **Customers** — CSV import (headers are normalized, `name` required), edit-by-id (no duplicate
  key errors), duplicate detection by email / phone / name+ZIP / address, and merge that moves
  orders + return records to the primary and archives duplicates with `merged_into` set.
- **Returns** — generate `EB-XXXXXX` access codes, review submitted requests, and create USPS
  return labels via EasyPost `is_return` shipments (cheapest USPS rate auto-bought). Instruction
  PDF buttons link to the two files in `public/`.

## CSV import format
Headers (case/space insensitive): `name, email, phone, street1, street2, city, state, zip, country, notes`.
`address` and `postal_code` are accepted as aliases for `street1` and `zip`.
