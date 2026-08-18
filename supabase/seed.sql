insert into creators (id, handle, "displayName", "avatarUrl", verified, followers, bio) values
('creator-luna', 'luna.wav', 'LunaVibe', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=320&q=80', true, '12.4M', 'Neon cities, quiet moods, late-night edits.'),
('creator-kairo', 'kairo', 'Kairo', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=320&q=80', true, '8.7M', 'Movement, sound, cyber flow.'),
('creator-aurora', 'auroraxvisions', 'Aurora', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=320&q=80', true, '128K', 'Dreamer. Creator. Night thinker. Building my world in pixels and light.'),
('creator-zayn', 'zaynbeats', 'ZaynBeats', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=320&q=80', true, '5.3M', 'Synthwave packs and midnight samples.')
on conflict (id) do update set
  handle = excluded.handle,
  "displayName" = excluded."displayName",
  "avatarUrl" = excluded."avatarUrl",
  verified = excluded.verified,
  followers = excluded.followers,
  bio = excluded.bio;

insert into videos (id, "creatorId", title, caption, tags, "imageUrl", duration, likes, comments, saves, shares, views, sound, "createdAt") values
('video-neon-dreams', 'creator-luna', 'Neon Dreams', 'when the city hits different at 2am', array['NightVibes', 'NeonCity', 'AuroraMood'], 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=85', '0:28', '12.8K', '342', '2.6K', '1.1K', '124.7K', 'NEON PULSE - synthwave remix', '2h ago'),
('video-aurora-skies', 'creator-kairo', 'Aurora Skies', 'Found this quiet place. Needed this.', array['mindful', 'escape'], 'https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=900&q=85', '0:45', '948', '64', '851', '97', '842K', 'soft horizon - ambient edit', '5h ago'),
('video-electric-flow', 'creator-aurora', 'Electric Flow', 'lost in the glow', array['AuroraMoves', 'CyberpunkFlow', 'NeonEnergy'], 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=900&q=85', '0:33', '12.4K', '842', '3.1K', '2.4K', '1.5M', 'Midnight Pulse', '8h ago'),
('video-city-lights', 'creator-zayn', 'City Lights & Dreams', 'The streets wrote the hook first.', array['FutureFlow', 'Music'], 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=85', '1:02', '189K', '2.1K', '39K', '14K', '1.8M', 'Cyber Heart', '12h ago')
on conflict (id) do update set
  "creatorId" = excluded."creatorId",
  title = excluded.title,
  caption = excluded.caption,
  tags = excluded.tags,
  "imageUrl" = excluded."imageUrl",
  duration = excluded.duration,
  likes = excluded.likes,
  comments = excluded.comments,
  saves = excluded.saves,
  shares = excluded.shares,
  views = excluded.views,
  sound = excluded.sound,
  "createdAt" = excluded."createdAt";

insert into message_threads (id, "creatorId", "lastMessage", time, unread, online) values
('thread-aurora', 'creator-aurora', 'Hey, are we still on for tonight?', '9:39 PM', 2, true),
('thread-kairo', 'creator-kairo', 'Sent you a photo.', '8:17 PM', 1, true),
('thread-luna', 'creator-luna', 'Can you send the files over?', '6:45 PM', 3, true),
('thread-zayn', 'creator-zayn', 'The beat pack is ready.', 'Yesterday', 0, false)
on conflict (id) do update set
  "creatorId" = excluded."creatorId",
  "lastMessage" = excluded."lastMessage",
  time = excluded.time,
  unread = excluded.unread,
  online = excluded.online;

insert into dashboard_metrics (id, label, value, delta, tone) values
('views', 'Total Views', '18.7M', '+24.6%', 'cyan'),
('followers', 'Followers', '128K', '+18.3%', 'pink'),
('likes', 'Likes', '2.4M', '+31.7%', 'pink'),
('watch', 'Watch Time', '4.2K hrs', '+20.1%', 'cyan')
on conflict (id) do update set
  label = excluded.label,
  value = excluded.value,
  delta = excluded.delta,
  tone = excluded.tone;
