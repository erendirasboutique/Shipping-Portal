# Tracking webhooks (Shippo + EasyPost)

Shippo and EasyPost push every carrier scan to the portal, so orders show where each package is without pressing "Update tracking" on Carrier Performance.

| What | Where |
|---|---|
| Shippo receiver | `app/api/webhooks/shippo/route.ts` |
| EasyPost receiver | `app/api/webhooks/easypost/route.ts` |
| Shared logic (format + save) | `lib/trackingWebhooks.ts` |
| Database columns | `supabase/tracking-webhooks.sql` |

Each update is matched to a `shipping_orders` row by `tracking_number` and saves `tracking_status`, the latest scan (`tracking_last_event`, `tracking_last_location`, `tracking_last_event_at`), `tracking_eta`, the scan history (`tracking_events`), and `first_scan_at` / `delivered_at`. Older or repeated updates are skipped. Tracking numbers that aren't in `shipping_orders` are acknowledged and ignored.

## 1. Database

Supabase → SQL Editor → paste and run `supabase/tracking-webhooks.sql`.

## 2. Environment variables

Vercel → **shipping portal** → Settings → Environment Variables. Never put these values in the repo.

| Variable | Notes |
|---|---|
| `SHIPPO_WEBHOOK_TOKEN` | Long random password (letters and numbers only). Goes at the end of the Shippo URL. |
| `SHIPPO_HMAC_SECRET` | Optional. Only after Shippo's solutions team enables HMAC signing. |
| `EASYPOST_WEBHOOK_USER` | Made-up username (letters and numbers only). |
| `EASYPOST_WEBHOOK_PASS` | Long random password (letters and numbers only). |

Redeploy after adding them.

## 3. Shippo

Shippo API Portal → Webhooks → create:

- Event type: **Track Updated**
- Environment: **Production**
- URL: `https://ship.erendirasboutique.com/api/webhooks/shippo?token=SHIPPO_WEBHOOK_TOKEN`

Labels bought through Shippo report to it automatically.

## 4. EasyPost

EasyPost dashboard → Webhooks → add (your existing EasyPost webhook for customer emails stays as is; EasyPost sends to both):

- URL: `https://EASYPOST_WEBHOOK_USER:EASYPOST_WEBHOOK_PASS@ship.erendirasboutique.com/api/webhooks/easypost`

## 5. Check it

Send a test from each dashboard. A test package won't match a real order, so expect a `200` with `"updated": 0`. A `401` means the password or token in the URL doesn't match Vercel.
