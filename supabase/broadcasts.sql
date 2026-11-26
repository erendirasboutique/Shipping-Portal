-- Notifications › Send a message: custom emails and texts to customers.
-- Run once in Supabase › SQL Editor. Safe to run again.

-- ---------- Presets (the buttons on the left) ----------
create table if not exists message_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sms_body text not null default '',
  email_subject text not null default '',
  email_heading text not null default '',
  email_body text not null default '',
  button_text text not null default '',
  button_link text not null default '',
  attach_card_sms boolean not null default false,
  attach_card_email boolean not null default false,
  built_in boolean not null default false,
  sort int not null default 100,
  created_at timestamptz not null default now()
);
create unique index if not exists message_presets_builtin_name on message_presets (name) where built_in;

insert into message_presets (name, description, sms_body, email_subject, email_heading, email_body, button_text, button_link, attach_card_sms, attach_card_email, built_in, sort) values
('🔴 Estamos en vivo', '"¡Estamos EN VIVO ahora!" + your live link',
 E'¡Hola {first_name}! 🔴 Estamos EN VIVO ahora con piezas nuevas. ¡Te esperamos!\n{live_link}',
 '🔴 ¡Estamos EN VIVO!', 'Estamos en vivo',
 '¡Hola {first_name}! Ya empezamos el live con piezas nuevas. Entra ahora y aparta las tuyas.',
 'Ver el live', '{live_link}', false, false, true, 1),
('⏰ Live hoy', 'Reminder earlier in the day, with the time',
 E'¡Hola {first_name}! ⏰ Hoy tenemos live a las [HORA] con piezas nuevas. ¡No te lo pierdas!',
 '⏰ Hoy hay live', 'Hoy tenemos live',
 '¡Hola {first_name}! Hoy a las [HORA] estaremos en vivo con piezas nuevas. Te esperamos.',
 'Ver el live', '{live_link}', false, false, true, 2),
('👋 Bienvenida', '"Ahora te avisaremos por texto" + contact card',
 E'¡Hola {first_name}! 👋 Ahora te avisaremos por texto de tus pedidos, envíos y lives. Guarda nuestro contacto para que sepas que somos nosotros. 🤍',
 '👋 ¡Te damos la bienvenida a Erendira''s Boutique!', '¡Te damos la bienvenida!',
 '¡Hola {first_name}! Gracias por ser parte de Erendira''s Boutique. Te avisaremos de tus pedidos, envíos, lives y ofertas. Guarda nuestro contacto (va adjunto) para que siempre sepas que somos nosotros.',
 'Visita nuestra tienda', 'https://erendirasboutique.com', true, true, true, 3),
('📇 Guarda nuestro contacto', 'Just the contact card, so we show up by name',
 E'¡Hola {first_name}! 📇 Guarda nuestro contacto para que sepas que somos nosotros cuando te escribamos.',
 '📇 Guarda nuestro contacto', 'Guarda nuestro contacto',
 '¡Hola {first_name}! Te mandamos nuestra tarjeta de contacto (va adjunta). Ábrela y toca "Agregar contacto" para que siempre sepas que somos nosotros.',
 '', '', true, true, true, 4),
('🏷️ Oferta', 'A sale or new pieces',
 E'¡Hola {first_name}! 🏷️ [Tu oferta aquí]. ¡Solo por tiempo limitado!',
 '🏷️ [Tu oferta aquí]', '[Tu oferta aquí]',
 '¡Hola {first_name}! [Escribe aquí los detalles de la oferta.]',
 'Ver ahora', 'https://erendirasboutique.com', false, false, true, 5),
('✏️ En blanco', 'Write your own',
 '', '', '', '', '', '', false, false, true, 6)
on conflict (name) where built_in do nothing;

-- ---------- Each send, and each person it goes to ----------
create table if not exists broadcasts (
  id uuid primary key default gen_random_uuid(),
  created_by text,
  channels text not null,             -- email | sms | both
  audience text not null,             -- sms_subscribers | emails | live_week | one
  message jsonb not null,             -- what was sent
  status text not null default 'sending', -- sending | done | cancelled
  total int not null default 0,
  sent int not null default 0,
  failed int not null default 0,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists broadcasts_recent on broadcasts (created_at desc);

create table if not exists broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references broadcasts(id) on delete cascade,
  channel text not null check (channel in ('email','sms')),
  to_addr text not null,
  name text,
  status text not null default 'pending', -- pending | sending | sent | failed | skipped
  error text,
  provider_id text,
  sent_at timestamptz,
  unique (broadcast_id, channel, to_addr)
);
create index if not exists broadcast_recipients_pending on broadcast_recipients (broadcast_id) where status = 'pending';

-- ---------- People who clicked "Darse de baja" on a promotional email ----------
-- (Shipping updates still go to them; only Send-a-message emails skip them.)
create table if not exists email_unsubscribes (
  email text primary key,              -- lowercase
  unsubscribed_at timestamptz not null default now(),
  source text
);

alter table message_presets enable row level security;
alter table broadcasts enable row level security;
alter table broadcast_recipients enable row level security;
alter table email_unsubscribes enable row level security;
