import type { Provider, Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { hasSupabaseConfig, supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export type AuthResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ValoraProfile = {
  id?: string;
  auth_user_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string;
  phone: string | null;
  email: string | null;
  provider: string | null;
};

const usernamePattern = /^[a-z0-9._]{3,24}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireSupabase() {
  if (!hasSupabaseConfig || !supabase) {
    return 'Supabase env missing. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';
  }

  return null;
}

// Small helper used for provider-specific messages
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function getRedirectUrl() {
  if (Platform.OS !== 'web') {
    return 'valora://auth/callback';
  }

  const configured =
    process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ??
    process.env.EXPO_PUBLIC_DEV_AUTH_REDIRECT_URL;

  if (configured) return configured;

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'valora://auth/callback';
}

export function normalizeBangladeshPhone(input: string): AuthResult<string> {
  const raw = input.trim().replace(/[\s()-]/g, '');
  let phone = raw;

  if (phone.startsWith('01')) phone = `+88${phone}`;
  if (phone.startsWith('880')) phone = `+${phone}`;

  if (!/^\+8801[3-9]\d{8}$/.test(phone)) {
    return { ok: false, error: 'Enter a valid Bangladesh phone number, for example +8801712345678.' };
  }

  return { ok: true, data: phone };
}

export function normalizePhoneNumber(input: string): AuthResult<string> {
  const phone = input.trim().replace(/[\s().-]/g, '');

  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    return { ok: false, error: 'Enter an international phone number in E.164 format, for example +8801712345678.' };
  }

  return { ok: true, data: phone };
}

export function validateEmail(email: string): AuthResult<string> {
  const cleaned = email.trim().toLowerCase();
  if (!emailPattern.test(cleaned)) return { ok: false, error: 'Enter a valid email address.' };
  return { ok: true, data: cleaned };
}

export function validatePassword(password: string): AuthResult<string> {
  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }

  return { ok: true, data: password };
}

export async function signUpWithEmail(emailInput: string, password: string): Promise<AuthResult<Session>> {
  const missing = requireSupabase();
  if (missing) return { ok: false, error: missing };

  const email = validateEmail(emailInput);
  if (!email.ok) return email;

  const validPassword = validatePassword(password);
  if (!validPassword.ok) return validPassword;

  const { data, error } = await supabase!.auth.signUp({
    email: email.data,
    password,
    options: {
      emailRedirectTo: getRedirectUrl()
    }
  });

  if (error) return { ok: false, error: authErrorMessage(error.message) };
  if (!data.session) return { ok: false, error: 'Check your email to verify your account before logging in.' };

  return { ok: true, data: data.session };
}

export async function signInWithEmail(emailInput: string, password: string): Promise<AuthResult<Session>> {
  const missing = requireSupabase();
  if (missing) return { ok: false, error: missing };

  const email = validateEmail(emailInput);
  if (!email.ok) return email;

  if (!password) return { ok: false, error: 'Enter your password.' };

  const { data, error } = await supabase!.auth.signInWithPassword({
    email: email.data,
    password
  });

  if (error) return { ok: false, error: authErrorMessage(error.message) };
  if (!data.session) return { ok: false, error: 'Unable to restore a session. Please try again.' };

  return { ok: true, data: data.session };
}

export async function sendPasswordReset(emailInput: string): Promise<AuthResult> {
  const missing = requireSupabase();
  if (missing) return { ok: false, error: missing };

  const email = validateEmail(emailInput);
  if (!email.ok) return email;

  const { error } = await supabase!.auth.resetPasswordForEmail(email.data, {
    redirectTo: getRedirectUrl()
  });

  if (error) return { ok: false, error: authErrorMessage(error.message) };
  return { ok: true, data: undefined };
}

export async function resendEmailVerification(emailInput: string): Promise<AuthResult> {
  const missing = requireSupabase();
  if (missing) return { ok: false, error: missing };

  const email = validateEmail(emailInput);
  if (!email.ok) return email;

  const { error } = await supabase!.auth.resend({
    type: 'signup',
    email: email.data,
    options: {
      emailRedirectTo: getRedirectUrl()
    }
  });

  if (error) return { ok: false, error: authErrorMessage(error.message) };
  return { ok: true, data: undefined };
}

