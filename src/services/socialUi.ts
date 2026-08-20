import { hasSupabaseConfig, supabase } from '../lib/supabase';
import type { ChatMessage, Creator, NotificationItem, VideoPost } from '../types';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function unavailable<T>(): Result<T> { return { ok: false, error: 'Supabase is not configured.' }; }

export type ProfileStats = Creator & { postsCount: number; followersCount: number; followingCount: number };

export async function getProfileStats(profileId: string): Promise<ProfileStats | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  const { data, error } = await supabase.from('profile_stats').select('id,username,display_name,avatar_url,bio,posts_count,followers_count,following_count').eq('id', profileId).single();
  if (error || !data) return null;
  return { id: data.id, handle: data.username, displayName: data.display_name, avatarUrl: data.avatar_url ?? '', verified: false, followers: String(data.followers_count), bio: data.bio ?? '', postsCount: data.posts_count, followersCount: data.followers_count, followingCount: data.following_count };
}

export async function getFollowState(profileId: string, targetId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;
  const { data } = await supabase.from('follows').select('id').eq('follower_id', profileId).eq('following_id', targetId).maybeSingle();
  return Boolean(data);
}

export async function searchProfilesAndPosts(query: string): Promise<{ profiles: ProfileStats[]; posts: VideoPost[] }> {
  if (!hasSupabaseConfig || !supabase) return { profiles: [], posts: [] };
  const q = query.trim();
  if (!q) return { profiles: [], posts: [] };
  const pattern = `%${q}%`;
  const [profilesResult, postsResult] = await Promise.all([
    supabase.from('profile_stats').select('id,username,display_name,avatar_url,bio,posts_count,followers_count,following_count').or(`username.ilike.${pattern},display_name.ilike.${pattern}`).limit(30),
    supabase.from('posts').select('id,user_id,title,caption,tags,image_url,media_type,sound,privacy,created_at').or(`title.ilike.${pattern},caption.ilike.${pattern}`).eq('privacy', 'public').order('created_at', { ascending: false }).limit(30)
  ]);
  const profiles = !profilesResult.error && profilesResult.data ? profilesResult.data.map((p) => ({ id: p.id, handle: p.username, displayName: p.display_name, avatarUrl: p.avatar_url ?? '', verified: false, followers: String(p.followers_count), bio: p.bio ?? '', postsCount: p.posts_count, followersCount: p.followers_count, followingCount: p.following_count })) : [];
  const posts = !postsResult.error && postsResult.data ? postsResult.data.map((p) => ({ id: p.id, creatorId: p.user_id, title: p.title || 'Untitled post', caption: p.caption, tags: p.tags ?? [], imageUrl: p.image_url ?? '', duration: p.media_type === 'video' ? '0:30' : 'PHOTO', likes: '0', comments: '0', saves: '0', shares: '0', views: '0', sound: p.sound, createdAt: new Date(p.created_at).toLocaleDateString(), privacy: p.privacy, type: p.media_type })) : [];
  return { profiles, posts };
}

export type StoryRecord = { id: string; userId: string; mediaUrl: string; caption: string; createdAt: string; expiresAt: string; viewCount: number };
export async function listActiveStories(): Promise<StoryRecord[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const { data, error } = await supabase.from('active_stories').select('id,user_id,media_url,caption,created_at,expires_at,view_count').order('created_at', { ascending: false }).limit(100);
  if (error || !data) return [];
  return data.map((s) => ({ id: s.id, userId: s.user_id, mediaUrl: s.media_url, caption: s.caption, createdAt: s.created_at, expiresAt: s.expires_at, viewCount: s.view_count }));
}

export async function markStoryViewed(storyId: string): Promise<Result<null>> {
  if (!hasSupabaseConfig || !supabase) return unavailable();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Please sign in again.' };
  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', auth.user.id).single();
  if (!profile) return { ok: false, error: 'Profile not found.' };
  const { error } = await supabase.from('story_views').upsert({ story_id: storyId, user_id: profile.id }, { onConflict: 'story_id,user_id' });
  return error ? { ok: false, error: error.message } : { ok: true, data: null };
}

