create or replace function public.prepare_gift_verified_order(
  p_user_id uuid, p_quote_id uuid, p_wallet_address text, p_settlement_days integer
)
returns table (order_id uuid, order_number bigint)
language plpgsql security definer set search_path = '' set row_security = off
as $$
declare selected_session public.sell_sessions%rowtype; selected_quote public.order_quotes%rowtype; selected_order public.orders%rowtype;
begin
  if p_settlement_days <= 0 then raise exception 'invalid settlement policy' using errcode = '22023'; end if;
  select * into selected_session from public.sell_sessions where user_id = p_user_id and flow = 'verified'
    and selected_source = 'gifts' and settlement_notice_accepted_at is not null and expires_at > now() for update;
  if not found then raise exception 'gift settlement notice not accepted' using errcode = 'P0002'; end if;
  if selected_session.order_id is not null then select * into selected_order from public.orders where id = selected_session.order_id and user_id = p_user_id; return query select selected_order.id, selected_order.order_number; return; end if;
  select * into selected_quote from public.order_quotes where id = p_quote_id and user_id = p_user_id for update;
  if not found or selected_quote.expires_at <= now() or selected_quote.consumed_at is not null then raise exception 'quote unavailable' using errcode = '22023'; end if;
  insert into public.orders (user_id, type, source, stars_amount, quote_id, payout_asset, payout_network, wallet_address, expected_payout_amount, status, settlement_duration_days)
  values (p_user_id, 'verified', 'gifts', selected_quote.stars_amount, selected_quote.id, selected_quote.payout_asset, selected_quote.payout_network, p_wallet_address, selected_quote.expected_payout_amount, 'draft', p_settlement_days) returning * into selected_order;
  update public.order_quotes set consumed_at = now() where id = selected_quote.id;
  update public.sell_sessions set order_id = selected_order.id, wallet_address = p_wallet_address, wallet_confirmed = true, expires_at = now() + interval '24 hours' where id = selected_session.id;
  return query select selected_order.id, selected_order.order_number;
end;
$$;

create or replace function public.submit_gift_verified_order(p_user_id uuid)
returns table (order_id uuid, order_number bigint)
language plpgsql security definer set search_path = '' set row_security = off
as $$
declare selected_order public.orders%rowtype;
begin
  select o.* into selected_order from public.orders o join public.sell_sessions s on s.order_id = o.id where s.user_id = p_user_id and o.user_id = p_user_id and o.source = 'gifts' for update of o;
  if not found then raise exception 'draft order unavailable' using errcode = 'P0002'; end if;
  if selected_order.status = 'submitted' then return query select selected_order.id, selected_order.order_number; return; end if;
  if selected_order.status <> 'draft' then raise exception 'order cannot be submitted' using errcode = '55000'; end if;
  if not exists (select 1 from public.order_evidence e where e.order_id = selected_order.id and e.evidence_type = 'gift_history')
    or not exists (select 1 from public.order_evidence e where e.order_id = selected_order.id and e.evidence_type = 'gift_details')
    or not exists (select 1 from public.order_evidence e where e.order_id = selected_order.id and e.evidence_type = 'telegram_confirmation') then raise exception 'required gift evidence missing' using errcode = '22023'; end if;
  update public.orders set status = 'submitted' where id = selected_order.id returning * into selected_order;
  return query select selected_order.id, selected_order.order_number;
end;
$$;

create or replace function public.set_apple_google_settlement_date()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.source in ('apple_google', 'gifts') and new.status = 'approved' and old.status is distinct from 'approved' then
    if new.settlement_duration_days is null then raise exception 'settlement policy missing' using errcode = '23514'; end if;
    new.settlement_available_at = now() + make_interval(days => new.settlement_duration_days);
  end if;
  return new;
end;
$$;
revoke all on function public.prepare_gift_verified_order(uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.submit_gift_verified_order(uuid) from public, anon, authenticated;
grant execute on function public.prepare_gift_verified_order(uuid, uuid, text, integer) to service_role;
grant execute on function public.submit_gift_verified_order(uuid) to service_role;
