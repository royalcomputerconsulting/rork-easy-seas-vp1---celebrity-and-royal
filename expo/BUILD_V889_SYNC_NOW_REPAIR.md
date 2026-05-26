# Easy Seas v889 Sync Now Repair

Built from the full v888 codebase so the logo/header changes are preserved.

## Fixed
- Repaired the main **SYNC NOW** flow without changing the separate completed-cruise sync path.
- Broadened Royal offer/sailing payload detection in the WebView network monitor instead of relying only on old 404 casino-offers endpoints.
- Added expanded DOM/table/list parsing after each **View Sailings** click so Royal layouts that expose sailings as cards, rows, or collapsed text can still produce ship/date rows.
- Increased the View Sailings hydration wait from 4.5s to 6.5s before parsing.
- Syncs visible offer tiles even when Royal hides the sailing table, while preserving existing sailing rows rather than wiping them.
- Repaired the normal Sync Now end-of-run loop by stopping the obsolete Royal `/account/courtesy-holds` and `/account/loyalty-programs` probes during normal sync. Royal normal sync now uses `/myaccount`.
- Kept all completed-cruise sync logic and the 45-second completed-history hydration wait unchanged.

## Preserved
- Full codebase, not a patch-only ZIP.
- Gauguin-style Easy Seas logo/header assets from v888.
- Completed Cruise Sync button and completed-history parsing behavior.
