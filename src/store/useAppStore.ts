import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ChatMessage, ComposerMode, FeedScope, MainTab, RootScreen, UploadDraft, VideoPost } from '../types';

type Overlay = 'comments' | 'share' | 'account' | 'uploadPreview' | null;

export type CurrentUserProfile = {
  name: string;
  handle: string;
  bio: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  provider: string | null;
};

type AppState = {
  screen: RootScreen;
  tab: MainTab;
  signedIn: boolean;
  feedScope: FeedScope;
  selectedVideoId: string;
  selectedThreadId: string;
  overlay: Overlay;
  composerMode: ComposerMode;
  uploadedVideos: VideoPost[];
  commentsByVideoId: Record<string, string[]>;
  sentMessagesByThreadId: Record<string, ChatMessage[]>;
  localNotifications: string[];
  toast: string | null;
  currentUser: CurrentUserProfile;
  likedVideoIds: string[];
  savedVideoIds: string[];
  followedCreatorIds: string[];
  friendCreatorIds: string[];
  pendingFriendIds: string[];
  rejectedFriendIds: string[];
  selectedTopics: string[];
  go: (screen: RootScreen) => void;
  setTab: (tab: MainTab) => void;
  signIn: (name: string, handle: string, profile?: Partial<CurrentUserProfile>) => void;
  signOut: () => void;
  updateProfile: (profile: Partial<CurrentUserProfile> & { name: string; handle: string; bio: string }) => void;
  setFeedScope: (scope: FeedScope) => void;
  selectVideo: (videoId: string) => void;
  selectThread: (threadId: string) => void;
  setOverlay: (overlay: Overlay) => void;
  setComposerMode: (mode: ComposerMode) => void;
  publishUpload: (draft: UploadDraft) => void;
  addComment: (videoId: string, text: string) => void;
  sendMessage: (threadId: string, body: string) => void;
  toggleLiked: (videoId: string) => void;
  toggleSaved: (videoId: string) => void;
  toggleFollowed: (creatorId: string) => void;
  toggleFriend: (creatorId: string) => void;
  rejectFriend: (creatorId: string) => void;
  toggleTopic: (topic: string) => void;
};

const tabToScreen: Record<MainTab, RootScreen> = {
  home: 'home',
  friends: 'friends',
  create: 'create',
  messages: 'messages',
  profile: 'profile'
};

const valoraStorage = {
  getItem: (name: string) => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(name, value);
  },
  removeItem: (name: string) => {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(name);
  }
};

