# V12.3.0 Loyalty / Points Sync Repair QA

## Build metadata

- App version: `12.3.0`
- iOS build number: `12.3.0`
- Android version code: `120300`

## Problem found from latest log

The latest log showed that the sync saw multiple different payloads under the broad `loyalty` bucket:

1. `/api/casino/v1/loyalty-data` with keys `message, data`.
2. `/guestAccounts/loyalty/history/...` with keys `sailings`.

The history endpoint is useful for completed cruises, but it is not the authoritative Crown & Anchor / Club Royale tier-and-points endpoint. The app was treating any `loyalty` payload as if loyalty tier/points had been captured. That could close the loyalty capture path too early, causing the direct `loyalty/info` fallback to be skipped and preventing Club Royale / Crown & Anchor points from being updated.

## Fixes applied

- Set version baseline to `12.3.0` and Android `120300`.
- Added `hasMeaningfulExtendedLoyaltyData()` guard so only payloads with real tier/point values mark loyalty as captured.
- Added `isHistoryOnlyLoyaltyPayload()` so `/loyalty/history` sailings can still repair completed cruises without being mistaken for tier/points data.
- Updated the direct fallback JavaScript so existing captured payloads are only accepted if they contain tier or point fields.
- Added support for the `/api/casino/v1/loyalty-data` nested `{ message, data }` style and common Club Royale aliases:
  - `currentTierCredits`
  - `tierCredits`
  - `tierCreditBalance`
  - `currentClubTier`
  - `currentTier`
- Added Crown & Anchor aliases for account widgets:
  - `cruisePoints`
  - `cruiseCredits`
- Kept generic tier aliases away from Crown & Anchor so a casino `Signature` tier cannot be misread as a Crown & Anchor tier.

## Expected sync behavior after this fix

- Completed cruise history from `/loyalty/history` still imports.
- A history-only payload no longer sets `capturedSections.current.loyalty = true`.
- Sync continues to the loyalty page and/or direct loyalty info fetch until it gets actual tier/point values.
- Club Royale points/tier update from either the casino loyalty widget/API or the account loyalty/info endpoint.
- Crown & Anchor points/tier update from the loyalty/info endpoint or account widget scrape.
- If the site only provides completed-sailing history and no tier/points, existing loyalty values are preserved instead of overwritten by blanks.

## QA scripts

```bash
node scripts/testV1076NativeNoRevenueCatCasino.js
node scripts/testV1076CasinoEnginesFunctional.js
node scripts/testV1077RemainingRecommendationChanges.js
node scripts/testV1230LoyaltySyncRepair.js
```
