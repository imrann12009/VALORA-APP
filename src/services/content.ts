import { creators, videos, threads, chatMessages, notifications, metrics } from '../data/mockData';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import { backendPostToVideo, listPublicProfiles, listSocialPosts } from './social';
import type {
  ChatMessage,
  Creator,
  DashboardMetric,
  MessageThread,
  NotificationItem,
  VideoPost
} from '../types';

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
    const [backendPosts, legacyVideos] = await Promise.all([
      listSocialPosts(30),
      fromSupabase<VideoPost>('videos', videos)
    ]);
    if (!backendPosts.length) return legacyVideos;
    return [...backendPosts.map((post) => backendPostToVideo(post)), ...legacyVideos];
  },
  threads: () => fromSupabase<MessageThread>('message_threads', threads),
  chatMessages: () => fromSupabase<ChatMessage>('chat_messages', chatMessages),
  notifications: () => fromSupabase<NotificationItem>('notifications', notifications),
  metrics: () => fromSupabase<DashboardMetric>('dashboard_metrics', metrics)
};
