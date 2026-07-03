# V1019 Weather Card Live Detail Fetch QA

## Issue addressed
Tapping a marine weather card opened the detail modal, but it only showed whatever data was already attached to the card. It did not explicitly force a fresh web/live forecast fetch for that exact cruise/date/location, and the refreshed data was not guaranteed to be saved before the detail view updated.

## Fix
- Weather card tap now opens immediately with the card's existing forecast data so the UI responds instantly.
- The tap handler then forces `getForecastForCruiseDay(..., { force: true })` for that exact card's cruise input and date.
- If a live forecast is returned, the modal updates to the newly fetched full marine forecast.
- The provider already writes live results into the persisted sailing-weather cache, so the newly fetched detail forecast is saved for offline use.
- If live fetch fails, the modal keeps the cached/offline card data visible and shows a clear status/error message instead of looking blank.
- Added a `Refresh live` button inside the detail modal to retry the same live fetch/save path.

## QA checks
- Confirmed `MarineForecastItem` now carries both `cruiseInput` and `targetDate` so each card can be refreshed by exact itinerary day.
- Confirmed card `onPress` calls `handleOpenForecastDetail` instead of only setting `selectedForecast`.
- Confirmed `handleOpenForecastDetail` uses `force: true` to bypass fresh-cache short-circuit and attempt live fetch.
- Confirmed live fetch result updates selected modal data.
- Confirmed failure path preserves existing cached/offline forecast in the modal.
- Confirmed TypeScript transpile syntax check passed for:
  - `components/MarineAlertsPanel.tsx`
  - `state/SailingWeatherProvider.tsx`

## Version
- App/package: 9.11.19
- iOS build: 9.11.19
- Android versionCode: 91119
