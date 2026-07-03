# Easy Seas v1009 — SeaPass Font + Date Alignment Fix

## Purpose
Fix the SeaPass preview/export mismatch where the sailing date appeared too high and visually collided with the boarding time area, and where the overlay font did not match the Royal Caribbean app pass closely enough.

## Changes
- Replaced the generic Arial-only SVG font stack with an Apple/system-first stack:
  - `-apple-system`
  - `BlinkMacSystemFont`
  - `SF Pro Display`
  - `SF Pro Text`
  - `Helvetica Neue`
  - fallback Helvetica/Arial/sans-serif
- Moved the date baseline down so `Jul 5` sits below the time instead of intruding into the time line.
- Kept the date display as `Jul 5`, not `Jul 05`.
- Kept the Royal-style Port Canaveral display as `ORLANDO (PORT CANAVERAL),...`.
- Changed long-port SVG length adjustment to spacing-only so the port glyphs are not horizontally distorted.

## Files Changed
- `lib/seaPassWebPass.ts`
- `package.json`
- `app.json`

## Version
- App/package: `9.11.09`
- iOS build: `9.11.09`
- Android versionCode: `91109`
