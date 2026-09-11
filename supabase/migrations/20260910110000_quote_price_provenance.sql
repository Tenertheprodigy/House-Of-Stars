alter table public.order_quotes
  add column if not exists price_source text,
  add column if not exists price_updated_at timestamptz;

alter table public.order_quotes
  add constraint order_quotes_price_source_check
  check (price_source is null or char_length(btrim(price_source)) > 0);

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
    or new.price_source is distinct from old.price_source
    or new.price_updated_at is distinct from old.price_updated_at
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
