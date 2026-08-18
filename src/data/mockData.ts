import type {
  ChatMessage,
  Creator,
  DashboardMetric,
  MessageThread,
  NotificationItem,
  VideoPost
} from '../types';

export const creators: Creator[] = [
  {
    id: 'creator-luna',
    handle: 'luna.wav',
    displayName: 'LunaVibe',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=320&q=80',
    verified: true,
    followers: '12.4M',
    bio: 'Neon cities, quiet moods, late-night edits.'
  },
  {
    id: 'creator-kairo',
    handle: 'kairo',
    displayName: 'Kairo',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=320&q=80',
    verified: true,
    followers: '8.7M',
    bio: 'Movement, sound, cyber flow.'
  },
  {
    id: 'creator-aurora',
    handle: 'auroraxvisions',
    displayName: 'Aurora',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=320&q=80',
    verified: true,
    followers: '128K',
    bio: 'Dreamer. Creator. Night thinker. Building my world in pixels and light.'
  },
  {
    id: 'creator-zayn',
    handle: 'zaynbeats',
    displayName: 'ZaynBeats',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=320&q=80',
    verified: true,
    followers: '5.3M',
    bio: 'Synthwave packs and midnight samples.'
  }
];

export const videos: VideoPost[] = [
  {
    id: 'video-neon-dreams',
    creatorId: 'creator-luna',
    title: 'Neon Dreams',
    caption: 'when the city hits different at 2am',
    tags: ['NightVibes', 'NeonCity', 'AuroraMood'],
    imageUrl: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=85',
    duration: '0:28',
    likes: '12.8K',
    comments: '342',
    saves: '2.6K',
    shares: '1.1K',
    views: '124.7K',
    sound: 'NEON PULSE - synthwave remix',
    createdAt: '2h ago'
  },
  {
    id: 'video-aurora-skies',
    creatorId: 'creator-kairo',
    title: 'Aurora Skies',
    caption: 'Found this quiet place. Needed this.',
    tags: ['mindful', 'escape'],
    imageUrl: 'https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=900&q=85',
    duration: '0:45',
    likes: '948',
    comments: '64',
    saves: '851',
    shares: '97',
    views: '842K',
    sound: 'soft horizon - ambient edit',
    createdAt: '5h ago'
  },
  {
    id: 'video-electric-flow',
    creatorId: 'creator-aurora',
    title: 'Electric Flow',
    caption: 'lost in the glow',
    tags: ['AuroraMoves', 'CyberpunkFlow', 'NeonEnergy'],
    imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=900&q=85',
    duration: '0:33',
    likes: '12.4K',
    comments: '842',
    saves: '3.1K',
    shares: '2.4K',
    views: '1.5M',
    sound: 'Midnight Pulse',
    createdAt: '8h ago'
  },
  {
    id: 'video-city-lights',
    creatorId: 'creator-zayn',
    title: 'City Lights & Dreams',
    caption: 'The streets wrote the hook first.',
    tags: ['FutureFlow', 'Music'],
    imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=85',
    duration: '1:02',
    likes: '189K',
    comments: '2.1K',
    saves: '39K',
    shares: '14K',
    views: '1.8M',
    sound: 'Cyber Heart',
    createdAt: '12h ago'
  }
];

export const threads: MessageThread[] = [
  { id: 'thread-aurora', creatorId: 'creator-aurora', lastMessage: 'Hey, are we still on for tonight?', time: '9:39 PM', unread: 2, online: true },
  { id: 'thread-kairo', creatorId: 'creator-kairo', lastMessage: 'Sent you a photo.', time: '8:17 PM', unread: 1, online: true },
  { id: 'thread-luna', creatorId: 'creator-luna', lastMessage: 'Can you send the files over?', time: '6:45 PM', unread: 3, online: true },
  { id: 'thread-zayn', creatorId: 'creator-zayn', lastMessage: 'The beat pack is ready.', time: 'Yesterday', unread: 0, online: false }
];

export const chatMessages: ChatMessage[] = [
  { id: 'chat-1', threadId: 'thread-aurora', mine: true, kind: 'text', body: 'Hey Aurora', time: '9:29 PM' },
  { id: 'chat-2', threadId: 'thread-aurora', mine: false, kind: 'text', body: 'Hey you. So good to hear from you', time: '9:30 PM' },
  {
    id: 'chat-3',
    threadId: 'thread-aurora',
    mine: true,
    kind: 'image',
    body: 'City view',
    time: '9:32 PM',
    imageUrl: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=800&q=80'
  },
  { id: 'chat-4', threadId: 'thread-aurora', mine: false, kind: 'voice', body: '0:36', time: '9:33 PM' },
  { id: 'chat-5', threadId: 'thread-aurora', mine: true, kind: 'reply', body: 'Same here... counting the days', time: '9:34 PM' }
];

export const notifications: NotificationItem[] = [
  { id: 'n1', kind: 'like', title: 'Alex liked your video', time: '2m ago', actorAvatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=240&q=80' },
  { id: 'n2', kind: 'follow', title: 'Sarah started following you', time: '15m ago', actorAvatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=240&q=80' },
  { id: 'n3', kind: 'views', title: 'Your video reached 100K views', time: '1h ago' },
  { id: 'n4', kind: 'share', title: 'Someone shared your post', time: '2h ago' }
];

export const metrics: DashboardMetric[] = [
  { id: 'views', label: 'Total Views', value: '18.7M', delta: '+24.6%', tone: 'cyan' },
  { id: 'followers', label: 'Followers', value: '128K', delta: '+18.3%', tone: 'pink' },
  { id: 'likes', label: 'Likes', value: '2.4M', delta: '+31.7%', tone: 'pink' },
  { id: 'watch', label: 'Watch Time', value: '4.2K hrs', delta: '+20.1%', tone: 'cyan' }
];
