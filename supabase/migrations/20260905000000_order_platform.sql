create type public.order_type as enum ('quick', 'verified');
create type public.order_source as enum ('apple_google', 'fragment_other', 'gifts', 'unknown');
create type public.order_status as enum (
  'draft',
  'awaiting_payment',
  'payment_pending',
  'payment_received',
  'awaiting_evidence',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'payout_queued',
  'payout_broadcast',
  'paid',
  'cancelled',
  'refunded'
);
create type public.payout_status as enum ('queued', 'broadcast', 'confirmed', 'failed', 'cancelled');
create type public.risk_flag_severity as enum ('low', 'medium', 'high', 'blocking');

create sequence public.order_number_seq as bigint start with 1 increment by 1 no cycle;

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  telegram_user_id bigint not null unique check (telegram_user_id > 0),
  username text,
  first_name text not null check (char_length(first_name) between 1 and 128),
  last_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.users (id) on delete set null
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

create table public.order_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  stars_amount bigint not null check (stars_amount > 0),
  payout_asset text not null check (char_length(btrim(payout_asset)) > 0),
  payout_network text not null check (char_length(btrim(payout_network)) > 0),
  expected_payout_amount numeric(36, 18) not null check (expected_payout_amount > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint not null default nextval('public.order_number_seq'),
  user_id uuid not null references public.users (id) on delete restrict,
  type public.order_type not null,
  source public.order_source not null default 'unknown',
  stars_amount bigint not null check (stars_amount > 0),
  quote_id uuid,
  payout_asset text not null check (char_length(btrim(payout_asset)) > 0),
  payout_network text not null check (char_length(btrim(payout_network)) > 0),
  wallet_address text not null check (char_length(btrim(wallet_address)) > 0),
  expected_payout_amount numeric(36, 18) not null check (expected_payout_amount > 0),
  status public.order_status not null default 'draft',
  settlement_available_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_order_number_key unique (order_number),
  constraint orders_id_user_id_key unique (id, user_id),
  constraint orders_quote_owner_fk foreign key (quote_id, user_id)
    references public.order_quotes (id, user_id) on delete restrict
);

create table public.order_evidence (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  storage_bucket text not null default 'user-assets',
  storage_object_path text not null check (char_length(btrim(storage_object_path)) > 0),
  evidence_type text not null check (char_length(btrim(evidence_type)) > 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (order_id, id),
  constraint order_evidence_owner_fk foreign key (order_id, user_id)
    references public.orders (id, user_id) on delete cascade
);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete restrict,
  actor_user_id uuid references public.users (id) on delete set null,
  event_type text not null check (char_length(btrim(event_type)) > 0),
  from_status public.order_status,
  to_status public.order_status,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict,
  asset text not null check (char_length(btrim(asset)) > 0),
  network text not null check (char_length(btrim(network)) > 0),
  destination text not null check (char_length(btrim(destination)) > 0),
  amount numeric(36, 18) not null check (amount > 0),
  status public.payout_status not null default 'queued',
  provider_reference text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.payouts is
  'Payout workflow records only. No wallet keys, signing material, or transfer implementation belongs in this table.';

create table public.support_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  author_admin_user_id uuid not null references public.admin_users (user_id) on delete restrict,
  body text not null check (char_length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.risk_flags (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  severity public.risk_flag_severity not null,
  code text not null check (char_length(btrim(code)) > 0),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  resolved_at timestamptz,
  resolved_by uuid references public.admin_users (user_id) on delete set null,
  created_at timestamptz not null default now(),
  unique (order_id, code)
);

create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_status_created_idx on public.orders (status, created_at);
create index orders_settlement_idx on public.orders (settlement_available_at) where settlement_available_at is not null;
create index order_quotes_user_created_idx on public.order_quotes (user_id, created_at desc);
create index order_evidence_order_created_idx on public.order_evidence (order_id, created_at);
create index order_events_order_id_idx on public.order_events (order_id, id);
create index payouts_status_created_idx on public.payouts (status, created_at);
create index support_notes_order_created_idx on public.support_notes (order_id, created_at);
create index risk_flags_unresolved_idx on public.risk_flags (order_id, severity) where resolved_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger payouts_set_updated_at before update on public.payouts
for each row execute function public.set_updated_at();
create trigger support_notes_set_updated_at before update on public.support_notes
for each row execute function public.set_updated_at();

create or replace function public.record_order_event()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, actor_user_id, event_type, to_status)
    values (new.id, (select auth.uid()), 'order_created', new.status);
  elsif old.status is distinct from new.status then
    insert into public.order_events (order_id, actor_user_id, event_type, from_status, to_status)
    values (new.id, (select auth.uid()), 'status_changed', old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger orders_record_event after insert or update of status on public.orders
for each row execute function public.record_order_event();

create or replace function public.reject_order_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'order_events is append-only' using errcode = '55000';
end;
$$;

create trigger order_events_immutable before update or delete on public.order_events
for each row execute function public.reject_order_event_mutation();

create or replace function public.is_quick_sale_eligible(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and (o.user_id = (select auth.uid()) or (select public.is_admin()))
      and o.type = 'quick'
      and o.status not in ('rejected', 'cancelled', 'refunded', 'paid')
      and not exists (
        select 1 from public.risk_flags rf
        where rf.order_id = o.id and rf.resolved_at is null and rf.severity = 'blocking'
      )
  );
$$;

revoke all on function public.is_quick_sale_eligible(uuid) from public;
grant execute on function public.is_quick_sale_eligible(uuid) to authenticated, service_role;

alter table public.users enable row level security;
alter table public.admin_users enable row level security;
alter table public.order_quotes enable row level security;
alter table public.orders enable row level security;
alter table public.order_evidence enable row level security;
alter table public.order_events enable row level security;
alter table public.payouts enable row level security;
alter table public.support_notes enable row level security;
alter table public.risk_flags enable row level security;

create policy users_select_own_or_admin on public.users for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));
create policy users_update_own_or_admin on public.users for update to authenticated
using (id = (select auth.uid()) or (select public.is_admin()))
with check (id = (select auth.uid()) or (select public.is_admin()));

create policy admin_users_admin_only on public.admin_users for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy order_quotes_select_own_or_admin on public.order_quotes for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy orders_select_own_or_admin on public.orders for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy orders_insert_own_initial on public.orders for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status in ('draft', 'awaiting_payment')
);
create policy orders_admin_update on public.orders for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy evidence_select_own_or_admin on public.order_evidence for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy evidence_insert_own on public.order_evidence for insert to authenticated
with check (user_id = (select auth.uid()));
create policy evidence_delete_own_or_admin on public.order_evidence for delete to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy order_events_admin_only on public.order_events for select to authenticated
using ((select public.is_admin()));
create policy payouts_admin_only on public.payouts for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy support_notes_admin_only on public.support_notes for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy risk_flags_admin_only on public.risk_flags for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

grant usage on schema public to authenticated, service_role;
grant select, update on public.users to authenticated;
grant select, insert, update, delete on public.admin_users to authenticated;
grant select on public.order_quotes, public.order_events to authenticated;
grant select on public.orders to authenticated;
grant insert (
  user_id, type, source, stars_amount, quote_id, payout_asset, payout_network,
  wallet_address, expected_payout_amount, settlement_available_at, status
) on public.orders to authenticated;
grant update on public.orders to authenticated;
grant select, insert, delete on public.order_evidence to authenticated;
grant select, insert, update, delete on public.payouts, public.support_notes, public.risk_flags to authenticated;
grant usage, select on sequence public.order_number_seq to authenticated, service_role;
