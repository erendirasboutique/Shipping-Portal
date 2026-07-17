# Live Sale module — Erendira's Boutique

Adds Wednesday/Thursday live sale tracking, and puts each customer's basket into the portal they already have.

## ⚠️ This installs in the SHIPPING portal — `erendira-shipping-studio`

TypeScript, Next.js App Router, `ship.erendirasboutique.com`.

**Not** the billing portal. We checked: `customers` and `portal_token` live in the shipping portal's Supabase project. This module reads `customers` directly — to match baskets to people and to build portal links — so it has to sit in the same database as them. Putting it in the billing portal would mean that app talking to two Supabase projects at once, which isn't worth it.

If you later want live-sale numbers visible from the billing admin, the clean version is a link out to `/admin/live`, not a second copy of the data.

---

## What you get

| Screen | Path | Job |
|---|---|---|
| Live sales | `/admin/live` | Start a sale, see the week at a glance |
| Catalog | `/admin/live/{id}/catalog` | Load the rack **before** the live |
| Run live | `/admin/live/{id}/claims` | Basket # + tag code, ~2 seconds a claim |
| Baskets | `/admin/live/{id}/baskets` | Match customers, finalize, copy the message |
| Customer basket | your existing `/portal/{token}` | Photos, total, Pay button, EN/ES |

---

## Install — 5 steps, all browser

### 1. Supabase — three migrations left

Already run: `20260716000000_live_sales.sql`, `20260716000100_live_sales_fks.sql`.

Run these, in order:

1. **`20260716000200_manual_payments.sql`** — payment method + note on baskets, payment instructions on sales.
2. **`20260716000300_photo_storage.sql`** — the `live-items` storage bucket for photos.
3. **`20260716000400_basket_photo_and_who.sql`** — basket photo, and who-did-what columns.

Each ends with a verify query. All are safe to re-run.

### 2. Drop the files in

Upload via GitHub web UI, keeping paths:

```
supabase/migrations/20260716000000_live_sales.sql
types/live.ts
lib/live/supabase.ts
lib/live/money.ts
lib/live/queries.ts
lib/live/messages.ts
styles/live.css
components/live/*.tsx          (6 files)
app/admin/live/**              (4 pages)
app/api/live/**                (9 routes)
```

**Don't** upload `app/portal-basket-example/` — that's a reference file, see step 5.

### 3. Dependencies

None. This module imports nothing you don't already have — `@supabase/supabase-js` and Next itself.

It deliberately does **not** import `stripe`. That package isn't in this repo (it lives in the billing portal), and payments are manual anyway.

### 4. Environment variables

Vercel → **shipping portal** project → Settings → Environment Variables.

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | existing |
| `SUPABASE_SERVICE_ROLE_KEY` | existing |
| `NEXT_PUBLIC_PORTAL_URL` | **new** — `https://ship.erendirasboutique.com` |
| `NEXT_PUBLIC_PORTAL_PATH` | **only if** your portal isn't at `/portal/{token}` — e.g. `/p` |
| `NEXT_PUBLIC_BRAND_LOGO_URL` | optional — defaults to `/logo.png`, falls back to a wordmark |

### 5. Wire the customer portal

Open your existing portal page (`app/portal/[token]/page.tsx` or wherever it lives) and add two lines:

```tsx
import PortalBaskets from '@/components/live/PortalBaskets';
import '@/styles/live.css';

// ...then inside the page, above the address section:
<PortalBaskets token={token} />
```

That's the whole integration. See `app/portal-basket-example/EXAMPLE-portal-page.tsx`.

### 6. There is no step 6

No webhook, no second Stripe destination, no signing secret. Payment is marked by hand.

## How this module talks to your existing tables

Everything it assumes about tables you already own lives in **`lib/live/schema.ts`**. Rename something in Supabase later and that one file is the only edit.

Confirmed against your project:

| What | Yours |
|---|---|
| Customers table | `shipping_customers` |
| Orders table | `shipping_orders` |
| New order status | `draft` (your vocabulary: purchased / refunded / draft) |
| `order_number` | never written by this module — `shipping_order_number_seq` owns it |
| Customer columns | `id`, `name`, `email`, `phone`, `portal_token` — all present |
| `portal_token` type | **uuid**, not text |

