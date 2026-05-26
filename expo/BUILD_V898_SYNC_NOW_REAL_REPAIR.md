# Easy Seas v898 / 9.10.4 Sync Now Repair

This build is based on v897 and re-reads the full Sync Now thread findings:

- v861/v8.6.1 is the proven offer baseline: 3 offers / 200 sailings.
- v8.6.3 fixed multi-date expansion and DOM+API merge behavior.
- May 8 builds proved the network monitor/upcoming/completed/loyalty foundation.
- Completed-cruise sync is working and was not changed.

## Fixes in this build

1. App version incremented in `app.json`:
   - `expo.version`: `9.10.4`
   - `ios.buildNumber`: `9.10.4`
   - `android.versionCode`: `9104`

2. Sync Now Step 1 offer parser fixed:
   - Uses the v861 button-driven approach again.
   - Processes real View Sailings buttons instead of relying on parsed-card count.
   - Does not treat `READY TO PLAY?` / casino-credit banners as offers.
   - Fixes the v897 bug that skipped real Hot Hot July / West Coast buttons because their ancestor text also contained banner text.
   - Re-allows sequential page-offer mapping for real buttons whose nearest card text is too broad, while skipping explicit banner buttons.
   - Keeps memory-safe chunking for large offers.

3. Sync Now Step 2 monitor reinjection:
   - Reinstalls Royal network capture immediately after `/myaccount` navigation before waiting for bookings or injecting the hydrated upcoming-cruise extractor.
   - This targets the `window.capturedPayloads: MISSING` failure in `last 49.log`.

## Expected log markers

- `Offer sync engine v8.9.8 active`
- Real offers should not be skipped just because a surrounding container includes `READY TO PLAY?`.
- `READY TO PLAY?` should never appear as an offer name.
- `/myaccount` should no longer show `window.capturedPayloads: MISSING` after the post-navigation monitor reinstall.

