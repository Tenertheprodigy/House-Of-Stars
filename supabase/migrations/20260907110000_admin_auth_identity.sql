alter table public.users alter column telegram_user_id drop not null;

comment on column public.users.telegram_user_id is
  'Verified Telegram identity for Mini App users. NULL only for separately authenticated administrative principals.';

comment on table public.admin_users is
  'Server-authorized administrators. Their matching public.users row is an audit principal and need not have a Telegram identity.';
