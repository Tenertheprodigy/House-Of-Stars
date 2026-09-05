create type public.user_role as enum ('user', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  telegram_user_id text not null unique,
  display_name text not null check (char_length(display_name) between 1 and 128),
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Profiles are readable by their owner" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Profiles are editable by their owner" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

insert into storage.buckets (id, name, public) values ('user-assets', 'user-assets', false) on conflict (id) do nothing;
create policy "Users can read own assets" on storage.objects for select to authenticated using (bucket_id = 'user-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can upload own assets" on storage.objects for insert to authenticated with check (bucket_id = 'user-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
