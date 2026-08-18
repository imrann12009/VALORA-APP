import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LogoV } from './src/components/LogoV';
import { useValoraData } from './src/hooks/useValoraData';
import {
  ensureProfileForUser,
  getCurrentSession,
  resendEmailVerification,
  sendPasswordReset,
  sendPhoneOtp,
  signInWithEmail,
  signInWithOAuthProvider,
  signUpWithEmail,
  signOutSupabase,
  verifyPhoneOtp
} from './src/services/auth';
import { getOwnProfile, profileToCurrentUser, updateOwnProfile, uploadOwnAvatar } from './src/services/profile';
import { useAppStore } from './src/store/useAppStore';
import { colors, shadows, spacing } from './src/theme';
import type { Creator, FeedScope, MainTab, MessageThread, RootScreen, UploadDraft, VideoPost } from './src/types';

const queryClient = new QueryClient();
const { width, height } = Dimensions.get('window');
const PHONE_WIDTH = 430;
const appWidth = Math.min(width, PHONE_WIDTH);
const contentWidth = appWidth - spacing.lg * 2;
const twoColumnWidth = (contentWidth - spacing.md) / 2;
const threeColumnWidth = (contentWidth - spacing.sm * 2) / 3;

const accountCreator: Creator = {
  id: 'me',
  handle: 'imran.valora',
  displayName: 'Imran',
  avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=320&q=80',
  verified: false,
  followers: '0',
  bio: 'Building bright short videos on Valora.'
};

const uploadCovers = [
  'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=85'
];
const fallbackCover = uploadCovers[0] as string;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ValoraApp />
    </QueryClientProvider>
  );
}

function ValoraApp() {
  const data = useValoraData();
  const store = useAppStore();
  const [authResolved, setAuthResolved] = useState(false);
  const creators = useMemo<Creator[]>(
    () => [
      {
        ...accountCreator,
        handle: store.currentUser.handle,
        displayName: store.currentUser.name,
        avatarUrl: store.currentUser.avatarUrl ?? accountCreator.avatarUrl,
        bio: store.currentUser.bio
      },
      ...data.creators
    ],
    [data.creators, store.currentUser]
  );
  const videos = useMemo(() => [...store.uploadedVideos, ...data.videos], [data.videos, store.uploadedVideos]);
  const creatorsById = useMemo(
    () => Object.fromEntries(creators.map((creator) => [creator.id, creator])) as Record<string, Creator>,
    [creators]
  );

  useEffect(() => {
    let alive = true;

    async function restoreSession() {
      try {
        const session = await getCurrentSession();
        if (!alive) return;

        if (!session?.user) {
          useAppStore.setState({ signedIn: false, screen: 'welcome', tab: 'home', overlay: null });
          return;
        }

        const profile = await ensureProfileForUser(session.user);
        if (!alive) return;

        if (!profile.ok) {
          useAppStore.setState({ signedIn: false, screen: 'welcome', tab: 'home', overlay: null });
          return;
        }

        useAppStore.setState({
          signedIn: true,
          screen: 'home',
          tab: 'home',
          currentUser: {
            name: profile.data.display_name,
            handle: profile.data.username,
            bio: profile.data.bio,
            avatarUrl: profile.data.avatar_url,
            email: profile.data.email,
            phone: profile.data.phone,
            provider: profile.data.provider
          },
          toast: 'Session restored'
        });
      } finally {
        if (alive) setAuthResolved(true);
      }
    }

    restoreSession();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.appShell}>
        {!authResolved ? (
          <AuthLoadingScreen />
        ) : !store.signedIn || store.screen === 'welcome' ? (
          <WelcomeScreen />
        ) : (
          <>
            {store.screen === 'home' ? <FeedScreen videos={videos} creatorsById={creatorsById} /> : null}
            {store.screen === 'discover' ? <DiscoverScreen videos={videos} creators={creators} /> : null}
            {store.screen === 'friends' ? <FriendsScreen videos={videos} creators={creators} creatorsById={creatorsById} /> : null}
            {store.screen === 'create' || store.screen === 'upload' ? <CreateScreen /> : null}
            {store.screen === 'messages' ? <MessagesScreen creatorsById={creatorsById} threads={data.threads} /> : null}
            {store.screen === 'chat' ? <ChatScreen creatorsById={creatorsById} threads={data.threads} /> : null}
            {store.screen === 'profile' || store.screen === 'account' ? <ProfileScreen videos={videos} creators={creators} /> : null}
            {store.screen === 'notifications' ? <NotificationsScreen creatorsById={creatorsById} /> : null}
            {store.screen === 'dashboard' ? <DashboardScreen videos={videos} /> : null}
            {store.screen === 'monetization' ? <MonetizationScreen /> : null}
            {store.screen === 'settings' ? <SettingsScreen /> : null}
            {store.screen === 'saved' ? <SavedScreen videos={videos} /> : null}
            {store.screen === 'personalization' ? <PersonalizationScreen /> : null}
            {store.screen === 'story' ? <StoryScreen videos={videos} creatorsById={creatorsById} /> : null}
            {store.screen !== 'chat' && store.screen !== 'story' ? <BottomTabs /> : null}
          </>
        )}
        {store.overlay === 'comments' ? <CommentsSheet creatorsById={creatorsById} /> : null}
        {store.overlay === 'share' ? <ShareSheet creatorsById={creatorsById} /> : null}
        {store.toast ? <Toast message={store.toast} /> : null}
      </View>
    </SafeAreaView>
  );
}

function AuthLoadingScreen() {
  return (
    <View style={styles.authLoadingShell}>
      <LogoV size={104} withWordmark />
      <Text style={styles.welcomeCopy}>Checking your VALORA session...</Text>
    </View>
  );
}

