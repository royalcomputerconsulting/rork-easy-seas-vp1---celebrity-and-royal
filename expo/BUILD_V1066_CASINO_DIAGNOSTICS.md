# v1066 Casino Diagnostics

Purpose: add actionable crash logging for Casino/Analytics tab crashes.

Changes:
- Added CASINO and RENDER diagnostic categories.
- Added `recordDiagnosticError` with error name/message/stack capture.
- Installed React Native `ErrorUtils` global fatal/nonfatal error handler.
- Added unhandled promise rejection capture when supported.
- Expanded diagnostic export with a dedicated `CASINO / ANALYTICS EVENTS` section.
- Expanded error export lines to include event data and stack snippets.
- Added Analytics/Casino screen mount logs, active tab selection logs, pipeline-ready summaries, and guarded builder failure logs.
- Crash boundaries now record diagnostic events with component stack, not just console logs.

Verification:
- `node scripts/testV1066CasinoDiagnostics.js`
- TypeScript transpile check for `lib/diagnosticLogger.ts` and `app/(tabs)/analytics.tsx`.

Version: 9.11.56 / iOS build 9.11.56 / Android versionCode 91156.
