-- VALORA UI support: profile counts, search, conversation helpers, and notification/story metadata.
create index if not exists profiles_username_lower_idx on profiles (lower(username));
create index if not exists profiles_display_name_lower_idx on profiles (lower(display_name));
create index if not exists posts_caption_lower_idx on posts (lower(caption));
create index if not exists posts_title_lower_idx on posts (lower(title));

create or replace view public.profile_stats as
select
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  coalesce((select count(*) from posts x where x.user_id = p.id), 0)::int as posts_count,
  coalesce((select count(*) from follows f where f.following_id = p.id), 0)::int as followers_count,
  coalesce((select count(*) from follows f where f.follower_id = p.id), 0)::int as following_count
from profiles p;

grant select on public.profile_stats to authenticated;

create or replace view public.active_stories as
select s.id, s.user_id, s.media_url, s.caption, s.created_at, s.expires_at,
  coalesce((select count(*) from story_views v where v.story_id = s.id), 0)::int as view_count
from stories s
where s.expires_at > now();

grant select on public.active_stories to authenticated;

create or replace view public.conversation_previews as
select
  c.id,
  c.updated_at,
  cm.user_id,
  p.display_name,
  p.username,
  p.avatar_url,
  m.body as last_message,
  m.created_at as last_message_at,
  coalesce((select count(*) from messages um where um.conversation_id = c.id and um.sender_id <> cm.user_id and um.read_at is null), 0)::int as unread
from conversations c
join conversation_members cm on cm.conversation_id = c.id
join profiles p on p.id = cm.user_id
left join lateral (
  select body, created_at from messages m0 where m0.conversation_id = c.id order by created_at desc limit 1
) m on true;

grant select on public.conversation_previews to authenticated;
