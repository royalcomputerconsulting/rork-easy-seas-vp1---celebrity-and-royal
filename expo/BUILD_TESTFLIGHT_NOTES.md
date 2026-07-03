# EasySeas v1050 Build / Load Notes

This build is prepared to build and submit cleanly through EAS/TestFlight.

## What was fixed

- `package.json` version is `9.11.40`.
- `app.json` `expo.version` is also `9.11.40`.
- `app.json` iOS manifest `buildNumber` is also `9.11.40`.
- Android `versionCode` is `91140`.
- EAS project ID is configured in `app.json` so EAS does not need to relink the project.
- `eas.json` is included with production build and submit profiles.
- App Store Connect app ID is included in `eas.json` submit profile.
- AgentX `buildCasinoIntelligenceContextText()` crash fix remains in place.
- Preflight script added: `npm run test:v1050-build-load`.

## Correct clean build commands

```bash
rm -rf node_modules
bun install
npm run test:v1050-build-load
npm run test:v1049-agentx-context-fix
npm run test:v1048-forecasting
npm run test:v1047-casino-tabs
eas build -p ios --profile production --clear-cache
```

## Correct submit command

Use the IPA URL returned by the most recent `eas build` command:

```bash
eas submit -p ios --profile production --path "PASTE_THE_NEW_EAS_IPA_URL_HERE"
```

Do not submit an App Store Connect web page URL. It must be the `.ipa` artifact URL from Expo.

## Notes from the failed commands

- `Failed to resolve plugin for module "expo-router"` happens when `node_modules` is missing or incomplete. Run `bun install` first.
- `You've already submitted this version` happens when `expo.version` was not incremented. This build increments it to `9.11.40`.
- `Zip end of central directory signature not found` happened because a web page URL was passed to `--path` instead of an `.ipa` URL.