Three things that came out of that:

- **`portal_token` is a uuid column.** Postgres throws `22P02` on a malformed uuid rather than returning no rows, so both the portal API route and `getBasketsForPortalToken` validate the shape before querying. A junk link now gets a clean "Invalid link" instead of a 500.
- **Archived and merged customers are excluded from the typeahead.** You have `archived` and `merged_into` on `shipping_customers` from the duplicate-merging work. Matching a basket to a merged-away row would send the total to a portal token nobody checks, so the search filters both out.
- **The foreign keys are real now**, not commented out. See step 1.

## Your week, after this

**Wednesday morning — load the rack (~20 min)**
Catalog screen. Code, description, price, quantity, photo. Or paste a whole list from a sheet. These photos become the portal photos, so this isn't extra work — it's Thursday's work moved earlier.

**Wednesday/Thursday — run the live**
Claims screen. Type `47`, Enter, `A3`, Enter. The basket number sticks, so a customer claiming five things is `A3` Enter `B1` Enter `C7` Enter. Ctrl+Z undoes the last claim. Hit **Show rack** if you'd rather click photos than type codes.

Using a barcode scanner? Most scanners send the code then a Tab — the tag field treats Tab as Enter, so scanning just works. Type the basket number, scan, scan, scan.

**Thursday night — send totals (~5 min for 150 baskets)**
Baskets screen. Match each basket to a customer (typeahead), then **Finalize every matched basket** — that just locks the totals, nothing calls Stripe. Then per basket: **Copy message** → paste into Messenger. Toggle EN/ES at the top.

The customer opens their portal and sees their itemized basket, their total, your payment handles, and the deadline. Whatever you typed into "How to pay" when you started the sale is what they read.

**Friday — payment comes in however it comes in**
Zelle, Cash App, Venmo, PayPal, cash, Apple Pay, card. You watch your own accounts, and when money lands you hit **Mark paid** on that basket and pick the method. A reference field is there if you want to jot a Zelle confirmation number.

Nothing marks itself paid. That's deliberate — you asked for it, and it's the right call when six payment rails feed one basket.

Two things happen the moment you mark it:
- The basket becomes a **draft order** in `shipping_orders`, address already filled in
- The method gets counted in the running totals at the top of the screen, so you can see at a glance what came in by Zelle vs Venmo vs cash

**Card link (optional, per basket).** For the rare customer who wants to pay by card: make the link in the billing portal with the generator you already have, then hit **Card link** on their row and paste it. Their portal grows a "Pay by card" button. This module never talks to Stripe itself — no new dependency, no second generator to maintain. Pasting a link doesn't mark anything paid; you mark it when the money lands.

**Saturday — ship**
Every paid basket already has a **draft order** in `shipping_orders`, address copied from the customer record, `order_number` assigned by your sequence. Open the orders page, filter to drafts, buy labels. Your EasyPost webhook email sequence takes it from there.

Baskets whose customer record had no street address still become drafts, flagged `ADDRESS NEEDED` in the order notes. They paid — better a draft you have to finish than a silent no-op.

---

## What's deliberately not here

- **Auto-sending the Messenger message.** Needs a Business Page. Right now it's Copy → paste.
- **Comment capture.** Same reason.
- **Auto-release + Friday reminders.** These want a cron (Vercel Cron), and I'd rather you run one live with the manual version first and see what the real timing should be. `reminderMessage()` in `lib/live/messages.ts` is already written for when you want it.

---

## Notes

- **All money is integer cents.** Totals come from the `basket_totals` view, never from JS math.
- **Prices are snapshotted** onto `basket_items` at claim time. Editing the catalog later never silently rewrites a total a customer already saw.
- **Undo is a soft void**, not a delete. When someone disputes a total on Thursday, the history is still there.
- **Basket numbers reset every sale.** `(live_sale_id, basket_number)` is unique, not `basket_number` alone — that's what stops next Wednesday from colliding with this one.
- **Built for Next.js 14.2** — `params` is a plain object, not a Promise. If you upgrade to Next 15, wrap the param types in `Promise<>` and await them.
