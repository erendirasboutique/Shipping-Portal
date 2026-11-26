-- Customer notifications: 4 Spanish emails + texts
--   packed            -> when the label is bought
--   in_transit        -> USPS's first scan ("on the way")
--   out_for_delivery  -> out for delivery
--   delivered         -> delivered
-- Run once in Supabase › SQL Editor. Safe to run again.

-- ---------- Branding + master switch (one row) ----------
create table if not exists notification_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default true,
  -- Only orders created after this get tracking notifications, so packages
  -- already out there don't suddenly get "delivered" emails.
  enabled_since timestamptz not null default now(),
  logo_url text,                       -- blank = the portal's /logo2.png
  tagline text default '¡Envíos cada Sábado!',
  business_address text,               -- shown in the email footer (required by email law)
  color_background text default '#F5F3EF',
  color_accent text default '#957f67', -- headings + buttons
  color_border text default '#cfbda9',
  color_text text default '#332b23',
  updated_at timestamptz default now()
);
insert into notification_settings (id) values (1) on conflict (id) do nothing;
-- Where customer replies go.
alter table notification_settings add column if not exists reply_to text default 'hello@erendirasboutique.com';
update notification_settings set reply_to = 'hello@erendirasboutique.com' where id = 1 and reply_to is null;

-- ---------- The 4 messages (editable in Settings › Notifications) ----------
create table if not exists notification_templates (
  stage text primary key check (stage in ('packed','in_transit','out_for_delivery','delivered')),
  sort int not null default 0,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default true,
  subject text not null,
  heading_es text not null default '',
  heading_en text not null default '',
  body_es text not null default '',
  body_en text not null default '',
  sms_body text not null default '',
  updated_at timestamptz default now()
);

-- The starting wording (Spanish). Edit it any time in Settings › Notifications.
-- Running this file again never overwrites your edits (it only swaps out the old bilingual starting text).
insert into notification_templates (stage, sort, subject, heading_es, body_es, sms_body) values
('packed', 1,
 '📦 {first_name}, tu pedido está empacado',
 'Tu pedido está empacado',
 '¡Gracias por tu compra, {first_name}! Ya empacamos tu pedido y lo estamos preparando para enviarlo con nuestro envío del sábado.',
 E'¡Hola {first_name}! Es Erendira''s Boutique 🤍 Tu pedido {order_number} ya está empacado y sale el {ship_date}.\nRastréalo aquí: {tracking_link}'),
('in_transit', 2,
 '🚚 Tu pedido va en camino',
 'Tu pedido va en camino',
 'USPS ya tiene tu paquete. Rastrea tu envío para ver el estado de la entrega.',
 E'¡Hola {first_name}! 🎉 Tu pedido {order_number} va en camino.\nEntrega estimada: {eta}\nRastréalo aquí: {tracking_link}'),
('out_for_delivery', 3,
 '📍 Tu pedido llega hoy',
 'Tu pedido llega hoy',
 'Tu paquete ya va en el camión de entrega y debe llegar hoy. ¡Estate pendiente!',
 E'¡Buenos días {first_name}! ☀️ Tu pedido {order_number} sale a entrega y llega HOY.\nRastréalo aquí: {tracking_link}'),
('delivered', 4,
 '🛍️ Tu pedido fue entregado',
 'Tu pedido fue entregado',
 '¡Tu paquete llegó, {first_name}! Gracias por apoyar a nuestro pequeño negocio. Esperamos que te encante todo.',
 E'¡Hola {first_name}! 🛍️ Tu pedido {order_number} fue entregado. ¡Esperamos que te encante! ¿No lo ves? Escríbenos: ebtq.io/messenger')
on conflict (stage) do update set
  subject = excluded.subject,
  heading_es = excluded.heading_es,
  body_es = excluded.body_es,
  sms_body = excluded.sms_body,
  updated_at = now()
where notification_templates.sms_body like '%Hi {first_name}%';  -- only the old bilingual starting text

-- ---------- Send log (also stops anyone getting the same message twice) ----------
create table if not exists notification_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references shipping_orders(id) on delete cascade,
  stage text not null,
  channel text not null check (channel in ('email','sms')),
  sent_to text,
  status text not null,            -- sending | sent | scheduled | failed | skipped
  provider_id text,
  error text,
  test boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists notification_log_once
  on notification_log (order_id, stage, channel)
  where status in ('sending', 'sent', 'scheduled') and test = false;
create index if not exists notification_log_recent on notification_log (created_at desc);
create index if not exists notification_log_order on notification_log (order_id);
-- The text that was sent, and when a quiet-hours text is set to go out.
alter table notification_log add column if not exists body text;
alter table notification_log add column if not exists send_at timestamptz;

-- Only the server (service role) touches these tables.
alter table notification_settings enable row level security;
alter table notification_templates enable row level security;
alter table notification_log enable row level security;
