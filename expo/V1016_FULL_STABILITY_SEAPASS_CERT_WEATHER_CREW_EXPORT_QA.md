# V1016 Full Stability QA — SeaPass, Certificate Search/Cancel, Weather Detail, Crew Export

Version: 9.11.16 / Android 91116

## TODO list completed

1. SeaPass font fidelity
   - Reverted the SeaPass SVG renderer to the prior live-preview font stack: `Arial, Helvetica, sans-serif`.
   - Stopped chasing iOS/System/SF/Helvetica Neue SVG differences.
   - Restored ship-code typography to match other editable field values more closely.
   - Restored the date field to the live-preview family/weight and moved it into the correct top-right date line.
   - Kept `Jul 5` formatting and kept `ORLANDO (PORT CANAVERAL),...` behavior.

2. Certificate search/filter
   - Improved unique-sailing search normalization.
   - Search now includes normalized text, all certificate codes, cabin label, benefit text, and multiple date variants such as `July 5`, `Jul 5`, `2026-07-05`, and `7/5/2026`.
   - Continues to group raw certificate rows into unique sailings before displaying/filtering.

3. Certificate scrape cancellation
   - X button now increments the run guard, aborts the active AbortController, clears loading/error state, and writes an explicit export-log line: `Certificate scrape cancelled by user...`.
   - Late results from cancelled runs are ignored by the run id guard.

4. Certificate contrast/readability
   - Previous high-contrast white PDF chips remain preserved: dark text on light backgrounds.

5. Weather card full-detail drilldown
   - Each live weather card is now tappable.
   - Tap opens a full marine forecast modal for that exact cruise/date/location.
   - Details preserve existing marine data: temp, wind, gusts, wave height, wave period, swell height, swell direction, precipitation, condition, alerts/watchouts, hourly forecast, source, timestamp, and offline-cache note.

6. Weather itinerary marine behavior
   - V1011 itinerary-day marine resolving remains preserved.
   - Port days resolve to that day’s port.
   - Sea days use route midpoint/fallback marine zones rather than repeating the departure port.

7. Crew export writable-directory failure
   - Crew CSV/text export now checks all available Expo file-system writable locations: documentDirectory, cacheDirectory, Paths.document.uri, and Paths.cache.uri.
   - This fixes the “no writable document area exists” failure path on Expo/iOS builds where documentDirectory is unavailable or the SDK exposes paths differently.

8. RevenueCat and prior sync fixes
   - Prior RevenueCat offerings-spam suppression remains preserved.
   - Prior certificate parser rewrite and Hermes-safe date parsing remain preserved.

## Smoke test checklist

- SeaPass preview: ship code, date, time, port, deck, cabin, reservation use consistent live-preview typography.
- Certificate scrape: let a scrape finish; verify raw row count and unique sailing count are both displayed.
- Certificate search: search `Star`, `July 5`, `2026-07-05`, `Balcony`, `C05`.
- Certificate cancel: start scrape and tap X; export log should show cancellation and the scrape should not continue visually.
- Weather: tap a Sailing Weather card; modal opens with detailed day-specific forecast and hourly rows.
- Crew recognition: tap export; share sheet/file export should open without “no writable document area exists.”
