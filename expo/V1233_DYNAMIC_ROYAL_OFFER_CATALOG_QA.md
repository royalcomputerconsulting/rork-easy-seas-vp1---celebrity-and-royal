# EasySeas v12.3.3 — Dynamic Royal Offer Catalog QA

## Purpose

Fix the Royal / Club Royale offer scraper so it does not assume a fixed number of offers. The account can legitimately show 0, 1, 4, 30, or any future number of live offers. Sync must download whatever the live My Offers page exposes.

## Version

- App version: `12.3.3`
- iOS buildNumber: `12.3.3`
- Android versionCode: `120303`

## New runtime marker

`v12.3.3-dynamic-visible-offer-catalog`

## What changed

1. Removed hard-coded Royal offer-count and row-count rejection thresholds.
2. Removed the old assumption that 4 offers require ~900 rows or 5+ offers require ~1000 rows.
3. Removed reliance on fixed monthly offer row targets such as July Monthly Mix = 197.
4. Step 1 now treats Royal offer count as dynamic.
5. Zero visible offers is allowed only when the page explicitly says there are no offers.
6. If some visible offers return 0 rows but others succeed, the successful offers are staged and Apply Sync preserves existing rows for the zero-row visible offer code(s).
7. If all visible offers return 0 rows, the run is still treated as failed/suspicious and existing offers are preserved.
8. Offer catalog metadata now travels with the staged rows:
   - `catalogVisibleOfferCodes`
   - `catalogVisibleOfferCount`
   - `catalogZeroRowOfferCodes`
   - `catalogRowBearingOfferCodes`
9. Apply Sync now receives dynamic catalog metadata and distinguishes:
   - full dynamic catalog
   - partial dynamic catalog with zero-row visible offer(s)
   - authoritative empty catalog
10. A full dynamic Royal catalog can replace stale Royal offers even if there is only 1 active offer.
11. A partial dynamic Royal catalog preserves unmatched existing Royal offer rows instead of deleting a visible offer that returned 0 rows.
12. An explicitly empty live Royal catalog can clear managed Royal offers/available sailings.

## Expected behavior

- If Royal shows 0 offers and the page clearly says no offers are available, sync completes with 0 offers.
- If Royal shows 1 offer and it has rows, sync stores that 1 offer.
- If Royal shows 4 offers and one returns 0 rows, sync stores the 3 successful offers and preserves existing rows for the missing offer code if present.
- If Royal shows 30 offers, sync iterates all 30 discovered visible offer cards and downloads however many rows each has.
- No offer count by itself should ever make the run fail.
- No fixed row total by itself should ever make the run fail.

## Files changed

- `app.json`
- `package.json`
- `lib/royalCaribbean/step1_offers.ts`
- `lib/royalCaribbean/types.ts`
- `lib/royalCaribbean/syncLogic.ts`
- `state/RoyalCaribbeanSyncProvider.tsx`
- `scripts/testV1233DynamicRoyalOfferCatalog.js`

## QA scripts

Passed:

```txt
PASS testV1076NativeNoRevenueCatCasino
PASS testV1076CasinoEnginesFunctional
PASS testV1077RemainingRecommendationChanges
PASS testV1230LoyaltySyncRepair
PASS testV1231CasinoSectionWiring
PASS testV1232RoyalOfferZeroRowPreservation
PASS testV1233DynamicRoyalOfferCatalog
```
