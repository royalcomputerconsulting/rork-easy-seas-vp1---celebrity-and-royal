# V1020 SeaPass Live Preview Edit Render Fix QA

## Scope
Targeted SeaPass Generator patch only. No weather, certificate scraper, crew export, sync, storage, or revenue logic changed.

## Fixes

### 1. Edited field typography
The dynamic overlay renderer now uses the same live-preview value typography family for edited values instead of leaving edited fields visually larger/bolder than the approved shell.

- Restored/kept `Arial, Helvetica, sans-serif` as the live preview renderer font stack.
- Added shared live value constants:
  - `SEA_PASS_LIVE_VALUE_FONT_WEIGHT = '300'`
  - `SEA_PASS_LIVE_VALUE_FONT_SIZE = 48`
  - `SEA_PASS_LIVE_COMPACT_VALUE_FONT_SIZE = 44`
- Applies the lighter live-preview weight to Deck, Stateroom, Muster, Reservation, Ship, Date, Time, Port, and Terminal overlays.
- Ship code values like `ST` now use compact 44px typography and a slightly higher baseline so they do not look oversized beside Reservation # or Port.

### 2. Date/time placement
- Date remains normalized as `Jul 5`, not `Jul 05`.
- Date overlay remains right-aligned under the time column, with lighter typography and live-preview value sizing.
- Time/date masks remain on the purple header and do not affect other SeaPass areas.

### 3. Press Enter commits and re-renders
- Added `returnKeyType="done"`, `blurOnSubmit`, and `onSubmitEditing` to every SeaPass form input.
- Pressing Enter/Done now finalizes the field value using the same normalization as blur, then immediately re-renders the live preview overlay.
- Port and date normalization now happen on Enter as well as on field blur.

## Files changed
- `lib/seaPassWebPass.ts`
- `app/seapass-generator.tsx`
- `package.json`
- `app.json`

## QA
- TypeScript transpile syntax check passed for:
  - `lib/seaPassWebPass.ts`
  - `app/seapass-generator.tsx`
- Verified version bump:
  - App version: 9.11.20
  - iOS build: 9.11.20
  - Android versionCode: 91120

## Device QA still needed
A real iOS TestFlight run is still required for pixel-level confirmation because iOS SVG text rendering can differ from web/canvas rendering. This build specifically targets the issue shown in the screenshots: edited values were heavier/larger than the original live-preview field values.
