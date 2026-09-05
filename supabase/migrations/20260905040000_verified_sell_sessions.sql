create table public.sell_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  flow text not null default 'verified' check (flow = 'verified'),
  selected_source public.order_source not null check (selected_source <> 'unknown'),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, flow),
  check (expires_at > created_at)
);

create index sell_sessions_expires_at_idx on public.sell_sessions (expires_at);
create trigger sell_sessions_set_updated_at before update on public.sell_sessions
for each row execute function public.set_updated_at();
alter table public.sell_sessions enable row level security;
revoke all on table public.sell_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.sell_sessions to service_role;
comment on table public.sell_sessions is
  'Short-lived, server-managed state for sell flows. It does not represent an order.';
