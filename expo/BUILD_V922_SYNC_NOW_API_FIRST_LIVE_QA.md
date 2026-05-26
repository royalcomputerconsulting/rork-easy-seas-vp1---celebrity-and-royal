# Easy Seas v922 / 9.10.28 — Sync Now API-First Live Scrape Rebuild

## Scope

This build stops guessing from local verified CSV/baseline data and rebuilds Sync Now around the old working dual-domain extension behavior.

## Key change

Step 1 now tries the extension-proven live casino-offers API path first:

- Reads Royal/Celebrity `persist:session` from the live WebView page.
- Extracts `token`, `accountId`, and `cruiseLoyaltyId`.
- POSTs to the same-origin casino offers endpoint first:
  - Royal: `/api/casino/casino-offers/v1`
  - Celebrity: `/api/casino/casino-offers/v2`
- Uses explicit `authorization`, `account-id`, and `cruiseLoyaltyId` headers/body, matching the old dual-domain extension approach.
- Refetches individual offer codes when the first API response contains empty/placeholder sailings.
- Only accepts rows with real `shipName` + `sailingDate`.

## Explicitly not included

- No verified CSV fallback.
- No provider-side QA baseline row fill.
- No fake zero-cruise offer rows.

## Fallback

If the live casino-offers API does not return real sailing rows, Step 1 falls back to live DOM/modal scraping only. If that also fails, Sync Now must report incomplete and preserve existing data.

## Expected log markers

- `Offer sync engine v9.2.2 active: LIVE-ONLY extension-grade API-first scraper + DOM modal fallback; no CSV/baseline fallback`
- `Offer API attempt ... via /api/casino/casino-offers/v1 (omit)`
- `STEP 1 API-FIRST LIVE COMPLETE` when live rows are returned.

## QA performed

- `app.json` incremented to 9.10.28 / iOS build 9.10.28 / Android versionCode 9128.
- Extracted `STEP1_OFFERS_SCRIPT` and ran `node --check` successfully.
- Bundled `RoyalCaribbeanSyncProvider.tsx` with esbuild using external app dependencies to catch syntax-level errors.
- Verified no `royalOffersQaBaseline` import/reference exists in Royal sync code.
