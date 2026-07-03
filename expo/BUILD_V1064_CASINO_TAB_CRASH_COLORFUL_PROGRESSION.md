# EasySeas v1064 — Casino Tab Crash Fix + Colorful Progression UI

## Goals

- Stop the Casino tab from crashing when opened.
- Harden the four casino sections against null/undefined loyalty, local data, metrics, dates, and child-card render errors.
- Preserve the v1060-v1063 calculation, attribution, sessions, and forecast displays.
- Add colorful chart/progression sections to each casino page.

## Key fixes

- Added `CasinoTabCrashBoundary` around active casino section rendering so a card-level display issue does not close the app.
- Added safe helpers for numbers, arrays, dates, and percentages.
- Replaced unsafe `clubRoyaleNextResetDate.toLocaleDateString(...)` with `formatSafeDateLabel(...)` so synced string/null reset dates cannot crash the page.
- Replaced unsafe `localData.booked` and `localData.offers` reads with optional/safe-array access.
- Hardened current-season metric rendering with `safeNumber(...).toFixed(...)`.
- Guarded workflow hero metric rendering with `safeArray(...)`.

## New UI

Added `Colorful Charts & Progression Levels` sections to all four casino pages:

- Portfolio
- Value
- Play
- Forecast

These sections visualize:

- Signature/Club Royale progression
- Masters progression
- Certificate ladder progress
- Net make-out vs retail value
- Future value created
- PPH target progress
- Session points coverage

## Tests

Added:

- `scripts/testV1064CasinoTabCrashUi.js`
- `npm run test:v1064-casino-tab-crash-ui`

Also updated prior regression tests for the new version number.

## Version

- package.json: 9.11.54
- app.json expo.version: 9.11.54
- iOS buildNumber: 9.11.54
- Android versionCode: 91154
