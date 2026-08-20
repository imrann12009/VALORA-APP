import { hasSupabaseConfig, supabase } from '../lib/supabase';
import type { ChatMessage, Creator, VideoPost } from '../types';

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function unavailable<T>(): Result<T> {
  return {
    ok: false,
    error: 'Supabase is not configured.',
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

type ProfileStatsRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  posts_count: number | null;
  followers_count: number | null;
  following_count: number | null;
};

function mapProfileStats(data: ProfileStatsRow): ProfileStats {
  const followersCount = data.followers_count ?? 0;
  const followingCount = data.following_count ?? 0;
  const postsCount = data.posts_count ?? 0;

  return {
    id: data.id,
    handle: data.username ?? '',
    displayName: data.display_name ?? '',
    avatarUrl: data.avatar_url ?? '',
    verified: false,
    followers: String(followersCount),
    bio: data.bio ?? '',
    postsCount,
    followersCount,
    followingCount,
  };
}

async function getCurrentProfileId(): Promise<
  Result<string>
> {
  if (!hasSupabaseConfig || !supabase) {
    return unavailable();
  }

  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return {
      ok: false,
      error: 'Please sign in again.',
    };
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      error: profileError.message,
    };
  }

  if (!profile) {
    return {
      ok: false,
      error: 'Profile not found.',
    };
  }

  return {
    ok: true,
    data: profile.id,
  };
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

export type ProfileStats = Creator & {
  postsCount: number;
  followersCount: number;
  followingCount: number;
};

export async function getProfileStats(
  profileId: string,
): Promise<ProfileStats | null> {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const {
    data,
    error,
  } = await supabase
    .from('profile_stats')
    .select(
      'id,username,display_name,avatar_url,bio,posts_count,followers_count,following_count',
    )
    .eq('id', profileId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapProfileStats(data as ProfileStatsRow);
}

export async function getFollowState(
  profileId: string,
  targetId: string,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) {
    return false;
  }

  if (!profileId || !targetId) {
    return false;
  }

  const {
    data,
    error,
  } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', profileId)
    .eq('following_id', targetId)
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data);
}

/* -------------------------------------------------------------------------- */
/* Search                                                                     */
/* -------------------------------------------------------------------------- */

export async function searchProfilesAndPosts(
  query: string,
): Promise<{
  profiles: ProfileStats[];
  posts: VideoPost[];
}> {
  if (!hasSupabaseConfig || !supabase) {
    return {
      profiles: [],
      posts: [],
    };
  }

  const q = query.trim();

  if (!q) {
    return {
      profiles: [],
      posts: [],
    };
  }

  /*
   * Escape characters that have special meaning in PostgreSQL ILIKE patterns.
   */
  const escapedQuery = q
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');

  const pattern = `%${escapedQuery}%`;

  const [profilesResult, postsResult] = await Promise.all([
    supabase
      .from('profile_stats')
      .select(
        'id,username,display_name,avatar_url,bio,posts_count,followers_count,following_count',
      )
      .or(
        `username.ilike.${pattern},display_name.ilike.${pattern}`,
      )
      .limit(30),

    supabase
      .from('posts')
      .select(
        'id,user_id,title,caption,tags,image_url,media_type,sound,privacy,created_at',
      )
      .or(`title.ilike.${pattern},caption.ilike.${pattern}`)
      .eq('privacy', 'public')
      .order('created_at', {
        ascending: false,
      })
      .limit(30),
  ]);

  const profiles: ProfileStats[] =
    !profilesResult.error && profilesResult.data
      ? (profilesResult.data as ProfileStatsRow[]).map(
          mapProfileStats,
        )
      : [];

  const posts: VideoPost[] =
    !postsResult.error && postsResult.data
      ? postsResult.data.map((p) => ({
          id: p.id,
          creatorId: p.user_id,
          title: p.title || 'Untitled post',
          caption: p.caption ?? '',
          tags: Array.isArray(p.tags) ? p.tags : [],
          imageUrl: p.image_url ?? '',
          duration:
            p.media_type === 'video'
              ? '0:30'
              : 'PHOTO',
          likes: '0',
          comments: '0',
          saves: '0',
          shares: '0',
          views: '0',
          sound: p.sound ?? '',
          createdAt: new Date(
            p.created_at,
          ).toLocaleDateString(),
          privacy: p.privacy,
          type: p.media_type,
        }))
      : [];

  return {
    profiles,
    posts,
  };
}

