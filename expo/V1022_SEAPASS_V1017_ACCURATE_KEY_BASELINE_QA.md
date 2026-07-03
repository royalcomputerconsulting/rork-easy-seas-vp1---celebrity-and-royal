# V1022 SeaPass v1017-Accurate Key Baseline QA

## Scope
Targeted SeaPass Generator patch only. No weather, certificate scraper, crew export, sync, storage, RevenueCat, or casino logic changed.

## Reason for this build
After reviewing the build logs, the last explicitly verified SeaPass reproduction baseline was v1017 / 9.11.17. v1018 and v1019 were weather-only. v1020 changed SeaPass rendering and still required device pixel QA.

## Fix
- Re-baselined the SeaPass Generator to the v1017/v1019 approved-shell approach: use the approved SeaPass shell image as the visual foundation and only mask/overlay dynamic fields when the user edits them.
- Added the Key symbol as a standalone SVG overlay in the purple header.
- The Key overlay is inside the same SVG used by preview, PNG export, and PDF export, so all exports match the preview.
- Updated the default SeaPass data to match the last visually approved shell baseline so the renderer does not repaint accurate shell text unless the user intentionally edits a field.
- Preserved the one-tap workflow: edit fields are hidden by default behind `Edit Pass Data`; export captures the clean card only, not the keyboard, navigation bar, or app screen.

## Files changed
- `lib/seaPassWebPass.ts`
- `app/seapass-generator.tsx`
- `package.json`
- `app.json`

## QA
- TypeScript transpile syntax check passed for:
  - `lib/seaPassWebPass.ts`
  - `app/seapass-generator.tsx`

## Version
- App/package: 9.11.22
- iOS build: 9.11.22
- Android versionCode: 91122

## Device QA still needed
A real iOS TestFlight run is still required for pixel-level confirmation of the final card image, but this build intentionally avoids the v1020 drift by preserving the last verified approved-shell reproduction strategy and adding only the Key overlay.
