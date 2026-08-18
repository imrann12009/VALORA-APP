export type RootScreen =
  | 'welcome'
  | 'home'
  | 'discover'
  | 'create'
  | 'upload'
  | 'messages'
  | 'chat'
  | 'friends'
  | 'profile'
  | 'notifications'
  | 'dashboard'
  | 'monetization'
  | 'settings'
  | 'saved'
  | 'personalization'
  | 'story'
  | 'account';

export type MainTab = 'home' | 'friends' | 'create' | 'messages' | 'profile';
export type FeedScope = 'forYou' | 'following' | 'friends' | 'live';
export type ComposerMode = 'video' | 'photo' | 'text' | 'story' | 'live';
export type Visibility = 'public' | 'friends' | 'private';

export type Creator = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  verified: boolean;
  followers: string;
  bio: string;
};

export type VideoPost = {
  id: string;
  creatorId: string;
  title: string;
  caption: string;
  tags: string[];
  imageUrl: string;
  duration: string;
  likes: string;
  comments: string;
  saves: string;
  shares: string;
  views: string;
  sound: string;
  createdAt: string;
  isLive?: boolean;
  privacy?: Visibility;
  type?: 'video' | 'photo' | 'text' | 'story' | 'live';
};

export type UploadDraft = {
  id: string;
  title: string;
  caption: string;
  tags: string[];
  imageUrl: string;
  sound: string;
  privacy: Visibility;
  type?: 'video' | 'photo' | 'text' | 'story' | 'live';
};

export type MessageThread = {
  id: string;
  creatorId: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  mine: boolean;
  kind: 'text' | 'image' | 'voice' | 'reply';
  body: string;
  time: string;
  imageUrl?: string;
};

export type NotificationItem = {
  id: string;
  kind: 'like' | 'follow' | 'views' | 'share';
  title: string;
  time: string;
  actorAvatarUrl?: string;
};

export type DashboardMetric = {
  id: string;
  label: string;
  value: string;
  delta: string;
  tone: 'cyan' | 'pink' | 'violet';
};
