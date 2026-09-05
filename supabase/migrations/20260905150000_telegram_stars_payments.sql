alter table public.users add column if not exists stars_balance bigint not null default 0;

create table if not exists public.payment_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  telegram_payment_charge_id text not null unique,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  stars_amount bigint not null check (stars_amount > 0),
  total_amount bigint not null check (total_amount > 0),
  currency text not null check (currency = 'XTR'),
  status text not null default 'paid' check (status in ('paid', 'refunded', 'failed')),
  created_at timestamptz not null default now(),
  unique (telegram_payment_charge_id)
);

create index if not exists payment_charges_user_created_idx on public.payment_charges (user_id, created_at desc);

alter table public.payment_charges enable row level security;

create policy payment_charges_select_own_or_admin on public.payment_charges for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy payment_charges_insert_own_or_admin on public.payment_charges for insert to authenticated
with check (user_id = (select auth.uid()) or (select public.is_admin()));
