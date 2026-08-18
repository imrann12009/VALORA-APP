import type { User } from '@supabase/supabase-js';
import { authErrorMessage, type AuthResult, type ValoraProfile, validateUsername } from './auth';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import type { CurrentUserProfile } from '../store/useAppStore';

type ProfileUpdateInput = {
  displayName: string;
  username: string;
  bio: string;
  avatarUrl?: string | null;
};

export function profileToCurrentUser(profile: ValoraProfile): CurrentUserProfile {
  return {
    name: profile.display_name,
    handle: profile.username,
    bio: profile.bio,
    avatarUrl: profile.avatar_url,
    email: profile.email,
    phone: profile.phone,
    provider: profile.provider
  };
}

function missingSupabase() {
  if (!hasSupabaseConfig || !supabase) {
    return 'Supabase env missing. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';
  }

  return null;
}

async function getSignedInUser(): Promise<AuthResult<User>> {
  const missing = missingSupabase();
  if (missing) return { ok: false, error: missing };

  const { data, error } = await supabase!.auth.getUser();
  if (error) return { ok: false, error: authErrorMessage(error.message) };
  if (!data.user) return { ok: false, error: 'Your session expired. Please log in again.' };

  return { ok: true, data: data.user };
}

export async function getOwnProfile(): Promise<AuthResult<ValoraProfile>> {
  const user = await getSignedInUser();
  if (!user.ok) return user;

  const { data, error } = await supabase!
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.data.id)
    .single();

  if (error) return { ok: false, error: authErrorMessage(error.message) };
  return { ok: true, data: data as ValoraProfile };
}

export async function isUsernameAvailable(usernameInput: string): Promise<AuthResult<boolean>> {
  const user = await getSignedInUser();
  if (!user.ok) return user;

  const username = validateUsername(usernameInput);
  if (!username.ok) return username;

  const { data, error } = await supabase!.rpc('is_username_available', {
    candidate_username: username.data
  });

  if (error) return { ok: false, error: authErrorMessage(error.message) };
  return { ok: true, data: Boolean(data) };
}

export async function updateOwnProfile(input: ProfileUpdateInput): Promise<AuthResult<ValoraProfile>> {
  const user = await getSignedInUser();
  if (!user.ok) return user;

  const username = validateUsername(input.username);
  if (!username.ok) return username;

  const displayName = input.displayName.trim();
  const bio = input.bio.trim();

  if (displayName.length < 2) {
    return { ok: false, error: 'Display name must be at least 2 characters.' };
  }

  if (displayName.length > 60) {
    return { ok: false, error: 'Display name must be 60 characters or fewer.' };
  }

  if (bio.length > 160) {
    return { ok: false, error: 'Bio must be 160 characters or fewer.' };
  }

  const available = await isUsernameAvailable(username.data);
  if (!available.ok) return available;
  if (!available.data) return { ok: false, error: 'That username is already taken. Try another one.' };

  const { data, error } = await supabase!
    .from('profiles')
    .update({
      display_name: displayName,
      username: username.data,
      bio,
      avatar_url: input.avatarUrl ?? null
    })
    .eq('auth_user_id', user.data.id)
    .select('*')
    .single();

  if (error) {
    const message = error.message.toLowerCase().includes('duplicate') || error.message.toLowerCase().includes('unique')
      ? 'That username is already taken. Try another one.'
      : authErrorMessage(error.message);
    return { ok: false, error: message };
  }

  return { ok: true, data: data as ValoraProfile };
}

export async function uploadOwnAvatar(uri: string, mimeType?: string | null, fileName?: string | null): Promise<AuthResult<string>> {
  const user = await getSignedInUser();
  if (!user.ok) return user;

  const extension = fileName?.split('.').pop()?.toLowerCase() || mimeType?.split('/').pop() || 'jpg';
  const safeExtension = extension.replace(/[^a-z0-9]/g, '') || 'jpg';
  const storagePath = `${user.data.id}/avatar-${Date.now()}.${safeExtension}`;

  try {
    const response = await fetch(uri);
    const blob = await response.blob();

    const { error } = await supabase!.storage
      .from('avatars')
      .upload(storagePath, blob, {
        contentType: mimeType ?? 'image/jpeg',
        upsert: true
      });

    if (error) return { ok: false, error: authErrorMessage(error.message) };

    const { data } = supabase!.storage.from('avatars').getPublicUrl(storagePath);
    if (!data.publicUrl) return { ok: false, error: 'Avatar uploaded, but the public URL was not returned.' };

    return { ok: true, data: data.publicUrl };
  } catch {
    return { ok: false, error: 'Unable to upload avatar. Check your connection and try again.' };
  }
}
