# Easy Seas v900 / 9.10.6 Sync Now coded-button repair

This build patches the failures shown in the 05/25/2026 15:55–16:01 Sync Now log.

## Fixed

- Incremented app metadata to 9.10.6 (`expo.version`, `ios.buildNumber`, `android.versionCode` 9106).
- Rebuilt Sync Now offer-card mapping so page-level text like `My Offers` or nearby `READY TO PLAY?` banner text cannot veto a real coded offer.
- A View Sailings button is processed when it maps to a real casino offer code such as `26JUL104`.
- `READY TO PLAY?` / casino-credit controls are skipped only when their compact bounded button context has no casino offer code.
- Removed the duplicate `pageOffers.forEach` block that had been accidentally introduced in the prior generated raw script.
- Added Step 2 recovery for missing `window.capturedPayloads`:
  - `window.capturedPayloads` is initialized before checks.
  - Step 2 waits longer for hydration.
  - If the monitor missed the payload, the extractor scans `performance.getEntriesByType('resource')` for Royal `profileBookings` URLs and re-fetches them with cookies.

## Not changed

- Completed-cruise sync path remains untouched.
- Logo/header remains untouched.
- Existing preserve-on-partial-sync rules remain in place.

## Expected markers

- `Offer sync engine v9.0.0 active`
- Real coded offers should no longer be skipped with `Hot Hot July26JUL104...` in the skip log.
- Step 2 should show `window.capturedPayloads: EXISTS` and may also show `Recovered ... bookings by re-fetching profileBookings performance URL` if the monitor misses the initial network response.
