# EasySeas v1061 — Casino Page + Session Wiring Completion

## Purpose
Fix the remaining disconnected calculations on the main Casino analytics page and the Session tab.

## Changes
- Added a unified `buildAnalyticsSessionsForCasinoTabs(...)` path in `app/(tabs)/analytics.tsx`.
- Completed-cruise casino totals now become derived analytics sessions.
- Raw/manual sessions remain included only when they are not already covered by an authoritative completed-cruise casino total.
- Linked generated sessions no longer double-count completed-cruise points/win-loss when cruise totals are present.
- Official current-season Club Royale point balance still creates a balance-adjustment derived row when synced/manual current-year points exceed imported completed-cruise rows.
- Derived completed-cruise session rows no longer treat cruise fare/amount paid as casino buy-in.
- Sessions Summary win count now counts only positive win/loss rows as wins.
- Data source cards now show unified session coverage based on the same analytics session array consumed by Sessions, Charts, Intelligence, and Calcs.

## Version
- package.json: 9.11.51
- app.json expo.version: 9.11.51
- iOS buildNumber: 9.11.51
- Android versionCode: 91151

## Tests
- `node scripts/testV1061CasinoPageSessionWiring.js`
- `node scripts/testV1060CasinoCalculationFlow.js`
- TypeScript transpile checks on touched files.
