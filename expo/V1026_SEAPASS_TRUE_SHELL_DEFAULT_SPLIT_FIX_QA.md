# V1026 — SeaPass True Shell / Editable Default Split Fix QA

## Purpose
Fix the SeaPass Generator so the live preview, PNG export, and PDF export repaint values that differ from the approved screenshot shell, even when those values are also the editable form defaults.

## Root cause
The approved SeaPass shell image physically contains baked-in text values, including:

- Date: `Apr 07`
- Ship code: `QN`
- Port: `LOS ANGELES, CALIFORNIA`

The generator form defaults now need to be editable defaults, including:

- Date: `Jul 5`
- Ship / ST Code: `ST`

Previous logic treated the editable defaults as if they were also the screenshot shell defaults. Because `ST` was the form default, the renderer skipped the ship overlay, leaving the baked-in `QN` visible on the card.

## Files changed

- `lib/seaPassWebPass.ts`
- `components/seapass/SeaPassWebPass.tsx`

## Code changes

### 1. Explicit editable defaults
`SEA_PASS_DEFAULTS` remains the form/reset source of truth:

- `date: 'Jul 5'`
- `ship: 'ST'`

### 2. Explicit screenshot shell values
`SEA_PASS_APPROVED_SHELL_VALUES` is now fully explicit and no longer spreads `SEA_PASS_DEFAULTS`.

This prevents future form default changes from accidentally changing the renderer's understanding of what is baked into the screenshot.

Current shell values:

- `date: 'Apr 07'`
- `ship: 'QN'`
- `port: 'LOS ANGELES, CALIFORNIA'`

### 3. Overlay comparison uses shell values, not form defaults
`shouldRenderDynamicOverlay()` now compares the current normalized field value against the normalized shell value.

Therefore:

- form `ST` vs shell `QN` => overlay renders `ST`
- form `Jul 5` vs shell `Apr 07` => overlay renders `Jul 5`
- form `ORLANDO (PORT CANAVERAL),...` vs shell `LOS ANGELES, CALIFORNIA` => overlay renders Orlando

### 4. Forced live preview remount key
`SeaPassWebPass.tsx` now passes a data-based `key` to `SvgXml` so iOS/react-native-svg cannot reuse a stale rendered SVG when SeaPass fields change.

## Manual QA checklist

1. Open SeaPass Generator.
2. Confirm default Ship / ST Code field shows `ST`.
3. Confirm preview card shows `ST`, not `QN`.
4. Confirm default Sailing Date field shows `Jul 5`.
5. Confirm preview card shows `Jul 5`, not `Apr 07`.
6. Change Ship / ST Code to `NV`; preview should update to `NV`.
7. Change Ship / ST Code to `QN`; preview should allow the shell `QN` to remain without a duplicate overlay.
8. Change Ship / ST Code back to `ST`; preview should show `ST`.
9. Export PNG; exported card should show the same values as preview.
10. Export PDF; exported card should show the same values as preview.

## Scope safety
No sync, booked cruise, offer, Cruise Itinerary Booklet, storage, or casino logic was changed.
