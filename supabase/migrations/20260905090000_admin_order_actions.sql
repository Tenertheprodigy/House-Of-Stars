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

create or replace function public.admin_add_order_note(
  p_admin_user_id uuid,
  p_order_id uuid,
  p_body text
)
returns uuid
language plpgsql security definer set search_path = '' set row_security = off
as $$
declare note_id uuid; current_status public.order_status;
begin
  if not exists (select 1 from public.admin_users where user_id = p_admin_user_id) then raise exception 'administrator access required' using errcode = '42501'; end if;
  if nullif(btrim(p_body), '') is null then raise exception 'note required' using errcode = '22023'; end if;
  select status into current_status from public.orders where id = p_order_id;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  insert into public.support_notes(order_id, author_admin_user_id, body) values (p_order_id, p_admin_user_id, btrim(p_body)) returning id into note_id;
  insert into public.order_events(order_id, actor_user_id, event_type, from_status, to_status, payload)
  values (p_order_id, p_admin_user_id, 'admin_note_added', current_status, current_status, jsonb_build_object('reason', btrim(p_body)));
  return note_id;
end;
$$;

create or replace function public.admin_queue_payout(p_admin_user_id uuid, p_order_id uuid)
returns uuid
language plpgsql security definer set search_path = '' set row_security = off
as $$
declare current_order public.orders%rowtype; payout_id uuid;
begin
  if not exists (select 1 from public.admin_users where user_id = p_admin_user_id) then raise exception 'administrator access required' using errcode = '42501'; end if;
  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if current_order.status <> 'approved' then raise exception 'order is not approved' using errcode = '55000'; end if;
  if current_order.settlement_available_at is not null and current_order.settlement_available_at > now() then raise exception 'settlement hold is active' using errcode = '55000'; end if;
  insert into public.payouts(order_id, asset, network, destination, amount)
  values (current_order.id, current_order.payout_asset, current_order.payout_network, current_order.wallet_address, current_order.expected_payout_amount)
  returning id into payout_id;
  update public.orders set status = 'payout_queued' where id = current_order.id;
  insert into public.order_events(order_id, actor_user_id, event_type, from_status, to_status, payload)
  values (current_order.id, p_admin_user_id, 'admin_queue_payout', 'approved', 'payout_queued', jsonb_build_object('payout_id', payout_id));
  return payout_id;
end;
$$;

revoke all on function public.admin_transition_order(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_add_order_note(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_queue_payout(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_transition_order(uuid, uuid, text, text) to service_role;
grant execute on function public.admin_add_order_note(uuid, uuid, text) to service_role;
grant execute on function public.admin_queue_payout(uuid, uuid) to service_role;
