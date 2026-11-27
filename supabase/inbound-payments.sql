-- supabase/inbound-payments.sql
-- Payments read from forwarded "you got paid" emails (Venmo, PayPal,
-- Cash App, Wells Fargo Zelle), waiting for a person to confirm which
-- basket they belong to. Run once in the Supabase SQL editor (the same
-- project as baskets / shipping_orders).
--
-- Nothing here marks a basket paid by itself: the Pagos screen does that
-- only after someone taps "Confirmar".

create table if not exists public.inbound_payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- where it came from
  source text not null,                 -- venmo | paypal | cashapp | zelle | gmail_confirm
  resend_email_id text unique,          -- Resend's id for the received email
  forwarded_by text,                    -- which inbox forwarded it, when we can tell
  auth_status text not null default 'unknown', -- pass | unknown | fail (DKIM/DMARC of the original sender)

  -- what the email says
  payer_name text,
  amount_cents integer,
  note text,                            -- "Depo", "ropa", "#23"...
  reference text,                       -- transaction id / confirmation number
  paid_on text,                         -- date as written in the email
  subject text,

  -- what a person decided
  status text not null default 'new',   -- new | confirmed | ignored
  basket_id uuid,
  confirmed_by text,
  confirmed_at timestamptz
);

-- The same payment forwarded twice (or Resend retrying) is stored once.
create unique index if not exists inbound_payments_source_reference_key
  on public.inbound_payments (source, reference)
  where reference is not null;

create index if not exists inbound_payments_status_idx
  on public.inbound_payments (status, created_at desc);

-- Only the server (service role) reads or writes this table.
alter table public.inbound_payments enable row level security;
