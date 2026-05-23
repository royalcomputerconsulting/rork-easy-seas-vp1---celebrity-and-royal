# BUILD V862 — Actual Cruise Sync Fix

This package is rebuilt from the Expo-root v862 clean package, with targeted fixes based on the two supplied logs (`last 36.log` and `last 37.log`).

## Root cause found in the logs

The app was not failing at the final sync step. It was failing earlier during Step 1:

- Royal displayed 3 offer cards.
- The DOM click-through pass returned only one placeholder row per offer.
- Those placeholder rows had no ship/date sailing details.
- The provider correctly filtered them as empty/in-progress rows.
- Final result: 3 offer cards, 0 active available cruises.

That is why the app showed offers and upcoming cruises, but synced zero individual available cruise sailings.

## Fixes applied

1. **Actual available cruise rows**
   - Expanded network capture to catch Royal offer/sailing payloads beyond the old `/casino-offers` endpoint.
   - Added broad Royal offer/sailing detection for View Sailings network calls, cruise-search style responses, coupon/offer responses, and sailing/voyage/cruise arrays.
   - Excludes bookings, loyalty, myaccount, and voyage-enrichment calls so they do not pollute offer extraction.

2. **Offer payload parser**
   - Expanded parser support for modern/nested Royal structures:
     - `voyages`
     - `availableCruises`
     - `cruiseOptions`
     - `sailingOptions`
     - `itineraries`
     - `cruiseSearch.results.cruises`
   - Added nested `cruise.sailings[]` flattening so a cruise-search result with nested sailings becomes real offer rows.
   - Pulls ship/date/port/itinerary/pricing from both the parent cruise and nested sailing.

3. **Preview counts**
   - Preview already displays each unique offer with its cruise count.
   - With actual sailing rows restored, those counts should now be meaningful instead of 0.

4. **Sync complete summary**
   - Sync Complete screen already shows offers, available cruises, upcoming cruises, courtesy holds, completed cruises, and loyalty data.
   - Offer breakdown is shown under “Offers & Available Cruises Synced.”

5. **Completed cruises button**
   - Completed-cruise direct history fetch now bootstraps `accountId` and Crown & Anchor number from the regular loyalty sync result.
   - The direct history fetch now also rebuilds auth headers from the same persisted session used by regular loyalty sync, including account-id, authorization, appkey, and x-api-key when available.

## Packaging

- This ZIP is rooted at the Expo project folder.
- `package.json` and `app.json` are top-level files.
- No hashed folders.
- No parent wrapper folder.
