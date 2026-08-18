create table if not exists creators (
  id text primary key,
  handle text not null,
  "displayName" text not null,
  "avatarUrl" text not null,
  verified boolean not null default false,
  followers text not null,
  bio text not null
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  username text not null unique,
  avatar_url text,
  bio text not null default '',
  phone text unique,
  email text unique,
  provider text,
  privacy_settings jsonb not null default '{"privateAccount": false, "messages": "friends", "comments": "everyone"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9._]{3,24}$')
);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
before update on profiles
for each row
execute function set_updated_at();

alter table profiles enable row level security;

drop policy if exists "profiles are readable" on profiles;
drop policy if exists "users read own profile" on profiles;
create policy "users read own profile"
on profiles for select
to authenticated
using (auth.uid() = auth_user_id);

drop policy if exists "users insert own profile" on profiles;
create policy "users insert own profile"
on profiles for insert
to authenticated
with check (auth.uid() = auth_user_id);

drop policy if exists "users update own profile" on profiles;
create policy "users update own profile"
on profiles for update
to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

create index if not exists profiles_username_idx on profiles (username);
create index if not exists profiles_auth_user_id_idx on profiles (auth_user_id);

create or replace view public_profiles as
select
  id,
  display_name,
  username,
  avatar_url,
  bio,
  created_at,
  updated_at
from profiles;

grant select on public_profiles to anon, authenticated;

create or replace function is_username_available(candidate_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from profiles
    where username = lower(trim(candidate_username))
      and auth_user_id <> auth.uid()
  );
$$;

grant execute on function is_username_available(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar images are publicly readable" on storage.objects;
create policy "avatar images are publicly readable"
on storage.objects for select
to public
using (bucket_id = 'avatars');

drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists videos (
  id text primary key,
  "creatorId" text not null references creators(id),
  title text not null,
  caption text not null,
  tags text[] not null default '{}',
  "imageUrl" text not null,
  duration text not null,
  likes text not null,
  comments text not null,
  saves text not null,
  shares text not null,
  views text not null,
  sound text not null,
  "createdAt" text not null
);

create table if not exists message_threads (
  id text primary key,
  "creatorId" text not null references creators(id),
  "lastMessage" text not null,
  time text not null,
  unread integer not null default 0,
  online boolean not null default false
);

create table if not exists chat_messages (
  id text primary key,
  "threadId" text not null references message_threads(id),
  mine boolean not null default false,
  kind text not null check (kind in ('text', 'image', 'voice', 'reply')),
  body text not null,
  time text not null,
  "imageUrl" text
);

create table if not exists notifications (
  id text primary key,
  kind text not null check (kind in ('like', 'follow', 'views', 'share')),
  title text not null,
  time text not null,
  "actorAvatarUrl" text
);

create table if not exists dashboard_metrics (
  id text primary key,
  label text not null,
  value text not null,
  delta text not null,
  tone text not null check (tone in ('cyan', 'pink', 'violet'))
);
