# Breadcrumb mobile app (Expo)

The iOS and Android app, built with Expo (SDK 58) and Expo Router. It talks only to the Breadcrumb API, through the same typed client as the website (`@breadcrumb/contracts`).

## Run it on your iPhone

1. Install **Expo Go** from the App Store.
2. In this folder, copy the settings once: `cp .env.example .env`. That points the app at the **staging** API.
3. From the repo root: `npm install`, then `npm run start -w @breadcrumb/mobile`.
4. Scan the QR code it prints with the iPhone camera. The app opens in Expo Go and reloads as you edit.

The phone and the computer need to be on the same Wi-Fi. If they can't see each other, start with `npx expo start --tunnel` from this folder.

## Install it as a real app (your own iPhone, free)

This builds the app on your Mac and installs it over the cable, signed with your Apple ID. It gets its own icon and runs without the Mac. With a free Apple ID, it stops opening after **7 days**; run the command again to reinstall. (TestFlight, which needs the $99 Apple Developer Program, comes with M27.)

**Once:**
- Xcode → Settings → Accounts: add your Apple ID. Then select it → **Manage Certificates** → **+** → **Apple Development**.
- Plug the iPhone in and tap **Trust**.
- On the iPhone, turn on **Developer Mode** (Settings → Privacy & Security → Developer Mode); the phone restarts.

**Each install:**
```sh
cd apps/mobile
npx expo run:ios --device --configuration Release
```
Pick your iPhone and your Apple ID's team if asked. The first build takes about 10 minutes.

The first time the app opens, iOS says "Untrusted Developer". Fix it in Settings → General → VPN & Device Management → your Apple ID → **Trust**.

The app uses the API address from `.env`, which is staging. It's built into the app, so changing it means building again.

The app's permanent ID is **`boston.breadcrumb.app`** (`ios.bundleIdentifier` / `android.package` in `app.json`). It can't change once the app is on the App Store.

## Checks

From the repo root, the usual commands include the app:
- `npm run lint`: ESLint, plus `scripts/check-tokens.mjs`, which fails if the app's colours drift from `docs/styles/tokens.css`.
- `npm run typecheck`
- `npm run build`: bundles the iOS app (`expo export`), proving it builds inside the monorepo.

`npx expo-doctor` (in this folder) checks Expo's dependencies and settings.

## What's in the app so far

- **Tabs**, as in the style guide: **Explore · Map · + · Saved · You**. The **+** (Make a trail) is a raised orange button.
- **Explore:** the trail list. **Saved:** your saved and started trails (signed in). **You:** your name, Edit profile and Log out.
- **Map** and **Make a trail** are placeholders for now.
- **Log in / Create account** with email and password. New accounts pick a username next, as on the website.
- **The login session is stored encrypted on the phone,** as Supabase's Expo guide recommends: the key is in the iPhone Keychain (expo-secure-store), and the encrypted session is in AsyncStorage. Everything else goes through the API, which gets the signed-in user's access token.
- **Shared building blocks** in `src/components`: `AppText` (the type scale), `Button`, `TextField`, `StateView` (loading, empty and error states), `TrailCard` and `TabBar`. Use them instead of styling screens directly, so restyling later stays a small change.

## Notes

- **Settings** are `EXPO_PUBLIC_` variables, built into the app and readable by anyone who has it. Only public values belong there: the API address and the Supabase URL and publishable key, which the website ships too.
- **React is pinned to exactly 19.3.0** in both apps, because React Native requires the exact React version it was built with. Change the two together, using the version Expo's SDK expects.
- **Native folders** (`ios/`, `android/`) aren't committed. EAS builds generate them (M27).
