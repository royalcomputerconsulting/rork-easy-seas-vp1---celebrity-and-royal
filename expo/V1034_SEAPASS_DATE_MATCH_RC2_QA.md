# V1034 SeaPass Date Match RC2 QA

## Purpose
Surgical follow-up to v1033. The app was visually almost correct, but the edited sailing date overlay did not match the approved SeaPass shell's original date size and placement.

## Changed file
- `lib/seaPassWebPass.ts`

## Exact change
Restored the date overlay geometry to the approved Archive(12) / v1017 accurate SeaPass values:

- `x: 958`
- `y: 178`
- `fontSize: 62`
- `letterSpacing: -1.6`
- `textAnchor: 'end'`

This keeps the edited `Jul 5` date in the same visual position/scale family as the original baked-in `Apr 07` text.

## Preserved behavior
- Approved shell remains untouched.
- Baked-in Key symbol remains the only Key symbol.
- No fake Key overlay is drawn.
- Default editable ship code remains `ST`.
- Shell comparison value remains `QN`.
- Default editable date remains `Jul 5`.
- Shell comparison date remains `Apr 07`.
- Port remains shortened as `ORLANDO (PORT CANAVERAL),...`.
- Maritime Weather accordion behavior and dashboard count fixes from v1027/v1029/v1033 remain unchanged.

## QA performed
- Verified `SEA_PASS_DEFAULTS.date` is `Jul 5`.
- Verified `SEA_PASS_APPROVED_SHELL_VALUES.date` is `Apr 07`.
- Verified `SEA_PASS_DEFAULTS.ship` is `ST`.
- Verified `SEA_PASS_APPROVED_SHELL_VALUES.ship` is `QN`.
- Verified date overlay uses restored approved-shell coordinates and font size.
- Verified dynamic overlays are still compared to the approved shell values, not editable defaults.
- Verified the overlay key list does not include a Key overlay.
- Verified changed files transpile with TypeScript `transpileModule` without diagnostics.

## Device QA note
This archive has source-level and static QA in this environment. Final confirmation still requires installing the TestFlight/device build and exporting one PNG, because native image loading and iOS screenshot/export behavior cannot be fully simulated here.
