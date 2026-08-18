import { creators, videos, threads, chatMessages, notifications, metrics } from '../data/mockData';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import { backendPostToVideo, listComments, listNotifications, listPublicProfiles, listSocialPosts } from './social';
import { listConversationMessages, listConversationPreviews } from './socialUi';
import './socialSync';
import type { ChatMessage, Creator, DashboardMetric, MessageThread, NotificationItem, VideoPost } from '../types';

async function fromSupabase<T>(table: string, fallback: T[]): Promise<T[]> {
  if (!hasSupabaseConfig || !supabase) return fallback;
  const { data, error } = await supabase.from(table).select('*');
  if (error || !data) return fallback;
  return data as T[];
}

export const contentService = {
  creators: async (): Promise<Creator[]> => {
    const backendProfiles = await listPublicProfiles();
    if (backendProfiles.length) return [...backendProfiles, ...creators];
    return fromSupabase<Creator>('creators', creators);
  },
  videos: async (): Promise<VideoPost[]> => {
    const [backendPosts, legacyVideos] = await Promise.all([listSocialPosts(30), fromSupabase<VideoPost>('videos', videos)]);
    if (!backendPosts.length) return legacyVideos;
    return [...backendPosts.map((post) => backendPostToVideo(post)), ...legacyVideos];
  },
  threads: async (): Promise<MessageThread[]> => {
    const real = await listConversationPreviews();
    if (!real.length) return fromSupabase<MessageThread>('message_threads', threads);
    return real.map((x) => ({ id: x.id, creatorId: x.userId, lastMessage: x.lastMessage, time: x.lastMessageAt ? new Date(x.lastMessageAt).toLocaleString() : '', unread: x.unread, online: false }));
  },
  chatMessages: async (): Promise<ChatMessage[]> => {
    const base = await fromSupabase<ChatMessage>('chat_messages', chatMessages);
    const realThreads = await listConversationPreviews();
    if (!realThreads.length) return base;
    const groups = await Promise.all(realThreads.map((thread) => listConversationMessages(thread.id)));
    return [...groups.flat(), ...base];
  },
  notifications: async (): Promise<NotificationItem[]> => {
    const real = await listNotifications();
    return real.length ? real : fromSupabase<NotificationItem>('notifications', notifications);
  },
  metrics: () => fromSupabase<DashboardMetric>('dashboard_metrics', metrics)
};
