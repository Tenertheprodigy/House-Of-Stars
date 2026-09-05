alter table public.users add column photo_url text;

alter table public.users add constraint users_photo_url_check
check (photo_url is null or photo_url ~ '^https://');
