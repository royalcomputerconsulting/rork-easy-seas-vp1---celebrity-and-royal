# V1028 SeaPass Key Dedupe Export Fix QA

## Issue
A generated SeaPass PNG could show two overlapping Key icons when the approved SeaPass shell image already contained The Key and the renderer also added the Key overlay.

## Root cause
The SeaPass renderer always appended `BOARDING_KEY_MARKUP` on top of the approved shell. That is correct for an older shell without The Key, but it duplicates the icon if the shell asset already includes The Key.

## Fix
`lib/seaPassWebPass.ts` now treats The Key as a deterministic overlay zone:

1. Clear the small Key-icon area first with `BOARDING_KEY_ERASE_MARKUP`.
2. Draw exactly one `BOARDING_KEY_RING_PATH` overlay.

This makes live preview, PNG export, and PDF export stable whether the shell image has no key or already has one baked in.

## Files changed
- `lib/seaPassWebPass.ts`

## Regression guard
Do not add a second Key icon in export-specific code. PNG export captures the live preview, and PDF export uses `buildSeaPassSvgMarkup`; both already receive the single deduped Key from the shared renderer.
