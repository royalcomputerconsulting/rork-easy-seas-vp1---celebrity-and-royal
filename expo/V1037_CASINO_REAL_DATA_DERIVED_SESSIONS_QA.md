# V1037 Casino Real Data + Derived Sessions QA

## Build

- App version: 9.11.28
- iOS buildNumber: 9.11.28
- Android versionCode: 91128
- Scope: Casino tab Sessions, Charts, and Calcs data-source correctness.

## Problem addressed

The Casino tab needed to stop mixing real data and calculated values without clearly explaining the source. Sessions, Charts, and Calcs now favor actual cruise-level casino economics first and use derived sessions only as a way to split known totals when individual session records are missing.

## Data hierarchy implemented

1. Actual completed cruise rows win first.
2. Tracked casino sessions are used when present.
3. Derived sessions are generated only from known cruise totals.
4. Estimates are labeled as mixed/estimated instead of presented as fully actual.

## Session generation rules

- Uses canonical cruise casino points from `getBookedCruiseCasinoPoints`.
- Uses actual cruise win/loss from winnings brought home, winnings, total winnings, net result, or cash result.
- Generated session points add back to the cruise point total.
- Generated session win/loss adds back to the cruise win/loss total.
- Coin-in remains points × $5 and is never counted as profit/value.
- Auto-generated session notes say they were calculated from cruise totals.

## UI changes

- Added a data-source card to the Charts tab.
- Added a data-source card to the Sessions tab.
- Added a data-source card to the Calcs tab.
- Each card shows actual/mixed/estimated cruise rows, tracked session count, derivable cruise rows, points, and win/loss totals.

## Calculator hardening

- Historical Calcs mode now keeps session-derived risk/win-loss metrics scoped to historical cruise sessions instead of using unrelated current sessions.
- Historical mode continues to use completed cruise economics totals for points, cash result, paid amount, retail value, coin-in, and total economic value.

## Manual

- `USERMANUAL.md` updated with Casino Tab Data Rules — Actual vs Derived.
- `components/UserManualModal.tsx` updated with data-source/derived-session rules.

## QA performed

- Static syntax transpile check passed for:
  - `app/(tabs)/analytics.tsx`
  - `lib/historicalSessionCalculator.ts`
  - `components/UserManualModal.tsx`
- Version metadata confirmed as 9.11.28 / 91128.
- Full Expo TypeScript check could not run in this container because the archive does not include the installed Expo base tsconfig/dependency type environment.

## Files changed

- `app/(tabs)/analytics.tsx`
- `lib/historicalSessionCalculator.ts`
- `USERMANUAL.md`
- `components/UserManualModal.tsx`
- `app.json`
- `package.json`
- `app/(tabs)/settings.tsx`
