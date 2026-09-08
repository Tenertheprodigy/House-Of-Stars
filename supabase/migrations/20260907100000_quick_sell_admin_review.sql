create or replace function public.admin_transition_order(
  p_admin_user_id uuid,
  p_order_id uuid,
  p_action text,
  p_reason text default null
)
returns public.orders
language plpgsql security definer set search_path = '' set row_security = off
as $$
declare
  current_order public.orders%rowtype;
  target_status public.order_status;
  previous_status public.order_status;
begin
  if not exists (select 1 from public.admin_users where user_id = p_admin_user_id) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;

  case p_action
    when 'start_review' then
      if current_order.status not in ('payment_received', 'submitted') then
        raise exception 'invalid review transition' using errcode = '55000';
      end if;
      target_status := 'under_review';
    when 'approve' then
      if current_order.status <> 'under_review' then raise exception 'invalid approval transition' using errcode = '55000'; end if;
      target_status := 'approved';
    when 'reject' then
      if nullif(btrim(p_reason), '') is null then raise exception 'reason required' using errcode = '22023'; end if;
      if current_order.status not in ('submitted', 'under_review', 'awaiting_evidence') then raise exception 'invalid rejection transition' using errcode = '55000'; end if;
      target_status := 'rejected';
    when 'request_more_evidence' then
      if nullif(btrim(p_reason), '') is null then raise exception 'reason required' using errcode = '22023'; end if;
      if current_order.status not in ('submitted', 'under_review') then raise exception 'invalid evidence transition' using errcode = '55000'; end if;
      target_status := 'awaiting_evidence';
    else raise exception 'unsupported action' using errcode = '22023';
  end case;

  previous_status := current_order.status;
  update public.orders set status = target_status where id = current_order.id returning * into current_order;
  insert into public.order_events(order_id, actor_user_id, event_type, from_status, to_status, payload)
  values (current_order.id, p_admin_user_id, 'admin_' || p_action, previous_status, target_status,
    jsonb_build_object('reason', nullif(btrim(p_reason), '')));
  return current_order;
end;
$$;

revoke all on function public.admin_transition_order(uuid, uuid, text, text)
from public, anon, authenticated;
grant execute on function public.admin_transition_order(uuid, uuid, text, text)
to service_role;

comment on function public.admin_transition_order(uuid, uuid, text, text) is
  'Performs authorized administrative order transitions, including moving paid Quick Sell orders into review, and writes attributed audit events.';
