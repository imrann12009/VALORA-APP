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
