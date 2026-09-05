alter table public.order_quotes
  add column usd_value numeric(18, 2),
  add column exchange_rate numeric(36, 18),
  add column consumed_at timestamptz;

alter table public.order_quotes
  add constraint order_quotes_usd_value_positive check (usd_value is null or usd_value > 0),
  add constraint order_quotes_exchange_rate_positive check (exchange_rate is null or exchange_rate > 0);

create unique index orders_quote_once_idx on public.orders (quote_id) where quote_id is not null;

create or replace function public.create_quick_sell_order(
  p_user_id uuid,
  p_quote_id uuid,
  p_wallet_address text,
  p_max_usd numeric,
  p_cooldown_days integer
)
returns table (order_id uuid, order_number bigint)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  selected_quote public.order_quotes%rowtype;
  existing_order public.orders%rowtype;
  created_order public.orders%rowtype;
begin
  if char_length(btrim(p_wallet_address)) = 0 then raise exception 'invalid wallet address' using errcode = '22023'; end if;
  if p_max_usd <= 0 or p_cooldown_days <= 0 then raise exception 'invalid Quick Sell configuration' using errcode = '22023'; end if;

  select * into existing_order from public.orders where quote_id = p_quote_id and user_id = p_user_id;
  if found then return query select existing_order.id, existing_order.order_number; return; end if;

  select * into selected_quote from public.order_quotes where id = p_quote_id and user_id = p_user_id for update;
  if not found then raise exception 'quote not found' using errcode = 'P0002'; end if;
  if selected_quote.consumed_at is not null then raise exception 'quote already consumed' using errcode = '55000'; end if;
  if selected_quote.expires_at <= now() then raise exception 'quote expired' using errcode = '22023'; end if;
  if selected_quote.usd_value is null or selected_quote.usd_value > p_max_usd then raise exception 'quote exceeds Quick Sell maximum' using errcode = '22023'; end if;
  if exists (select 1 from public.orders where user_id = p_user_id and type = 'quick' and status not in ('paid', 'rejected', 'cancelled', 'refunded')) then raise exception 'previous Quick Sell order still processing' using errcode = '55000'; end if;
  if exists (select 1 from public.orders where user_id = p_user_id and type = 'quick' and status = 'paid' and updated_at > now() - make_interval(days => p_cooldown_days)) then raise exception 'Quick Sell cooldown active' using errcode = '55000'; end if;

  insert into public.orders (user_id, type, source, stars_amount, quote_id, payout_asset, payout_network, wallet_address, expected_payout_amount, status)
  values (p_user_id, 'quick', 'unknown', selected_quote.stars_amount, selected_quote.id, selected_quote.payout_asset, selected_quote.payout_network, p_wallet_address, selected_quote.expected_payout_amount, 'awaiting_payment')
  returning * into created_order;
  update public.order_quotes set consumed_at = now() where id = selected_quote.id;
  return query select created_order.id, created_order.order_number;
end;
$$;

revoke all on function public.create_quick_sell_order(uuid, uuid, text, numeric, integer) from public, anon, authenticated;
grant execute on function public.create_quick_sell_order(uuid, uuid, text, numeric, integer) to service_role;
