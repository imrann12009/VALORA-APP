import type { PostgrestError } from '@supabase/supabase-js';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import { getOwnProfile } from './profile';
import type { ChatMessage, Creator, NotificationItem, UploadDraft, VideoPost } from '../types';

export type SocialResult<T> = { ok: true; data: T } | { ok: false; error: string };

function unavailable(): SocialResult<never> {
  return { ok: false, error: 'Supabase is not configured.' };
}

function errorMessage(error: PostgrestError | Error | null | undefined) {
  return error?.message || 'Something went wrong. Please try again.';
}

async function ownProfile() {
  if (!hasSupabaseConfig || !supabase) return null;
  const profile = await getOwnProfile();
  return profile.ok ? profile.data : null;
}

export type BackendPost = {
  id: string;
  user_id: string;
  title: string;
  caption: string;
  tags: string[];
  image_url: string | null;
  media_type: 'video' | 'photo' | 'text' | 'story' | 'live';
  sound: string;
  privacy: 'public' | 'friends' | 'private';
  created_at: string;
};

export async function listSocialPosts(limit = 30): Promise<BackendPost[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const { data, error } = await supabase.from('posts').select('id,user_id,title,caption,tags,image_url,media_type,sound,privacy,created_at').order('created_at', { ascending: false }).limit(limit);
  if (error || !data) return [];
  return data as BackendPost[];
}

export async function listPublicProfiles(): Promise<Creator[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const { data, error } = await supabase.from('public_profiles').select('id,display_name,username,avatar_url,bio').order('created_at', { ascending: false }).limit(100);
  if (error || !data) return [];
  return data.map((profile) => ({
    id: String(profile.id),
    handle: profile.username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url ?? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=320&q=80',
    verified: false,
    followers: '0',
    bio: profile.bio
  }));
}

export function backendPostToVideo(post: BackendPost): VideoPost {
  return {
    id: post.id,
    creatorId: post.user_id,
    title: post.title || 'Untitled post',
    caption: post.caption,
    tags: post.tags ?? [],
    imageUrl: post.image_url ?? 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=85',
    duration: post.media_type === 'video' ? '0:30' : 'PHOTO',
    likes: '0',
    comments: '0',
    saves: '0',
    shares: '0',
    views: '0',
    sound: post.sound,
    createdAt: new Date(post.created_at).toLocaleDateString(),
    privacy: post.privacy,
    type: post.media_type
  };
}

export async function createPost(draft: UploadDraft): Promise<SocialResult<BackendPost>> {
  if (!hasSupabaseConfig || !supabase) return unavailable();
  const profile = await ownProfile();
  if (!profile) return { ok: false, error: 'Please sign in before creating a post.' };
  const { data, error } = await supabase.from('posts').insert({
    user_id: profile.id,
    title: draft.title.trim(),
    caption: draft.caption.trim(),
    tags: draft.tags,
    image_url: draft.imageUrl || null,
    media_type: draft.type ?? 'photo',
    sound: draft.sound.trim() || 'Original sound',
    privacy: draft.privacy
  }).select('id,user_id,title,caption,tags,image_url,media_type,sound,privacy,created_at').single();
  if (error || !data) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: data as BackendPost };
}

export async function createStory(mediaUrl: string, caption = ''): Promise<SocialResult<string>> {
  if (!hasSupabaseConfig || !supabase) return unavailable();
  const profile = await ownProfile();
  if (!profile) return { ok: false, error: 'Please sign in before creating a story.' };
  const { data, error } = await supabase.from('stories').insert({ user_id: profile.id, media_url: mediaUrl, caption }).select('id').single();
  if (error || !data) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: data.id };
}

export async function toggleLike(postId: string, liked: boolean): Promise<SocialResult<null>> {
  if (!hasSupabaseConfig || !supabase) return unavailable();
  const profile = await ownProfile();
  if (!profile) return { ok: false, error: 'Please sign in again.' };
  const query = liked ? supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', profile.id) : supabase.from('post_likes').insert({ post_id: postId, user_id: profile.id });
  const { error } = await query;
  if (error) return { ok: false, error: errorMessage(error) };
  if (!liked) {
    const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).single();
    if (post && post.user_id !== profile.id) await supabase.from('notifications_v2').insert({ recipient_id: post.user_id, actor_id: profile.id, kind: 'like', post_id: postId });
  }
  return { ok: true, data: null };
}

