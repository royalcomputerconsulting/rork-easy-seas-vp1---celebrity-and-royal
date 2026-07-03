# v1072 Casino Dashboard Drill-Downs

## Purpose
Adds tap/click drill-downs to the rebuilt Casino dashboard so summary numbers, cruise rows, offer/certificate rows, ship performance cards, and simulator/result calculations open an in-depth detail panel instead of remaining static.

## Key changes
- Added a native-crash-safe detail modal to `app/(tabs)/analytics.tsx`.
- Added reusable `DetailPayload` / `DetailLine` detail model.
- Added `buildCruiseDetail`, `buildMetricDetail`, and `buildShipDetail` helpers.
- Wired click/tap handlers into Casino Portfolio metrics, cruise rows, ship cards, ship performance rows, Cruise Value ledger rows, Offer Attribution rows, True Make-Out rows, Action Center upcoming/offer/certificate rows, and History ship rows.
- Detail panels explain formulas and guardrails, including that coin-in is wagering volume, not cost.
- Added diagnostics when a drill-down is opened: `CASINO_V1072_DETAIL_OPENED`.
- Preserved v1069/v1071 native crash mitigation: no legacy heavy analytics import, no native gradient dependency, no direct `.split(...)` calls, and capped rendered rows.

## QA
- `node scripts/testV1072CasinoDrilldowns.js`
- TypeScript transpile check for `app/(tabs)/analytics.tsx`
