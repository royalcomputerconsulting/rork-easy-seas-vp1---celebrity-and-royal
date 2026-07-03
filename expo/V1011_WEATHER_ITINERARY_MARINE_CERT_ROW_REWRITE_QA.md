# V1011 Weather Itinerary Marine + Certificate Row Parser Rewrite QA

## Scope
- Rewrote certificate PDF row segmentation to parse flat extracted Royal certificate table text by ship/date anchors, not just line breaks or repeated offer-code boundaries.
- Hardened date matching with fresh RegExp instances so stateful global regexes cannot poison row detection.
- Kept backend PDF.js/manual parser pipeline and device fallback logging intact.
- Added `flatTableRows` candidate logging to certificate scrape export logs.
- Updated cruise weather resolution so weather cards use itinerary-day marine targets instead of reusing departure port for every day.
- Added inferred itinerary fallback for missing booked-cruise day-by-day itinerary, including Eastern Caribbean + Perfect Day, Bahamas, CocoCay, Northwest Bahamas, Florida Straits, and Western Atlantic marine zones.
- Preserved the existing marine forecast card metrics: temperature, wind, gusts, wave height, swell, precipitation, snapshots, and advisories.
- Preserved marine alert panel functionality; alerts now resolve through the same itinerary-day/sea-zone weather provider.

## Key validation expectations
- Certificate logs should show nonzero `flatTableRows` and `sailingsFound` when PDF text contains samples like `2606C05 Spectrum Of The Seas Shanghai (Baoshan), China June 3, 2026`.
- If backend PDF.js works, backend results should apply first. If backend cannot run, device fallback now has a flat-table scanner instead of failing all extracted text.
- Star of the Seas July 5-12 should no longer use Port Canaveral/Orlando for every day when itinerary details are available or inferable.
- Day cards continue using Open-Meteo weather + marine APIs with wind, swell, waves, precipitation, and alerts.

## Version
- App/package: 9.11.11
- iOS build: 9.11.11
- Android versionCode: 91111
