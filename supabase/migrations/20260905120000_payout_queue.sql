alter type public.payout_status add value if not exists 'pending' before 'queued';

alter table public.orders
  add column wallet_validated_at timestamptz,
  add column wallet_validation_network text;

alter table public.payouts add column idempotency_key text;
update public.payouts set idempotency_key = 'legacy:' || id::text where idempotency_key is null;
alter table public.payouts alter column idempotency_key set not null;
create unique index payouts_idempotency_key_idx on public.payouts(idempotency_key);

create or replace function public.mark_order_wallet_validated(
  p_order_id uuid,
  p_wallet_address text,
  p_network text
)
returns boolean
language plpgsql security definer set search_path = '' set row_security = off as $$
begin
  update public.orders set wallet_validated_at = now(), wallet_validation_network = p_network
  where id = p_order_id and wallet_address = p_wallet_address and payout_network = p_network;
  return found;
end;
$$;

revoke all on function public.mark_order_wallet_validated(uuid, text, text) from public, anon, authenticated;
grant execute on function public.mark_order_wallet_validated(uuid, text, text) to service_role;

drop function public.admin_queue_payout(uuid, uuid);
create function public.admin_queue_payout(p_admin_user_id uuid, p_order_id uuid, p_idempotency_key text)
returns uuid
language plpgsql security definer set search_path = '' set row_security = off as $$
declare current_order public.orders%rowtype; current_quote public.order_quotes%rowtype; payout_id uuid; existing_key text;
begin
  if not exists (select 1 from public.admin_users where user_id = p_admin_user_id) then raise exception 'administrator access required' using errcode = '42501'; end if;
  if nullif(btrim(p_idempotency_key), '') is null then raise exception 'idempotency key required' using errcode = '22023'; end if;
  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  select id, idempotency_key into payout_id, existing_key from public.payouts where order_id = current_order.id;
  if found then
    if existing_key = p_idempotency_key then return payout_id; end if;
    raise exception 'payout already exists' using errcode = '23505';
  end if;
  if current_order.status <> 'approved' or current_order.status in ('rejected', 'cancelled') then raise exception 'order is not approved' using errcode = '55000'; end if;
  if current_order.settlement_available_at is not null and current_order.settlement_available_at > now() then raise exception 'settlement hold is active' using errcode = '55000'; end if;
  if current_order.wallet_validated_at is null or current_order.wallet_validation_network is distinct from current_order.payout_network then raise exception 'wallet has not been validated' using errcode = '55000'; end if;
  if current_order.stars_amount <= 0 or current_order.expected_payout_amount <= 0 then raise exception 'invalid order amount' using errcode = '22023'; end if;
  if current_order.quote_id is not null then
    select * into current_quote from public.order_quotes where id = current_order.quote_id and user_id = current_order.user_id;
    if not found or current_quote.consumed_at is null
      or current_quote.stars_amount <> current_order.stars_amount
      or current_quote.payout_asset <> current_order.payout_asset
      or current_quote.payout_network <> current_order.payout_network
      or current_quote.expected_payout_amount <> current_order.expected_payout_amount then
      raise exception 'quote and order amounts do not match' using errcode = '22023';
    end if;
  end if;
  insert into public.payouts(order_id, asset, network, destination, amount, status, idempotency_key)
  values (current_order.id, current_order.payout_asset, current_order.payout_network, current_order.wallet_address, current_order.expected_payout_amount, 'queued', p_idempotency_key)
  returning id into payout_id;
  update public.orders set status = 'payout_queued' where id = current_order.id;
  insert into public.order_events(order_id, actor_user_id, event_type, from_status, to_status, payload)
  values (current_order.id, p_admin_user_id, 'admin_queue_payout', 'approved', 'payout_queued', jsonb_build_object('payout_id', payout_id));
  return payout_id;
end;
$$;

revoke all on function public.admin_queue_payout(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_queue_payout(uuid, uuid, text) to service_role;

create or replace function public.enforce_payout_state_transition()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = new.status then return new; end if;
  if not ((old.status = 'pending' and new.status in ('queued', 'failed', 'cancelled'))
    or (old.status = 'queued' and new.status in ('broadcast', 'failed', 'cancelled'))
    or (old.status = 'broadcast' and new.status in ('confirmed', 'failed'))
    or (old.status = 'failed' and new.status in ('queued', 'cancelled'))) then
    raise exception 'invalid payout status transition' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger payouts_enforce_state before update of status on public.payouts
for each row execute function public.enforce_payout_state_transition();
