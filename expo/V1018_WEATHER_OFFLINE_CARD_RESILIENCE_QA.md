# V1018 Weather Offline Card Resilience QA

## Goal
Weather cards must continue to render and open full detail no matter whether the device has internet.

## Changes
- Added an offline-placeholder forecast source to the sailing weather provider.
- If live forecast fetch fails and no cached forecast exists, the app now creates a route-aware offline weather card instead of returning null.
- Offline cards preserve the same marine card/detail shape: ship, date, itinerary location, zone, hourly rows, metrics placeholders, advisory/watchout, source label, stale/offline flag.
- If a cached forecast exists, the app still uses the cached stale forecast as before.
- Fixed weather detail modal field references so hourly rows read the provider model correctly (`isoTime`, `windMph`, `windGustMph`, `waveHeightFt`, `precipitationProbability`).
- Fixed detail modal source label to use the existing `getSourceLabel` helper.

## Expected Behavior
- With internet: live marine cards display as before.
- Without internet and cached data: cached offline marine forecasts display and open detail.
- Without internet and no cached data: offline route cards still display for each resolvable itinerary day and open detail, clearly saying live wind/swell/temp/precip will refresh when service returns.
