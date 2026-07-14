# EasySeas v12.3.1 — Casino Section Wiring QA

Baseline: `Archive(19).zip` / version `12.3.0`.
New build: `12.3.1` / Android `120301`.

## Fixed items

1. Surfaced `BestPlayTodayCard` in Casino Action Center.
2. Surfaced `HostViewCard` in Casino Portfolio.
3. Surfaced `OfferAttributionLedgerCard` in Cruise Value.
4. Surfaced `TrueMakeoutLedgerCard` in Cruise Value.
5. Surfaced `CasinoOpportunityBadge` on portfolio and upcoming cruise rows.
6. Surfaced `CertificateExpirationBadge` on expiring offer rows and certificate-bank rows.
7. Removed `expo-linear-gradient` from the main Casino route and replaced the only Casino-route gradient usage with a safe `View`.

## Files changed

- `app/(tabs)/analytics.tsx`
- `app.json`
- `package.json`
- `scripts/testV1230LoyaltySyncRepair.js` version expectation only
- `scripts/testV1231CasinoSectionWiring.js`

## Guardrails preserved

- The Royal sync apply-staging marker remains present: `Royal offer rows are staged for Apply Sync`.
- No Casino data model or Royal sync flow was rewritten.
- Changes are wiring-only, so the working `Archive(19)` baseline remains intact.

## QA

Passed:

```txt
PASS testV1076NativeNoRevenueCatCasino
PASS testV1076CasinoEnginesFunctional
PASS testV1077RemainingRecommendationChanges
PASS testV1230LoyaltySyncRepair
PASS testV1231CasinoSectionWiring
```