export const useAppStore = create<AppState>()(persist((set) => ({
  screen: 'welcome',
  tab: 'home',
  signedIn: false,
  feedScope: 'forYou',
  selectedVideoId: 'video-neon-dreams',
  selectedThreadId: 'thread-aurora',
  overlay: null,
  composerMode: 'video',
  uploadedVideos: [],
  commentsByVideoId: {},
  sentMessagesByThreadId: {},
  localNotifications: [],
  toast: null,
  currentUser: {
    name: 'Imran',
    handle: 'imran.valora',
    bio: 'Building bright short videos on Valora.',
    avatarUrl: null,
    email: null,
    phone: null,
    provider: null
  },
  likedVideoIds: ['video-neon-dreams'],
  savedVideoIds: ['video-aurora-skies'],
  followedCreatorIds: ['creator-luna', 'creator-aurora'],
  friendCreatorIds: ['creator-luna'],
  pendingFriendIds: ['creator-kairo', 'creator-zayn'],
  rejectedFriendIds: [],
  selectedTopics: ['Music', 'Gaming', 'Fashion', 'Technology', 'Travel', 'Lifestyle', 'Art', 'Movies'],
  go: (screen) => set({ screen, overlay: null }),
  setTab: (tab) => set({ tab, screen: tabToScreen[tab], overlay: null }),
  signIn: (name, handle, profile = {}) =>
    set((state) => ({
      signedIn: true,
      screen: 'home',
      tab: 'home',
      currentUser: {
        ...state.currentUser,
        ...profile,
        name: name.trim() || 'Valora Creator',
        handle: handle.trim().replace(/^@/, '') || 'creator.valora',
        bio: profile.bio?.trim() || state.currentUser.bio || 'New creator on Valora.'
      }
    })),
  signOut: () => set({ signedIn: false, screen: 'welcome', tab: 'home', overlay: null }),
  updateProfile: (profile) =>
    set((state) => ({
      currentUser: {
        ...state.currentUser,
        ...profile,
        name: profile.name.trim() || 'Valora Creator',
        handle: profile.handle.trim().replace(/^@/, '') || 'creator.valora',
        bio: profile.bio.trim() || 'Creator on Valora.'
      },
      toast: 'Profile updated'
    })),
  setFeedScope: (feedScope) => set({ feedScope }),
  selectVideo: (videoId) => set({ selectedVideoId: videoId }),
  selectThread: (threadId) => set({ selectedThreadId: threadId, screen: 'chat', tab: 'messages', overlay: null }),
  setOverlay: (overlay) => set({ overlay }),
  setComposerMode: (composerMode) => set({ composerMode }),
  publishUpload: (draft) =>
    set((state) => {
      const video: VideoPost = {
        id: draft.id,
        creatorId: 'me',
        title: draft.title,
        caption: draft.caption,
        tags: draft.tags,
        imageUrl: draft.imageUrl,
        duration: '0:31',
        likes: '0',
        comments: '0',
        saves: '0',
        shares: '0',
        views: '0',
        sound: draft.sound,
        createdAt: 'now',
        privacy: draft.privacy,
        type: draft.type ?? state.composerMode
      };

      return {
        uploadedVideos: [video, ...state.uploadedVideos],
        selectedVideoId: video.id,
        screen: 'profile',
        tab: 'profile',
        overlay: null,
        toast: `${draft.type === 'text' ? 'Thought' : 'Post'} published`
      };
    }),
  addComment: (videoId, text) =>
    set((state) => {
      const clean = text.trim();
      if (!clean) return state;

      return {
        commentsByVideoId: {
          ...state.commentsByVideoId,
          [videoId]: [clean, ...(state.commentsByVideoId[videoId] ?? [])]
        },
        localNotifications: [`You commented on a post`, ...state.localNotifications],
        toast: 'Comment added'
      };
    }),
  sendMessage: (threadId, body) =>
    set((state) => {
      const clean = body.trim();
      if (!clean) return state;

      const message: ChatMessage = {
        id: `local-message-${Date.now()}`,
        threadId,
        mine: true,
        kind: 'text',
        body: clean,
        time: 'now'
      };

      return {
        sentMessagesByThreadId: {
          ...state.sentMessagesByThreadId,
          [threadId]: [...(state.sentMessagesByThreadId[threadId] ?? []), message]
        },
        localNotifications: ['Message sent', ...state.localNotifications],
        toast: 'Message sent'
      };
    }),
  toggleLiked: (videoId) =>
    set((state) => {
      const isLiked = state.likedVideoIds.includes(videoId);
      return {
        likedVideoIds: isLiked
          ? state.likedVideoIds.filter((id) => id !== videoId)
          : [...state.likedVideoIds, videoId],
        localNotifications: isLiked ? state.localNotifications : ['You liked a post', ...state.localNotifications],
        toast: isLiked ? 'Like removed' : 'Liked'
      };
    }),
  toggleSaved: (videoId) =>
    set((state) => {
      const isSaved = state.savedVideoIds.includes(videoId);
      return {
        savedVideoIds: isSaved
          ? state.savedVideoIds.filter((id) => id !== videoId)
          : [...state.savedVideoIds, videoId],
        toast: isSaved ? 'Removed from saved' : 'Saved'
      };
    }),
  toggleFollowed: (creatorId) =>
    set((state) => {
      const isFollowing = state.followedCreatorIds.includes(creatorId);
      return {
        followedCreatorIds: isFollowing
          ? state.followedCreatorIds.filter((id) => id !== creatorId)
          : [...state.followedCreatorIds, creatorId],
        localNotifications: isFollowing ? state.localNotifications : ['You followed a creator', ...state.localNotifications],
        toast: isFollowing ? 'Unfollowed' : 'Following'
      };
    }),
  toggleFriend: (creatorId) =>
    set((state) => ({
      friendCreatorIds: state.friendCreatorIds.includes(creatorId)
        ? state.friendCreatorIds.filter((id) => id !== creatorId)
        : [...state.friendCreatorIds, creatorId],
      pendingFriendIds: state.pendingFriendIds.filter((id) => id !== creatorId),
      rejectedFriendIds: state.rejectedFriendIds.filter((id) => id !== creatorId),
      localNotifications: [`Friend request accepted`, ...state.localNotifications],
      toast: 'Friend updated'
    })),
  rejectFriend: (creatorId) =>
    set((state) => ({
      pendingFriendIds: state.pendingFriendIds.filter((id) => id !== creatorId),
      friendCreatorIds: state.friendCreatorIds.filter((id) => id !== creatorId),
      rejectedFriendIds: [...state.rejectedFriendIds.filter((id) => id !== creatorId), creatorId],
      toast: 'Friend request rejected'
    })),
  toggleTopic: (topic) =>
    set((state) => ({
      selectedTopics: state.selectedTopics.includes(topic)
        ? state.selectedTopics.filter((item) => item !== topic)
        : [...state.selectedTopics, topic]
    }))
}), {
  name: 'valora-app-state',
  version: 2,
  storage: createJSONStorage(() => valoraStorage),
  migrate: (persistedState) => ({
    ...(persistedState as Partial<AppState>),
    signedIn: false,
    screen: 'welcome',
    tab: 'home',
    overlay: null
  }),
  partialize: (state) => ({
    signedIn: false,
    screen: 'welcome',
    tab: state.tab,
    feedScope: state.feedScope,
    selectedVideoId: state.selectedVideoId,
    selectedThreadId: state.selectedThreadId,
    composerMode: state.composerMode,
    uploadedVideos: state.uploadedVideos,
    commentsByVideoId: state.commentsByVideoId,
    sentMessagesByThreadId: state.sentMessagesByThreadId,
    localNotifications: state.localNotifications,
    currentUser: state.currentUser,
    likedVideoIds: state.likedVideoIds,
    savedVideoIds: state.savedVideoIds,
    followedCreatorIds: state.followedCreatorIds,
    friendCreatorIds: state.friendCreatorIds,
    pendingFriendIds: state.pendingFriendIds,
    rejectedFriendIds: state.rejectedFriendIds,
    selectedTopics: state.selectedTopics
  })
}));
