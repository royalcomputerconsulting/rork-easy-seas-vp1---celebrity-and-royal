# v1067 Casino Safe Route Loader

## Problem
The Casino/Analytics tab still hard-crashed when opened. v1066 added diagnostics inside the Casino screen, but if the crash occurred during route/module import, those diagnostics could never run.

## Fix
- Replaced `app/(tabs)/analytics.tsx` with a lightweight safe route shell.
- Moved the full Casino screen into `components/analytics/CasinoAnalyticsScreenFull.tsx`.
- The route now loads the full screen inside a guarded `require()` call and logs:
  - `CASINO_ROUTE_SHELL_MOUNTED`
  - `CASINO_FULL_MODULE_REQUIRE_STARTED`
  - `CASINO_FULL_MODULE_REQUIRE_OK`
  - `CASINO_FULL_MODULE_REQUIRE_FAILED`
  - `CASINO_ROUTE_SHELL_RENDER_RECOVERED`
- If the full Casino module fails to import/render, the app shows a recovery fallback instead of closing.
- Removed the new Expo File/Paths API from the Casino route/module load path and switched Casino CSV export to `expo-file-system/legacy`.

## Preserved
The full Casino experience, colorful progression sections, offer attribution, true make-out, sessions, charts, forecasting, and calculation lab remain in `CasinoAnalyticsScreenFull`.

## Version
- package.json: 9.11.57
- app.json expo.version: 9.11.57
- iOS buildNumber: 9.11.57
- Android versionCode: 91157

## Verification
- `node scripts/testV1067CasinoSafeLoader.js`
- TypeScript transpile checks for:
  - `app/(tabs)/analytics.tsx`
  - `components/analytics/CasinoAnalyticsScreenFull.tsx`
  - `lib/diagnosticLogger.ts`
