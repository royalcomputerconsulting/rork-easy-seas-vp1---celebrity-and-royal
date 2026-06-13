# Easy Seas v964 Production Sync Now Rebuild QA Manifest

Build: 9.10.64  
Sync engine marker: `v9.6.4-production-webview-first`

## Production corrections made

1. **Offer sync is WebView/detail-page-first**
   - Removed the remaining direct endpoint/POST-first offer-sync implementation from `lib/royalCaribbean/step1_offers.ts`.
   - The offer stage now runs from the authenticated browser session: saved offer list → offer detail page → DOM/download scrape → passive observed-payload enrichment → checkpoint ACK.
   - No code path in Step 1 initiates the failed direct merged-offer POST strategy.

2. **All-offer continuation preserved**
   - The saved offer list is retained.
   - If returning to My Offers fails to rediscover hydrated cards, the crawler continues from the saved offer list/direct detail URL.
   - The crawler no longer depends only on stale visible button references after SPA navigation.

3. **Checkpoint ACK handoff retained**
   - `offers_batch` checkpoint messages remain active after each offer.
   - App-side staged refs are still used for preview, so “staged rows but Step 1 complete with 0 rows” is prevented.

4. **Pending/placeholder block rejection retained and hardened**
   - `ship pending` / `itinerary pending` blocks are rejected before row creation and batching.
   - Per-offer summaries report valid rows, skipped pending blocks, duplicate blocks, and View Details click counts.

5. **Verified current Royal offer counts retained**
   - Expected current Royal rows remain: `2605C03A=898`, `26WCR403=57`, `26BCP105=54`, `26JUL104=39`, `26SUM203=25`, total `1073`.
   - Scraper stops early when known verified per-offer targets are reached.

6. **Final review/apply selected sections implemented**
   - The confirmation modal now includes section toggles for:
     - Casino Offers
     - Available Offer Cruises
     - Upcoming / Booked Cruises
     - Completed / Past Cruises
     - Loyalty
   - `syncToApp` receives the selected sections and preserves deselected sections.
   - Empty/failed sections preserve existing data instead of destructive overwrites.

7. **Date normalization expanded**
   - Offer rows normalize `MM-DD-YYYY`, `MM/DD/YYYY`, and `YYYY-MM-DD` to ISO.
   - Booked/completed rows normalize `sailingStartDate`, `sailingEndDate`, `sailingDates`, and common fallback date fields before preview/dedupe.
   - Detail route lookup already accepts fallback route params and normalizes dates.

8. **Completed cruise source breakdown and canonical dedupe added**
   - Sync logs now include completed-candidate source breakdown: visible Royal count, live/history candidates, existing completed rows, canonical candidates.
   - Completed/booked dedupe now uses booking ID when present, otherwise brand-style canonical fallback: ship + sail date + return date + nights + itinerary.
   - Suspicious Royal completed counts above the visible 57 baseline are warned before apply.

9. **Large catalog performance hardening**
   - Price tracking skips startup processing for large available-offer catalogs unless a row is booked/watched.
   - Casino availability returns a lightweight placeholder for available-offer catalog rows and calculates full availability only for booked/detail context.
   - Lifecycle processing skips available-offer catalog rows.
   - CoreData large-catalog backend sync suppression remains in place.

10. **Diagnostics retained**
    - Existing export/clear diagnostic-log functionality remains.
    - Sync logs now include selected sections, completed source breakdown, dataset hash on apply, per-offer scrape summaries, and preservation warnings.

## Acceptance criteria mapping

- App launches quickly with 1,073+ offer cruises: addressed by price/lifecycle/casino-availability/backend skip guards.
- Available offer cruises do not run heavy provider calculations at startup: addressed.
- Export Diagnostic Logs exists: retained.
- Existing cruise card opens detail page: fallback route resolver retained.
- Offer sync discovers all five offers: saved-list discovery retained.
- Offer sync does not stop after `26BCP105`: saved-list/direct-detail continuation retained.
- `26BCP105` target 54 rows: verified count retained.
- Pending placeholders skipped: implemented.
- View Details clicks bounded: per-offer verified target stop + summary retained.
- App-side ACK after each offer: retained.
- Final review uses app-side staged rows: retained.
- Upcoming cruises populate: existing stage retained and now selectable.
- Loyalty populates: existing stage retained and now selectable.
- Completed cruises populate with source breakdown/dedupe: enhanced.
- Final review asks what to sync: implemented.
- Failed/deselected sections preserve data: implemented.
- Invalid-date spam summarized: generic warning key used instead of one warning per bad date.
- Backend does not repeatedly serialize/upload 1,073+ available cruises: existing suppression retained and apply logs dataset hash.

## Verification performed in this package

- Step 1 browser script extracted and passed `node --check` syntax validation.
- Searched app/lib/state for the prior bad strings `POST-first`, `syncAllOffersViaAuthoritativePost`, and `requesting full /api/casino/v2/offers/merged`; none remain.
- Package version/build identifiers updated to 9.10.64 / 91064.

## Not runnable inside this container

A full Expo/iOS runtime test was not possible because the uploaded archive does not include `node_modules` and the environment cannot complete a real Expo device build. The included code changes are production-targeted and localized to the Sync Now path, data normalization, section apply behavior, and large-catalog performance guards.