/* -------------------------------------------------------------------------- */
/* Stories                                                                    */
/* -------------------------------------------------------------------------- */

export type StoryRecord = {
  id: string;
  userId: string;
  mediaUrl: string;
  caption: string;
  createdAt: string;
  expiresAt: string;
  viewCount: number;
};

export async function listActiveStories(): Promise<
  StoryRecord[]
> {
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }

  const {
    data,
    error,
  } = await supabase
    .from('active_stories')
    .select(
      'id,user_id,media_url,caption,created_at,expires_at,view_count',
    )
    .order('created_at', {
      ascending: false,
    })
    .limit(100);

  if (error || !data) {
    return [];
  }

  return data.map((story) => ({
    id: story.id,
    userId: story.user_id,
    mediaUrl: story.media_url ?? '',
    caption: story.caption ?? '',
    createdAt: story.created_at,
    expiresAt: story.expires_at,
    viewCount: story.view_count ?? 0,
  }));
}

export async function markStoryViewed(
  storyId: string,
): Promise<Result<null>> {
  if (!hasSupabaseConfig || !supabase) {
    return unavailable();
  }

  if (!storyId) {
    return {
      ok: false,
      error: 'Story ID is required.',
    };
  }

  const profileResult = await getCurrentProfileId();

  if (!profileResult.ok) {
    return profileResult;
  }

  const {
    error,
  } = await supabase
    .from('story_views')
    .upsert(
      {
        story_id: storyId,
        user_id: profileResult.data,
      },
      {
        onConflict: 'story_id,user_id',
      },
    );

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  return {
    ok: true,
    data: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Conversations                                                              */
/* -------------------------------------------------------------------------- */

export type ConversationPreview = {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  lastMessage: string;
  lastMessageAt: string | null;
  unread: number;
};

export async function listConversationPreviews(): Promise<
  ConversationPreview[]
> {
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }

  const {
    data,
    error,
  } = await supabase
    .from('conversation_previews')
    .select(
      'id,user_id,display_name,username,avatar_url,last_message,last_message_at,unread',
    )
    .order('last_message_at', {
      ascending: false,
      nullsFirst: false,
    })
    .limit(100);

  if (error || !data) {
    return [];
  }

  return data.map((item) => ({
    id: item.id,
    userId: item.user_id,
    displayName: item.display_name ?? '',
    username: item.username ?? '',
    avatarUrl: item.avatar_url ?? '',
    lastMessage: item.last_message ?? '',
    lastMessageAt: item.last_message_at ?? null,
    unread: item.unread ?? 0,
  }));
}

export async function getOrCreateConversation(
  targetProfileId: string,
): Promise<Result<string>> {
  if (!hasSupabaseConfig || !supabase) {
    return unavailable();
  }

  if (!targetProfileId) {
    return {
      ok: false,
      error: 'Target profile is required.',
    };
  }

  const profileResult = await getCurrentProfileId();

  if (!profileResult.ok) {
    return profileResult;
  }

  const myProfileId = profileResult.data;

  if (myProfileId === targetProfileId) {
    return {
      ok: false,
      error: 'You cannot start a conversation with yourself.',
    };
  }

  /*
   * Get all conversations where the current user is a member.
   */
  const {
    data: memberships,
    error: membershipsError,
  } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', myProfileId);

  if (membershipsError) {
    return {
      ok: false,
      error: membershipsError.message,
    };
  }

  /*
   * Check whether a conversation already exists with target user.
   */
  for (const membership of memberships ?? []) {
    const {
      data: otherMember,
      error: otherMemberError,
    } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq(
        'conversation_id',
        membership.conversation_id,
      )
      .eq('user_id', targetProfileId)
      .maybeSingle();

    if (otherMemberError) {
      continue;
    }

    if (otherMember) {
      return {
        ok: true,
        data: membership.conversation_id,
      };
    }
  }

  /*
   * Create a new conversation.
   */
  const {
    data: conversation,
    error: conversationError,
  } = await supabase
    .from('conversations')
    .insert({})
    .select('id')
    .single();

  if (conversationError || !conversation) {
    return {
      ok: false,
      error:
        conversationError?.message ??
        'Unable to create conversation.',
    };
  }

  /*
   * Add both users to the conversation.
   */
  const {
    error: memberError,
  } = await supabase
    .from('conversation_members')
    .insert([
      {
        conversation_id: conversation.id,
        user_id: myProfileId,
      },
      {
        conversation_id: conversation.id,
        user_id: targetProfileId,
      },
    ]);

  if (memberError) {
    /*
     * Best-effort cleanup so a failed membership insert
     * does not leave an empty conversation behind.
     */
    await supabase
      .from('conversations')
      .delete()
      .eq('id', conversation.id);

    return {
      ok: false,
      error: memberError.message,
    };
  }

  return {
    ok: true,
    data: conversation.id,
  };
}

/* -------------------------------------------------------------------------- */
/* Messages                                                                   */
/* -------------------------------------------------------------------------- */

export async function listConversationMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }

  if (!conversationId) {
    return [];
  }

  const profileResult = await getCurrentProfileId();

  if (!profileResult.ok) {
    return [];
  }

  const myProfileId = profileResult.data;

  /*
   * Make sure the current user belongs to this conversation.
   */
  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', myProfileId)
    .maybeSingle();

  if (membershipError || !membership) {
    return [];
  }

  const {
    data,
    error,
  } = await supabase
    .from('messages')
    .select(
      'id,conversation_id,sender_id,body,created_at',
    )
    .eq('conversation_id', conversationId)
    .order('created_at', {
      ascending: true,
    })
    .limit(100);

  if (error || !data) {
    return [];
  }

  return data.map((message) => ({
    id: message.id,
    threadId: message.conversation_id,
    mine: message.sender_id === myProfileId,
    kind: 'text',
    body: message.body ?? '',
    time: new Date(
      message.created_at,
    ).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
  }));
}

