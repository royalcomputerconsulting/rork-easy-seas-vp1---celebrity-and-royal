# Easy Seas v963 Sync Now Rebuild Notes

## Build Identity

- App version: `9.10.63`
- Sync engine marker: `v9.6.3-webview-first`
- Base: v962 latest guardrail build, surgically corrected to restore the v950/v958 WebView-first scraper behavior.

## What Was Fixed

1. **Removed POST-first offer sync as the primary path**
   - The broken `/api/casino/v2/offers/merged` direct POST strategy is no longer attempted before the browser scraper.
   - Sync Now now starts with the proven logged-in WebView/detail-page flow.

2. **Preserved the working v950/v958 scraper family behavior**
   - Saved offer-list discovery remains.
   - Detail-page navigation remains.
   - Per-offer checkpoint `offers_batch` ACK handoff remains.
   - Final preview continues using app-side staged rows.

3. **Kept safe guardrails from v962 without over-restricting the scraper**
   - Pending placeholder blocks are rejected before row creation/logging/handoff.
   - Duplicate DOM rows are deduped by canonical key.
   - Known Royal offer row targets remain as guardrails:
     - `2605C03A`: 898
     - `26WCR403`: 57
     - `26BCP105`: 54
     - `26JUL104`: 39
     - `26SUM203`: 25
   - Scroll limit increased from the over-restricted v962 value so large offers can complete.

4. **Fixed offer continuation architecture**
   - The crawler uses the saved offer list to continue to the next offer even if rediscovery after SPA navigation is weak.
   - It returns to the exact My Offers URL between offers.

5. **Improved detail route fallback**
   - Cruise detail resolution now compares normalized date formats:
     - `MM-DD-YYYY`
     - `MM/DD/YYYY`
     - `YYYY-MM-DD`
   - Detail lookup now tries:
     - exact id
     - booking id / reservation number
     - offer code + ship + normalized sail date
     - ship + normalized sail date
     - fuzzy normalized id fallback
   - Overview navigation now passes fallback params to the detail screen.
   - If lookup fails, the detail screen shows the received route params instead of silently doing nothing.

6. **Retained existing v962 performance protections**
   - Large available-cruise catalog normalization remains in `CoreDataProvider`.
   - Heavy raw fields are stripped from in-memory available rows.
   - Backend available-cruise sync skip threshold remains.
   - Diagnostic export remains in Settings/Admin.

## Critical Acceptance Tests

- Launch app with 1,073+ available cruises without major lag.
- Settings/Admin still shows Export Diagnostic Logs and Clear Diagnostic Logs.
- Sync Now discovers all five visible Royal offers.
- Sync Now opens offer detail pages through WebView before any direct endpoint attempt.
- `26BCP105` ends at 54 rows, not 0 and not inflated.
- `2605C03A` is allowed enough scroll/crawl time to reach its large verified count.
- No `ship pending / itinerary pending` rows are handed to React Native.
- Each completed offer sends checkpoint batches and React Native ACK logs.
- Final review uses app-side staged rows.
- Existing cruise cards open the detail page even if ids changed.
- Failed/empty sections preserve existing good app data.

