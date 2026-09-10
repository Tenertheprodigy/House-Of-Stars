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
  selected_payment public.payment_charges%rowtype;
  existing_order public.orders%rowtype;
  created_order public.orders%rowtype;
begin
  if char_length(btrim(p_wallet_address)) = 0 then raise exception 'invalid wallet address' using errcode = '22023'; end if;
  if p_max_usd <= 0 or p_cooldown_days <= 0 then raise exception 'invalid Quick Sell configuration' using errcode = '22023'; end if;

  select * into existing_order
  from public.orders
  where quote_id = p_quote_id and user_id = p_user_id
  for update;
  if found then
    if existing_order.wallet_address is distinct from p_wallet_address then
      raise exception 'order destination does not match' using errcode = '55000';
    end if;
    if existing_order.wallet_validated_at is null
      or existing_order.wallet_validation_network is distinct from existing_order.payout_network then
      update public.orders
      set wallet_validated_at = now(), wallet_validation_network = existing_order.payout_network
      where id = existing_order.id
      returning * into existing_order;
    end if;
    return query select existing_order.id, existing_order.order_number;
    return;
  end if;

  select * into selected_quote
  from public.order_quotes
  where id = p_quote_id and user_id = p_user_id
  for update;
  if not found then raise exception 'quote not found' using errcode = 'P0002'; end if;
  if selected_quote.consumed_at is not null then raise exception 'quote already consumed' using errcode = '55000'; end if;
  if selected_quote.usd_value is null or selected_quote.usd_value > p_max_usd then raise exception 'quote exceeds Quick Sell maximum' using errcode = '22023'; end if;

  select * into selected_payment
  from public.payment_charges
  where user_id = p_user_id
    and status = 'paid'
    and currency = 'XTR'
    and total_amount = selected_quote.stars_amount
    and payload @> jsonb_build_object('pr', 'q', 'o', p_quote_id::text)
  order by created_at desc
  limit 1;
  if not found then
    if selected_quote.expires_at <= now() then
      raise exception 'quote expired' using errcode = '22023';
    end if;
    raise exception 'Telegram payment not confirmed' using errcode = '55000';
  end if;

  if exists (
    select 1 from public.orders
    where user_id = p_user_id and type = 'quick'
      and status not in ('paid', 'rejected', 'cancelled', 'refunded')
  ) then raise exception 'previous Quick Sell order still processing' using errcode = '55000'; end if;
  if exists (
    select 1 from public.orders
    where user_id = p_user_id and type = 'quick' and status = 'paid'
      and updated_at > now() - make_interval(days => p_cooldown_days)
  ) then raise exception 'Quick Sell cooldown active' using errcode = '55000'; end if;

  insert into public.orders (
    user_id, type, source, stars_amount, quote_id, payout_asset,
    payout_network, wallet_address, wallet_validated_at,
    wallet_validation_network, expected_payout_amount, status
  ) values (
    p_user_id, 'quick', 'unknown', selected_quote.stars_amount,
    selected_quote.id, selected_quote.payout_asset,
    selected_quote.payout_network, p_wallet_address, now(),
    selected_quote.payout_network, selected_quote.expected_payout_amount,
    'payment_received'
  ) returning * into created_order;

  update public.order_quotes set consumed_at = now() where id = selected_quote.id;
  return query select created_order.id, created_order.order_number;
end;
$$;

revoke all on function public.create_quick_sell_order(uuid, uuid, text, numeric, integer)
from public, anon, authenticated;
grant execute on function public.create_quick_sell_order(uuid, uuid, text, numeric, integer)
to service_role;

comment on function public.create_quick_sell_order(uuid, uuid, text, numeric, integer) is
  'Atomically consumes a paid Quick Sell quote, creates its order, and records the server-validated destination network. Idempotent retries must use the original destination.';
