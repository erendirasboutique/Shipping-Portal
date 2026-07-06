-- Erendira Shipping Studio — schema
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS throughout.

create extension if not exists "pgcrypto";

-- ---------- staff_users ----------
create table if not exists staff_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  role text default 'staff',
  active boolean default true,
  created_at timestamptz default now()
);

-- ---------- shipping_customers ----------
create table if not exists shipping_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  street1 text,
  street2 text,
  city text,
  state text,
  zip text,
  country text default 'US',
  notes text,
  archived boolean default false,
  merged_into uuid references shipping_customers(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table shipping_customers add column if not exists archived boolean default false;
alter table shipping_customers add column if not exists merged_into uuid references shipping_customers(id);

create index if not exists idx_customers_email on shipping_customers (lower(email));
create index if not exists idx_customers_phone on shipping_customers (phone);
create index if not exists idx_customers_name_zip on shipping_customers (lower(name), zip);
create index if not exists idx_customers_archived on shipping_customers (archived);

-- ---------- shipping_orders ----------
create table if not exists shipping_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references shipping_customers(id),
  -- snapshot of ship-to at time of order
  to_name text,
  to_street1 text,
  to_street2 text,
  to_city text,
  to_state text,
  to_zip text,
  to_country text default 'US',
  to_phone text,
  to_email text,
  -- parcel
  length numeric default 14,
  width numeric default 17,
  height numeric default 1,
  weight_lb integer default 0,
  weight_oz numeric default 0,
  signature_confirmation boolean default false,
  -- easypost
  easypost_shipment_id text,
  easypost_tracker_id text,
  label_url text,
  tracking_number text,
  tracking_url text,
  carrier text,
  mail_class text,
  postage_amount numeric,
  postage_currency text default 'USD',
  refund_status text,
  -- printing
  printed_at timestamptz,
  printed_by text,
  print_status text default 'not_printed', -- not_printed | printed
  batch_selected boolean default false,
  -- lifecycle
  status text default 'draft', -- draft | purchased | refunded | delivered ...
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table shipping_orders add column if not exists easypost_shipment_id text;
alter table shipping_orders add column if not exists easypost_tracker_id text;
alter table shipping_orders add column if not exists label_url text;
alter table shipping_orders add column if not exists tracking_number text;
alter table shipping_orders add column if not exists tracking_url text;
alter table shipping_orders add column if not exists carrier text;
alter table shipping_orders add column if not exists mail_class text;
alter table shipping_orders add column if not exists postage_amount numeric;
alter table shipping_orders add column if not exists postage_currency text default 'USD';
alter table shipping_orders add column if not exists refund_status text;
alter table shipping_orders add column if not exists printed_at timestamptz;
alter table shipping_orders add column if not exists printed_by text;
alter table shipping_orders add column if not exists print_status text default 'not_printed';
alter table shipping_orders add column if not exists batch_selected boolean default false;
alter table shipping_orders add column if not exists customer_id uuid references shipping_customers(id);

create index if not exists idx_orders_status on shipping_orders (status);
create index if not exists idx_orders_print on shipping_orders (print_status);
create index if not exists idx_orders_customer on shipping_orders (customer_id);
create index if not exists idx_orders_created on shipping_orders (created_at desc);

-- ---------- return_codes ----------
create table if not exists return_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  customer_id uuid references shipping_customers(id),
  order_id uuid references shipping_orders(id),
  used boolean default false,
  expires_at timestamptz,
  created_by text,
  created_at timestamptz default now()
);

-- ---------- return_requests ----------
create table if not exists return_requests (
  id uuid primary key default gen_random_uuid(),
  return_code text references return_codes(code),
  customer_id uuid references shipping_customers(id),
  order_id uuid references shipping_orders(id),
  from_name text,
  from_street1 text,
  from_street2 text,
  from_city text,
  from_state text,
  from_zip text,
  from_country text default 'US',
  from_phone text,
  from_email text,
  reason text,
  status text default 'submitted', -- submitted | label_created | received | closed
  easypost_shipment_id text,
  label_url text,
  tracking_number text,
  tracking_url text,
  carrier text default 'USPS',
  mail_class text,
  postage_amount numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- updated_at trigger ----------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_updated on shipping_orders;
create trigger trg_orders_updated before update on shipping_orders
  for each row execute function set_updated_at();

drop trigger if exists trg_customers_updated on shipping_customers;
create trigger trg_customers_updated before update on shipping_customers
  for each row execute function set_updated_at();

drop trigger if exists trg_returns_updated on return_requests;
create trigger trg_returns_updated before update on return_requests
  for each row execute function set_updated_at();

-- ---------- RLS ----------
alter table staff_users enable row level security;
alter table shipping_customers enable row level security;
alter table shipping_orders enable row level security;
alter table return_codes enable row level security;
alter table return_requests enable row level security;

-- Authenticated staff can do everything; service role bypasses RLS automatically.
drop policy if exists "staff read staff_users" on staff_users;
create policy "staff read staff_users" on staff_users
  for select to authenticated using (true);

drop policy if exists "staff all customers" on shipping_customers;
create policy "staff all customers" on shipping_customers
  for all to authenticated using (true) with check (true);

drop policy if exists "staff all orders" on shipping_orders;
create policy "staff all orders" on shipping_orders
  for all to authenticated using (true) with check (true);

drop policy if exists "staff all return_codes" on return_codes;
create policy "staff all return_codes" on return_codes
  for all to authenticated using (true) with check (true);

drop policy if exists "staff all return_requests" on return_requests;
create policy "staff all return_requests" on return_requests
  for all to authenticated using (true) with check (true);

-- Seed your staff (edit emails):
-- insert into staff_users (email, full_name, role) values ('you@erendirasboutique.com', 'Dylan', 'admin')
--   on conflict (email) do nothing;
