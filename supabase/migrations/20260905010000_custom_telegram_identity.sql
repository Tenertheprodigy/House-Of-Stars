alter table public.users drop constraint users_id_fkey;
alter table public.users alter column id set default gen_random_uuid();

comment on column public.users.id is
  'Application identity. Telegram sessions are verified by the backend and are not Supabase Auth identities.';
