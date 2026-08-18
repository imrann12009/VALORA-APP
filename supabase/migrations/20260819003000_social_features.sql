-- VALORA production social features
-- Safe to run after the existing profile schema.

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null default '',
  caption text not null default '',
  tags text[] not null default '{}',
  image_url text,
  media_type text not null default 'photo' check (media_type in ('video','photo','text','story','live')),
  sound text not null default 'Original sound',
  privacy text not null default 'public' check (privacy in ('public','friends','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_created_at_idx on posts(created_at desc);
create index if not exists posts_user_id_idx on posts(user_id);

create table if not exists post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);
create index if not exists post_likes_post_id_idx on post_likes(post_id);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_id_created_at_idx on comments(post_id, created_at desc);

create table if not exists follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(follower_id, following_id),
  check(follower_id <> following_id)
);
create index if not exists follows_follower_idx on follows(follower_id);
create index if not exists follows_following_idx on follows(following_id);

create table if not exists notifications_v2 (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  kind text not null check (kind in ('like','comment','follow','mention','share')),
  post_id uuid references posts(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_v2_recipient_idx on notifications_v2(recipient_id, created_at desc);

create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  media_url text not null,
  caption text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index if not exists stories_active_idx on stories(expires_at desc, created_at desc);

create table if not exists story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique(story_id, user_id)
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(conversation_id, user_id)
);
create index if not exists conversation_members_user_idx on conversation_members(user_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on messages(conversation_id, created_at asc);

-- Reusable timestamp trigger.
drop trigger if exists posts_set_updated_at on posts;
create trigger posts_set_updated_at before update on posts for each row execute function set_updated_at();
drop trigger if exists conversations_set_updated_at on conversations;
create trigger conversations_set_updated_at before update on conversations for each row execute function set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table posts enable row level security;
alter table post_likes enable row level security;
alter table comments enable row level security;
alter table follows enable row level security;
alter table notifications_v2 enable row level security;
alter table stories enable row level security;
alter table story_views enable row level security;
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;

-- Idempotent policy creation helpers.
drop policy if exists "public posts are readable" on posts;
create policy "public posts are readable" on posts for select to authenticated
using (privacy = 'public' or user_id = (select id from profiles where auth_user_id = auth.uid()) or (privacy = 'friends' and exists (
  select 1 from follows f where f.follower_id = (select id from profiles where auth_user_id = auth.uid()) and f.following_id = posts.user_id
)));
drop policy if exists "users create own posts" on posts;
create policy "users create own posts" on posts for insert to authenticated
with check (user_id = (select id from profiles where auth_user_id = auth.uid()));
drop policy if exists "users update own posts" on posts;
create policy "users update own posts" on posts for update to authenticated
using (user_id = (select id from profiles where auth_user_id = auth.uid())) with check (user_id = (select id from profiles where auth_user_id = auth.uid()));
drop policy if exists "users delete own posts" on posts;
create policy "users delete own posts" on posts for delete to authenticated
using (user_id = (select id from profiles where auth_user_id = auth.uid()));

drop policy if exists "likes are readable" on post_likes;
create policy "likes are readable" on post_likes for select to authenticated using (true);
drop policy if exists "users create own likes" on post_likes;
create policy "users create own likes" on post_likes for insert to authenticated
with check (user_id = (select id from profiles where auth_user_id = auth.uid()));
drop policy if exists "users delete own likes" on post_likes;
create policy "users delete own likes" on post_likes for delete to authenticated
using (user_id = (select id from profiles where auth_user_id = auth.uid()));

drop policy if exists "comments are readable" on comments;
create policy "comments are readable" on comments for select to authenticated using (true);
drop policy if exists "users create own comments" on comments;
create policy "users create own comments" on comments for insert to authenticated
with check (user_id = (select id from profiles where auth_user_id = auth.uid()));
drop policy if exists "users delete own comments" on comments;
create policy "users delete own comments" on comments for delete to authenticated
using (user_id = (select id from profiles where auth_user_id = auth.uid()));

drop policy if exists "follows are readable" on follows;
create policy "follows are readable" on follows for select to authenticated using (true);
drop policy if exists "users create own follows" on follows;
create policy "users create own follows" on follows for insert to authenticated
with check (follower_id = (select id from profiles where auth_user_id = auth.uid()) and follower_id <> following_id);
drop policy if exists "users delete own follows" on follows;
create policy "users delete own follows" on follows for delete to authenticated
using (follower_id = (select id from profiles where auth_user_id = auth.uid()));

drop policy if exists "users read own notifications" on notifications_v2;
create policy "users read own notifications" on notifications_v2 for select to authenticated
using (recipient_id = (select id from profiles where auth_user_id = auth.uid()));
drop policy if exists "users update own notifications" on notifications_v2;
create policy "users update own notifications" on notifications_v2 for update to authenticated
using (recipient_id = (select id from profiles where auth_user_id = auth.uid())) with check (recipient_id = (select id from profiles where auth_user_id = auth.uid()));

drop policy if exists "active stories are readable" on stories;
create policy "active stories are readable" on stories for select to authenticated using (expires_at > now());
drop policy if exists "users create own stories" on stories;
create policy "users create own stories" on stories for insert to authenticated
with check (user_id = (select id from profiles where auth_user_id = auth.uid()));
drop policy if exists "users delete own stories" on stories;
create policy "users delete own stories" on stories for delete to authenticated
using (user_id = (select id from profiles where auth_user_id = auth.uid()));

drop policy if exists "story views readable" on story_views;
create policy "story views readable" on story_views for select to authenticated
using (user_id = (select id from profiles where auth_user_id = auth.uid()) or exists (select 1 from stories s where s.id = story_id and s.user_id = (select id from profiles where auth_user_id = auth.uid())));
drop policy if exists "users create own story views" on story_views;
create policy "users create own story views" on story_views for insert to authenticated
with check (user_id = (select id from profiles where auth_user_id = auth.uid()));

drop policy if exists "members can read conversations" on conversations;
create policy "members can read conversations" on conversations for select to authenticated
using (exists (select 1 from conversation_members cm where cm.conversation_id = id and cm.user_id = (select id from profiles where auth_user_id = auth.uid())));
drop policy if exists "authenticated can create conversations" on conversations;
create policy "authenticated can create conversations" on conversations for insert to authenticated with check (true);

drop policy if exists "members can read membership" on conversation_members;
create policy "members can read membership" on conversation_members for select to authenticated
using (user_id = (select id from profiles where auth_user_id = auth.uid()) or exists (select 1 from conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = (select id from profiles where auth_user_id = auth.uid())));
drop policy if exists "members can add membership" on conversation_members;
create policy "members can add membership" on conversation_members for insert to authenticated
with check (user_id = (select id from profiles where auth_user_id = auth.uid()) or exists (select 1 from conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = (select id from profiles where auth_user_id = auth.uid())));

drop policy if exists "members can read messages" on messages;
create policy "members can read messages" on messages for select to authenticated
using (exists (select 1 from conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = (select id from profiles where auth_user_id = auth.uid())));
drop policy if exists "members can send messages" on messages;
create policy "members can send messages" on messages for insert to authenticated
with check (sender_id = (select id from profiles where auth_user_id = auth.uid()) and exists (select 1 from conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = (select id from profiles where auth_user_id = auth.uid())));
drop policy if exists "senders can update messages" on messages;
create policy "senders can update messages" on messages for update to authenticated
using (sender_id = (select id from profiles where auth_user_id = auth.uid())) with check (sender_id = (select id from profiles where auth_user_id = auth.uid()));

-- Storage policies. Folder name is the auth user id.
drop policy if exists "post media is publicly readable" on storage.objects;
create policy "post media is publicly readable" on storage.objects for select to public using (bucket_id = 'post-media');
drop policy if exists "users upload post media" on storage.objects;
create policy "users upload post media" on storage.objects for insert to authenticated
with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users update post media" on storage.objects;
create policy "users update post media" on storage.objects for update to authenticated
using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users delete post media" on storage.objects;
create policy "users delete post media" on storage.objects for delete to authenticated
using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime. PostgreSQL errors if a table is already a member, so guard through a DO block.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'post_likes') then alter publication supabase_realtime add table post_likes; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'comments') then alter publication supabase_realtime add table comments; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'follows') then alter publication supabase_realtime add table follows; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications_v2') then alter publication supabase_realtime add table notifications_v2; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then alter publication supabase_realtime add table messages; end if;
end $$;
