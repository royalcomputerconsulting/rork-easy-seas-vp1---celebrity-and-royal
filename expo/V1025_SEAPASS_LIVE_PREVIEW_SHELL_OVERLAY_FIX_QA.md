# V1025 SeaPass Live Preview Shell Overlay Fix QA

## Issue reported
The SeaPass Generator form accepted edits, but the live SeaPass card did not repaint some fields when the requested value matched the generator default. Specifically:

- The form field showed `ST`, but the card still showed the approved screenshot shell's original `QN` ship code.
- The form field showed `Jul 5`, but the card still showed the shell's original `Apr 07` date.
- Port changes appeared to work because that field differed from the generator default and therefore triggered an overlay.

## Root cause
The dynamic overlay renderer decided whether to paint a field by comparing the current form value to `SEA_PASS_DEFAULTS`.

That was wrong for v1022/v1023/v1024 because the approved SeaPass screenshot shell has its own baked-in values. The shell image contains values like `QN` and `Apr 07`, while the editable generator defaults intentionally use `ST` and `Jul 5`.

Because `ST` equaled the form default, the renderer skipped the ship overlay, leaving the shell's baked-in `QN` visible.

## Fix
Added `SEA_PASS_APPROVED_SHELL_VALUES` and changed overlay-render decisions to compare the current form values against the shell values, not the form defaults.

This means:

- If the shell says `QN` and the field says `ST`, the app now paints `ST` over `QN`.
- If the shell says `Apr 07` and the field says `Jul 5`, the app now paints `Jul 5` over `Apr 07`.
- Live preview, PNG export, and PDF export use the same overlay renderer, so they stay aligned.

## Files changed
- `lib/seaPassWebPass.ts`

## Safety notes
No sync, offers, booked cruises, storage, Cruise Itinerary Booklet, casino, or profile logic was changed.
