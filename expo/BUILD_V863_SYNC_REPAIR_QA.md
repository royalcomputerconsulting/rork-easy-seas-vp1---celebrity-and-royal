# Easy Seas v8.6.3 Sync Repair QA

This build is based on `easyseas_v862_date_regex_verified.zip` and keeps the Expo project at the ZIP root.

## Fixed

1. **Multiple sailings on one Royal offer-card date line**
   - Handles `Dates 2026 Aug 29, Sep 26, Oct 24, Oct 30` as four separate sailings.
   - Carries the shared year across every month/day fragment.
   - Adds an explicit log: `Expanded offer card ... into X sailing date(s)`.

2. **DOM/API offer merge no longer drops visible offers**
   - The API fallback no longer replaces the visible DOM offer cards.
   - It now merges DOM-discovered cards with API/network sailing rows.
   - This prevents the third offer card, such as `Hot Hot July`, from disappearing when `/api/casino/v2/offers/merged` only returns a subset of offers.

3. **Completed cruises button now targets Past Sailings**
   - The standalone button repeats `View All` + scroll attempts, then explicitly looks for `Past Sailings`, `Past Cruises`, `Completed Sailings`, `Completed Cruises`, `Sailing History`, and `Cruise History`.
   - It waits longer after clicking Past Sailings before scraping or accepting payloads.
   - It marks rows captured during the completed-sync flow as `Completed` if Royal omits the status.

4. **Completed date normalization fixed**
   - `YYYYMMDD`, `YYYY-MM-DD`, `YYYY/MM/DD`, and `MM/DD/YYYY` are handled when determining whether a booking is past/completed.

## Targeted validation performed

- `Dates 2026 Aug 29, Sep 26, Oct 24, Oct 30` expands to:
  - `08/29/2026`
  - `09/26/2026`
  - `10/24/2026`
  - `10/30/2026`
- `2026 Aug 29, Sep 26, Oct 24 & Oct 30` expands to the same four rows.
- `May 9th, 2026`, `2026-05-09`, and `5-9-2026` normalize to `05/09/2026`.
- TypeScript syntax check was run on the patched files. The sandbox has no installed Expo/React dependencies, so module-resolution errors are expected, but no syntax errors were reported in the patched files.

## Expected logs after fix

- Offer sync should log `v8.6.3`.
- Variety Selection should expand to four dates when the card shows `2026 Aug 29, Sep 26, Oct 24, Oct 30`.
- Step 1 should log `DOM+API MERGE COMPLETE` instead of replacing DOM offers with only API fallback rows.
- Completed sync should log `Clicked Past Sailings / Completed cruises control` before completed extraction.
