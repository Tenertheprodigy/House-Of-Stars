alter table public.payouts
  add column public_transaction_id text,
  add column public_transaction_url text,
  add constraint payouts_public_transaction_pair check (
    (public_transaction_id is null and public_transaction_url is null)
    or (char_length(btrim(public_transaction_id)) > 0
      and public_transaction_url ~ '^https://')
  );

comment on column public.payouts.public_transaction_id is
  'Blockchain transaction identifier explicitly approved for customer display.';
comment on column public.payouts.public_transaction_url is
  'HTTPS explorer URL explicitly approved for customer display.';
