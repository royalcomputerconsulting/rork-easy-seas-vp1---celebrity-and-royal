# Easy Seas 12.4.2 App Store Version Fix QA

## Reason

App Store Connect rejected marketing version `9.17.1` with `ITMS-90062` because the previously approved version is `12.3.7`. Apple compares the numeric components of `CFBundleShortVersionString`; therefore any `9.x.x` version is lower than `12.3.7`.

## Corrected values

- Expo / iOS marketing version (`CFBundleShortVersionString`): `12.4.2`
- iOS build number (`CFBundleVersion`): `310`
- Android versionCode: `120401`
- package.json version: `12.4.2`

## Release checks

- `app.json` contains `expo.version = 12.4.2`.
- `app.json` contains `expo.ios.buildNumber = 310`.
- `app.json` contains `expo.android.versionCode = 120401`.
- The bundle identifier remains unchanged.
- Carnival synchronization remains administrator-only.
- No application functionality was altered for this metadata-only repair.

## Important build-service note

If the build service uses remote version management, confirm the generated archive still reports marketing version `12.4.2`. A remote build counter may replace `CFBundleVersion`; that is acceptable if it is unique, but it must not replace `CFBundleShortVersionString` with `9.17.1`.
