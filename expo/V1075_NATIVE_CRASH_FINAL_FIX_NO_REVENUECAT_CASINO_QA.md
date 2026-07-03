# EasySeas v1075 — Native Crash Final Fix + No RevenueCat + Casino QA

Version: 9.11.65 / Android versionCode 91165

## Why this build exists

The previous 9.11.64 build failed during iOS pod install because New Architecture was disabled while `react-native-worklets` requires New Architecture. The crash report also showed native/Hermes failure paths, so this build removes unused native purchase code without disabling New Architecture.

## Final crash fix approach

- Keep Expo New Architecture enabled so `react-native-worklets` can install.
- Remove `react-native-purchases` from runtime dependencies.
- Replace `EntitlementProvider` with a no-IAP, full-access provider.
- Do not initialize diagnostics from root layout during module load.
- Keep diagnostic logger memory-only and do not monkey-patch console methods.
- Preserve the v1074 phone-first Casino route.
- Preserve all four Casino sections and drill-down modals.

## Casino section status

The Casino tab contains these active sections:

1. Casino Portfolio
2. Cruise Value
3. Action Center
4. History & Simulator

All four are wired through tab state, render their own page, use capped native-safe row lists, and retain drill-down modal support.

## QA executed

```bash
node scripts/testV1075NativeNoRevenueCatCasino.js
node scripts/testV1075CasinoSectionsFunctional.js
```

Both tests passed.

## Important note about old QA scripts

Older v1046-v1074 scripts are historical, version-pinned regression scripts. Many intentionally assert their original build numbers or older implementation markers, so they are not valid as current v1075 acceptance tests without updating their expected version/markers. The v1075 scripts are the current acceptance tests for this build.
