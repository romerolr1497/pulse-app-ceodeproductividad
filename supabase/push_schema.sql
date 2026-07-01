-- Pulse — suscripciones a notificaciones push (ejecutar en Supabase > SQL Editor)
-- Guarda la suscripción del navegador + un snapshot de las rutinas para que el
-- servidor (cron) sepa a qué hora notificar, sin leer el estado completo.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  routines jsonb not null default '[]'::jsonb,   -- [{ id, name, startTime, days }]
  notify_minutes int not null default 0,
  wake_time text,                                 -- HH:mm hora de despertar
  morning_motivation boolean not null default false,
  tz text not null default 'America/Argentina/Buenos_Aires',
  updated_at timestamptz not null default now()
);

-- Si la tabla ya existía, agregá las columnas nuevas:
alter table public.push_subscriptions add column if not exists wake_time text;
alter table public.push_subscriptions add column if not exists morning_motivation boolean not null default false;

alter table public.push_subscriptions enable row level security;

-- El usuario gestiona sus propias suscripciones (el cron usa service_role y saltea RLS).
drop policy if exists "push own select" on public.push_subscriptions;
create policy "push own select" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push own insert" on public.push_subscriptions;
create policy "push own insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push own update" on public.push_subscriptions;
create policy "push own update" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push own delete" on public.push_subscriptions;
create policy "push own delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);
