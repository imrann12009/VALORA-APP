# Valora

Valora is a short-video social app built with React Native, Expo, TypeScript, Supabase, Zustand, and React Query.

The app runs immediately with local content data. Add Supabase environment variables when you want live authentication.

## Run

```bash
npm install
npm run start
```

## Browser Preview

Expo native mode at `localhost:8081` can show a JSON manifest. For the actual interface in a browser, export and serve the web build:

```bash
npx expo export --platform web --output-dir dist
python3 -m http.server 8083 -d dist
```

Open `http://localhost:8083`.

## Supabase

Create `.env.local` from `.env.example`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Then run the SQL in `supabase/schema.sql` in your Supabase SQL editor. The table columns intentionally match the app's TypeScript field names.

For email/password, Google, Facebook, and phone OTP configuration, see `AUTH_SETUP.md`.

## Screens And Features

- Production-oriented auth portal with email/password, OAuth, phone OTP, password reset, email verification prompts, and session restoration
- TikTok-style vertical video feed with For You, Following, Friends, and Live filters
- Like, comment, save, share, story, follow, and add-friend actions
- Friend requests, suggested friends, friends feed
- Discover/search with trends, creators, hashtags, sounds
- Upload/create flow with cover, caption, tags, sound, privacy, editor tools, publish
- Inbox, message requests, group-chat entry, and chat screen
- Profile with uploads, liked videos, saved, settings, activity, dashboard
- Creator analytics, monetization readiness, privacy/safety/settings, personalization

The Valora logo is the glowing blue/magenta V mark on a dark squircle (`assets/hlogo.png`), used as the app icon, splash, and in-app branding.
