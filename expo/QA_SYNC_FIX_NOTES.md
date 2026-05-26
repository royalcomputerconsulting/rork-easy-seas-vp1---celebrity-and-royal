# v885 Sync Capture Restore QA Notes

This build restores the working Sync Now capture pattern from the successful 8.6.2-era logs while keeping the completed-cruise button fixes.

## Royal Caribbean offer QA target from supplied offers.csv
The supplied Royal Caribbean offers CSV contains 201 rows:
- 26BCP105 Limitless Luck: 54 sailings
- 26JUL104 Hot Hot July: 40 sailings
- 26VTY104 Variety Selection: 107 sailings

The app must not treat the visible offer cards as real sailing rows. If Step 1 sees cards but no ship/date rows, it must preserve existing data rather than writing zero. The WebView now injects the network monitor before content loads and again after every Royal/Celebrity page load so the real /api/casino/v2/offers/merged payload is captured before View Sailings extraction.

## Completed-cruise QA target
Completed history must dedupe by ship + normalized sail date, not generated booking id. The 54-row completed history must not inflate to 108 when the same rows appear in both MM-DD-YYYY and YYYY-MM-DD formats.

## Safety guards
- Failed offer capture preserves existing offers and available sailings.
- Failed booked/upcoming capture preserves existing booked cruises.
- Completed-only sync is additive and preserves active/upcoming bookings.
- Royal and Celebrity page loads reinstall the same capture hooks.
