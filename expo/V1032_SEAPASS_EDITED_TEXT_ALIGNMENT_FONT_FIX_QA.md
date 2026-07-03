# V1032 — SeaPass Edited Text Alignment + Font Match Fix

## Purpose
Restore the SeaPass generator to the near-flawless v1017/v1019 shell behavior while keeping editable Star of the Seas values.

## Issue
The approved SeaPass shell is a baked screenshot. The shell text uses a thinner/smaller iOS-style font than the SVG overlay text. When fields changed from the shell values, the overlay text was visibly larger and misaligned:

- `Jul 5` appeared too far right/low and larger than the baked `Apr 07` style.
- `ST` appeared larger than the baked ship code style.
- Other edited values could look oversized compared with unedited baked shell values.

## Fix
- Kept the approved baked Key symbol only; no extra Key overlay is drawn.
- Kept shell/default split so the editable default remains `ST` / `Jul 5` over the baked `QN` / `Apr 07` shell.
- Switched SVG overlay font stack from Arial-first to Helvetica Neue / Helvetica-first for a closer iOS wallet match.
- Reduced edited field overlay font sizes to better match the baked shell.
- Repositioned the edited date overlay to align with the baked date region.
- Repositioned/reduced the edited ship code overlay so `ST` matches the baked ship-code size and right edge.
- Preserved shortened Orlando port display: `ORLANDO (PORT CANAVERAL),...`.

## Files changed
- `lib/seaPassWebPass.ts`

## Guardrails
- Do not rebuild the SeaPass from scratch.
- Do not draw a second Key icon.
- Treat the approved screenshot as the visual source of truth.
- Compare edited overlay values against the baked shell values, not the editable defaults.
