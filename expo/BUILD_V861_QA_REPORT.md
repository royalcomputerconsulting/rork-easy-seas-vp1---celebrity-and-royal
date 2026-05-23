# Easy Seas Build v8.6.1 QA Report

## Required behavior

There are two separate sync buttons and two separate workflows:

1. **SYNC NOW**
   - Syncs Club Royale offers
   - Syncs all individual offer sailings
   - Syncs upcoming cruises
   - Syncs loyalty
   - Must ignore completed-cruise loyalty history payloads unless the dedicated completed sync is running

2. **SYNC COMPLETED CRUISES**
   - Syncs completed/past cruises only
   - Opens My Account / Past cruises
   - Waits for the Past section/API payload to load
   - Captures `/guestAccounts/loyalty/history/...`
   - Parses `payload.sailings`
   - Forces captured rows to `Completed`
   - Shows the same review/confirm modal pattern before writing
   - Writes completed rows into the Booked/Completed Cruises storage

## Expected counts from provided offers.csv

- Limitless Luck / 26BCP105 — 54 rows
- Hot Hot July / 26JUL104 — 41 rows
- Variety Selection / 26VTY104 — 105 rows
- Total — 3 offers / 200 individual sailing rows

## Expected live sync counts

- SYNC NOW final extraction should show 3 offers / 200 sailings, 13 upcoming cruises, loyalty captured.
- SYNC COMPLETED CRUISES final extraction should show 55 completed/past cruises, then await Yes/No confirmation, then persist them.

## Static QA completed in sandbox

Passed checks:

- `royal-sync-now-button` exists and calls `runIngestion`.
- `royal-sync-completed-cruises-button` exists and calls `runCompletedCruisesSync(coreData)`.
- Completed sync has its own confirmation count card: `Completed / Past Cruises`.
- `SyncDataCounts` now includes `completedCruises`.
- Regular Sync Now ignores loyalty-history payloads unless completed sync is active.
- Completed sync explicitly processes `royalLoyaltyHistory` network captures.
- Completed sync directly fetches `/guestAccounts/loyalty/history/{accountId}?loyaltyNumber={loyaltyNumber}`.
- Completed sync waits after clicking/attempting Past before failing: 12 seconds + DOM fallback wait.
- Completed sync stores `completedRows.length` into the confirmation state.
- Final app write preserves `finalCompletedBookedCruises.length` in sync counts.
- Offer scraper treats every `View Sailings` button as authoritative so Variety Selection is not dropped if card parsing misses it.
- Offer scraper contains scroll/stability logic to avoid stopping after one visible row.

## Important limitation

A real Royal Caribbean login/API session cannot be executed inside this sandbox, so this QA confirms code paths, static TypeScript parsing, and the provided CSV target counts. The live end-to-end proof still requires running the build against your Royal account in the app.

## Pass/fail criteria for your live test

Fail the build if any of these appear:

- `2 offers / 2 sailings`
- `0 completed cruises`
- completed cruises appear during regular Sync Now
- Sync Completed Cruises does not show a review/confirm prompt
- Sync Completed Cruises captures rows but does not write them to Booked/Completed

Pass the build only if logs show:

```text
✅ STEP 1 COMPLETE: Captured 3 active casino offer(s) with 200 total sailing(s)
📊 SUMMARY: 3 casino offer(s) with 200 total sailing(s)
✅ STEP 2 COMPLETE: Captured 13 cruise(s) (13 booked, 0 courtesy holds)
✅ STEP 3 COMPLETE: Loyalty data captured successfully
```

And for the dedicated completed button:

```text
✅ Captured 55 completed cruise(s)
📊 SUMMARY: 55 past/completed cruise(s) found
⏳ Found 55 past cruises. Please review and confirm to sync them to your app.
✅ Data synced successfully to app!
```
