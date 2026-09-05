begin;

insert into auth.users (id)
values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000099');

insert into public.users (id, telegram_user_id, first_name)
values
  ('00000000-0000-0000-0000-000000000001', 100001, 'User One'),
  ('00000000-0000-0000-0000-000000000002', 100002, 'User Two'),
  ('00000000-0000-0000-0000-000000000003', 100003, 'User Three'),
  ('00000000-0000-0000-0000-000000000099', 100099, 'Admin');

insert into public.admin_users (user_id)
values ('00000000-0000-0000-0000-000000000099');

insert into public.orders (
  id, user_id, type, source, stars_amount, payout_asset, payout_network,
  wallet_address, expected_payout_amount, status
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'quick', 'apple_google', 100, 'TEST', 'testnet', 'wallet-one', 1.25, 'draft'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'verified', 'gifts', 200, 'TEST', 'testnet', 'wallet-two', 2.50, 'awaiting_payment'
  );

do $$
declare
  first_number bigint;
  second_number bigint;
begin
  select order_number into first_number from public.orders
  where id = '10000000-0000-0000-0000-000000000001';
  select order_number into second_number from public.orders
  where id = '10000000-0000-0000-0000-000000000002';
  if second_number <> first_number + 1 then
    raise exception 'order numbers are not sequential: % then %', first_number, second_number;
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.orders (
      user_id, type, stars_amount, payout_asset, payout_network,
      wallet_address, expected_payout_amount
    ) values (
      '00000000-0000-0000-0000-000000000001', 'quick', 0,
      'TEST', 'testnet', 'wallet-invalid', 1
    );
    raise exception 'zero Stars amount was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.orders (
      user_id, type, stars_amount, payout_asset, payout_network,
      wallet_address, expected_payout_amount
    ) values (
      '00000000-0000-0000-0000-000000000001', 'quick', -1,
      'TEST', 'testnet', 'wallet-invalid', 1
    );
    raise exception 'negative Stars amount was accepted';
  exception when check_violation then
    null;
  end;
end;
$$;

do $$
begin
  begin
    perform 'not_a_status'::public.order_status;
    raise exception 'invalid order status was accepted';
  exception when invalid_text_representation then
    null;
  end;
end;
$$;

insert into public.risk_flags (order_id, severity, code)
values ('10000000-0000-0000-0000-000000000002', 'blocking', 'MANUAL_REVIEW');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

do $$
begin
  if (select count(*) from public.orders) <> 1 then
    raise exception 'RLS exposed another user''s order';
  end if;

  if exists (
    select 1 from public.orders
    where order_number = 2
  ) then
    raise exception 'sequential order number bypassed ownership authorization';
  end if;

  if not public.is_quick_sale_eligible('10000000-0000-0000-0000-000000000001') then
    raise exception 'eligible quick order was not found';
  end if;

  if public.is_quick_sale_eligible('10000000-0000-0000-0000-000000000002') then
    raise exception 'another user''s order was exposed by eligibility lookup';
  end if;
end;
$$;

insert into public.order_evidence (
  order_id, user_id, storage_path, evidence_type
) values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001/evidence.png',
  'payment_receipt'
);

do $$
begin
  begin
    insert into public.order_evidence (
      order_id, user_id, storage_path, evidence_type
    ) values (
      '10000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000002/evidence.png',
      'payment_receipt'
    );
    raise exception 'RLS allowed evidence insertion for another user';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;

insert into public.order_quotes (
  id, user_id, stars_amount, payout_asset, payout_network,
  expected_payout_amount, usd_value, exchange_rate, expires_at
) values (
  '20000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000003',
  500, 'GRAM', 'TON', 1, 5, 5, now() - interval '1 second'
);

do $$
begin
  begin
    perform * from public.create_quick_sell_order(
      '00000000-0000-0000-0000-000000000003',
      '20000000-0000-4000-8000-000000000001',
      'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ', 10, 30
    );
    raise exception 'expired quote was accepted';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

insert into public.order_quotes (
  id, user_id, stars_amount, payout_asset, payout_network,
  expected_payout_amount, usd_value, exchange_rate, expires_at
) values (
  '20000000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  500, 'GRAM', 'TON', 1, 5, 5, now() + interval '5 minutes'
);

do $$
declare first_number bigint; retry_number bigint;
begin
  select q.order_number into first_number from public.create_quick_sell_order(
    '00000000-0000-0000-0000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ', 10, 30
  ) q;
  select q.order_number into retry_number from public.create_quick_sell_order(
    '00000000-0000-0000-0000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ', 10, 30
  ) q;
  if first_number <> retry_number then raise exception 'duplicate submission created a different order'; end if;
  if (select count(*) from public.orders where quote_id = '20000000-0000-4000-8000-000000000002') <> 1 then raise exception 'quote was reused'; end if;
end;
$$;

do $$
begin
  begin
    update public.order_events set event_type = 'tampered' where id = 1;
    raise exception 'order event update was accepted';
  exception when object_not_in_prerequisite_state then
    null;
  end;
end;
$$;

