create or replace function public.record_payout_order_transition()
returns trigger
language plpgsql security definer set search_path = '' set row_security = off as $$
declare target_status public.order_status;
begin
  if old.status = new.status then return new; end if;
  if new.status = 'broadcast' then target_status := 'payout_broadcast';
  elsif new.status = 'confirmed' then target_status := 'paid';
  else
    insert into public.order_events(order_id, event_type, payload)
    values (new.order_id, 'payout_' || new.status::text, jsonb_build_object('payout_id', new.id));
    return new;
  end if;
  update public.orders set status = target_status where id = new.order_id;
  return new;
end;
$$;

create trigger payouts_record_order_transition after update of status on public.payouts
for each row execute function public.record_payout_order_transition();

comment on function public.record_payout_order_transition() is
  'Synchronizes externally-updated payout milestones to orders; the orders status trigger creates the immutable order event.';
