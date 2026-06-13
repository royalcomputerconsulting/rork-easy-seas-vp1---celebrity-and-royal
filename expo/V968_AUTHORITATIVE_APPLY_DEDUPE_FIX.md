# Easy Seas v968 / 9.10.68 — Authoritative Apply + Completed Cruise Visibility Fix

This build assumes the v967 collector success is proven: 5 offers / 1,073 available sailings, 13 upcoming bookings, loyalty, and 57 completed sailings from loyalty/history.

## Fixed in this build

1. Offer catalog apply is now authoritative when the Royal scrape captures the full 5-offer / ~1,073-row catalog. Existing Royal offer records are replaced instead of appended. Expected result: 5 current Royal offers, not 10.

2. Available cruise catalog apply is now authoritative when the Royal scrape captures the full catalog. Existing Royal available offer-catalog rows are replaced instead of appended. Expected result: around 1,073 Royal available offer cruises, not 2,000+.

3. Completed cruises parsed from loyalty/history are transformed as `status: completed` and `completionState: completed`, not `booked/upcoming`.

4. Compact Royal dates like `20100131` are normalized before transform so completed cruises can be displayed and counted correctly.

5. Booked/history apply now replaces the Royal booked/history lane from the authoritative sync instead of merging it on top of stale prior Royal rows. Expected result: 13 active upcoming + 57 completed history candidates, subject to non-Royal/manual preservation.

## Comparison baseline

The uploaded `offers.csv` is used only as a comparison baseline. It contains 1,073 rows across these offer codes: 2605C03A=898, 26WCR403=57, 26BCP105=54, 26JUL104=39, 26SUM203=25.