insert into public.sell_sessions (user_id, selected_source)
values ('00000000-0000-0000-0000-000000000001', 'apple_google');

insert into public.sell_sessions (user_id, selected_source, expires_at)
values ('00000000-0000-0000-0000-000000000001', 'gifts', now() + interval '24 hours')
on conflict (user_id, flow) do update
set selected_source = excluded.selected_source, expires_at = excluded.expires_at;

do $$
begin
  if (select count(*) from public.sell_sessions where user_id = '00000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'more than one verified sell session exists for a user';
  end if;
  if (select selected_source from public.sell_sessions where user_id = '00000000-0000-0000-0000-000000000001') <> 'gifts' then
    raise exception 'verified sell source was not updated';
  end if;
end;
$$;

update public.sell_sessions set selected_source = 'fragment_other', order_id = null, quote_id = null
where user_id = '00000000-0000-0000-0000-000000000001';
insert into public.order_quotes (
  id, user_id, stars_amount, payout_asset, payout_network,
  expected_payout_amount, usd_value, exchange_rate, expires_at
) values (
  '30000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  2000, 'GRAM', 'TON', 4, 20, 5, now() + interval '5 minutes'
);

select * from public.prepare_fragment_verified_order(
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ'
);

insert into public.order_evidence (
  order_id, user_id, storage_path, evidence_type, sha256, mime_type, size
)
select order_id, user_id, user_id || '/' || order_id || '/history.png',
  'stars_transaction_history', repeat('a', 64), 'image/png', 100
from public.sell_sessions where user_id = '00000000-0000-0000-0000-000000000001';

insert into public.order_evidence (
  order_id, user_id, storage_path, evidence_type, sha256, mime_type, size
)
select order_id, user_id, user_id || '/' || order_id || '/receipt.webp',
  'purchase_receipt', repeat('b', 64), 'image/webp', 200
from public.sell_sessions where user_id = '00000000-0000-0000-0000-000000000001';

do $$
begin
  begin
    insert into public.order_evidence (
      order_id, user_id, storage_path, evidence_type, sha256, mime_type, size
    )
    select order_id, user_id, user_id || '/' || order_id || '/duplicate.png',
      'stars_transaction_history', repeat('a', 64), 'image/png', 100
    from public.sell_sessions where user_id = '00000000-0000-0000-0000-000000000001';
    raise exception 'duplicate evidence hash was accepted';
  exception when unique_violation then null;
  end;
end;
$$;

do $$
declare first_number bigint; retry_number bigint;
begin
  select s.order_number into first_number from public.submit_fragment_verified_order(
    '00000000-0000-0000-0000-000000000001'
  ) s;
  select s.order_number into retry_number from public.submit_fragment_verified_order(
    '00000000-0000-0000-0000-000000000001'
  ) s;
  if first_number <> retry_number then raise exception 'duplicate verified submission created another order'; end if;
  if (select status from public.orders where order_number = first_number) <> 'submitted' then
    raise exception 'verified order was not submitted';
  end if;
end;
$$;

insert into public.sell_sessions (user_id, selected_source, settlement_notice_accepted_at)
values ('00000000-0000-0000-0000-000000000002', 'apple_google', now());
insert into public.order_quotes (
  id, user_id, stars_amount, payout_asset, payout_network,
  expected_payout_amount, usd_value, exchange_rate, expires_at
) values (
  '40000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000002', 2000,
  'GRAM', 'TON', 4, 20, 5, now() + interval '5 minutes'
);
select * from public.prepare_apple_google_verified_order(
  '00000000-0000-0000-0000-000000000002',
  '40000000-0000-4000-8000-000000000001', 'wallet-two', 21
);
do $$
declare target_id uuid; calculated_at timestamptz;
begin
  select order_id into target_id from public.sell_sessions
    where user_id = '00000000-0000-0000-0000-000000000002';
  if (select settlement_available_at from public.orders where id = target_id) is not null then
    raise exception 'settlement date was set before acceptance';
  end if;
  update public.orders set status = 'approved' where id = target_id;
  select settlement_available_at into calculated_at from public.orders where id = target_id;
  if calculated_at < now() + interval '20 days 23 hours 59 minutes'
    or calculated_at > now() + interval '21 days 1 minute' then
    raise exception 'settlement date was not calculated from the configured duration';
  end if;
end;
$$;

insert into public.sell_sessions (user_id, selected_source, settlement_notice_accepted_at)
values ('00000000-0000-0000-0000-000000000003', 'gifts', now());
insert into public.order_quotes (id, user_id, stars_amount, payout_asset, payout_network, expected_payout_amount, usd_value, exchange_rate, expires_at)
values ('50000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000003', 3000, 'GRAM', 'TON', 6, 30, 5, now() + interval '5 minutes');
select * from public.prepare_gift_verified_order('00000000-0000-0000-0000-000000000003', '50000000-0000-4000-8000-000000000001', 'wallet-three', 7);
insert into public.order_evidence (order_id, user_id, storage_path, evidence_type, sha256, mime_type, size)
select order_id, user_id, user_id || '/' || order_id || '/' || evidence_type || '.png', evidence_type, encode(sha256(evidence_type::bytea), 'hex'), 'image/png', 100
from public.sell_sessions cross join (values ('gift_history'), ('gift_details'), ('telegram_confirmation')) required(evidence_type)
where user_id = '00000000-0000-0000-0000-000000000003';
do $$
declare first_number bigint; retry_number bigint; target_id uuid; calculated_at timestamptz;
begin
  select s.order_number into first_number from public.submit_gift_verified_order('00000000-0000-0000-0000-000000000003') s;
  select s.order_number into retry_number from public.submit_gift_verified_order('00000000-0000-0000-0000-000000000003') s;
  if first_number <> retry_number then raise exception 'duplicate gift submission created another order'; end if;
  select order_id into target_id from public.sell_sessions where user_id = '00000000-0000-0000-0000-000000000003';
  update public.orders set status = 'approved' where id = target_id;
  select settlement_available_at into calculated_at from public.orders where id = target_id;
  if calculated_at < now() + interval '6 days 23 hours 59 minutes' or calculated_at > now() + interval '7 days 1 minute' then
    raise exception 'gift settlement date was not calculated from configuration';
  end if;
end;
$$;

do $$
declare target_id uuid := '10000000-0000-0000-0000-000000000001';
begin
  update public.orders set source = 'unknown', status = 'under_review', settlement_available_at = now() + interval '1 day' where id = target_id;
  perform public.mark_order_wallet_validated(target_id, 'wallet-one', 'testnet');
  perform public.admin_transition_order('00000000-0000-0000-0000-000000000099', target_id, 'approve', null);
  if (select status from public.orders where id = target_id) <> 'approved' then raise exception 'admin approval failed'; end if;
  if not exists (select 1 from public.order_events where order_id = target_id and event_type = 'admin_approve' and actor_user_id = '00000000-0000-0000-0000-000000000099') then raise exception 'admin approval audit event missing'; end if;
  begin
    perform public.admin_queue_payout('00000000-0000-0000-0000-000000000099', target_id, 'payout:test-one');
    raise exception 'future settlement hold was bypassed';
  exception when sqlstate '55000' then null;
  end;
  begin
    perform public.admin_transition_order('00000000-0000-0000-0000-000000000001', target_id, 'reject', 'unauthorized');
    raise exception 'non-admin action was accepted';
  exception when insufficient_privilege then null;
  end;
  update public.orders set settlement_available_at = now() - interval '1 second' where id = target_id;
  perform public.admin_queue_payout('00000000-0000-0000-0000-000000000099', target_id, 'payout:test-one');
  if not exists (select 1 from public.payouts where order_id = target_id and status = 'queued') then raise exception 'payout queue record missing'; end if;
  if public.admin_queue_payout('00000000-0000-0000-0000-000000000099', target_id, 'payout:test-one') is distinct from
    (select id from public.payouts where order_id = target_id) then raise exception 'idempotent payout retry returned a different record'; end if;
  if (select count(*) from public.payouts where order_id = target_id) <> 1 then raise exception 'duplicate payout record was created'; end if;
end;
$$;

do $$
declare target_event_id bigint; target_order_id uuid;
begin
  select id, order_id into target_event_id, target_order_id from public.order_events order by id limit 1;
  insert into public.notification_delivery(order_event_id, order_id, notification_type, status)
  values (target_event_id, target_order_id, 'test_delivery', 'sent');
  begin
    insert into public.notification_delivery(order_event_id, order_id, notification_type)
    values (target_event_id, target_order_id, 'test_delivery');
    raise exception 'duplicate notification event was accepted';
  exception when unique_violation then null;
  end;
end;
$$;

do $$
declare first_allowed boolean; second_allowed boolean; third_allowed boolean;
begin
  select allowed into first_allowed from public.consume_api_rate_limit(repeat('c', 64), 2, 60);
  select allowed into second_allowed from public.consume_api_rate_limit(repeat('c', 64), 2, 60);
  select allowed into third_allowed from public.consume_api_rate_limit(repeat('c', 64), 2, 60);
  if not first_allowed or not second_allowed or third_allowed then raise exception 'rate limiter did not enforce its limit'; end if;
end;
$$;

insert into public.order_quotes(id, user_id, stars_amount, usd_value, payout_asset, payout_network, expected_payout_amount, exchange_rate, fees, expires_at)
values ('60000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000001', 100, 1.30, 'GRAM', 'TON', 0.25, 5.20, 0, now() + interval '60 seconds');

do $$
begin
  begin
    update public.order_quotes set usd_value = 99 where id = '60000000-0000-4000-8000-000000000001';
    raise exception 'immutable quote terms were changed';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    perform public.consume_order_quote('60000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000002');
    raise exception 'quote ownership was bypassed';
  exception when object_not_in_prerequisite_state then null;
  end;
  perform public.consume_order_quote('60000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000001');
  begin
    perform public.consume_order_quote('60000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000001');
    raise exception 'quote was consumed twice';
  exception when object_not_in_prerequisite_state then null;
  end;
end;
$$;

rollback;
