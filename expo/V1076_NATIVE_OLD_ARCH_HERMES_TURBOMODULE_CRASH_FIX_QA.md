# EasySeas v1076 — Hermes/TurboModule Native Crash Fix + Casino QA

Version: 9.11.66 / Android versionCode 91166

## Crash investigated

The crash report for build 9.11.65 (288) is not a normal React render crash. It shows:

- `Triggered by Thread: com.facebook.react.runtime.JavaScript`
- `EXC_BAD_ACCESS (SIGSEGV)` in `hermes::vm::HadesGC::writeBarrierSlow`
- repeated `hermes::vm::JSError::recordStackTrace` frames
- a parallel `com.meta.react.turbomodulemanager.queue` frame converting a native `NSException` to a JSI error
- the app running as an iOS app on Apple Silicon macOS (`UIKitMacHelper`, `MacFamily` variant)

That means a native TurboModule exception is being thrown during startup, and Hermes crashes while React Native tries to convert/record the error. The previous v1075 approach removed RevenueCat but left New Architecture enabled because `react-native-worklets` forced it.

## Fix applied

- Removed unused `react-native-worklets` dependency.
- Set `expo.newArchEnabled` to `false` so the app no longer uses the New Architecture TurboModule path that appears in the crash report.
- Kept `react-native-purchases` removed.
- Kept the no-IAP full-access EntitlementProvider.
- Kept memory-only diagnostics and no console monkey-patching.
- Kept the v1075 lightweight Casino route with all four sections.

## Casino section status

The Casino tab still contains these active sections:

1. Casino Portfolio
2. Cruise Value
3. Action Center
4. History & Simulator

All four sections remain wired, native-safe, and capped for mobile rendering.

## QA executed locally

```bash
node scripts/testV1076NativeOldArchCasino.js
node scripts/testV1075CasinoSectionsFunctional.js
```

Both tests passed locally in this codebase.