export type ConversationPreview = { id: string; userId: string; displayName: string; username: string; avatarUrl: string; lastMessage: string; lastMessageAt: string | null; unread: number };
export async function listConversationPreviews(): Promise<ConversationPreview[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const { data, error } = await supabase.from('conversation_previews').select('id,user_id,display_name,username,avatar_url,last_message,last_message_at,unread').order('last_message_at', { ascending: false }).limit(100);
  if (error || !data) return [];
  return data.map((x) => ({ id: x.id, userId: x.user_id, displayName: x.display_name, username: x.username, avatarUrl: x.avatar_url ?? '', lastMessage: x.last_message ?? '', lastMessageAt: x.last_message_at }));
}

export async function getOrCreateConversation(targetProfileId: string): Promise<Result<string>> {
  if (!hasSupabaseConfig || !supabase) return unavailable();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Please sign in again.' };
  const { data: me } = await supabase.from('profiles').select('id').eq('auth_user_id', auth.user.id).single();
  if (!me) return { ok: false, error: 'Profile not found.' };
  const { data: memberships } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', me.id);
  for (const membership of memberships ?? []) {
    const { data: other } = await supabase.from('conversation_members').select('user_id').eq('conversation_id', membership.conversation_id).eq('user_id', targetProfileId).maybeSingle();
    if (other) return { ok: true, data: membership.conversation_id };
  }
  const { data: conversation, error } = await supabase.from('conversations').insert({}).select('id').single();
  if (error || !conversation) return { ok: false, error: error?.message ?? 'Unable to create conversation.' };
  const { error: memberError } = await supabase.from('conversation_members').insert([{ conversation_id: conversation.id, user_id: me.id }, { conversation_id: conversation.id, user_id: targetProfileId }]);
  if (memberError) return { ok: false, error: memberError.message };
  return { ok: true, data: conversation.id };
}

export async function listConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data: me } = await supabase.from('profiles').select('id').eq('auth_user_id', auth.user.id).single();
  if (!me) return [];
  const { data, error } = await supabase.from('messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(100);
  if (error || !data) return [];
  return data.map((m) => ({ id: m.id, threadId: m.conversation_id, mine: m.sender_id === me.id, kind: 'text', body: m.body, time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }));
}

export function subscribeToMessages(conversationId: string, onMessage: (message: ChatMessage) => void) {
  if (!hasSupabaseConfig || !supabase) return () => undefined;
  let active = true;
  const channel = supabase.channel(`messages:${conversationId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, async (payload) => {
    if (!active || !supabase) return;
    const m = payload.new as { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };
    const { data: auth } = await supabase.auth.getUser();
    const { data: me } = auth.user ? await supabase.from('profiles').select('id').eq('auth_user_id', auth.user.id).single() : { data: null };
    onMessage({ id: m.id, threadId: m.conversation_id, mine: m.sender_id === me?.id, kind: 'text', body: m.body, time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  }).subscribe();
  return () => { active = false; if (supabase) void supabase.removeChannel(channel); };
}

export function subscribeToNotifications(onChange: () => void) {
  if (!hasSupabaseConfig || !supabase) return () => undefined;
  let active = true;
  const channel = supabase.channel('notifications:current').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications_v2' }, () => { if (active) onChange(); }).subscribe();
  return () => { active = false; if (supabase) void supabase.removeChannel(channel); };
}

export async function getNotificationUnreadCount(): Promise<number> {
  if (!hasSupabaseConfig || !supabase) return 0;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 0;
  const { data: me } = await supabase.from('profiles').select('id').eq('auth_user_id', auth.user.id).single();
  if (!me) return 0;
  const { count } = await supabase.from('notifications_v2').select('id', { count: 'exact', head: true }).eq('recipient_id', me.id).is('read_at', null);
  return count ?? 0;
}
