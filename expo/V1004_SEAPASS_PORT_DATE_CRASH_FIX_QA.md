# Easy Seas v1004 — SeaPass Port / Date Stability Fix QA

## Scope
Targeted SeaPass Generator fix only. No cruise sync, certificate scrape, offer import, crew recognition, booked cruise, or storage logic was rewritten.

## Issues addressed
1. Long Royal Caribbean port names such as `ORLANDO (PORT CANAVERAL), FLORIDA` could not fit cleanly on the one-line SeaPass port overlay.
2. The date overlay was sitting too low relative to the time overlay in the upper-right SeaPass header.
3. The screen could crash or become unstable while editing the date because the hidden full-size export SVG was mounted and re-rendering on every keystroke, in addition to the visible preview SVG.

## Changes
- Added canonical SeaPass port normalization for Orlando / Port Canaveral aliases:
  - `ORLANDO`
  - `ORLANDO, FLORIDA`
  - `PORT CANAVERAL`
  - `ORLANDO PORT CANAVERAL`
  - typo correction for `CANABERAL` -> `CANAVERAL`
- Added long-port auto-fit rendering:
  - dynamically reduces port font size based on length
  - vertically recenters the port baseline after shrinking
  - applies SVG text-length fitting for long port names so the full line stays inside the Royal SeaPass port field
- Added date normalization:
  - `7/5`, `07/05`, `7-5-26`, `Jul 5`, and `July 5` normalize to `Jul 05`
- Repositioned the date overlay upward/right-aligned with the time overlay:
  - date x changed from `958` to `956`
  - date y changed from `178` to `170`
- Stabilized typing/editing:
  - sanitized unsupported characters before they reach the SVG renderer
  - added field max lengths
  - removed the always-mounted hidden full-size export SVG from the live typing path
  - hidden full-size export SVG now mounts only during PNG export
  - PNG export waits briefly for the hidden export view to mount before capture
  - memoized SeaPass data/SVG markup in the SeaPass preview component

## Files changed
- `app/seapass-generator.tsx`
- `components/seapass/SeaPassWebPass.tsx`
- `lib/seaPassWebPass.ts`
- `package.json`
- `app.json`

## Version
- App/package: `9.11.04`
- iOS buildNumber: `9.11.04`
- Android versionCode: `91104`

## Validation performed in sandbox
- JSON parsed successfully for `package.json` and `app.json`.
- TypeScript syntax check on the modified SeaPass files reached dependency/type-resolution errors only because the ZIP does not include `node_modules`; no syntax errors were reported in the patched files.
