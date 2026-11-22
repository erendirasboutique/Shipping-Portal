-- Run once in Supabase → SQL Editor before turning on the tracking webhooks.
-- Safe to run more than once.

-- Already used by Carrier Performance (/api/tracking/check); added here in case
-- they were created by hand and aren't in schema.sql.
alter table shipping_orders add column if not exists tracking_status text;
alter table shipping_orders add column if not exists tracking_checked_at timestamptz;
alter table shipping_orders add column if not exists first_scan_at timestamptz;
alter table shipping_orders add column if not exists delivered_at timestamptz;

-- New: filled in by /api/webhooks/shippo and /api/webhooks/easypost.
alter table shipping_orders add column if not exists tracking_last_event text;        -- e.g. "Out for delivery"
alter table shipping_orders add column if not exists tracking_last_location text;     -- e.g. "Houston, TX"
alter table shipping_orders add column if not exists tracking_last_event_at timestamptz;
alter table shipping_orders add column if not exists tracking_eta timestamptz;        -- carrier's estimated delivery, when given
alter table shipping_orders add column if not exists tracking_events jsonb;           -- newest first: [{at, status, message, location}]
alter table shipping_orders add column if not exists tracking_source text;            -- shippo | easypost

-- Webhooks look orders up by tracking number.
create index if not exists idx_orders_tracking_number on shipping_orders (tracking_number);
