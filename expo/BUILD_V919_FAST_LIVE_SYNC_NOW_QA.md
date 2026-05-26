# Easy Seas v919 / 9.10.25 — Fast Live-Only Sync Now Redesign

## Scope
- Full codebase rebuild based on v918 live-only Sync Now.
- No verified CSV / QA baseline fallback in Sync Now.
- Completed-cruise sync, SeaPass generator, and logo assets were not intentionally changed.

## Version
- expo.version: 9.10.25
- ios.buildNumber: 9.10.25
- android.versionCode: 9125

## Sync Now redesign
- Step 1 remains live-only v861/v882-style offer scrape with no local fallback.
- Step 2 was redesigned as a fast payload-driven sweep:
  - Arms AUTH_DETECTION_SCRIPT + NETWORK_MONITOR_SCRIPT before each trigger page.
  - Visits only the shortest trigger route list.
  - Runs a same-session Royal API payload probe after each trigger.
  - Attempts direct same-session fetch of profileBookings/enriched when accountId can be found from session/captured headers/DOM.
  - Inspects performance resource URLs and refetches candidate Royal JSON endpoints with credentials.
  - Posts only real network_payload messages back into the existing provider pipeline.
  - Stops early when bookings and loyalty are captured.
  - Uses a hard cap and preserves existing booked/completed rows on zero capture.

## Explicit removals / guards
- No Step 2 DOM upcoming-cruise extractor loop during normal Sync Now.
- No repeated `Step 2 completed with 0 items` route loop.
- No local verified CSV offer-row fill.
- No fake success when live Royal rows are not captured.

## QA performed in sandbox
- app.json version verified.
- esbuild parse/bundle check passed for RoyalCaribbeanSyncProvider.tsx with externals.
- Extracted STEP1_OFFERS_SCRIPT and ran `node --check` successfully.
- Verified no `royalOffersQaBaseline` import/reference in Royal sync code.

## Expected markers
- `Offer sync engine v9.1.9 active: LIVE-ONLY v861/v882 scraper; no local fallback; completed-history path unchanged`
- `Sync Now Step 2 capture engine v9.1.9 active: fast payload-driven Royal sweep; no repeated DOM extractor loop; no CSV fallback`

## Expected behavior
- If live Royal offer rows are captured: sync shows real per-offer counts from Royal.
- If Royal exposes only placeholders: Sync Now reports incomplete and preserves existing data.
- If live account payloads are captured: Sync Now logs captured booking/loyalty rows.
- If live account payloads are not captured: existing booked/completed cruises are preserved.
