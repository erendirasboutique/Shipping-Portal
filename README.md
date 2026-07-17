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

## Install — 6 steps, all browser

### 1. Supabase — mostly done already

You've already run `20260716000000_live_sales.sql` in the shipping project. `live_sales`, `live_items`, `baskets`, `basket_items`, `basket_totals` and `live_item_stock` are all in place.

One thing left: **run `supabase/migrations/20260716000100_live_sales_fks.sql`**. The first migration shipped with the foreign keys commented out because I didn't know your table names yet. Now confirmed — `shipping_customers.id` and `shipping_orders.id` are both uuid — so they can go in. It ends with a verify query that should return two rows.

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

### 3. Check the dependency

`package.json` needs `stripe`. You already have it if the billing portal is in this repo; if not:

```
npm install stripe
```

### 4. Environment variables

Vercel → Settings → Environment Variables. You already have the first three.

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | existing |
| `SUPABASE_SERVICE_ROLE_KEY` | existing |
| `STRIPE_SECRET_KEY` | existing |
| `NEXT_PUBLIC_PORTAL_URL` | **new** — e.g. `https://ship.erendirasboutique.com` |
| `STRIPE_LIVE_WEBHOOK_SECRET` | **new**, only if you use the included webhook |

### 5. Wire the customer portal

Open your existing portal page (`app/portal/[token]/page.tsx` or wherever it lives) and add two lines:

```tsx
import PortalBaskets from '@/components/live/PortalBaskets';
import '@/styles/live.css';

// ...then inside the page, above the address section:
<PortalBaskets token={token} />
```

That's the whole integration. See `app/portal-basket-example/EXAMPLE-portal-page.tsx`.

### 6. Stripe webhook

**If you already have a webhook route:** open it, and inside your `checkout.session.completed` handler add:

```ts
import { markBasketPaid } from '@/app/api/live/stripe-webhook/route';

const basketId = session.metadata?.basket_id;
if (basketId) await markBasketPaid(basketId);
```

Then delete `app/api/live/stripe-webhook/route.ts`… except for that exported function, so easier: keep the file, just don't register a second endpoint in Stripe.

**If you don't:** Stripe → Developers → Webhooks → add `https://ship.erendirasboutique.com/api/live/stripe-webhook`, event `checkout.session.completed`, copy the signing secret into `STRIPE_LIVE_WEBHOOK_SECRET`.

---

## How this module talks to your existing tables

Everything it assumes about tables you already own lives in **`lib/live/schema.ts`**. Rename something in Supabase later and that one file is the only edit.

Confirmed against your project:

| What | Yours |
|---|---|
| Customers table | `shipping_customers` |
| Orders table | `shipping_orders` |
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
Baskets screen. Match each basket to a customer (typeahead), then **Finalize every matched basket**. Every basket gets its total locked and a Stripe link minted. Then per basket: **Copy message** → paste into Messenger. Toggle EN/ES at the top.

**Friday — payment**
Nothing. Stripe webhook marks baskets paid as they come in. Watch the Collected number climb.

**Saturday — ship**
Paid baskets are ready for your existing label flow.

---

## What's deliberately not here

- **Auto-sending the Messenger message.** Needs a Business Page. Right now it's Copy → paste.
- **Comment capture.** Same reason.
- **Auto-release + Friday reminders.** These want a cron (Vercel Cron), and I'd rather you run one live with the manual version first and see what the real timing should be. `reminderMessage()` in `lib/live/messages.ts` is already written for when you want it.
- **EB-XXX order creation on payment.** `baskets.order_id` exists and stays null. I can see `shipping_orders.order_number` is an integer and the address columns are `to_name` / `to_street1` / …, so the mapping from a paid basket to an order row is clear — the one thing I don't know is how `order_number` gets its next value today (a Postgres sequence? `max(order_number) + 1` in app code?). Tell me and I'll wire it into the webhook.

---

## Notes

- **All money is integer cents.** Totals come from the `basket_totals` view, never from JS math.
- **Prices are snapshotted** onto `basket_items` at claim time. Editing the catalog later never silently rewrites a total a customer already saw.
- **Undo is a soft void**, not a delete. When someone disputes a total on Thursday, the history is still there.
- **Basket numbers reset every sale.** `(live_sale_id, basket_number)` is unique, not `basket_number` alone — that's what stops next Wednesday from colliding with this one.
- **`params` is typed as a Promise** (Next 15 style). On Next 14 the `await` is a no-op and it still works.
