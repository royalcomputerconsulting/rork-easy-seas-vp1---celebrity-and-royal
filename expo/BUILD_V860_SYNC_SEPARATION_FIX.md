# BUILD v8.6.1 — Sync Separation + Full Offer/Completed Cruise Fix

## Hard requirements from QA target

Regular **Sync Now** must capture only:
- 3 casino offers
- 200 individual offer sailing rows
- 13 upcoming cruises
- loyalty data

Separate **Sync Completed Cruises** must capture only:
- 55 past/completed cruises
- then show the same review/confirm flow as Sync Now before writing to the app

## Expected offer breakdown from known-good offers.csv

- Limitless Luck / 26BCP105 — 54 sailings
- Hot Hot July / 26JUL104 — 41 sailings
- Variety Selection / 26VTY104 — 105 sailings
- Total — 200 sailings

## Code changes made

### 1. `lib/royalCaribbean/step1_offers.ts`
- Made View Sailings buttons authoritative.
- If Royal reports 3 offers and renders 3 View Sailings buttons, all 3 buttons are processed even if the card parser only recognizes 2 cards.
- Added button-driven fallback so the missing Variety Selection card is not skipped.
- Replaced one-row modal scrape with repeated modal/container scrolling.
- Added repeated row accumulation until count stabilizes.
- Added support for Load More / Show More / View More / Next controls.
- Keeps collecting rows before closing each offer modal.

### 2. `state/RoyalCaribbeanSyncProvider.tsx`
- Added a separate completed-cruise sync mode flag.
- Regular Sync Now ignores loyalty history sailings so completed cruises do not bleed into the normal sync.
- Sync Completed Cruises alone parses `/guestAccounts/loyalty/history/...` payloads.
- Added reusable converter for `payload.sailings` from the Royal loyalty history endpoint.
- Completed history rows are forced to `status: Completed` and `sourcePage: Completed`.
- Sync Completed Cruises now stops at `awaiting_confirmation` and shows review/confirm instead of silently writing or silently failing.
- Removed the bad condition that required completed rows to look like upcoming booking rows.

### 3. `lib/royalCaribbean/authDetection.ts`
- Prevented the broad loyalty detector from swallowing `/guestAccounts/loyalty/history/...` as ordinary loyalty data.
- This allows the completed-cruise parser to own that endpoint.

## Required successful logs

### Sync Now
```text
✅ STEP 1 COMPLETE: Captured 3 active casino offer(s) with 200 total sailing(s)
✅ STEP 2 COMPLETE: Captured 13 cruise(s) (13 booked, 0 courtesy holds)
✅ STEP 3 COMPLETE: Loyalty data captured successfully
📊 SUMMARY: 3 casino offer(s) with 200 total sailing(s)
📊 SUMMARY: 13 cruise(s) - 13 upcoming
```

### Sync Completed Cruises
```text
🚢 ====== COMPLETED CRUISES SYNC ======
📦 Processing captured Royal Caribbean loyalty history sailings...
✅ Captured 55 completed/past cruise(s) from loyalty history sailings
✅ Captured 55 completed cruise(s)
📊 SUMMARY: 55 past/completed cruise(s) found
⏳ Found 55 past cruises. Please review and confirm to sync them to your app.
✅ COMPLETED CRUISES CAPTURE COMPLETE: awaiting Yes/No confirmation
```


## v8.6.1 QA patch
- Confirmation modal now shows Completed / Past Cruises count for the dedicated Sync Completed Cruises button.
- Final sync state preserves completedCruises count after writing to app storage.
- Completed sync log label updated to v8.6.1 so stale builds are obvious.
