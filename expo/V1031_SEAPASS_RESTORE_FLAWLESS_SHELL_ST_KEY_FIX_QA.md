# V1031 SeaPass Restore Flawless Shell / ST / Key Fix QA

## Purpose
Restore the SeaPass generator to the previously accurate v1017/v1019 visual baseline and fix the regressions reported by Scott:

- QN remained visible instead of ST.
- Apr 07 remained visible instead of Jul 5.
- The Key icon was being added on top of the existing baked-in Key, creating a doubled/overlapped Key.
- The newer Key patch introduced an artificial purple box / distorted key.
- The generator should remain visually identical to the previously flawless SeaPass shell, except the Port Canaveral port text must be shortened so it does not run off the card.

## Root cause
The approved SeaPass screenshot already contains a correct baked-in Key icon. Later builds treated the Key as something that always needed to be drawn as an overlay. That caused duplicated keys or fake-looking key patches.

The app also mixed two concepts:

1. Values baked into the screenshot shell, such as QN and Apr 07.
2. Editable Star defaults, such as ST and Jul 5.

When those are mixed, the renderer either skips the ST overlay or starts from legacy shell values.

## Fix
- Restored the SeaPass renderer to the earlier accurate v1017/v1019 shell-based overlay style.
- Removed all extra Key overlay drawing.
- The Key now comes only from the approved SeaPass shell, so it can appear exactly once.
- Added a permanent split between editable defaults and baked-in shell values.
- Editable defaults now start as:
  - ship: ST
  - date: Jul 5
  - port: ORLANDO (PORT CANAVERAL),...
- Shell comparison values remain:
  - ship: QN
  - date: Apr 07
  - port: LOS ANGELES, CALIFORNIA
- Dynamic overlays compare against the baked-in shell values, not editable defaults.
- Added a screen-level legacy migration guard that replaces the old QN / Apr 07 startup state with ST / Jul 5.
- Preserved the shortened Port Canaveral format to avoid the Orlando port name overflowing.

## Files changed
- lib/seaPassWebPass.ts
- app/seapass-generator.tsx

## Expected QA result
- Preview opens with ST, Jul 5, and ORLANDO (PORT CANAVERAL),...
- Exported PNG shows ST, not QN.
- Exported PNG shows Jul 5, not Apr 07.
- Exactly one Key icon appears.
- No purple Key box appears.
- No doubled or overlapped Key appears.
- The exported PNG captures the full SeaPass card, not only overlay text.
