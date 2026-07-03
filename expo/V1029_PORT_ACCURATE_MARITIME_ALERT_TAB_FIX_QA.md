# V1029 — Port-Accurate Maritime Weather + Alerting Accordion QA

## Issue
The maritime weather engine could show a forecast near Philipsburg, St. Maarten for Star of the Seas 07-05-2026 Day 5 even though the actual Royal app itinerary shows Basseterre, St. Kitts & Nevis.

## Root cause
When a booked cruise did not have a complete/usable itinerary payload, the weather provider fell back to a broad inferred Eastern Caribbean template. That generic template inserted common Eastern Caribbean ports, including Philipsburg, instead of using the actual day-by-day itinerary. The weather card then resolved coordinates for Philipsburg and fetched weather for the wrong island.

## Fixes
- Added Basseterre / St. Kitts coordinate aliases to the maritime weather port resolver.
- Added a known exact itinerary override for Star of the Seas 07-05-2026 through 07-12-2026:
  - Day 1 Port Canaveral
  - Day 2 Perfect Day at CocoCay
  - Day 3 sea-day Bahamas marine zone
  - Day 4 Charlotte Amalie, St. Thomas
  - Day 5 Basseterre, St. Kitts & Nevis
  - Days 6-7 return-route marine zone
  - Day 8 Port Canaveral
- Changed generic Eastern Caribbean fallback behavior so it no longer invents named ports like Philipsburg when the exact itinerary is unavailable. It uses a broad Eastern Caribbean marine zone instead.
- Maritime Weather accordions now scan while closed and show an alert badge/pill if rough-seas or weather advisories exist, so the closed tab still tells the user there is something to pay attention to.

## Files changed
- `state/SailingWeatherProvider.tsx`
- `components/MarineAlertsPanel.tsx`

## Expected behavior
- Star of the Seas Day 5 weather should resolve near Basseterre, St. Kitts, not Philipsburg.
- Closed Maritime Weather cards should display alert status such as `1 Alert` / `2 Alerts` instead of hiding the warning until opened.
- Generic routes without exact day-by-day itinerary should avoid false precision.
