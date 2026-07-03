# V1024 SeaPass ST / Ship Code Edit Fix QA

Targeted SeaPass Generator patch only. No cruise sync, offer scraping, storage, Cruise Itinerary Booklet, booked-cruise, casino, or RevenueCat logic was changed.

## Issue

The SeaPass Generator uses the last accurate v1017/v1019 shell, where the default ship code is `ST`. The generator needed a hard guarantee that this `ST` ship-code field remains editable and that changing it updates the SeaPass preview and exports instead of preserving the locked shell value.

## Changes made

- Added `normalizeSeaPassShipCodeDisplayValue()` in `lib/seaPassWebPass.ts`.
- `getSeaPassData()` now normalizes `ship` through that helper before building preview, PNG, or PDF markup.
- The Ship Code edit field is now labeled `Ship / ST Code` so it is clear that this is the editable `ST` code area on the pass.
- Increased that field's input limit from 4 to 24 characters so the user may type either a code (`NV`, `IC`, `QN`, etc.) or a ship name (`Navigator`, `Icon of the Seas`, etc.).
- On blur/submit, the field collapses supported ship names to compact Royal-style codes.
- The locked info text now explicitly confirms that the Ship / ST Code field updates preview, PNG, and PDF output.

## Supported normalizations added

Examples:

- `Star` / `Star of the Seas` → `ST`
- `Icon` / `Icon of the Seas` → `IC`
- `Navigator` / `Navigator of the Seas` → `NV`
- `Quantum` / `Quantum of the Seas` → `QN`
- `Allure` / `Allure of the Seas` → `AL`
- `Harmony` / `Harmony of the Seas` → `HM`
- `Symphony` / `Symphony of the Seas` → `SY`
- `Wonder` / `Wonder of the Seas` → `WN`
- Unknown freeform values are still preserved as a short uppercase code, up to 4 characters.

## QA expectation

1. Open SeaPass Generator.
2. Tap `Edit Pass Data`.
3. Change `Ship / ST Code` from `ST` to `NV`.
4. Confirm the preview replaces the shell `ST` with `NV`.
5. Export PNG and PDF and confirm the exported pass also shows `NV`.
6. Type `Navigator of the Seas`, submit/blur, and confirm it normalizes to `NV`.
7. Type `Icon of the Seas` with port `MIAMI, FLORIDA`, submit/blur, and confirm it normalizes to `IC` and still shows Terminal A.

## Validation note

A full TypeScript compile could not complete in this sandbox because the ZIP does not include installed Expo/React dependencies and `expo/tsconfig.base`. This matches the current archive limitation rather than a SeaPass code-specific error. The changed files were reviewed directly for targeted syntax and import consistency.
