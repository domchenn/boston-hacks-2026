# Breadcrumb mobile app (Expo)

The iOS and Android app, built with Expo (SDK 58) and Expo Router. It talks only to the Breadcrumb API, through the same typed client as the website (`@breadcrumb/contracts`).

## Run it on your iPhone

1. Install **Expo Go** from the App Store.
2. In this folder, copy the settings once: `cp .env.example .env`. That points the app at the **staging** API.
3. From the repo root: `npm install`, then `npm run start -w @breadcrumb/mobile`.
4. Scan the QR code it prints with the iPhone camera. The app opens in Expo Go and reloads as you edit.

The phone and the computer need to be on the same Wi-Fi. If they can't see each other, start with `npx expo start --tunnel` from this folder.

## Checks

From the repo root, the usual commands include the app:
- `npm run lint`: ESLint, plus `scripts/check-tokens.mjs`, which fails if the app's colours drift from `docs/styles/tokens.css`.
- `npm run typecheck`
- `npm run build`: bundles the iOS app (`expo export`), proving it builds inside the monorepo.

`npx expo-doctor` (in this folder) checks Expo's dependencies and settings.

## Notes

- **Settings** are `EXPO_PUBLIC_` variables, built into the app and readable by anyone who has it. Only public values belong there (the API address).
- **React is pinned to exactly 19.3.0** in both apps, because React Native requires the exact React version it was built with. Change the two together, using the version Expo's SDK expects.
- **Native folders** (`ios/`, `android/`) aren't committed. EAS builds generate them (M27).