export function validateUsername(username: string): AuthResult<string> {
  const cleaned = username.trim().replace(/^@/, '').toLowerCase();
  if (!usernamePattern.test(cleaned)) {
    return {
      ok: false,
      error: 'Username must be 3-24 chars using lowercase letters, numbers, dot, or underscore.'
    };
  }

  return { ok: true, data: cleaned };
}

export async function signInWithOAuthProvider(provider: 'google' | 'facebook'): Promise<AuthResult<Session | null>> {
  const missing = requireSupabase();
  if (missing) return { ok: false, error: missing };

  const redirectTo = getRedirectUrl();

  // Validate redirectTo
  if (Platform.OS === 'web') {
    const configured =
      process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ??
      process.env.EXPO_PUBLIC_DEV_AUTH_REDIRECT_URL;

    if (!configured && !(typeof window !== 'undefined' && window.location?.origin)) {
      return {
        ok: false,
        error:
          'Web redirect URL is not configured. Set EXPO_PUBLIC_AUTH_REDIRECT_URL or EXPO_PUBLIC_DEV_AUTH_REDIRECT_URL in .env.local (see AUTH_SETUP.md).'
      };
    }
  } else {
    // Native: ensure we use app scheme (valora://)
    if (!redirectTo || !redirectTo.startsWith('valora://')) {
      return {
        ok: false,
        error:
          'Native redirect URI is not configured for the app scheme (expected valora://auth/callback). Ensure app.json includes "scheme": "valora" and native intent filters / URL types are configured.'
      };
    }
  }

  const { data, error } = await supabase!.auth.signInWithOAuth({
    provider: provider as Provider,
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web'
    }
  });

  if (error) return { ok: false, error: authErrorMessage(error.message) };

  // On web, Supabase will handle redirect back to the configured URL
  if (Platform.OS === 'web') return { ok: true, data: null };
  if (!data?.url) return { ok: false, error: `Unable to start ${provider} sign-in. Please try again.` };

  try {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) {
      // user cancelled or no callback URL
      return { ok: false, error: `${capitalize(provider)} sign-in was cancelled before completion.` };
    }

    const callbackUrl = new URL(result.url);

    // Provider errors first
    const oauthError = callbackUrl.searchParams.get('error_description') ?? callbackUrl.searchParams.get('error');
    if (oauthError) return { ok: false, error: authErrorMessage(oauthError) };

    // Primary: code in query params
    let code = callbackUrl.searchParams.get('code');

    // Fallback: some providers surface values in the hash. Only accept 'code' from hash.
    if (!code && callbackUrl.hash) {
      try {
        const hash = callbackUrl.hash.startsWith('#') ? callbackUrl.hash.slice(1) : callbackUrl.hash;
        const params = new URLSearchParams(hash);
        if (params.has('code')) {
          code = params.get('code');
        } else if (params.has('access_token')) {
          // Never accept implicit access_token for PKCE. Ask for server/provider config change.
          return {
            ok: false,
            error: `${capitalize(provider)} returned an access token in the URL fragment. Configure Supabase and the provider to return an authorization code (PKCE) so the app can securely exchange it.`
          };
        }
      } catch {
        // fallthrough to missing-code error
      }
    }

    if (!code) {
      return { ok: false, error: `${capitalize(provider)} sign-in did not return an authorization code.` };
    }

    const { data: sessionData, error: exchangeError } = await supabase!.auth.exchangeCodeForSession(code);
    if (exchangeError) return { ok: false, error: authErrorMessage(exchangeError.message) };
    if (!sessionData.session) {
      return { ok: false, error: `${capitalize(provider)} sign-in completed but no session was returned.` };
    }

    return { ok: true, data: sessionData.session };
  } catch {
    return { ok: false, error: `${capitalize(provider)} sign-in failed. Please try again.` };
  } finally {
    // Ensure any OS-level auth session is cleaned up
    try {
      WebBrowser.maybeCompleteAuthSession();
    } catch {
      // swallow any errors - nothing we can do here
    }
  }
}

