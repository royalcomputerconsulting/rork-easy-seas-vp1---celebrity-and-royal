# V995 Explicit Offer Fail-Safe QA

## Purpose
Prevent a failed Step 1 offer scrape from being treated as clean completion just because the WebView sent the final resolver message.

## Fixes
- Bumped app version to `9.10.95`.
- Bumped offer scraper engine marker to `v9.9.5-offer-completeness-explicit-failsafe`.
- Added an explicit `step_failed` WebView message for Step 1 fail-safe cases.
- React Native now records the Step 1 failure reason and resolves Step 1 as not clean.
- Partial checkpoint rows from an incomplete visible-offer run are discarded before Apply Sync.
- Existing offers and available sailings are preserved when any visible current offer produces zero required ship/date rows or a known offer is short.
- Fail-safe log text is no longer hard-coded to the older 36/45-row failure case.

## Acceptance Tests
1. Run Royal Sync Now with a complete offer catalog.
   - Expected: Step 1 shows `Offer ship/date completeness verified` and Apply Sync may stage offers/sailings.
2. Run Royal Sync Now when any visible active offer returns 0 rows.
   - Expected: WebView sends `step_failed`; logs show the fail-safe reason; Apply Sync preserves existing offers and available sailings.
3. Run Royal Sync Now when checkpoint batches were received for some offers but another visible offer failed.
   - Expected: partial checkpoint rows are discarded and not applied as authoritative.
4. Bookings, completed history, and loyalty continue to sync independently.