/* -------------------------------------------------------------------------- */
/* Realtime Messages                                                          */
/* -------------------------------------------------------------------------- */

export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: ChatMessage) => void,
): () => void {
  if (!hasSupabaseConfig || !supabase) {
    return () => undefined;
  }

  if (!conversationId) {
    return () => undefined;
  }

  let active = true;

  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      async (payload) => {
        if (!active || !supabase) {
          return;
        }

        const message = payload.new as {
          id: string;
          conversation_id: string;
          sender_id: string;
          body: string | null;
          created_at: string;
        };

        const profileResult =
          await getCurrentProfileId();

        if (!active) {
          return;
        }

        const myProfileId =
          profileResult.ok
            ? profileResult.data
            : null;

        onMessage({
          id: message.id,
          threadId: message.conversation_id,
          mine:
            message.sender_id === myProfileId,
          kind: 'text',
          body: message.body ?? '',
          time: new Date(
            message.created_at,
          ).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
      },
    )
    .subscribe();

  return () => {
    active = false;

    if (supabase) {
      void supabase.removeChannel(channel);
    }
  };
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

export function subscribeToNotifications(
  onChange: () => void,
): () => void {
  if (!hasSupabaseConfig || !supabase) {
    return () => undefined;
  }

  let active = true;

  const channel = supabase
    .channel('notifications:current')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications_v2',
      },
      () => {
        if (active) {
          onChange();
        }
      },
    )
    .subscribe();

  return () => {
    active = false;

    if (supabase) {
      void supabase.removeChannel(channel);
    }
  };
}

export async function getNotificationUnreadCount(): Promise<number> {
  if (!hasSupabaseConfig || !supabase) {
    return 0;
  }

  const profileResult = await getCurrentProfileId();

  if (!profileResult.ok) {
    return 0;
  }

  const {
    count,
    error,
  } = await supabase
    .from('notifications_v2')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('recipient_id', profileResult.data)
    .is('read_at', null);

  if (error) {
    return 0;
  }

  return count ?? 0;
}