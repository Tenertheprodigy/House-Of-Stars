create table public.api_rate_limits (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql security definer set search_path = '' set row_security = off as $$
declare current_row public.api_rate_limits%rowtype; v_now timestamptz := clock_timestamp();
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' or p_limit <= 0 or p_window_seconds <= 0 then
    raise exception 'invalid rate limit parameters' using errcode = '22023';
  end if;
  insert into public.api_rate_limits(key_hash, window_started_at, request_count, updated_at)
  values (p_key_hash, v_now, 1, v_now)
  on conflict (key_hash) do update set
    window_started_at = case when public.api_rate_limits.window_started_at + make_interval(secs => p_window_seconds::double precision) <= v_now then v_now else public.api_rate_limits.window_started_at end,
    request_count = case when public.api_rate_limits.window_started_at + make_interval(secs => p_window_seconds::double precision) <= v_now then 1 else public.api_rate_limits.request_count + 1 end,
    updated_at = v_now
  returning * into current_row;
  return query select current_row.request_count <= p_limit,
    greatest(p_limit - current_row.request_count, 0),
    current_row.window_started_at + make_interval(secs => p_window_seconds::double precision);
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;
