# Easy Seas 13.0.30 (396) — Certificate Resume and Weather Refresh

Release baseline: Easy Seas 13.0.30, local iOS build 396, Android version code 130053.

## Certificate downloads

- Download All now preserves certificates already parsed and saved for the selected month.
- Missing and failed certificates are retried without reprocessing successful certificates.
- A single-flight guard prevents overlapping individual and batch operations from corrupting progress or storage state.
- The screen remains in a saving state until parsed certificates are durably committed locally.
- Next Month changes the discovery month and downloads that month's missing or failed certificates.

## Weather and voyage preload

- Pull-to-refresh on Booked Cruises now reloads local cruise data and force-refreshes the next sailing's weather query.
- Weather cards provide an explicit manual refresh when live provider data is eligible.
- Cruises outside the provider forecast horizon now show the date when live forecasts should become available instead of presenting a broken reload control.
- Offline Voyage Pack reports missing itinerary data and forecast-horizon limits directly, while preserving cached weather for offline use.
- Background weather refresh remains bounded and non-blocking.

## Compatibility

- Startup, provider tree, navigation, tabs, local-first persistence, Royal/Celebrity/Carnival sync, Ask My Data, and existing certificate parsing architecture are preserved.
- No backend dependency or mobile AI SDK was added.
- No synthetic port, wave, wind, or weather data is generated when provider or itinerary data is unavailable.

## Verification

- TypeScript compile: passed.
- TypeScript/TSX syntax scan: 587 files passed.
- Production and uploaded certificate PDF fixtures: passed, including 3,858 verified uploaded sailing rows.
- Maintained release suite: all packaged tests passed; two optional private-fixture tests were explicitly skipped because their excluded large August fixture folder is not part of the release archive.
