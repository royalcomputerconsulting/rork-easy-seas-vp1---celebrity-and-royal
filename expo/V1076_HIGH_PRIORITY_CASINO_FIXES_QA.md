# V1076 High-Priority Casino Fixes QA

## What changed

- Removed RevenueCat / `react-native-purchases` from the live app dependency list.
- Replaced `state/EntitlementProvider.tsx` with a full-access no-IAP provider that preserves the existing entitlement API.
- Kept Expo New Architecture enabled.
- Hardened diagnostics so they are memory-only, do not auto-persist to AsyncStorage, and do not monkey-patch console methods.
- Removed unused diagnostics import from root layout.
- Removed `expo-linear-gradient` and direct `.split(` calls from the Casino route.
- Added centralized casino/value/certificate engines:
  - `lib/casino/pointsEarning.ts`
  - `lib/dates/appDate.ts`
  - `lib/certificates/expiration.ts`
  - `lib/certificates/instantCertificateUrls.ts`
  - `lib/certificates/certificateChaseRecommendation.ts`
  - `lib/cruise/casinoOpportunityScore.ts`
  - `lib/casino/bestPlayToday.ts`
  - `lib/analytics/hostView.ts`
  - `lib/value/cruiseValueLedger.ts`
  - `lib/value/futureValueWallet.ts`
  - `lib/value/cruiseValueCalculations.ts`
  - `lib/offers/offerCodeClassifier.ts`
  - `lib/offers/offerAttribution.ts`
  - `lib/value/trueMakeout.ts`
  - `lib/analytics/casinoValueAttribution.ts`
- Added reusable UI components for future wiring:
  - `CertificateExpirationBadge`
  - `CasinoOpportunityBadge`
  - `BestPlayTodayCard`
  - `HostViewCard`
  - `FutureValueWalletCard`
  - `OfferAttributionLedgerCard`
  - `TrueMakeoutLedgerCard`
  - `CertificateCreatedByPlayCard`
  - `KeepPlayingDecisionCard`
- Extended the casino session model with optional fields only, so old sessions keep loading.

## Guardrails preserved

- Coin-in is treated as wagering volume, not cost.
- FreePlay coin-in does not earn points by default.
- Royal reel slots use $5 per point.
- Royal video poker uses $15 per point.
- Royal table games require manual/theoretical tracking.
- FCCs reduce cash owed but are not casino comp value.
- OBC is counted once and can be tagged to a spending category.
- Expired certificates/future values remain visible for history.

## QA commands

```bash
node scripts/testV1076NativeNoRevenueCatCasino.js
node scripts/testV1076CasinoEnginesFunctional.js
```

Both passed in this workspace.

## Notes

The new engines/components are intentionally additive and low-risk. Existing screens are not radically rewritten in this build. The next safe step is to wire these engines into the existing Casino Portfolio, Cruise Value, Action Center, and History/Simulator cards one section at a time.