export async function addComment(postId: string, content: string): Promise<SocialResult<{ id: string; content: string; created_at: string }>> {
  if (!hasSupabaseConfig || !supabase) return unavailable();
  const profile = await ownProfile();
  if (!profile) return { ok: false, error: 'Please sign in again.' };
  const clean = content.trim();
  if (!clean) return { ok: false, error: 'Comment cannot be empty.' };
  const { data, error } = await supabase.from('comments').insert({ post_id: postId, user_id: profile.id, content: clean }).select('id,content,created_at').single();
  if (error || !data) return { ok: false, error: errorMessage(error) };
  const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).single();
  if (post && post.user_id !== profile.id) await supabase.from('notifications_v2').insert({ recipient_id: post.user_id, actor_id: profile.id, kind: 'comment', post_id: postId });
  return { ok: true, data };
}

export async function deleteComment(commentId: string): Promise<SocialResult<null>> {
  if (!hasSupabaseConfig || !supabase) return unavailable();
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: null };
}

export async function toggleFollow(targetProfileId: string, following: boolean): Promise<SocialResult<null>> {
  if (!hasSupabaseConfig || !supabase) return unavailable();
  const profile = await ownProfile();
  if (!profile) return { ok: false, error: 'Please sign in again.' };
  if (profile.id === targetProfileId) return { ok: false, error: 'You cannot follow yourself.' };
  const query = following ? supabase.from('follows').delete().eq('follower_id', profile.id).eq('following_id', targetProfileId) : supabase.from('follows').insert({ follower_id: profile.id, following_id: targetProfileId });
  const { error } = await query;
  if (error) return { ok: false, error: errorMessage(error) };
  if (!following) await supabase.from('notifications_v2').insert({ recipient_id: targetProfileId, actor_id: profile.id, kind: 'follow' });
  return { ok: true, data: null };
}

export async function listComments(postId: string) {
  if (!hasSupabaseConfig || !supabase) return [];
  const { data, error } = await supabase.from('comments').select('id,user_id,content,created_at').eq('post_id', postId).order('created_at', { ascending: false }).limit(100);
  if (error || !data) return [];
  return data;
}

export async function listNotifications(): Promise<NotificationItem[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const profile = await ownProfile();
  if (!profile) return [];
  const { data, error } = await supabase.from('notifications_v2').select('id,kind,created_at,actor_id,read_at').eq('recipient_id', profile.id).order('created_at', { ascending: false }).limit(50);
  if (error || !data) return [];
  return data.map((item) => ({
    id: item.id,
    kind: item.kind === 'comment' ? 'like' : item.kind,
    title: item.kind === 'follow' ? 'Someone followed you' : item.kind === 'comment' ? 'Someone commented on your post' : item.kind === 'like' ? 'Someone liked your post' : 'Someone interacted with your post',
    time: new Date(item.created_at).toLocaleString()
  }));
}

export async function markNotificationsRead(): Promise<SocialResult<null>> {
  if (!hasSupabaseConfig || !supabase) return unavailable();
  const profile = await ownProfile();
  if (!profile) return { ok: false, error: 'Please sign in again.' };
  const { error } = await supabase.from('notifications_v2').update({ read_at: new Date().toISOString() }).eq('recipient_id', profile.id).is('read_at', null);
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: null };
}

export async function uploadPostMedia(uri: string, mimeType = 'image/jpeg', fileName?: string): Promise<SocialResult<string>> {
  if (!hasSupabaseConfig || !supabase) return unavailable();
  const profile = await ownProfile();
  if (!profile) return { ok: false, error: 'Please sign in again.' };
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const extension = (fileName?.split('.').pop() || mimeType.split('/').pop() || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
    const path = `${profile.auth_user_id}/${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from('post-media').upload(path, blob, { contentType: mimeType, upsert: false });
    if (error) return { ok: false, error: errorMessage(error) };
    const { data } = supabase.storage.from('post-media').getPublicUrl(path);
    return data.publicUrl ? { ok: true, data: data.publicUrl } : { ok: false, error: 'Upload succeeded but no public URL was returned.' };
  } catch {
    return { ok: false, error: 'Unable to upload media. Check your connection and try again.' };
  }
}

export async function sendMessage(conversationId: string, body: string): Promise<SocialResult<ChatMessage>> {
  if (!hasSupabaseConfig || !supabase) return unavailable();
  const profile = await ownProfile();
  if (!profile) return { ok: false, error: 'Please sign in again.' };
  const clean = body.trim();
  if (!clean) return { ok: false, error: 'Message cannot be empty.' };
  const { data, error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: profile.id, body: clean }).select('id,conversation_id,sender_id,body,created_at').single();
  if (error || !data) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: { id: data.id, threadId: data.conversation_id, mine: true, kind: 'text', body: data.body, time: new Date(data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } };
}
