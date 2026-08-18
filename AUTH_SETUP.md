# Valora Production Auth Setup

Valora uses Supabase Auth for email/password, Google, Facebook, and phone OTP.

No OAuth client secret, SMS provider token, or database password belongs in frontend source code.

## Environment Variables

Create `.env.local`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_DEV_AUTH_REDIRECT_URL=http://localhost:8083
EXPO_PUBLIC_AUTH_REDIRECT_URL=https://your-production-domain.com
```

## Database

Run `supabase/schema.sql` in Supabase SQL editor. It creates `profiles` with:

- `auth_user_id` unique link to `auth.users`
- unique `username`
- unique `email` and `phone`
- RLS policies so authenticated users can create/update only their own profile

## Email And Password

1. In Supabase Dashboard > Authentication > Providers, enable Email.
2. Configure confirmation emails for production.
3. Add the redirect URLs from the environment section to Supabase Auth URL configuration.
4. Confirm password policy settings in Supabase and keep the app UX aligned with that policy.

Supabase handles password hashing, session persistence, verification emails, and password reset links. The app never stores passwords manually.

## Google OAuth

1. In Google Cloud Console, create an OAuth client.
2. Add Supabase callback URL:
   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
3. In Supabase Dashboard > Authentication > Providers > Google:
   - enable Google
   - add Google client ID
   - add Google client secret
4. In Supabase Auth URL configuration, add redirect URLs:
   - development: `http://localhost:8083`
   - production: your production URL
   - native: `valora://auth/callback` if using device deep links

## Facebook Login

1. In Meta Developer Dashboard, create an app and enable Facebook Login.
2. Add Supabase OAuth callback:
   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
3. In Supabase Dashboard > Authentication > Providers > Facebook:
   - enable Facebook
   - add Facebook App ID
   - add Facebook App Secret
4. Add the same development, production, and native redirect URLs in Supabase.

## Phone OTP

The app expects international E.164 phone numbers:

```text
+8801712345678
+14155552671
+447700900123
```

Configure SMS in Supabase Dashboard > Authentication > SMS provider. Use a production provider such as Twilio or MessageBird, and configure the provider credentials in Supabase, not in this app.

Supabase Auth handles:

- secure OTP generation
- OTP expiration
- token verification server-side
- SMS delivery through the configured provider
- built-in abuse controls

The app adds frontend cooldown and friendly error UI.

## Test Flows

Google:

1. Click `Continue with Google`.
2. Complete Google consent.
3. Return to Valora.
4. Confirm a `profiles` row exists for the authenticated user.

Facebook:

1. Click `Continue with Facebook`.
2. Complete Facebook consent.
3. Return to Valora.
4. Confirm no duplicate profile is created for the same auth user.

Phone OTP:

1. Enter a valid E.164 phone number such as `+8801712345678`.
2. Click `Send SMS OTP`.
3. Enter the received 6-digit code.
4. Confirm session restore works after refresh.

Email:

1. Click `Get Started`.
2. Enter an email and password.
3. Confirm the verification email arrives.
4. Return to Valora and log in after verification.
5. Use `Forgot password?` to send a reset email.

Logout:

1. Open Profile.
2. Click `Log Out`.
3. Confirm Supabase session is cleared and Valora returns to auth.
