# Easy Seas v965 / 9.10.65 — Real Data Continuation Fix

## What the live log proved
The working path is not a public/direct Royal endpoint. The real sailing data is coming from the authenticated Royal browser session:

1. The WebView is logged in.
2. The Club Royale offers page hydrates five real offer cards.
3. Each offer card exposes a real `View Sailings` path and/or `playerOfferId` detail URL.
4. Opening `26BCP105` exposes the real detail/download-rendered sailing rows.
5. The scraper stages rows in checkpoint batches and React Native ACKs them app-side.

## Root cause of v964 failure
v964 successfully scraped `26BCP105`, but then performed a hard navigation back to `/club-royale/offers`. That killed or detached the manually injected offer-crawler script before it could re-arm. The host WebView auth/network monitor kept logging, but the Step 1 crawler itself stopped, causing the 240-second timeout and only 54 rows.

## v965 fixes
- Adds continuation after each offer without relying on hard return-to-list navigation.
- Uses saved authenticated offer detail hrefs/playerOfferIds gathered from the real DOM.
- Fetches saved detail pages from the authenticated WebView session to parse hydrated/detail content without leaving crawler context.
- Falls back to SPA `history.back()` instead of hard `location.href = /offers` when a live button re-open is needed.
- Keeps checkpoint ACK handoff after every offer.
- Adds a guard in the React Native provider so timed-out/partial Royal offer captures are discarded from Apply Sync and existing offer/available-cruise catalogs are preserved.
- Upgrades engine marker to `v9.6.5-production-webview-first-continuation`.

## Expected healthy log shape
- Discover 5 offers.
- Scrape/stage `26BCP105` 54 rows.
- Log `Continuing to next saved offer 2/5: 26JUL104`.
- Stage rows for all remaining saved offers or reopen via SPA back.
- Step 1 only completes authoritatively when all visible offers have nonzero rows and current Royal set is roughly 1,073 rows.
- If Step 1 times out, Apply Sync preserves existing offers/available cruises instead of appending 54 partial rows.
