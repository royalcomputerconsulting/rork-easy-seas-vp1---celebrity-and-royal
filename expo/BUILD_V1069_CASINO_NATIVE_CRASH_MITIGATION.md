# v1069 Casino Native Crash Mitigation

## Crash report interpretation

The macOS/TestFlight crash report showed a native SIGSEGV on the React Native JavaScript thread, not a normal JavaScript exception:

- Thread: `com.facebook.react.runtime.JavaScript`
- Engine: Hermes
- Failing frame: `hermes::vm::stringPrototypeSplit`
- Main-thread secondary activity: React Fabric `calculateShadowViewMutations`

Because this is a native Hermes/Fabric crash, React error boundaries and route-level try/catch blocks cannot reliably catch it. The Casino route must avoid the high-risk rendering/calculation shape rather than only wrapping it.

## What changed

- Rebuilt `app/(tabs)/analytics.tsx` as a lightweight native-crash-safe Casino screen.
- Removed the legacy heavy analytics module load from the Casino tab route.
- Removed Expo LinearGradient/native gradient usage from Casino tab startup.
- Removed direct `.split(` calls from the Casino route.
- Removed heavy `buildCruiseEconomicsSummary` and `buildCasinoValueAttributionSummary` calls from Casino route mount.
- Capped rendered cruise/session rows to avoid huge Fabric mount diffs.
- Kept the four sections: Portfolio, Value, Play, Forecast.
- Kept lightweight offer classification, point-cost classification, value/make-out calculations, colorful progress bars, and high-value cruise/session display.
- Added native-crash-specific diagnostic event: `CASINO_SAFE_NATIVE_CRASH_MITIGATION_MOUNTED`.

## Verification

- `npm run test:v1069-casino-native-crash-mitigation`
- TypeScript transpile check for `app/(tabs)/analytics.tsx`

## Version

- package.json: `9.11.59`
- app.json: `9.11.59`
- iOS buildNumber: `9.11.59`
- Android versionCode: `91159`
