create type public.notification_delivery_status as enum ('processing', 'sent', 'failed');

create table public.notification_delivery (
  id uuid primary key default gen_random_uuid(),
  order_event_id bigint not null unique references public.order_events(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  notification_type text not null check (char_length(btrim(notification_type)) > 0),
  status public.notification_delivery_status not null default 'processing',
  attempts integer not null default 1 check (attempts > 0),
  telegram_message_id bigint,
  last_error text,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_delivery_status_idx on public.notification_delivery(status, updated_at);
create trigger notification_delivery_set_updated_at before update on public.notification_delivery
for each row execute function public.set_updated_at();

comment on table public.notification_delivery is
  'Database-backed idempotency ledger for Telegram order notifications.';

alter table public.notification_delivery enable row level security;
revoke all on public.notification_delivery from public, anon, authenticated;
grant select, insert, update on public.notification_delivery to service_role;

create or replace function public.pending_order_notifications(p_limit integer default 100)
returns table(event_id bigint, order_id uuid, order_number bigint, telegram_user_id bigint, event_type text, to_status public.order_status)
language sql stable security definer set search_path = '' set row_security = off
as $$
  select e.id, o.id, o.order_number, u.telegram_user_id, e.event_type, e.to_status
  from public.order_events e
  join public.orders o on o.id = e.order_id
  join public.users u on u.id = o.user_id
  left join public.notification_delivery d on d.order_event_id = e.id
  where (
    (e.event_type = 'status_changed' and e.to_status in ('submitted', 'payout_broadcast', 'paid'))
    or e.event_type in ('admin_request_more_evidence', 'admin_approve', 'admin_reject', 'admin_queue_payout')
  ) and (d.id is null or d.status = 'failed')
  order by e.id
  limit least(greatest(p_limit, 1), 500);
$$;

revoke all on function public.pending_order_notifications(integer) from public, anon, authenticated;
grant execute on function public.pending_order_notifications(integer) to service_role;
