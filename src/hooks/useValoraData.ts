import { useQuery } from '@tanstack/react-query';
import { hasSupabaseConfig } from '../lib/supabase';
import { contentService } from '../services/content';

export function useValoraData() {
  const creators = useQuery({ queryKey: ['creators'], queryFn: contentService.creators });
  const videos = useQuery({ queryKey: ['videos'], queryFn: contentService.videos });
  const threads = useQuery({ queryKey: ['threads'], queryFn: contentService.threads });
  const chatMessages = useQuery({ queryKey: ['chatMessages'], queryFn: contentService.chatMessages });
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: contentService.notifications });
  const metrics = useQuery({ queryKey: ['metrics'], queryFn: contentService.metrics });

  return {
    creators: creators.data ?? [],
    videos: videos.data ?? [],
    threads: threads.data ?? [],
    chatMessages: chatMessages.data ?? [],
    notifications: notifications.data ?? [],
    metrics: metrics.data ?? [],
    isLoading: creators.isLoading || videos.isLoading || threads.isLoading,
    isSupabaseBacked: hasSupabaseConfig
  };
}
