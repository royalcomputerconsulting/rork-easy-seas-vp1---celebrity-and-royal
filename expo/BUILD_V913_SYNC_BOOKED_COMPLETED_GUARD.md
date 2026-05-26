# Easy Seas v913 / 9.10.19 — Sync Now booking-preservation + completed-history guard

Built after reviewing last 62/63 logs and the working v861/v882 Sync Now behavior.

## Version
- expo.version: 9.10.19
- ios.buildNumber: 9.10.19
- android.versionCode: 9119

## Sync Now
- Does not replace booked/completed cruises when Step 2 returns 0 rows.
- `setBookedCruises()` is skipped on zero booking capture every time, not only when existing booked rows are already visible in the current context.
- Prevents offer-only Sync Now runs from wiping existing booked/completed storage.
- Leaves the v912/v861/v882 offer row fill in place: current verified baseline is 1,145 rows because that is what the available uploaded CSV + verified baseline currently contains.

## Completed Cruise Sync
- No hard-coded max of 54/57.
- Final completed-history dedupe no longer collapses completed rows by ship + date only.
- Existing booked rows with a past sail/return date are treated as completed-history candidates when Royal exposes 0 completed-history rows but the visible Past tab shows more rows than stored history.
- This is designed to recover recent sailings such as cruises that moved from Upcoming to Past but were not yet marked `completed` in app storage.

## Not changed
- SeaPass rendering from v909.
- Final logo assets from v911.
- The working completed-cruise scraping flow is not capped and remains wait-for-stable-history based.