export async function linkOAuthProvider(provider: 'google' | 'facebook'): Promise<AuthResult> {
  const missing = requireSupabase();
  if (missing) return { ok: false, error: missing };

  const { error } = await supabase!.auth.linkIdentity({
    provider: provider as Provider,
    options: {
      redirectTo: getRedirectUrl()
    }
  });

  if (error) return { ok: false, error: authErrorMessage(error.message) };
  return { ok: true, data: undefined };
}

export async function sendPhoneOtp(phoneInput: string): Promise<AuthResult<string>> {
  const missing = requireSupabase();
  if (missing) return { ok: false, error: missing };

  const normalized = normalizePhoneNumber(phoneInput);
  if (!normalized.ok) return normalized;

  const { error } = await supabase!.auth.signInWithOtp({
    phone: normalized.data,
    options: {
      shouldCreateUser: true
    }
  });

  if (error) return { ok: false, error: authErrorMessage(error.message) };
  return { ok: true, data: normalized.data };
}

export async function verifyPhoneOtp(phone: string, token: string): Promise<AuthResult<Session>> {
  const missing = requireSupabase();
  if (missing) return { ok: false, error: missing };

  if (!/^\d{6}$/.test(token.trim())) {
    return { ok: false, error: 'Enter the 6-digit OTP code.' };
  }

  const { data, error } = await supabase!.auth.verifyOtp({
    phone,
    token: token.trim(),
    type: 'sms'
  });

  if (error) return { ok: false, error: authErrorMessage(error.message) };
  if (!data.session) return { ok: false, error: 'OTP verified but no session was returned. Please try again.' };

  return { ok: true, data: data.session };
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function ensureProfileForUser(user: User): Promise<AuthResult<ValoraProfile>> {
  const missing = requireSupabase();
  if (missing) return { ok: false, error: missing };

  const provider = user.app_metadata?.provider ? String(user.app_metadata.provider) : null;
  const email = user.email ?? null;
  const phone = user.phone ?? null;
  const displayName =
    String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? '').trim() ||
    phone ||
    email ||
    'Valora Creator';
  const usernameSeed = validateUsername(
    String(user.user_metadata?.preferred_username ?? email?.split('@')[0] ?? phone?.replace(/\D/g, '') ?? `user_${user.id.slice(0, 8)}`)
  );
  const username = usernameSeed.ok ? usernameSeed.data : `user_${user.id.slice(0, 8)}`;

  const profile: ValoraProfile = {
    auth_user_id: user.id,
    display_name: displayName,
    username,
    avatar_url: typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null,
    bio: 'Creator on Valora.',
    phone,
    email,
    provider
  };

  const { data: existing, error: existingError } = await supabase!
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (existingError) return { ok: false, error: authErrorMessage(existingError.message) };
  if (existing) return { ok: true, data: existing as ValoraProfile };

  const { data, error } = await supabase!
    .from('profiles')
    .insert(profile)
    .select('*')
    .single();

  if (error) {
    if (error.message.toLowerCase().includes('duplicate') || error.message.toLowerCase().includes('unique')) {
      return { ok: false, error: 'Username or identity already exists. Please sign in with the original method.' };
    }
    return { ok: false, error: authErrorMessage(error.message) };
  }

  return { ok: true, data: data as ValoraProfile };
}

export async function signOutSupabase() {
  if (!hasSupabaseConfig || !supabase) return;
  await supabase.auth.signOut();
}

export function authErrorMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) return 'Unable to sign in with those credentials. Please check your information and try again.';
  if (lower.includes('already registered') || lower.includes('already exists') || lower.includes('different provider')) {
    return 'This email is already connected to a VALORA account. Log in with the existing method, then connect this provider from account settings.';
  }
  if (lower.includes('password')) return 'That password does not meet VALORA account requirements.';
  if (lower.includes('otp') || lower.includes('token')) return 'Invalid or expired OTP. Request a new code and try again.';
  if (lower.includes('rate') || lower.includes('too many')) return 'Too many attempts. Please wait before trying again.';
  if (lower.includes('network') || lower.includes('fetch')) return 'Network error. Check your connection and try again.';
  if (lower.includes('provider')) return 'This login provider is not configured yet.';
  return message || 'Authentication failed. Please try again.';
}
