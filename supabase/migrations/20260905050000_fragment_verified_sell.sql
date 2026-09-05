alter table public.sell_sessions
  add column quote_id uuid references public.order_quotes(id) on delete set null,
  add column order_id uuid references public.orders(id) on delete set null,
  add column wallet_address text,
  add column wallet_confirmed boolean not null default false;

alter table public.order_evidence rename column storage_object_path to storage_path;
alter table public.order_evidence
  add column sha256 text,
  add column mime_type text,
  add column size bigint,
  add column uploaded_at timestamptz not null default now(),
  add constraint order_evidence_sha256_format check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  add constraint order_evidence_mime_type_allowed check (mime_type is null or mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  add constraint order_evidence_size_positive check (size is null or size > 0);

create unique index order_evidence_order_hash_idx
  on public.order_evidence(order_id, sha256) where sha256 is not null;

create or replace function public.prepare_fragment_verified_order(
  p_user_id uuid,
  p_quote_id uuid,
  p_wallet_address text
)
returns table (order_id uuid, order_number bigint)
language plpgsql security definer set search_path = '' set row_security = off
as $$
declare
  selected_session public.sell_sessions%rowtype;
  selected_quote public.order_quotes%rowtype;
  selected_order public.orders%rowtype;
begin
  select * into selected_session from public.sell_sessions
    where user_id = p_user_id and flow = 'verified' and selected_source = 'fragment_other'
      and expires_at > now() for update;
  if not found then raise exception 'verified sell session unavailable' using errcode = 'P0002'; end if;
  if selected_session.order_id is not null then
    select * into selected_order from public.orders where id = selected_session.order_id and user_id = p_user_id;
    return query select selected_order.id, selected_order.order_number; return;
  end if;
  select * into selected_quote from public.order_quotes
    where id = p_quote_id and user_id = p_user_id for update;
  if not found or selected_quote.expires_at <= now() or selected_quote.consumed_at is not null then
    raise exception 'quote unavailable' using errcode = '22023';
  end if;
  insert into public.orders (
    user_id, type, source, stars_amount, quote_id, payout_asset, payout_network,
    wallet_address, expected_payout_amount, status
  ) values (
    p_user_id, 'verified', 'fragment_other', selected_quote.stars_amount,
    selected_quote.id, selected_quote.payout_asset, selected_quote.payout_network,
    p_wallet_address, selected_quote.expected_payout_amount, 'draft'
  ) returning * into selected_order;
  update public.order_quotes set consumed_at = now() where id = selected_quote.id;
  update public.sell_sessions set quote_id = selected_quote.id, order_id = selected_order.id,
    wallet_address = p_wallet_address, wallet_confirmed = true,
    expires_at = now() + interval '24 hours'
    where id = selected_session.id;
  return query select selected_order.id, selected_order.order_number;
end;
$$;

create or replace function public.submit_fragment_verified_order(p_user_id uuid)
returns table (order_id uuid, order_number bigint)
language plpgsql security definer set search_path = '' set row_security = off
as $$
declare selected_order public.orders%rowtype;
begin
  select o.* into selected_order from public.orders o
    join public.sell_sessions s on s.order_id = o.id
    where s.user_id = p_user_id and s.flow = 'verified'
      and o.user_id = p_user_id and o.type = 'verified' and o.source = 'fragment_other'
    for update of o;
  if not found then raise exception 'draft order unavailable' using errcode = 'P0002'; end if;
  if selected_order.status = 'submitted' then
    return query select selected_order.id, selected_order.order_number; return;
  end if;
  if selected_order.status <> 'draft' then raise exception 'order cannot be submitted' using errcode = '55000'; end if;
  if not exists (select 1 from public.order_evidence e where e.order_id = selected_order.id and e.evidence_type = 'stars_transaction_history')
    or not exists (select 1 from public.order_evidence e where e.order_id = selected_order.id and e.evidence_type = 'purchase_receipt') then
    raise exception 'required evidence missing' using errcode = '22023';
  end if;
  update public.orders set status = 'submitted' where id = selected_order.id returning * into selected_order;
  return query select selected_order.id, selected_order.order_number;
end;
$$;

revoke all on function public.prepare_fragment_verified_order(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.submit_fragment_verified_order(uuid) from public, anon, authenticated;
grant execute on function public.prepare_fragment_verified_order(uuid, uuid, text) to service_role;
grant execute on function public.submit_fragment_verified_order(uuid) to service_role;
