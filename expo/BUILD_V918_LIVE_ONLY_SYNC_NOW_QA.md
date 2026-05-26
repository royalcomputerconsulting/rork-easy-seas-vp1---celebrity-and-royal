# Easy Seas v918 / 9.10.24 — Live-Only Sync Now Rebuild

## Hard rule enforced
Sync Now no longer uses verified CSV / QA baseline / provider-side row-fill data. If Royal does not return live sailing rows, Sync Now reports the scrape as incomplete and preserves existing data.

## What changed
- `app.json` incremented to 9.10.24 / iOS build 9.10.24 / Android versionCode 9124.
- Removed `royalOffersQaBaseline.ts` and removed the `assets/qa` baseline CSV folder from this build.
- Removed the provider-side verified row fill from `state/RoyalCaribbeanSyncProvider.tsx`.
- Step 1 now sends only real live rows with ship/date information.
- Step 1 no longer sends one coded placeholder per offer to trigger row fill.
- Step 1 logs `STEP 1 LIVE SCRAPE INCOMPLETE` when only cards/placeholders are captured.
- Restored app-store-era `authDetection.ts` dual XHR/fetch capture hooks from the QA build that captured 14 bookings.
- Preserved current `networkMonitorScript.ts` so completed-history capture improvements remain available.
- Removed Sync Now’s unused DOM upcoming-cruise extractor import so normal Sync Now uses passive account-route network capture.

## Not intentionally changed
- Sync Completed Cruises button/path.
- SeaPass generator.
- Logo assets.
- Existing storage merge safeguards.

## QA checks run in sandbox
- TypeScript transpile diagnostics on:
  - `state/RoyalCaribbeanSyncProvider.tsx`
  - `lib/royalCaribbean/step1_offers.ts`
  - `lib/royalCaribbean/authDetection.ts`
  - `lib/royalCaribbean/networkMonitorScript.ts`
- Extracted `STEP1_OFFERS_SCRIPT` and ran `node --check` against the injected JavaScript.
- Verified no live code imports `royalOffersQaBaseline`.
- Verified the baseline CSV folder is not present in this build.

## Expected markers
- `Offer sync engine v9.1.8 active: LIVE-ONLY v861/v882 scraper; no local fallback`
- `Sync Now Step 2 capture engine v9.1.8 active: live-only May-6 passive XHR/fetch capture; no DOM extractor loop; no CSV fallback`

## Expected behavior
- If live Royal offer rows are captured, Sync Now previews and syncs those rows.
- If Royal exposes only offer cards/placeholders, Sync Now does **not** fill rows from CSV and does **not** call the scrape successful.
- If account/upcoming capture returns 0, existing booked/completed cruises are preserved.
