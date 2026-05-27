# Build v927 / 9.10.33 — Royal Sync Rebuild QA

## Scope
Rebuilt from `easyseas_v926_ios_export_fix_9_10_32_FULL_CODEBASE(2).zip` and kept the full Expo app structure intact.

## Implemented
- Bumped app/build version to 9.10.33 and Android versionCode to 9133.
- Updated Royal Caribbean primary account route from `/account/upcoming-cruises` to `/myaccount`.
- Updated Royal loyalty route to `/myaccount/loyalty-programs`.
- Advanced Royal offer sync engine marker from v9.2.5 to v9.2.7.
- Hardened Step 1 offer extraction:
  - Royal v2 merged/facets endpoints remain first-class sources.
  - Direct offer-detail DOM parser added for `View Sailings` pages.
  - Re-queries `View Sailings` buttons by offer code instead of relying on stale indexes.
  - Expands `View details` / `Show details` rows before parsing.
  - Parses Royal grouped date blocks such as `Dates 2026 Jun 13, Jun 20 ... 2027 Feb 7, Feb 14 ...`.
  - Parses rows where dates appear before the ship name, as seen on current Royal offer detail pages.
  - Extracts itinerary and departure port from expanded detail text when present.
- Hardened network monitor:
  - Captures `/api/casino/v2/offers/facets` in addition to `/api/casino/v2/offers/merged`.
  - Captures `/profileBookings/searchAddGetProfileBookings` in addition to enriched bookings.
- Preserved existing no-zero-offer safeguards in `RoyalCaribbeanSyncProvider`.
- Preserved separate `Sync Completed Cruises` flow and did not merge it into normal Sync Now.

## QA Performed
- Verified `app.json` and `package.json` parse as valid JSON.
- Verified the injected `STEP1_OFFERS_SCRIPT` parses successfully as executable JavaScript.
- Verified the final archive contains a normal Expo project root with `app/`, `components/`, `lib/`, `state/`, `assets/`, `package.json`, and `app.json`.

## Expected runtime marker
`Offer sync engine v9.2.7 active: Royal v2 merged + direct offer-detail DOM parser + grouped-date expansion; no CSV fallback`
