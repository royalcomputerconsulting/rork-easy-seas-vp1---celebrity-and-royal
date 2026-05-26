# Easy Seas v914 / 9.10.20 — Sync Now working Step 2 capture restore

Based on v913, with Sync Now offer engine left intact and the completed-cruise sync path left untouched.

## Changes

- Incremented app metadata to 9.10.20 / Android 9120.
- Restored the proven May 6 / QA Step 2 capture surface for Sync Now:
  - `/account/upcoming-cruises`
  - `/myaccount/my-trips`
  - `/myaccount`
  - `/account/courtesy-holds`
  - `/account/loyalty-programs`
  - `/account`
- Restored multi-cycle Step 2 probing for Royal (3 cycles), matching the behavior from the log that captured 14 bookings and loyalty.
- Kept `/myaccount` and the hydrated-page upcoming extractor as fallback, not the only trigger.
- Restored Star of the Seas ship-code aliases in the Step 2 extractor.

## Not changed

- Sync Completed Cruises code/path was not rebuilt.
- Sync Now Step 1 offer engine and 1,145-row provider fill were not changed.
- SeaPass generator was not changed.
- Logo assets were not changed.

## Expected result

The log should keep the good Step 1 behavior:

- 5 casino offers
- 1,145 available cruises

And Step 2 should return to the working behavior from the QA build:

- capture upcoming bookings from Royal profileBookings/voyage enrichment endpoints
- capture loyalty from the Royal loyalty endpoints
- preserve existing booked/completed cruises if Royal still returns zero
