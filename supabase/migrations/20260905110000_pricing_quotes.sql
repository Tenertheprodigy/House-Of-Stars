alter table public.order_quotes add column fees numeric(36, 18) not null default 0 check (fees >= 0);

update public.order_quotes
set exchange_rate = coalesce(exchange_rate, 1),
    usd_value = coalesce(usd_value, expected_payout_amount * coalesce(exchange_rate, 1));

alter table public.order_quotes
  alter column usd_value set not null,
  alter column exchange_rate set not null;

create or replace function public.protect_quote_terms()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.stars_amount is distinct from old.stars_amount
    or new.usd_value is distinct from old.usd_value
    or new.payout_asset is distinct from old.payout_asset
    or new.payout_network is distinct from old.payout_network
    or new.expected_payout_amount is distinct from old.expected_payout_amount
    or new.exchange_rate is distinct from old.exchange_rate
    or new.fees is distinct from old.fees
    or new.created_at is distinct from old.created_at then
    raise exception 'quote financial terms are immutable' using errcode = '55000';
  end if;
  if old.consumed_at is not null and new.consumed_at is distinct from old.consumed_at then
    raise exception 'consumed quote cannot be changed' using errcode = '55000';
  end if;
  if new.expires_at > old.expires_at then
    raise exception 'quote expiry cannot be extended' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger order_quotes_protect_terms before update on public.order_quotes
for each row execute function public.protect_quote_terms();

create or replace function public.consume_order_quote(p_quote_id uuid, p_user_id uuid)
returns public.order_quotes
language plpgsql security definer set search_path = '' set row_security = off as $$
declare consumed public.order_quotes%rowtype;
begin
  update public.order_quotes set consumed_at = now()
  where id = p_quote_id and user_id = p_user_id and consumed_at is null and expires_at > now()
  returning * into consumed;
  if not found then raise exception 'quote unavailable' using errcode = '55000'; end if;
  return consumed;
end;
$$;

create or replace function public.expire_order_quote(p_quote_id uuid, p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = '' set row_security = off as $$
begin
  update public.order_quotes set expires_at = least(expires_at, now())
  where id = p_quote_id and user_id = p_user_id and consumed_at is null;
  return found;
end;
$$;

revoke all on function public.consume_order_quote(uuid, uuid) from public, anon, authenticated;
revoke all on function public.expire_order_quote(uuid, uuid) from public, anon, authenticated;
grant execute on function public.consume_order_quote(uuid, uuid) to service_role;
grant execute on function public.expire_order_quote(uuid, uuid) to service_role;
