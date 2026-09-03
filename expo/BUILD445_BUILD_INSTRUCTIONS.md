# Easy Seas 13.0.74 (Build 445) — Reproducible Build Instructions

## Requirements

- Node.js 20.x
- npm from the Node.js installation
- EAS CLI authenticated to the intended Expo account
- For local native builds: a current full Xcode installation selected with `xcode-select`

The project uses Expo SDK 54. Expo Doctor must report 18/18 checks before submission.

## Verify the source

From the extracted source folder:

```sh
npm ci
npx tsc --noEmit --pretty false
npm_config_cache=/tmp/easyseas-npm-cache npx -y expo-doctor
npm run verify:source-release
CI=1 npx expo export --platform ios --output-dir /tmp/easyseas-build445-ios-export
```

Expected identity:

- App version: 13.0.74
- Local iOS build: 445
- Android version code: 130107
- Expo SDK: 54

## Build for TestFlight with EAS

```sh
npx eas-cli build --platform ios --profile production
```

The production profile uses remote auto-increment, so EAS may assign a build number above 445 if 445 already exists in App Store Connect.

The verified September 2 build was assigned iOS build 448. EAS build ID: `e5f6c7c7-6198-44bc-9654-51a7bded27e0`.

When the build completes:

```sh
npx eas-cli submit --platform ios --latest
```

## Local Xcode alternative

Only use this route after installing full Xcode and accepting its license:

```sh
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
sudo xcodebuild -runFirstLaunch
npx expo prebuild --clean --platform ios
open ios/*.xcworkspace
```

Archive in Xcode with the production signing team, validate the archive, then distribute it to App Store Connect.

## Required device smoke test

Before promoting the TestFlight build, exercise all seven tabs plus Agent SEA, certificate download/examiner/export, offer and cruise detail, Day Agenda map/weather, Royal/Celebrity sync, completed-history import, Save All, Load Encrypted Backup, recovery-key copy/paste/restore, Trust issue export, native share sheets, and document pickers. Test at least one small and one large supported iPhone size with VoiceOver, large text, high contrast, reduced motion, and the keyboard.
