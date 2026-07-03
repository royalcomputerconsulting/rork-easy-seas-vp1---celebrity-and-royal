# EasySeas v1071 — Casino All Tabs Dashboard Rebuild

## Purpose

Continue the one-tab-at-a-time Casino redesign after v1070 by rebuilding the remaining three Casino tabs while keeping the v1069 native-crash mitigation rules.

## Tabs completed

1. Casino Portfolio
2. Cruise Value
3. Casino Action Center
4. History & Simulator

## Stability rules preserved

- No import or runtime load of `CasinoAnalyticsScreenFull` from the Casino route.
- No `expo-linear-gradient` usage in the Casino route.
- No direct `.split(...)` calls in the Casino route after the Hermes native string split crash.
- Capped source rows and display rows to reduce Fabric mutation pressure.
- Uses simple React Native Views/Text/TouchableOpacity only for the Casino dashboard route.
- Logs `CASINO_V1071_ALL_TABS_DASHBOARD_MOUNTED` and `CASINO_V1071_TAB_SELECTED`.

## Cruise Value tab

Displays:

- Cruise Value Overview header.
- Total retail value.
- Total comp value.
- Total cash paid.
- Total net make-out.
- Value per $1 paid.
- Value breakdown.
- Value vs cash paid chart.
- ROI / value per dollar card.
- Cruise Economics Ledger.
- Offer Attribution Ledger.
- True Make-Out Ledger.
- Future value summary metrics.

## Casino Action Center tab

Displays:

- Casino Action Center header.
- Upcoming cruises.
- Offers attached.
- Instant certificates.
- FreePlay / perks review.
- Tasks due.
- Upcoming Cruises list.
- Offers Expiring Soon list.
- Today's Action Items checklist.
- Instant Certificate Bank.
- Casino Goals & Progress.

## History & Simulator tab

Displays:

- History & Simulator header.
- Historical casino points.
- Completed cruises.
- Total win/loss.
- Best ship by points.
- Historical Casino Points trend.
- Win/Loss History trend.
- Points Per Night Trend.
- Ship Performance History.
- Insights Overview.
- Simulator Builder.
- Results Summary.
- Keep Playing / Stop Playing Decision.

## Verification

- `npm run test:v1071-casino-all-tabs-dashboard`
- TypeScript transpile check on `app/(tabs)/analytics.tsx`

Note: older v1070 version-specific test intentionally expects `9.11.60`; v1071 is `9.11.61`.
