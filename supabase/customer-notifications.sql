-- Customer notifications: 4 bilingual emails + texts
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

insert into notification_templates (stage, sort, subject, heading_es, heading_en, body_es, body_en, sms_body) values
('packed', 1,
 '📦 {first_name}, tu pedido está empacado · Your order has been packed',
 '¡Tu pedido está empacado!',
 'Your order has been packed!',
 'Hola {first_name}, ¡muchas gracias por tu compra! Tu pedido ya está empacado y lo estamos preparando para enviarlo. Sale con nuestro envío del {ship_date}.',
 'Hi {first_name}, thank you so much for shopping with us! Your order is packed and we''re preparing it for shipment. It goes out with our {ship_date} shipment.',
 E'¡Hola {first_name}! Es Erendira''s Boutique 🤍\nTu pedido {order_number} está empacado y lo estamos preparando para enviarlo. Sale el {ship_date}.\n\nHi {first_name}! Your order {order_number} is packed and we''re preparing it for shipment. It ships {ship_date}.\n\n🚚 {carrier}\n🔢 {tracking_number}\nRastrear / Track: {tracking_link}'),
('in_transit', 2,
 '🚚 ¡Tu pedido va en camino! · Your order is on the way!',
 '¡Tu pedido va en camino!',
 'Your order is on the way!',
 'Hola {first_name}, ¡buenas noticias! USPS acaba de escanear tu paquete y ya va en camino. ¡No podemos esperar a que lo estrenes!',
 'Hi {first_name}, great news! USPS just scanned your package and it''s officially on its way. We can''t wait for you to try everything on.',
 E'¡Hola {first_name}! 🎉 Tu pedido {order_number} va en camino. USPS lo escaneó en {scan_location}.\nEntrega estimada: {eta}\n\nHi {first_name}! Your order {order_number} is on the way. USPS scanned it in {scan_location}.\nEstimated delivery: {eta}\n\nRastrear / Track: {tracking_link}'),
('out_for_delivery', 3,
 '📍 ¡Llega hoy, {first_name}! · Your order is out for delivery',
 '¡Tu pedido sale a entrega hoy!',
 'Your order is out for delivery!',
 'Hola {first_name}, ¡hoy es el día! Tu paquete ya va en el camión de entrega y debe llegar hoy.',
 'Hi {first_name}, today''s the day! Your package is on the delivery truck and should arrive today.',
 E'¡Buenos días {first_name}! ☀️ Tu pedido {order_number} sale a entrega y llega HOY a {address}.\n\nGood morning {first_name}! Your order {order_number} is out for delivery and arriving TODAY.\n\nRastrear / Track: {tracking_link}'),
('delivered', 4,
 '🛍️ ¡Tu pedido fue entregado! · Your order has been delivered',
 '¡Tu pedido fue entregado!',
 'Your order has been delivered!',
 'Hola {first_name}, ¡tu paquete llegó! Gracias por apoyar a nuestro pequeño negocio. Esperamos que te encante cada pieza.',
 'Hi {first_name}, your package has arrived! Thank you for supporting our small business. We hope you love every piece.',
 E'¡Hola {first_name}! 🛍️ Tu pedido {order_number} fue entregado ({delivered_time}). ¡Esperamos que te encante!\n\nHi {first_name}! Your order {order_number} was delivered ({delivered_time}). We hope you love everything!\n\n¿No lo ves? / Don''t see it? ebtq.io/messenger\nGracias por comprar con Erendira''s Boutique 🤍')
on conflict (stage) do nothing;

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

-- Only the server (service role) touches these tables.
alter table notification_settings enable row level security;
alter table notification_templates enable row level security;
alter table notification_log enable row level security;
