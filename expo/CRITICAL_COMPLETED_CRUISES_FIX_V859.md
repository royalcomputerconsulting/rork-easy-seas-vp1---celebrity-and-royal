# v8.5.9 Critical Completed Cruises Sync Fix

## Root cause found from 05/07 working log
The completed cruise sync only worked when the app captured Royal Caribbean's loyalty-history sailings endpoint:

`/en/royal/web/v1/guestAccounts/loyalty/history/{accountId}?loyaltyNumber={loyaltyNumber}`

The broken standalone completed-cruises button was only trying to click My Account / Past Trips and then scrape visible DOM rows. That misses the authoritative loyalty-history payload that returned the 55 completed cruises in the working 05/07 build.

## Permanent fix applied
- Network monitor now explicitly detects `/guestAccounts/loyalty/history/` payloads.
- Those payloads are posted as `royalLoyaltyHistory`, not generic loyalty-only data.
- Sync provider now transforms `payload.sailings` into completed cruise rows.
- Completed cruise button now directly calls the loyalty-history endpoint after loading My Account, using captured account id / loyalty number / cookies / request headers.
- Existing completed cruises are preserved if Royal returns nothing.
- Duplicate completed rows are deduped by booking id + ship + sail date.

## Expected successful log markers
- `📡 Fetching completed cruises directly from loyalty history endpoint`
- `📡 Completed history endpoint status: 200`
- `📦 Processing captured Royal Caribbean loyalty history sailings...`
- `✅ Captured 55 completed/past cruise(s) from loyalty history sailings`
- `✅ Completed cruises persisted to storage`

## Notes
This preserves the working May 7 behavior but moves it under the dedicated Completed Cruises button.
