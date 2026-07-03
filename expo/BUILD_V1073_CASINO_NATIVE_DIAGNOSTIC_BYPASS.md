# v1073 Casino Native Diagnostic Bypass

## Why this build exists

Crash reports for v1072 showed native crashes, not ordinary React exceptions:

- `com.meta.react.turbomodulemanager.queue`
- `TurboModuleConvertUtils::convertNSExceptionToJSError`
- Hermes crashes in `stringPrototypeSplit`
- `EXC_BAD_ACCESS / SIGSEGV`

This means React error boundaries and route-level try/catch cannot reliably intercept the crash. The most likely trigger was Casino route diagnostic/native logging and automatic AsyncStorage persistence while entering a large Casino dashboard.

## Changes

- Removed all `diagnosticLogger` imports from `app/(tabs)/analytics.tsx`.
- Removed all `recordDiagnosticEvent` and `recordDiagnosticError` calls from the Casino route.
- Kept drill-downs and dashboard content.
- Disabled automatic AsyncStorage persistence in `lib/diagnosticLogger.ts` to avoid native TurboModule writes during high-volume diagnostic sessions.
- Kept in-memory diagnostics available for same-session export.
- Preserved export/clear paths for explicit user actions.
- Version bumped to 9.11.63 / 91163.

## Preserved Casino features

- Four tabs: Casino Portfolio, Cruise Value, Action Center, History & Simulator.
- Cruise rows and capped lists.
- Offer attribution.
- True make-out.
- Certificate and marketing offer classification.
- Drill-down modal for cruise, ship, metric, and calculation details.
- No legacy `CasinoAnalyticsScreenFull` import.
- No direct `.split(...)` calls in the Casino route.
- No `expo-linear-gradient` in Casino route.

## QA

- `node scripts/testV1073CasinoNoNativeDiagnostics.js` passed.
- TypeScript single-file check only showed expected missing module/alias errors in this container, plus the v1073 prop typing issue was fixed.
