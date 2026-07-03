# EasySeas v1062 — Offer Attribution + Casino Tab Restructure

## Version
- package.json: 9.11.52
- app.json expo.version: 9.11.52
- iOS buildNumber: 9.11.52
- Android versionCode: 91152

## Added engines
- `lib/offers/offerCodeClassifier.ts`
  - Classifies instant certificates vs marketing offers vs annual cruise/FCC/NextCruise/FreePlay perk.
  - Encodes the Royal instant certificate point ladder.
  - Treats non-instant codes as marketing offers by default.
- `lib/offers/offerAttribution.ts`
  - Attaches offer code/type/point cost/source/confidence to booked cruises.
- `lib/casino/certificateEarningChain.ts`
  - Links completed cruise play to instant certificates used on booked cruises when possible.
- `lib/value/trueMakeout.ts`
  - Calculates gross value, actual cash cost, coin-in volume, casino win/loss, and net make-out.
- `lib/analytics/casinoValueAttribution.ts`
  - Combines attribution, earning chains, and make-out into one shared analytics summary.
- `lib/migration/offerAttributionBackfill.ts`
  - Safely normalizes old offer-code field names without deleting originals.

## Added UI components
- `components/value/OfferAttributionLedgerCard.tsx`
- `components/value/TrueMakeoutLedgerCard.tsx`
- `components/casino/CertificateCreatedByPlayCard.tsx`
- `components/casino/KeepPlayingDecisionCard.tsx`

## Casino tab restructure
Existing internal keys remain for route stability, but user-facing labels are now:
1. Portfolio
2. Value
3. Play
4. Forecast

Mapped purpose:
- Portfolio = casino portfolio, completed cruise ledger, offer attribution, make-out overview.
- Value = cruise economics, offer attribution, true make-out, future value wallet, ROI/risk charts.
- Play = sessions, derived completed-cruise sessions, certificate-created-by-play, PPH/gamification/goals.
- Forecast = keep-playing decision, casino strength, certificate forecasting, host view, calculation lab.

## AgentX
Added `offer-attribution-true-makeout` context block so AgentX can answer:
- Which offer booked this cruise?
- Is it an instant certificate or marketing offer?
- How many points did it cost?
- Which cruise likely earned it?
- What was my true make-out?

## Guardrails encoded
- Coin-in is volume, not cost.
- Actual cost is fare/taxes/onboard spend plus casino net loss.
- Casino net wins increase make-out.
- FCC is payment credit, not casino comp value.
- OBC is counted once.
- Marketing offers and annual cruises have zero point cost unless explicitly marked otherwise.

## Verification
- `node scripts/testV1062OfferAttributionCasinoTabs.js` passed.
- TypeScript transpile checks passed for touched TS/TSX files.
- v1061 test was not re-run to completion because it intentionally asserts the previous version number 9.11.51.
