# BUILD V882 — Rollback-Stability Sync Repair

This build removes the incorrect offers.csv/verified-baseline logic. The app no longer fabricates or pads offer rows from the sample CSV.

## Sync Now guard
- Closed offer cards with no real ship/date sailing rows are treated as a failed/partial offer extraction.
- If Step 1 sees only summary cards, it sends zero authoritative offer rows so existing offer/cruise data is preserved.
- It does not overwrite a good offer database with 3 placeholder rows.
- It does not use offers.csv as a baseline or cap.

## Completed Cruises guard
- Completed history is deduped by ship + normalized sailing date + nights.
- This fixes 54 completed cruises doubling to 108 when the same cruises appear once as MM-DD-YYYY and once as YYYY-MM-DD.
- Existing completed rows now normalize app fields including `sailingDate`, `startDate`, and `departureDate`, not just `sailDate`/`sailingStartDate`.
- Completed-only sync remains additive/update-only and does not persist offers or available cruises.

## Expected results
- Completed cruises should be 54 historical Royal rows, plus Symphony if the current-bookings payload marks it completed: expected 55, not 108.
- Sync Now should preserve existing offer rows if Royal exposes only 3 summary cards / 0 real sailing rows.