function Toast({ message }: { message: string }) {
  useEffect(() => {
    const timer = setTimeout(() => useAppStore.setState({ toast: null }), 1800);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <View style={styles.toast}>
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

type AuthMode = 'welcome' | 'login' | 'signup' | 'phone' | 'forgot' | 'verify';

function WelcomeScreen() {
  const signIn = useAppStore((state) => state.signIn);
  const [mode, setMode] = useState<AuthMode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('+880');
  const [otp, setOtp] = useState('');
  const [otpPhone, setOtpPhone] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resetFeedback = () => {
    setAuthError(null);
    setAuthInfo(null);
  };

  const completeAuth = async (sessionUser: Parameters<typeof ensureProfileForUser>[0]) => {
    const profile = await ensureProfileForUser(sessionUser);
    if (!profile.ok) {
      const fallbackName =
        String(sessionUser.user_metadata?.full_name ?? sessionUser.user_metadata?.name ?? '').trim() ||
        sessionUser.phone ||
        sessionUser.email ||
        'Valora Creator';
      const fallbackHandleSeed = String(
        sessionUser.user_metadata?.preferred_username ??
        sessionUser.email?.split('@')[0] ??
        sessionUser.phone?.replace(/\D/g, '') ??
        `user_${sessionUser.id.slice(0, 8)}`
      )
        .trim()
        .replace(/^@/, '')
        .toLowerCase()
        .replace(/[^a-z0-9._]/g, '')
        .slice(0, 24);
      const fallbackHandle = fallbackHandleSeed.length >= 3 ? fallbackHandleSeed : `user_${sessionUser.id.slice(0, 8)}`;

      setAuthInfo(`Signed in. Profile sync needs attention: ${profile.error}`);
      setSuccess(true);
      setTimeout(() => {
        signIn(fallbackName, fallbackHandle, {
          avatarUrl: typeof sessionUser.user_metadata?.avatar_url === 'string' ? sessionUser.user_metadata.avatar_url : null,
          email: sessionUser.email ?? null,
          phone: sessionUser.phone ?? null,
          provider: sessionUser.app_metadata?.provider ? String(sessionUser.app_metadata.provider) : null
        });
      }, 750);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      signIn(profile.data.display_name, profile.data.username, profileToCurrentUser(profile.data));
    }, 750);
  };

  const oauth = async (provider: 'google' | 'facebook') => {
    resetFeedback();
    setAuthLoading(provider);
    const result = await signInWithOAuthProvider(provider);
    if (result.ok && result.data?.user) {
      await completeAuth(result.data.user);
    } else if (!result.ok) {
      setAuthError(result.error);
    }
    setAuthLoading(null);
  };

  const submitLogin = async () => {
    resetFeedback();
    setAuthLoading('login');
    const result = await signInWithEmail(email, password);
    if (result.ok) {
      await completeAuth(result.data.user);
    } else {
      setAuthError(result.error);
    }
    setAuthLoading(null);
  };

  const submitSignup = async () => {
    resetFeedback();
    if (password !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    setAuthLoading('signup');
    const result = await signUpWithEmail(email, password);
    if (result.ok) {
      if (!result.data.user.email_confirmed_at) {
        setMode('verify');
        setAuthInfo('Check your inbox and verify your email before continuing.');
      } else {
        await completeAuth(result.data.user);
      }
    } else if (result.error.toLowerCase().includes('verify')) {
      setMode('verify');
      setAuthInfo(result.error);
    } else {
      setAuthError(result.error);
    }
    setAuthLoading(null);
  };

  const resetPassword = async () => {
    resetFeedback();
    setAuthLoading('forgot');
    const result = await sendPasswordReset(email);
    if (result.ok) {
      setAuthInfo("If an account exists for this email, you'll receive password reset instructions.");
    } else {
      setAuthError(result.error);
    }
    setAuthLoading(null);
  };

  const resendVerification = async () => {
    resetFeedback();
    setAuthLoading('verify');
    const result = await resendEmailVerification(email);
    if (result.ok) {
      setAuthInfo('Verification email sent. Check your inbox, then return to log in.');
    } else {
      setAuthError(result.error);
    }
    setAuthLoading(null);
  };

  const requestOtp = async () => {
    resetFeedback();
    setAuthLoading('phone');
    const result = await sendPhoneOtp(phone);
    if (result.ok) {
      setOtpPhone(result.data);
      setCooldown(60);
    } else {
      setAuthError(result.error);
    }
    setAuthLoading(null);
  };

  const verifyOtp = async () => {
    if (!otpPhone) {
      setAuthError('Request an OTP first.');
      return;
    }

    resetFeedback();
    setAuthLoading('otp');
    const result = await verifyPhoneOtp(otpPhone, otp);
    if (result.ok) {
      await completeAuth(result.data.user);
    } else {
      setAuthError(result.error);
    }
    setAuthLoading(null);
  };

  return (
    <ImageBackground source={{ uri: uploadCovers[1] ?? fallbackCover }} style={styles.welcome}>
      <View style={styles.scrim} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.authScroll}>
        <LogoV size={128} withWordmark />
        {success ? (
          <View style={styles.successPanel}>
            <Text style={styles.welcomeTitle}>Welcome to VALORA</Text>
            <Text style={styles.welcomeCopy}>Your world.{"\n"}Your people.{"\n"}Your moments.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.welcomeTitle}>
              {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your VALORA account' : mode === 'forgot' ? 'Reset your password' : mode === 'verify' ? 'Verify your email' : 'Welcome to VALORA'}
            </Text>
            <Text style={styles.welcomeCopy}>
              {mode === 'login'
                ? 'Log in to continue to VALORA'
                : mode === 'signup'
                  ? 'Join VALORA and connect with people around the world.'
                  : mode === 'forgot'
                    ? 'Enter your email address and we will send reset instructions.'
                    : mode === 'verify'
                      ? `We sent a verification link to ${email || 'your email'}.`
                      : 'Your world. Your people. Your moments.'}
            </Text>

            <View style={styles.authCard}>
              {mode === 'welcome' ? (
                <>
                  <Pressable accessibilityRole="button" accessibilityLabel="Get started with VALORA" style={styles.primaryButton} onPress={() => setMode('signup')}>
                    <Text style={styles.primaryButtonText}>Get Started</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Log in to VALORA" style={styles.secondaryWideButton} onPress={() => setMode('login')}>
                    <Text style={styles.secondaryWideText}>Log In</Text>
                  </Pressable>
                  <SocialButtons oauth={oauth} authLoading={authLoading} />
                </>
              ) : null}

              {mode === 'login' ? (
                <>
                  <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                  <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
                  <Pressable accessibilityRole="button" accessibilityLabel="Log in" style={[styles.primaryButton, authLoading === 'login' && styles.disabledButton]} onPress={submitLogin} disabled={Boolean(authLoading)}>
                    <Text style={styles.primaryButtonText}>{authLoading === 'login' ? 'Logging in...' : 'Log In'}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Reset password" style={styles.linkButton} onPress={() => setMode('forgot')}>
                    <Text style={styles.linkText}>Forgot password?</Text>
                  </Pressable>
                  <SocialButtons oauth={oauth} authLoading={authLoading} />
                  <AuthFooter copy="Don't have an account?" action="Sign Up" onPress={() => setMode('signup')} />
                </>
              ) : null}

              {mode === 'signup' ? (
                <>
                  <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                  <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
                  <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
                  <Pressable accessibilityRole="button" accessibilityLabel="Create account" style={[styles.primaryButton, authLoading === 'signup' && styles.disabledButton]} onPress={submitSignup} disabled={Boolean(authLoading)}>
                    <Text style={styles.primaryButtonText}>{authLoading === 'signup' ? 'Creating...' : 'Create Account'}</Text>
                  </Pressable>
                  <SocialButtons oauth={oauth} authLoading={authLoading} />
                  <Pressable accessibilityRole="button" accessibilityLabel="Continue with phone" style={styles.secondaryWideButton} onPress={() => setMode('phone')}>
                    <Text style={styles.secondaryWideText}>Continue with Phone</Text>
                  </Pressable>
                  <AuthFooter copy="Already have an account?" action="Log In" onPress={() => setMode('login')} />
                </>
              ) : null}

              {mode === 'phone' ? (
                <>
                  <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                  <Pressable accessibilityRole="button" accessibilityLabel="Send phone OTP" style={[styles.secondaryWideButton, cooldown > 0 && styles.disabledButton]} onPress={requestOtp} disabled={Boolean(authLoading) || cooldown > 0}>
                    <Text style={styles.secondaryWideText}>
                      {authLoading === 'phone' ? 'Sending OTP...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send SMS OTP'}
                    </Text>
                  </Pressable>
                  {otpPhone ? (
                    <>
                      <Field label={`6-digit code sent to ${otpPhone}`} value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
                      <Pressable accessibilityRole="button" accessibilityLabel="Verify phone OTP" style={styles.primaryButton} onPress={verifyOtp} disabled={Boolean(authLoading)}>
                        <Text style={styles.primaryButtonText}>{authLoading === 'otp' ? 'Verifying...' : 'Verify OTP & Continue'}</Text>
                      </Pressable>
                    </>
                  ) : null}
                  <AuthFooter copy="Prefer email?" action="Log In" onPress={() => setMode('login')} />
                </>
              ) : null}

              {mode === 'forgot' ? (
                <>
                  <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                  <Pressable accessibilityRole="button" accessibilityLabel="Send reset link" style={styles.primaryButton} onPress={resetPassword} disabled={Boolean(authLoading)}>
                    <Text style={styles.primaryButtonText}>{authLoading === 'forgot' ? 'Sending...' : 'Send Reset Link'}</Text>
                  </Pressable>
                  <AuthFooter copy="Remembered it?" action="Log In" onPress={() => setMode('login')} />
                </>
              ) : null}

              {mode === 'verify' ? (
                <>
                  <Pressable accessibilityRole="button" accessibilityLabel="Resend verification email" style={styles.secondaryWideButton} onPress={resendVerification} disabled={Boolean(authLoading)}>
                    <Text style={styles.secondaryWideText}>{authLoading === 'verify' ? 'Sending...' : 'Resend Email'}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Go to login after verifying email" style={styles.primaryButton} onPress={() => setMode('login')}>
                    <Text style={styles.primaryButtonText}>I've Verified My Email</Text>
                  </Pressable>
                </>
              ) : null}

              {authInfo ? <Text style={styles.authInfo}>{authInfo}</Text> : null}
              {authError ? <Text style={styles.authError}>{authError}</Text> : null}
            </View>
          </>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

function SocialButtons({ oauth, authLoading }: { oauth: (provider: 'google' | 'facebook') => void; authLoading: string | null }) {
  return (
    <>
      <View style={styles.authDivider}><Text style={styles.authDividerText}>or continue with</Text></View>
      <View style={styles.oauthRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue with Google" style={styles.oauthButton} onPress={() => oauth('google')} disabled={Boolean(authLoading)}>
          <Text style={styles.oauthText}>{authLoading === 'google' ? 'Google...' : 'Continue with Google'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue with Facebook" style={styles.oauthButton} onPress={() => oauth('facebook')} disabled={Boolean(authLoading)}>
          <Text style={styles.oauthText}>{authLoading === 'facebook' ? 'Facebook...' : 'Continue with Facebook'}</Text>
        </Pressable>
      </View>
    </>
  );
}

function AuthFooter({ copy, action, onPress }: { copy: string; action: string; onPress: () => void }) {
  return (
    <View style={styles.authFooter}>
      <Text style={styles.authFooterCopy}>{copy}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onPress}>
        <Text style={styles.linkText}>{action}</Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  prefix,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  maxLength,
  multiline = false
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  prefix?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, multiline && styles.inputWrapMultiline]}>
        {prefix ? <Text style={styles.inputPrefix}>{prefix}</Text> : null}
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={colors.muted}
          style={styles.input}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      </View>
    </View>
  );
}

function AppHeader({ title, backTo, right = 'bell' }: { title?: string; backTo?: RootScreen; right?: 'bell' | 'search' | 'settings' | 'none' }) {
  const go = useAppStore((state) => state.go);
  return (
    <View style={styles.header}>
      <Pressable style={styles.iconButton} onPress={() => go(backTo ?? 'personalization')}>
        <Text style={styles.iconText}>{backTo ? '<' : 'Menu'}</Text>
      </Pressable>
      <View style={styles.headerBrand}>
        <LogoV size={34} />
        <Text style={styles.wordmark}>{title ?? 'VALORA'}</Text>
      </View>
      {right === 'none' ? (
        <View style={styles.iconButtonSpacer} />
      ) : (
        <Pressable style={styles.iconButton} onPress={() => right === 'search' ? go('discover') : right === 'settings' ? go('settings') : go('notifications')}>
          <Text style={styles.iconText}>{right === 'search' ? 'Find' : right === 'settings' ? 'Set' : 'Bell'}</Text>
        </Pressable>
      )}
    </View>
  );
}

function FeedScreen({ videos, creatorsById }: { videos: VideoPost[]; creatorsById: Record<string, Creator> }) {
  const feedScope = useAppStore((state) => state.feedScope);
  const setFeedScope = useAppStore((state) => state.setFeedScope);
  const followed = useAppStore((state) => state.followedCreatorIds);
  const friends = useAppStore((state) => state.friendCreatorIds);
  const scopedVideos = videos.filter((video) => {
    if (feedScope === 'following') return followed.includes(video.creatorId) || video.creatorId === 'me';
    if (feedScope === 'friends') return friends.includes(video.creatorId) || video.creatorId === 'me';
    if (feedScope === 'live') return video.isLive || video.id === videos[0]?.id;
    return true;
  });
  const visible = scopedVideos.length ? scopedVideos : videos;

  return (
    <View style={styles.feedShell}>
      <View style={styles.feedTop}>
        <LogoV size={42} />
        <View style={styles.scopeTabs}>
          {(['forYou', 'following', 'friends', 'live'] as FeedScope[]).map((scope) => (
            <Pressable key={scope} onPress={() => setFeedScope(scope)} style={[styles.scopeTab, feedScope === scope && styles.scopeTabActive]}>
              <Text style={[styles.scopeText, feedScope === scope && styles.scopeTextActive]}>{scopeLabel(scope)}</Text>
            </Pressable>
          ))}
        </View>
        <HeaderIcons />
      </View>
      <ScrollView pagingEnabled showsVerticalScrollIndicator={false}>
        {visible.map((video) => (
          <VideoPage key={video.id} video={video} creator={creatorsById[video.creatorId]} />
        ))}
      </ScrollView>
    </View>
  );
}

function scopeLabel(scope: FeedScope) {
  if (scope === 'forYou') return 'For You';
  if (scope === 'following') return 'Following';
  if (scope === 'friends') return 'Friends';
  return 'Live';
}

function HeaderIcons() {
  const go = useAppStore((state) => state.go);
  return (
    <View style={styles.headerActions}>
      <Pressable style={styles.iconButtonSmall} onPress={() => go('discover')}>
        <Text style={styles.smallIconText}>Find</Text>
      </Pressable>
      <Pressable style={styles.iconButtonSmall} onPress={() => go('notifications')}>
        <Text style={styles.smallIconText}>Bell</Text>
        <View style={styles.notifyDot} />
      </Pressable>
    </View>
  );
}

function VideoPage({ video, creator }: { video: VideoPost; creator: Creator | undefined }) {
  const toggleFollowed = useAppStore((state) => state.toggleFollowed);
  const followed = useAppStore((state) => state.followedCreatorIds.includes(video.creatorId));
  const toggleFriend = useAppStore((state) => state.toggleFriend);
  const friend = useAppStore((state) => state.friendCreatorIds.includes(video.creatorId));
  const go = useAppStore((state) => state.go);

  return (
    <ImageBackground source={{ uri: video.imageUrl }} style={styles.videoPage} imageStyle={styles.videoImage}>
      <View style={styles.videoScrim} />
      <View style={styles.liveBadge}>
        <Text style={styles.liveText}>{video.isLive ? 'LIVE' : video.privacy === 'friends' ? 'FRIENDS' : 'PUBLIC'}</Text>
      </View>
      <View style={styles.videoMeta}>
        <Pressable style={styles.creatorLine} onPress={() => go('profile')}>
          <Image source={{ uri: creator?.avatarUrl ?? accountCreator.avatarUrl }} style={styles.avatar} />
          <View style={styles.flexOne}>
            <Text style={styles.creatorName}>@{creator?.handle ?? 'creator'} {creator?.verified ? 'v' : ''}</Text>
            <Text style={styles.muted}>{video.views} views - {video.createdAt}</Text>
          </View>
        </Pressable>
        <Text style={styles.caption}>{video.caption}</Text>
        <Text style={styles.tags}>{video.tags.map((tag) => `#${tag}`).join(' ')}</Text>
        <View style={styles.soundPill}>
          <Text style={styles.soundText}>Sound: {video.sound}</Text>
        </View>
        <View style={styles.inlineActions}>
          {video.creatorId !== 'me' ? (
            <>
              <Pressable style={[styles.pillButton, followed && styles.pillButtonOn]} onPress={() => toggleFollowed(video.creatorId)}>
                <Text style={styles.pillButtonText}>{followed ? 'Following' : 'Follow'}</Text>
              </Pressable>
              <Pressable style={[styles.pillButton, friend && styles.pillButtonOn]} onPress={() => toggleFriend(video.creatorId)}>
                <Text style={styles.pillButtonText}>{friend ? 'Friend' : 'Add Friend'}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.pillButton} onPress={() => go('dashboard')}>
              <Text style={styles.pillButtonText}>Creator Tools</Text>
            </Pressable>
          )}
        </View>
      </View>
      <ActionRail video={video} />
    </ImageBackground>
  );
}

function ActionRail({ video }: { video: VideoPost }) {
  const liked = useAppStore((state) => state.likedVideoIds.includes(video.id));
  const saved = useAppStore((state) => state.savedVideoIds.includes(video.id));
  const localComments = useAppStore((state) => state.commentsByVideoId[video.id]?.length ?? 0);
  const toggleLiked = useAppStore((state) => state.toggleLiked);
  const toggleSaved = useAppStore((state) => state.toggleSaved);
  const setOverlay = useAppStore((state) => state.setOverlay);
  const selectVideo = useAppStore((state) => state.selectVideo);
  const go = useAppStore((state) => state.go);

  return (
    <View style={styles.actionRail}>
      <RailButton label={liked ? 'Liked' : 'Like'} value={countLabel(video.likes, liked ? 1 : 0)} hot={liked} onPress={() => toggleLiked(video.id)} />
      <RailButton label="Comment" value={countLabel(video.comments, localComments)} onPress={() => { selectVideo(video.id); setOverlay('comments'); }} />
      <RailButton label={saved ? 'Saved' : 'Save'} value={countLabel(video.saves, saved ? 1 : 0)} hot={saved} onPress={() => toggleSaved(video.id)} />
      <RailButton label="Share" value={video.shares} onPress={() => setOverlay('share')} />
      <RailButton label="Story" value={video.duration} onPress={() => { selectVideo(video.id); go('story'); }} />
    </View>
  );
}

function countLabel(base: string, plus: number) {
  return plus ? `${base}+${plus}` : base;
}

function RailButton({ label, value, hot, onPress }: { label: string; value: string; hot?: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.railButton} onPress={onPress}>
      <View style={[styles.railCircle, hot && styles.railCircleHot]}>
        <Text style={styles.railGlyph}>{label.slice(0, 1)}</Text>
      </View>
      <Text style={styles.railLabel}>{value}</Text>
    </Pressable>
  );
}

function DiscoverScreen({ videos, creators }: { videos: VideoPost[]; creators: Creator[] }) {
  const [query, setQuery] = useState('');
  const selectVideo = useAppStore((state) => state.selectVideo);
  const go = useAppStore((state) => state.go);
  const filtered = videos.filter((video) => `${video.title} ${video.caption} ${video.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <View style={styles.screen}>
      <AppHeader title="Discover" backTo="home" />
      <View style={styles.searchBox}>
        <Text style={styles.searchGlyph}>Q</Text>
        <TextInput value={query} onChangeText={setQuery} style={styles.searchInput} placeholder="Search creators, sounds, hashtags..." placeholderTextColor={colors.muted} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
        <SectionTitle title="Trending Videos" action="See all" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filtered.map((video) => (
            <Pressable key={video.id} style={styles.poster} onPress={() => { selectVideo(video.id); go('home'); }}>
              <Image source={{ uri: video.imageUrl }} style={styles.posterImage} />
              <Text style={styles.posterDuration}>{video.duration}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>{video.title}</Text>
              <Text style={styles.muted}>{video.views} views</Text>
            </Pressable>
          ))}
        </ScrollView>
        <SectionTitle title="Creators" action="Follow all" />
        {creators.filter((creator) => creator.id !== 'me').map((creator) => <CreatorRow key={creator.id} creator={creator} />)}
        <SectionTitle title="Hashtags" action="Explore" />
        <View style={styles.chipGrid}>
          {['NeonCity', 'DanceFlow', 'FoodTok', 'Gaming', 'Travel', 'Learning', 'LiveNow', 'ValoraMade'].map((tag) => (
            <Pressable key={tag} style={styles.hashChip}>
              <Text style={styles.hashText}>#{tag}</Text>
              <Text style={styles.muted}>{tag.length}.2M posts</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function CreatorRow({ creator }: { creator: Creator }) {
  const followed = useAppStore((state) => state.followedCreatorIds.includes(creator.id));
  const friend = useAppStore((state) => state.friendCreatorIds.includes(creator.id));
  const toggleFollowed = useAppStore((state) => state.toggleFollowed);
  const toggleFriend = useAppStore((state) => state.toggleFriend);
  return (
    <View style={styles.creatorRow}>
      <Image source={{ uri: creator.avatarUrl }} style={styles.avatarLarge} />
      <View style={styles.flexOne}>
        <Text style={styles.creatorRowName}>{creator.displayName}</Text>
        <Text style={styles.muted}>@{creator.handle} - {creator.followers} followers</Text>
      </View>
      <Pressable style={[styles.miniButton, followed && styles.miniButtonOn]} onPress={() => toggleFollowed(creator.id)}>
        <Text style={styles.miniButtonText}>{followed ? 'On' : 'Follow'}</Text>
      </Pressable>
      <Pressable style={[styles.miniButton, friend && styles.miniButtonOn]} onPress={() => toggleFriend(creator.id)}>
        <Text style={styles.miniButtonText}>{friend ? 'Friend' : 'Add'}</Text>
      </Pressable>
    </View>
  );
}

function FriendsScreen({ videos, creators, creatorsById }: { videos: VideoPost[]; creators: Creator[]; creatorsById: Record<string, Creator> }) {
  const friendIds = useAppStore((state) => state.friendCreatorIds);
  const pendingIds = useAppStore((state) => state.pendingFriendIds);
  const toggleFriend = useAppStore((state) => state.toggleFriend);
  const rejectFriend = useAppStore((state) => state.rejectFriend);
  const friendFeed = videos.filter((video) => friendIds.includes(video.creatorId));

  return (
    <View style={styles.screen}>
      <AppHeader title="Friends" backTo="home" right="search" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
        <SectionTitle title="Friend Requests" action={`${pendingIds.length} pending`} />
        {pendingIds.map((id) => {
          const creator = creatorsById[id];
          return creator ? (
            <View key={id} style={styles.friendRequest}>
              <Image source={{ uri: creator.avatarUrl }} style={styles.avatarLarge} />
              <View style={styles.flexOne}>
                <Text style={styles.creatorRowName}>{creator.displayName}</Text>
                <Text style={styles.muted}>wants to connect</Text>
              </View>
              <Pressable style={styles.primaryMini} onPress={() => toggleFriend(id)}>
                <Text style={styles.primaryMiniText}>Accept</Text>
              </Pressable>
              <Pressable style={styles.secondaryMini} onPress={() => rejectFriend(id)}>
                <Text style={styles.secondaryMiniText}>Reject</Text>
              </Pressable>
            </View>
          ) : null;
        })}
        <SectionTitle title="Suggested Friends" action="Sync contacts" />
        {creators.filter((creator) => creator.id !== 'me').map((creator) => <CreatorRow key={creator.id} creator={creator} />)}
        <SectionTitle title="Friends Feed" action="Open feed" />
        {friendFeed.length ? friendFeed.map((video) => (
          <CompactVideo key={video.id} video={video} creator={creatorsById[video.creatorId]} />
        )) : <EmptyCard title="Add friends to unlock a private friends feed." />}
      </ScrollView>
    </View>
  );
}

function CompactVideo({ video, creator }: { video: VideoPost; creator?: Creator | undefined }) {
  const selectVideo = useAppStore((state) => state.selectVideo);
  const go = useAppStore((state) => state.go);
  return (
    <Pressable style={styles.compactVideo} onPress={() => { selectVideo(video.id); go('home'); }}>
      <Image source={{ uri: video.imageUrl }} style={styles.compactImage} />
      <View style={styles.flexOne}>
        <Text style={styles.cardTitle}>{video.title}</Text>
        <Text style={styles.muted}>@{creator?.handle ?? 'creator'} - {video.views} views</Text>
        <Text style={styles.compactCaption} numberOfLines={2}>{video.caption}</Text>
      </View>
    </Pressable>
  );
}

function CreateScreen() {
  const mode = useAppStore((state) => state.composerMode);
  const setMode = useAppStore((state) => state.setComposerMode);
  const publishUpload = useAppStore((state) => state.publishUpload);
  const [draft, setDraft] = useState<UploadDraft>({
    id: `upload-${Date.now()}`,
    title: 'My first Valora',
    caption: 'new video from Valora',
    tags: ['ValoraMade', 'NewCreator'],
    imageUrl: fallbackCover,
    sound: 'Original sound - Imran',
    privacy: 'public'
  });

  const publish = () => publishUpload({ ...draft, id: `upload-${Date.now()}`, type: mode });

  return (
    <View style={styles.screen}>
      <AppHeader title="Create" backTo="home" right="none" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
        <View style={styles.modeGrid}>
          {(['video', 'photo', 'text', 'story', 'live'] as const).map((item) => (
            <Pressable key={item} style={[styles.modeCard, mode === item && styles.modeCardActive]} onPress={() => setMode(item)}>
              <Text style={styles.modeGlyph}>{item === 'video' ? 'Rec' : item.slice(0, 1).toUpperCase()}</Text>
              <Text style={styles.modeTitle}>{item === 'live' ? 'Go Live' : item === 'story' ? 'Story' : item.charAt(0).toUpperCase() + item.slice(1)}</Text>
            </Pressable>
          ))}
        </View>
        <ImageBackground source={{ uri: draft.imageUrl }} style={styles.uploadPreview} imageStyle={styles.uploadPreviewImage}>
          <View style={styles.videoScrim} />
          <LogoV size={68} />
          <Text style={styles.uploadPreviewTitle}>{mode === 'text' ? 'Share a Thought' : draft.title}</Text>
          <Text style={styles.uploadPreviewCaption}>{draft.caption}</Text>
        </ImageBackground>
        <SectionTitle title="Choose Cover" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {uploadCovers.map((cover) => (
            <Pressable key={cover} style={[styles.coverPick, draft.imageUrl === cover && styles.coverPickActive]} onPress={() => setDraft((state) => ({ ...state, imageUrl: cover }))}>
              <Image source={{ uri: cover }} style={styles.coverImage} />
            </Pressable>
          ))}
        </ScrollView>
        <Field label={mode === 'text' ? 'Thought title' : 'Title'} value={draft.title} onChangeText={(title) => setDraft((state) => ({ ...state, title }))} />
        <Field label={mode === 'text' ? 'Thought text' : 'Caption'} value={draft.caption} onChangeText={(caption) => setDraft((state) => ({ ...state, caption }))} />
        <Field label="Hashtags" value={draft.tags.join(', ')} onChangeText={(value) => setDraft((state) => ({ ...state, tags: value.split(',').map((tag) => tag.trim()).filter(Boolean) }))} prefix="#" />
        <Field label="Sound" value={draft.sound} onChangeText={(sound) => setDraft((state) => ({ ...state, sound }))} />
        <SectionTitle title="Privacy" />
        <View style={styles.segmented}>
          {(['public', 'friends', 'private'] as const).map((privacy) => (
            <Pressable key={privacy} style={[styles.segment, draft.privacy === privacy && styles.segmentActive]} onPress={() => setDraft((state) => ({ ...state, privacy }))}>
              <Text style={[styles.segmentText, draft.privacy === privacy && styles.segmentTextActive]}>{privacy}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.editorTools}>
          {['Trim', 'Text', 'Effects', 'Filters', 'Voiceover', 'Captions', 'Stickers', 'Duet', 'Green Screen', 'Schedule'].map((tool) => (
            <Pressable key={tool} style={styles.toolChip}>
              <Text style={styles.toolText}>{tool}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.publishButton} onPress={publish}>
          <Text style={styles.publishText}>{mode === 'text' ? 'Publish Thought' : 'Publish Post'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function MessagesScreen({ creatorsById, threads }: { creatorsById: Record<string, Creator>; threads: MessageThread[] }) {
  const selectThread = useAppStore((state) => state.selectThread);
  return (
    <View style={styles.screen}>
      <AppHeader title="Inbox" backTo="home" right="search" />
      <View style={styles.inboxActions}>
        <Pressable style={styles.inboxPill}><Text style={styles.inboxPillText}>New Message</Text></Pressable>
        <Pressable style={styles.inboxPill}><Text style={styles.inboxPillText}>Requests</Text></Pressable>
        <Pressable style={styles.inboxPill}><Text style={styles.inboxPillText}>Group Chat</Text></Pressable>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
        {threads.map((thread) => {
          const creator = creatorsById[thread.creatorId];
          return (
            <Pressable key={thread.id} style={styles.threadCard} onPress={() => selectThread(thread.id)}>
              <Image source={{ uri: creator?.avatarUrl ?? accountCreator.avatarUrl }} style={styles.avatarLarge} />
              <View style={styles.flexOne}>
                <Text style={styles.creatorRowName}>{creator?.displayName ?? 'Creator'}</Text>
                <Text style={styles.muted}>{thread.lastMessage}</Text>
              </View>
              <View style={styles.threadRight}>
                <Text style={styles.muted}>{thread.time}</Text>
                {thread.unread ? <Text style={styles.unreadBadge}>{thread.unread}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ChatScreen({ creatorsById, threads }: { creatorsById: Record<string, Creator>; threads: MessageThread[] }) {
  const selectedThreadId = useAppStore((state) => state.selectedThreadId);
  const go = useAppStore((state) => state.go);
  const friendIds = useAppStore((state) => state.friendCreatorIds);
  const sendMessage = useAppStore((state) => state.sendMessage);
  const sentMessages = useAppStore((state) => state.sentMessagesByThreadId[selectedThreadId] ?? []);
  const [messageText, setMessageText] = useState('');
  const { chatMessages } = useValoraData();
  const thread = threads.find((item) => item.id === selectedThreadId) ?? threads[0];
  const creator = thread ? creatorsById[thread.creatorId] : undefined;
  const isFriend = thread ? friendIds.includes(thread.creatorId) : false;
  const messages = [...chatMessages.filter((message) => message.threadId === thread?.id), ...sentMessages];
  const send = () => {
    if (!thread) return;
    sendMessage(thread.id, messageText);
    setMessageText('');
  };

  return (
    <View style={styles.chatScreen}>
      <View style={styles.chatHeader}>
        <Pressable style={styles.iconButton} onPress={() => go('messages')}><Text style={styles.iconText}>{'<'}</Text></Pressable>
        <Image source={{ uri: creator?.avatarUrl ?? accountCreator.avatarUrl }} style={styles.avatar} />
        <View style={styles.flexOne}>
          <Text style={styles.creatorName}>{creator?.displayName ?? 'Creator'}</Text>
          <Text style={styles.onlineText}>Online</Text>
        </View>
        <Text style={styles.chatAction}>Call</Text>
        <Text style={styles.chatAction}>Video</Text>
      </View>
      <ScrollView contentContainerStyle={styles.chatList}>
        <Text style={styles.chatDate}>Today</Text>
        {messages.map((message) => (
          <View key={message.id} style={[styles.messageBubble, message.mine ? styles.messageMine : styles.messageTheirs]}>
            {message.imageUrl ? <Image source={{ uri: message.imageUrl }} style={styles.messageImage} /> : null}
            <Text style={[styles.messageText, !message.mine && styles.messageTextDark]}>{message.kind === 'voice' ? `Voice message ${message.body}` : message.body}</Text>
            <Text style={[styles.messageTime, !message.mine && styles.messageTimeDark]}>{message.time}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.composer}>
        <Text style={styles.composerIcon}>Cam</Text>
        <TextInput
          value={messageText}
          onChangeText={setMessageText}
          placeholder={isFriend ? 'Message...' : 'Send one request message...'}
          placeholderTextColor={colors.muted}
          style={styles.composerInput}
        />
        <Text style={styles.composerIcon}>Mic</Text>
        <Pressable style={styles.sendButton} onPress={send}><Text style={styles.sendText}>{isFriend ? 'Send' : 'Request'}</Text></Pressable>
      </View>
    </View>
  );
}

function ProfileScreen({ videos, creators }: { videos: VideoPost[]; creators: Creator[] }) {
  const user = useAppStore((state) => state.currentUser);
  const localSignOut = useAppStore((state) => state.signOut);
  const go = useAppStore((state) => state.go);
  const myVideos = videos.filter((video) => video.creatorId === 'me');
  const liked = useAppStore((state) => state.likedVideoIds);
  const likedVideos = videos.filter((video) => liked.includes(video.id));
  const avatarUrl = user.avatarUrl ?? accountCreator.avatarUrl;

  return (
    <View style={styles.screen}>
      <AppHeader title="Profile" backTo="home" right="settings" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
        <View style={styles.profileTop}>
          <Image source={{ uri: avatarUrl }} style={styles.profileAvatar} />
          <Text style={styles.profileName}>{user.name}</Text>
          <Text style={styles.profileHandle}>@{user.handle}</Text>
          <Text style={styles.profileBio}>{user.bio}</Text>
          <View style={styles.statsRow}>
            <Stat value="128K" label="Followers" />
            <Stat value={String(creators.length - 1)} label="Following" />
            <Stat value="2.4M" label="Likes" />
          </View>
          <View style={styles.profileButtons}>
            <Pressable style={styles.primaryMini} onPress={() => go('settings')}><Text style={styles.primaryMiniText}>Edit Profile</Text></Pressable>
            <Pressable style={styles.secondaryMini} onPress={() => go('create')}><Text style={styles.secondaryMiniText}>Upload</Text></Pressable>
            <Pressable style={styles.secondaryMini} onPress={() => go('dashboard')}><Text style={styles.secondaryMiniText}>Dashboard</Text></Pressable>
          </View>
        </View>
        <View style={styles.profileAccountPanel}>
          <SettingRow label="Account" value={user.email ?? user.phone ?? 'Signed in'} />
          <SettingRow label="Provider" value={user.provider ?? 'VALORA'} />
          <SettingRow label="Username" value={`@${user.handle}`} />
        </View>
        <View style={styles.shortcutGrid}>
          <Shortcut label="Saved" screen="saved" />
          <Shortcut label="Activity" screen="notifications" />
          <Shortcut label="Personalize" screen="personalization" />
          <Shortcut label="Monetize" screen="monetization" />
        </View>
        <SectionTitle title="Your Uploads" action={`${myVideos.length} videos`} />
        {myVideos.length ? <VideoGrid videos={myVideos} /> : <EmptyCard title="No uploads yet. Create your first Valora video." />}
        <SectionTitle title="Liked Videos" />
        <VideoGrid videos={likedVideos.length ? likedVideos : videos.slice(0, 3)} />
        <Pressable
          style={styles.signOutButton}
          onPress={async () => {
            await signOutSupabase();
            localSignOut();
          }}
        >
          <Text style={styles.signOutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Shortcut({ label, screen }: { label: string; screen: RootScreen }) {
  const go = useAppStore((state) => state.go);
  return (
    <Pressable style={styles.shortcut} onPress={() => go(screen)}>
      <Text style={styles.shortcutText}>{label}</Text>
    </Pressable>
  );
}

function VideoGrid({ videos }: { videos: VideoPost[] }) {
  const selectVideo = useAppStore((state) => state.selectVideo);
  const go = useAppStore((state) => state.go);
  return (
    <View style={styles.videoGrid}>
      {videos.map((video) => (
        <Pressable key={video.id} style={styles.gridTile} onPress={() => { selectVideo(video.id); go('home'); }}>
          <Image source={{ uri: video.imageUrl }} style={styles.gridImage} />
          <Text style={styles.gridDuration}>{video.duration}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function NotificationsScreen({ creatorsById }: { creatorsById: Record<string, Creator> }) {
  const { notifications } = useValoraData();
  const localNotifications = useAppStore((state) => state.localNotifications);
  return (
    <View style={styles.screen}>
      <AppHeader title="Activity" backTo="home" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterStrip}>
        {['All', 'Likes', 'Comments', 'Follows', 'Mentions', 'Lives', 'System'].map((item, index) => (
          <Pressable key={item} style={[styles.filterChip, index === 0 && styles.filterChipActive]}>
            <Text style={[styles.filterText, index === 0 && styles.filterTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
        {localNotifications.map((title, index) => (
          <View key={`${title}-${index}`} style={styles.noticeCard}>
            <LogoV size={54} />
            <View style={styles.flexOne}>
              <Text style={styles.noticeTitle}>{title}</Text>
              <Text style={styles.muted}>just now</Text>
            </View>
            <Text style={styles.noticeAction}>Open</Text>
          </View>
        ))}
        {notifications.map((item) => (
          <View key={item.id} style={styles.noticeCard}>
            {item.actorAvatarUrl ? <Image source={{ uri: item.actorAvatarUrl }} style={styles.avatarLarge} /> : <LogoV size={54} />}
            <View style={styles.flexOne}>
              <Text style={styles.noticeTitle}>{item.title}</Text>
              <Text style={styles.muted}>{item.time}</Text>
            </View>
            <Text style={styles.noticeAction}>{item.kind === 'follow' ? 'Follow' : 'Open'}</Text>
          </View>
        ))}
        <SectionTitle title="People you may know" />
        {Object.values(creatorsById).filter((creator) => creator.id !== 'me').slice(0, 3).map((creator) => <CreatorRow key={creator.id} creator={creator} />)}
      </ScrollView>
    </View>
  );
}

function DashboardScreen({ videos }: { videos: VideoPost[] }) {
  const { metrics } = useValoraData();
  return (
    <View style={styles.screen}>
      <AppHeader title="Creator Tools" backTo="profile" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
        <View style={styles.metricGrid}>
          {metrics.map((metric) => (
            <View key={metric.id} style={[styles.metricCard, metric.tone === 'pink' && styles.metricCardPink]}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={styles.metricValue}>{metric.value}</Text>
              <Text style={styles.metricDelta}>{metric.delta} last 7 days</Text>
            </View>
          ))}
        </View>
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitleText}>Analytics</Text>
          <View style={styles.chartBars}>
            {[30, 48, 65, 54, 86, 74, 108].map((bar, index) => <View key={index} style={[styles.chartBar, { height: bar }]} />)}
          </View>
        </View>
        <SectionTitle title="Performance" action="View all" />
        {videos.slice(0, 4).map((video) => <CompactVideo key={video.id} video={video} />)}
        <View style={styles.editorTools}>
          {['Promote', 'Audience', 'Content Quality', 'Comments', 'Live Center', 'Creator Fund', 'Series', 'Shop'].map((tool) => (
            <Pressable key={tool} style={styles.toolChip}><Text style={styles.toolText}>{tool}</Text></Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function MonetizationScreen() {
  return (
    <View style={styles.screen}>
      <AppHeader title="Monetization" backTo="profile" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
        <Progress label="Followers" value="7,850 / 10,000" percent={78} />
        <Progress label="Qualified views" value="820K / 1M" percent={82} />
        <Progress label="Watch time" value="4,200 / 5,000" percent={84} />
        <View style={styles.bigPanel}>
          <LogoV size={82} />
          <Text style={styles.bigPanelTitle}>Monetization is coming soon.</Text>
          <Text style={styles.bigPanelCopy}>Creator rewards, payouts, subscriptions, tips, gifts, and brand deals are ready as locked modules.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Progress({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <View style={styles.progressCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{label}</Text>
        <Text style={styles.metricDelta}>{value}</Text>
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>
    </View>
  );
}

function SettingsScreen() {
  const user = useAppStore((state) => state.currentUser);
  const updateProfile = useAppStore((state) => state.updateProfile);
  const [name, setName] = useState(user.name);
  const [handle, setHandle] = useState(user.handle);
  const [bio, setBio] = useState(user.bio);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileInfo, setProfileInfo] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      setLoadingProfile(true);
      const result = await getOwnProfile();
      if (!alive) return;

      if (result.ok) {
        const current = profileToCurrentUser(result.data);
        useAppStore.setState({ currentUser: current });
        setName(current.name);
        setHandle(current.handle);
        setBio(current.bio);
        setAvatarUrl(current.avatarUrl);
      } else {
        setProfileError(result.error);
      }
      setLoadingProfile(false);
    }

    loadProfile();
    return () => {
      alive = false;
    };
  }, [updateProfile]);

  const chooseAvatar = async () => {
    setProfileError(null);
    setProfileInfo(null);
    setAvatarUploading(true);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setProfileError('Allow photo library access to change your profile picture.');
      setAvatarUploading(false);
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82
    });

    if (picked.canceled) {
      setAvatarUploading(false);
      return;
    }

    const asset = picked.assets[0];
    if (!asset?.uri) {
      setProfileError('No image was selected.');
      setAvatarUploading(false);
      return;
    }

    const uploaded = await uploadOwnAvatar(asset.uri, asset.mimeType, asset.fileName);
    if (uploaded.ok) {
      setAvatarUrl(uploaded.data);
      setProfileInfo('Profile photo ready. Tap Save Profile to keep it.');
    } else {
      setProfileError(uploaded.error);
    }
    setAvatarUploading(false);
  };

  const saveProfile = async () => {
    setProfileError(null);
    setProfileInfo(null);
    setSaving(true);

    const result = await updateOwnProfile({
      displayName: name,
      username: handle,
      bio,
      avatarUrl
    });

    if (result.ok) {
      updateProfile(profileToCurrentUser(result.data));
      setProfileInfo('Profile updated successfully.');
    } else {
      setProfileError(result.error);
    }
    setSaving(false);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title="Settings" backTo="profile" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
        <SettingsGroup title="Edit Profile">
          <View style={styles.avatarEditRow}>
            <Image source={{ uri: avatarUrl ?? accountCreator.avatarUrl }} style={styles.profileAvatarSmall} />
            <View style={styles.flexOne}>
              <Text style={styles.cardTitle}>Profile photo</Text>
              <Text style={styles.muted}>{avatarUploading ? 'Uploading...' : 'Square images work best.'}</Text>
            </View>
            <Pressable
              style={[styles.miniButton, avatarUploading && styles.disabledButton]}
              onPress={chooseAvatar}
              disabled={avatarUploading || saving}
            >
              <Text style={styles.miniButtonText}>{avatarUploading ? 'Wait' : 'Change'}</Text>
            </Pressable>
          </View>
          <Field label="Display name" value={name} onChangeText={setName} maxLength={60} />
          <Field label="Username" value={handle} onChangeText={setHandle} prefix="@" autoCapitalize="none" maxLength={24} />
          <Field label="Bio" value={bio} onChangeText={setBio} maxLength={160} multiline />
          {profileError ? <Text style={styles.authError}>{profileError}</Text> : null}
          {profileInfo ? <Text style={styles.authInfo}>{profileInfo}</Text> : null}
          <Pressable
            style={[styles.primaryButton, (saving || avatarUploading || loadingProfile) && styles.disabledButton]}
            onPress={saveProfile}
            disabled={saving || avatarUploading || loadingProfile}
          >
            <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : loadingProfile ? 'Loading...' : 'Save Profile'}</Text>
          </Pressable>
        </SettingsGroup>
        <SettingsGroup title="Account">
          <SettingRow label="Username" value={`@${user.handle}`} />
          <SettingRow label="Email" value={user.email ?? 'Not added'} />
          <SettingRow label="Phone" value={user.phone ?? 'Not added'} />
          <SettingRow label="Login provider" value={user.provider ?? 'VALORA'} />
        </SettingsGroup>
        <SettingsGroup title="Privacy">
          <SettingRow label="Private account" value="Off" />
          <SettingRow label="Who can message me" value="Friends" />
          <SettingRow label="Who can comment" value="Everyone" />
          <SettingRow label="Downloads" value="Followers" />
        </SettingsGroup>
        <SettingsGroup title="Content">
          <SettingRow label="Autoplay" value="On" />
          <SettingRow label="Data saver" value="Off" />
          <SettingRow label="Restricted mode" value="Off" />
          <SettingRow label="Muted words" value="Open" />
        </SettingsGroup>
        <SettingsGroup title="Safety">
          <SettingRow label="Two-factor auth" value="On" />
          <SettingRow label="Login activity" value="View" />
          <SettingRow label="Blocked accounts" value="0" />
        </SettingsGroup>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.settingsGroup}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      {children}
    </View>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.cardTitle}>{label}</Text>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  );
}

function SavedScreen({ videos }: { videos: VideoPost[] }) {
  const saved = useAppStore((state) => state.savedVideoIds);
  const savedVideos = videos.filter((video) => saved.includes(video.id));
  return (
    <View style={styles.screen}>
      <AppHeader title="Saved" backTo="profile" right="search" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterStrip}>
        {['Videos', 'Posts', 'Sounds', 'Collections', 'Effects'].map((item, index) => (
          <Pressable key={item} style={[styles.filterChip, index === 0 && styles.filterChipActive]}>
            <Text style={[styles.filterText, index === 0 && styles.filterTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.scrollPad}>
        <VideoGrid videos={savedVideos.length ? savedVideos : videos.slice(0, 6)} />
        <SectionTitle title="Collections" action="Create" />
        <View style={styles.collectionRow}>
          {['Favorites', 'Music', 'Travel', 'Inspiration'].map((item, index) => (
            <View key={item} style={styles.collectionCard}>
              <Image source={{ uri: videos[index % videos.length]?.imageUrl ?? fallbackCover }} style={styles.collectionImage} />
              <Text style={styles.cardTitle}>{item}</Text>
              <Text style={styles.muted}>{index * 7 + 12} items</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function PersonalizationScreen() {
  const selected = useAppStore((state) => state.selectedTopics);
  const toggleTopic = useAppStore((state) => state.toggleTopic);
  const topics = ['Music', 'Gaming', 'Fashion', 'Food', 'Sports', 'Beauty', 'Tech', 'Movies', 'Travel', 'Learning', 'Comedy', 'Live'];

  return (
    <View style={styles.screen}>
      <AppHeader title="Personalize" backTo="home" />
      <ScrollView contentContainerStyle={styles.scrollPad}>
        <View style={styles.bigPanel}>
          <Text style={styles.bigPanelTitle}>Tune your feed</Text>
          <Text style={styles.bigPanelCopy}>{selected.length} interests selected. These change For You, search, friends suggestions, and upload recommendations.</Text>
        </View>
        <View style={styles.chipGrid}>
          {topics.map((topic) => {
            const isOn = selected.includes(topic);
            return (
              <Pressable key={topic} style={[styles.topicChip, isOn && styles.topicChipOn]} onPress={() => toggleTopic(topic)}>
                <Text style={[styles.topicText, isOn && styles.topicTextOn]}>{topic}</Text>
              </Pressable>
            );
          })}
        </View>
        {['Muted words', 'Not interested', 'Watch history', 'Clear cache'].map((item) => <SettingRow key={item} label={item} value="Open" />)}
      </ScrollView>
    </View>
  );
}

function StoryScreen({ videos, creatorsById }: { videos: VideoPost[]; creatorsById: Record<string, Creator> }) {
  const selectedVideoId = useAppStore((state) => state.selectedVideoId);
  const go = useAppStore((state) => state.go);
  const setOverlay = useAppStore((state) => state.setOverlay);
  const video = videos.find((item) => item.id === selectedVideoId) ?? videos[0];
  const creator = video ? creatorsById[video.creatorId] : undefined;
  if (!video) return <EmptyCard title="No story selected." />;
  return (
    <ImageBackground source={{ uri: video.imageUrl }} style={styles.storyScreen}>
      <View style={styles.videoScrim} />
      <View style={styles.storyTop}>
        <Pressable style={styles.iconButton} onPress={() => go('home')}><Text style={styles.iconText}>X</Text></Pressable>
        <Text style={styles.storyTitle}>Story</Text>
        <Pressable style={styles.iconButton} onPress={() => setOverlay('share')}><Text style={styles.iconText}>S</Text></Pressable>
      </View>
      <View style={styles.storyBottom}>
        <Text style={styles.creatorName}>@{creator?.handle ?? 'creator'}</Text>
        <Text style={styles.caption}>{video.caption}</Text>
        <View style={styles.replyBox}>
          <TextInput placeholder="Reply..." placeholderTextColor={colors.muted} style={styles.replyInput} />
          <Pressable onPress={() => setOverlay('comments')}><Text style={styles.storyAction}>Like</Text></Pressable>
          <Pressable onPress={() => setOverlay('share')}><Text style={styles.storyAction}>Send</Text></Pressable>
        </View>
      </View>
    </ImageBackground>
  );
}

function CommentsSheet({ creatorsById }: { creatorsById: Record<string, Creator> }) {
  const setOverlay = useAppStore((state) => state.setOverlay);
  const selectedVideoId = useAppStore((state) => state.selectedVideoId);
  const comments = useAppStore((state) => state.commentsByVideoId[selectedVideoId] ?? []);
  const addComment = useAppStore((state) => state.addComment);
  const [commentText, setCommentText] = useState('');
  const people = Object.values(creatorsById).filter((creator) => creator.id !== 'me');
  const submitComment = () => {
    addComment(selectedVideoId, commentText);
    setCommentText('');
  };
  const allComments = [...comments, 'The lighting plus energy feels unreal', 'First save, then rewatch', 'The beat drop is perfect', 'Valora needs this on trending'];
  return (
    <View style={styles.sheet}>
      <View style={styles.grabber} />
      <View style={styles.rowBetween}>
        <Text style={styles.sheetTitle}>Comments - {allComments.length}</Text>
        <Pressable onPress={() => setOverlay(null)}><Text style={styles.sheetClose}>X</Text></Pressable>
      </View>
      {allComments.map((comment, index) => {
        const person = people[index % people.length];
        return (
          <View key={comment} style={styles.commentRow}>
            <Image source={{ uri: person?.avatarUrl ?? accountCreator.avatarUrl }} style={styles.avatar} />
            <View style={styles.flexOne}>
              <Text style={styles.creatorName}>@{person?.handle ?? 'creator'}</Text>
              <Text style={styles.commentText}>{comment}</Text>
              <Text style={styles.muted}>Like  Reply  Translate</Text>
            </View>
          </View>
        );
      })}
      <View style={styles.sheetComposer}>
        <TextInput value={commentText} onChangeText={setCommentText} placeholder="Add a comment..." placeholderTextColor={colors.muted} style={styles.composerInput} />
        <Pressable style={styles.sendButton} onPress={submitComment}><Text style={styles.sendText}>Send</Text></Pressable>
      </View>
    </View>
  );
}

function ShareSheet({ creatorsById }: { creatorsById: Record<string, Creator> }) {
  const setOverlay = useAppStore((state) => state.setOverlay);
  const people = Object.values(creatorsById).filter((creator) => creator.id !== 'me');
  return (
    <View style={styles.sheet}>
      <View style={styles.grabber} />
      <Text style={styles.sheetTitleCenter}>Send to Friends</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.peopleStrip}>
        {people.map((person) => (
          <View key={person.id} style={styles.personBubble}>
            <Image source={{ uri: person.avatarUrl }} style={styles.avatarLarge} />
            <Text style={styles.personHandle} numberOfLines={1}>{person.handle}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.shareGrid}>
        {['Copy Link', 'Repost', 'Story', 'WhatsApp', 'Facebook', 'Instagram', 'More'].map((item) => (
          <Pressable key={item} style={styles.shareAction} onPress={() => setOverlay(null)}>
            <Text style={styles.shareGlyph}>{item.slice(0, 1)}</Text>
            <Text style={styles.shareText}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function BottomTabs() {
  const tab = useAppStore((state) => state.tab);
  const setTab = useAppStore((state) => state.setTab);
  const tabs: Array<{ id: MainTab; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'friends', label: 'Friends' },
    { id: 'create', label: 'Create' },
    { id: 'messages', label: 'Inbox' },
    { id: 'profile', label: 'Profile' }
  ];

  return (
    <View style={styles.bottomTabs}>
      {tabs.map((item) => {
        const active = tab === item.id;
        return (
          <Pressable key={item.id} style={[styles.tabButton, item.id === 'create' && styles.createTab]} onPress={() => setTab(item.id)}>
            {item.id === 'create' ? (
              <Text style={[styles.tabIcon, active && styles.tabIconActive]}>+</Text>
            ) : (
              <View style={[styles.tabIndicator, active && styles.tabIndicatorActive]} />
            )}
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

function EmptyCard({ title }: { title: string }) {
  return (
    <View style={styles.emptyCard}>
      <LogoV size={54} />
      <Text style={styles.emptyText}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#02030b', alignItems: 'center' },
  appShell: {
    flex: 1,
    width: '100%',
    maxWidth: PHONE_WIDTH,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    borderLeftWidth: width > PHONE_WIDTH ? 1 : 0,
    borderRightWidth: width > PHONE_WIDTH ? 1 : 0,
    borderColor: 'rgba(255,255,255,0.12)'
  },
  flexOne: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  authLoadingShell: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bg },
  welcome: { flex: 1 },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(2,4,16,0.72)' },
  authScroll: { minHeight: height, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  welcomeTitle: { color: colors.text, fontSize: 32, fontWeight: '900', textAlign: 'center', marginTop: spacing.xl, letterSpacing: 0 },
  welcomeCopy: { color: colors.muted, fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: spacing.sm },
  authCard: { width: '100%', marginTop: spacing.xl, padding: spacing.lg, borderRadius: 22, borderWidth: 1, borderColor: colors.borderHot, backgroundColor: colors.panelGlass },
  successPanel: { width: '100%', alignItems: 'center', paddingVertical: spacing.xl },
  oauthRow: { gap: spacing.sm },
  oauthButton: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.cyan, backgroundColor: 'rgba(38,231,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  oauthText: { color: colors.text, fontWeight: '900', fontSize: 15 },
  authDivider: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xs },
  authDividerText: { color: colors.muted, fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
  authInfo: { color: colors.success, marginTop: spacing.md, fontWeight: '800', textAlign: 'center', lineHeight: 20 },
  authError: { color: colors.danger, marginTop: spacing.md, fontWeight: '800', textAlign: 'center', lineHeight: 20 },
  authFooter: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  authFooterCopy: { color: colors.muted, fontWeight: '800' },
  linkButton: { alignItems: 'center', marginTop: spacing.md, paddingVertical: spacing.sm },
  linkText: { color: colors.cyan, fontWeight: '900' },
  secondaryWideButton: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  secondaryWideText: { color: colors.text, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  field: { marginTop: spacing.md },
  fieldLabel: { color: colors.text, fontWeight: '800', marginBottom: spacing.sm },
  inputWrap: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  inputWrapMultiline: { minHeight: 104, alignItems: 'flex-start', paddingTop: spacing.md },
  inputPrefix: { color: colors.cyan, fontWeight: '900', marginRight: 2 },
  input: { flex: 1, color: colors.text, fontSize: 16, minHeight: 42 },
  primaryButton: { marginTop: spacing.lg, minHeight: 56, borderRadius: 999, backgroundColor: colors.pink, alignItems: 'center', justifyContent: 'center', ...shadows.pink },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg, paddingBottom: 96 },
  scrollPad: { paddingBottom: 130 },
  header: { height: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wordmark: { color: colors.text, fontSize: 23, fontWeight: '900', letterSpacing: 0 },
  iconButton: { width: 48, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  iconButtonSpacer: { width: 48, height: 44 },
  iconButtonSmall: { width: 42, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: colors.text, fontWeight: '900', fontSize: 11 },
  smallIconText: { color: colors.text, fontWeight: '900', fontSize: 10 },
  feedShell: { flex: 1, backgroundColor: colors.bg },
  feedTop: { position: 'absolute', zIndex: 10, top: 8, left: spacing.md, right: spacing.md, height: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scopeTabs: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(6,9,24,0.35)', borderRadius: 999, padding: 4 },
  scopeTab: { paddingHorizontal: 9, paddingVertical: 8, borderRadius: 999 },
  scopeTabActive: { backgroundColor: 'rgba(38,231,255,0.18)', borderWidth: 1, borderColor: colors.cyan },
  scopeText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  scopeTextActive: { color: colors.text },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  notifyDot: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pink },
  videoPage: { height, justifyContent: 'flex-end', backgroundColor: colors.bg },
  videoImage: { resizeMode: 'cover' },
  videoScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.26)' },
  liveBadge: { position: 'absolute', top: 84, left: spacing.lg, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: 'rgba(255,79,216,0.22)', borderWidth: 1, borderColor: colors.pink },
  liveText: { color: colors.white, fontWeight: '900' },
  videoMeta: { padding: spacing.lg, paddingRight: 92, paddingBottom: 118, gap: spacing.sm },
  creatorLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.cyan },
  avatarLarge: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: colors.pink },
  creatorName: { color: colors.text, fontSize: 17, fontWeight: '900' },
  muted: { color: colors.muted, fontSize: 13 },
  caption: { color: colors.text, fontSize: 20, fontWeight: '800', lineHeight: 27 },
  tags: { color: colors.cyan, fontSize: 16, fontWeight: '800', lineHeight: 23 },
  soundPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: 'rgba(16,23,47,0.72)', borderWidth: 1, borderColor: colors.border },
  soundText: { color: colors.text, fontWeight: '800' },
  inlineActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  pillButton: { borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.cyan, backgroundColor: 'rgba(38,231,255,0.12)' },
  pillButtonOn: { borderColor: colors.pink, backgroundColor: 'rgba(255,79,216,0.18)' },
  pillButtonText: { color: colors.text, fontWeight: '900' },
  actionRail: { position: 'absolute', right: spacing.md, bottom: 122, gap: spacing.md, alignItems: 'center' },
  railButton: { alignItems: 'center', gap: 4 },
  railCircle: { width: 54, height: 54, borderRadius: 27, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(8,12,31,0.70)', alignItems: 'center', justifyContent: 'center' },
  railCircleHot: { backgroundColor: colors.pink, ...shadows.pink },
  railGlyph: { color: colors.white, fontWeight: '900', fontSize: 20 },
  railLabel: { color: colors.text, fontSize: 12, fontWeight: '900' },
  searchBox: { height: 56, borderRadius: 18, borderWidth: 1, borderColor: colors.cyan, backgroundColor: colors.panelGlass, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  searchGlyph: { color: colors.cyan, fontWeight: '900' },
  searchInput: { flex: 1, color: colors.text, fontSize: 16 },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md },
  sectionTitleText: { color: colors.text, fontSize: 21, fontWeight: '900' },
  sectionAction: { color: colors.cyan, fontWeight: '900' },
  poster: { width: 158, marginRight: spacing.md },
  posterImage: { width: '100%', height: 210, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  posterDuration: { position: 'absolute', right: 8, top: 178, color: colors.white, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, fontWeight: '900' },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelGlass, marginBottom: spacing.sm },
  creatorRowName: { color: colors.text, fontSize: 18, fontWeight: '900' },
  miniButton: { borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  miniButtonOn: { borderColor: colors.cyan, backgroundColor: 'rgba(38,231,255,0.16)' },
  miniButtonText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hashChip: { width: twoColumnWidth, borderRadius: 16, borderWidth: 1, borderColor: colors.borderHot, padding: spacing.md, backgroundColor: colors.panelGlass },
  hashText: { color: colors.text, fontWeight: '900', fontSize: 16 },
  friendRequest: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: colors.pink, backgroundColor: colors.panelGlass, marginBottom: spacing.sm },
  primaryMini: { borderRadius: 12, backgroundColor: colors.cyan, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  primaryMiniText: { color: colors.bg, fontWeight: '900' },
  secondaryMini: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  secondaryMiniText: { color: colors.text, fontWeight: '900' },
  compactVideo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelGlass, marginBottom: spacing.sm },
  compactImage: { width: 120, height: 78, borderRadius: 12 },
  compactCaption: { color: colors.text, marginTop: spacing.xs },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  modeCard: { width: twoColumnWidth, minHeight: 112, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelGlass, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  modeCardActive: { borderColor: colors.pink, ...shadows.pink },
  modeGlyph: { color: colors.cyan, fontSize: 24, fontWeight: '900' },
  modeTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: spacing.sm },
  uploadPreview: { height: 280, borderRadius: 22, overflow: 'hidden', marginTop: spacing.lg, justifyContent: 'flex-end', padding: spacing.lg },
  uploadPreviewImage: { borderRadius: 22 },
  uploadPreviewTitle: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: spacing.md },
  uploadPreviewCaption: { color: colors.text, fontSize: 16, marginTop: spacing.xs },
  coverPick: { width: 96, height: 126, borderRadius: 14, overflow: 'hidden', marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border },
  coverPickActive: { borderColor: colors.cyan, ...shadows.cyan },
  coverImage: { width: '100%', height: '100%' },
  segmented: { flexDirection: 'row', borderRadius: 16, backgroundColor: colors.panel, padding: 4 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: 12 },
  segmentActive: { backgroundColor: 'rgba(38,231,255,0.18)', borderWidth: 1, borderColor: colors.cyan },
  segmentText: { color: colors.muted, fontWeight: '900', textTransform: 'capitalize' },
  segmentTextActive: { color: colors.text },
  editorTools: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  toolChip: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.panel },
  toolText: { color: colors.text, fontWeight: '800' },
  publishButton: { height: 58, borderRadius: 999, backgroundColor: colors.pink, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl, ...shadows.pink },
  publishText: { color: colors.white, fontSize: 18, fontWeight: '900' },
  inboxActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  inboxPill: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.panelGlass },
  inboxPillText: { color: colors.text, fontWeight: '900' },
  threadCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: colors.borderHot, backgroundColor: colors.panelGlass, marginBottom: spacing.sm },
  threadRight: { alignItems: 'flex-end', gap: spacing.sm },
  unreadBadge: { minWidth: 28, height: 28, borderRadius: 14, overflow: 'hidden', lineHeight: 28, textAlign: 'center', color: colors.white, fontWeight: '900', backgroundColor: colors.pink },
  chatScreen: { flex: 1, backgroundColor: colors.bg },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.panelGlass },
  onlineText: { color: colors.cyan, fontWeight: '800' },
  chatAction: { color: colors.text, fontWeight: '900' },
  chatList: { padding: spacing.lg, gap: spacing.md, paddingBottom: 100 },
  chatDate: { color: colors.muted, textAlign: 'center' },
  messageBubble: { maxWidth: '78%', borderRadius: 20, padding: spacing.md },
  messageMine: { alignSelf: 'flex-end', backgroundColor: colors.violet, borderWidth: 1, borderColor: colors.cyan },
  messageTheirs: { alignSelf: 'flex-start', backgroundColor: '#eef2ff' },
  messageText: { color: colors.white, fontSize: 16, lineHeight: 22 },
  messageTextDark: { color: '#111827' },
  messageTime: { color: 'rgba(255,255,255,0.70)', alignSelf: 'flex-end', marginTop: spacing.xs },
  messageTimeDark: { color: '#4b5563' },
  messageImage: { width: 220, height: 128, borderRadius: 14, marginBottom: spacing.sm },
  composer: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelGlass, paddingHorizontal: spacing.md },
  composerIcon: { color: colors.text, fontWeight: '900' },
  composerInput: { flex: 1, color: colors.text, fontSize: 16 },
  sendButton: { borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.violet },
  sendText: { color: colors.white, fontWeight: '900' },
  profileTop: { alignItems: 'center', paddingTop: spacing.md },
  profileAvatar: { width: 122, height: 122, borderRadius: 61, borderWidth: 3, borderColor: colors.cyan },
  profileAvatarSmall: { width: 74, height: 74, borderRadius: 37, borderWidth: 2, borderColor: colors.cyan, backgroundColor: colors.panel },
  profileName: { color: colors.text, fontSize: 34, fontWeight: '900', marginTop: spacing.md },
  profileHandle: { color: colors.muted, fontSize: 16 },
  profileBio: { color: colors.text, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  statBox: { minWidth: 100, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelGlass, padding: spacing.md, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  profileButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  profileAccountPanel: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelGlass, paddingHorizontal: spacing.md, marginTop: spacing.lg },
  avatarEditRow: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', paddingBottom: spacing.md, marginBottom: spacing.sm },
  shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.lg },
  shortcut: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelGlass, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  shortcutText: { color: colors.text, fontWeight: '900' },
  videoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridTile: { width: threeColumnWidth, aspectRatio: 0.72, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.panel },
  gridImage: { width: '100%', height: '100%' },
  gridDuration: { position: 'absolute', bottom: 6, right: 6, color: colors.white, fontWeight: '900', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  signOutButton: { marginTop: spacing.xl, borderRadius: 14, borderWidth: 1, borderColor: colors.borderHot, padding: spacing.md, alignItems: 'center' },
  signOutText: { color: colors.pink, fontWeight: '900' },
  filterStrip: { maxHeight: 54, marginBottom: spacing.md },
  filterChip: { height: 42, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, paddingHorizontal: spacing.lg, marginRight: spacing.sm },
  filterChipActive: { borderColor: colors.cyan, backgroundColor: 'rgba(38,231,255,0.16)' },
  filterText: { color: colors.muted, fontWeight: '900' },
  filterTextActive: { color: colors.text },
  noticeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelGlass, marginBottom: spacing.sm },
  noticeTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  noticeAction: { color: colors.cyan, fontWeight: '900' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricCard: { width: twoColumnWidth, borderRadius: 18, borderWidth: 1, borderColor: colors.cyan, backgroundColor: colors.panelGlass, padding: spacing.md, ...shadows.cyan },
  metricCardPink: { borderColor: colors.pink, ...shadows.pink },
  metricLabel: { color: colors.text, fontWeight: '900' },
  metricValue: { color: colors.text, fontSize: 30, fontWeight: '900', marginTop: spacing.sm },
  metricDelta: { color: colors.cyan, fontWeight: '900' },
  chartCard: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelGlass, padding: spacing.lg, marginTop: spacing.lg },
  chartBars: { height: 150, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', marginTop: spacing.lg },
  chartBar: { width: 26, borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: colors.pink },
  bigPanel: { borderRadius: 20, borderWidth: 1, borderColor: colors.borderHot, backgroundColor: colors.panelGlass, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.lg },
  bigPanelTitle: { color: colors.text, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  bigPanelCopy: { color: colors.muted, textAlign: 'center', lineHeight: 22, marginTop: spacing.sm },
  progressCard: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelGlass, padding: spacing.md, marginBottom: spacing.md },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden', marginTop: spacing.md },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: colors.cyan },
  settingsGroup: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelGlass, padding: spacing.md, marginBottom: spacing.md },
  settingRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  settingValue: { color: colors.cyan, fontWeight: '900' },
  collectionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  collectionCard: { width: twoColumnWidth, borderRadius: 16, borderWidth: 1, borderColor: colors.borderHot, backgroundColor: colors.panelGlass, padding: spacing.sm },
  collectionImage: { width: '100%', height: 116, borderRadius: 12, marginBottom: spacing.sm },
  topicChip: { width: twoColumnWidth, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', padding: spacing.md },
  topicChipOn: { borderColor: colors.pink, backgroundColor: 'rgba(255,79,216,0.18)' },
  topicText: { color: colors.muted, fontWeight: '900' },
  topicTextOn: { color: colors.text },
  storyScreen: { flex: 1, backgroundColor: colors.bg },
  storyTop: { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storyTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  storyBottom: { marginTop: 'auto', padding: spacing.lg, paddingBottom: spacing.xl },
  replyBox: { minHeight: 60, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelGlass, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.md, marginTop: spacing.lg },
  replyInput: { flex: 1, color: colors.text, fontSize: 16 },
  storyAction: { color: colors.cyan, fontWeight: '900' },
  sheet: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, maxHeight: '76%', borderRadius: 28, borderWidth: 1, borderColor: colors.borderHot, backgroundColor: 'rgba(20,27,56,0.97)', padding: spacing.lg, ...shadows.violet },
  grabber: { alignSelf: 'center', width: 48, height: 5, borderRadius: 3, backgroundColor: colors.muted, marginBottom: spacing.lg },
  sheetTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  sheetTitleCenter: { color: colors.text, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  sheetClose: { color: colors.text, fontSize: 22, fontWeight: '900' },
  commentRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  commentText: { color: colors.text, fontSize: 16, lineHeight: 22, marginVertical: 4 },
  sheetComposer: { minHeight: 56, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm, marginTop: spacing.lg },
  peopleStrip: { maxHeight: 102, marginVertical: spacing.lg },
  personBubble: { width: 86, alignItems: 'center', marginRight: spacing.sm },
  personHandle: { color: colors.text, fontSize: 12, marginTop: spacing.xs, maxWidth: 76 },
  shareGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  shareAction: { width: (contentWidth - spacing.md * 2) / 3, aspectRatio: 1, borderRadius: 18, borderWidth: 1, borderColor: colors.cyan, backgroundColor: colors.panelGlass, alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  shareGlyph: { color: colors.cyan, fontSize: 28, fontWeight: '900' },
  shareText: { color: colors.text, fontWeight: '800', textAlign: 'center', marginTop: spacing.sm },
  bottomTabs: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, minHeight: 72, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(16,23,47,0.96)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', ...shadows.violet },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  createTab: { transform: [{ translateY: -5 }] },
  tabIcon: { color: colors.muted, fontSize: 24, fontWeight: '900' },
  tabIconActive: { color: colors.cyan },
  tabIndicator: { width: 22, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  tabIndicatorActive: { backgroundColor: colors.cyan },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  tabTextActive: { color: colors.cyan },
  emptyCard: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelGlass, padding: spacing.xl, alignItems: 'center' },
  emptyText: { color: colors.text, fontWeight: '900', textAlign: 'center', marginTop: spacing.md },
  toast: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    top: 18,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cyan,
    backgroundColor: 'rgba(10,16,36,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    ...shadows.cyan
  },
  toastText: { color: colors.text, fontWeight: '900', textAlign: 'center' }
});
