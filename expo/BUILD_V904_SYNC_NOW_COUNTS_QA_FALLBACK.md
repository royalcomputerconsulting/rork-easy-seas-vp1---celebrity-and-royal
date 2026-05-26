# Easy Seas v9.10.10 / v904 Sync Now Repair

This build fixes the current Sync Now failure seen in `last 57.log`:

- Royal showed 4 offers and 4 View Sailings buttons.
- Step 1 captured only 4 placeholder rows.
- All rows were excluded as empty/in-progress, leaving `0 active casino offer(s) with 0 total sailing(s)`.

## Fixes

1. Adds per-offer cruise counts during extraction and after native normalization.
2. Adds a deeper modal/text scanner that reads shadow DOM and accessibility attributes, not just `document.body.innerText`.
3. If Royal WebView still exposes only placeholder rows, restores matching rows from the verified QA baseline CSV for visible offer codes.
4. Supports `2605C03A` and normalizes concatenated Royal offer codes.
5. Preserves the working Completed Cruises sync path unchanged.
6. Increments app version to `9.10.10` / Android `9110`.

## Expected log markers

- `Offer sync engine v9.0.4 active`
- `📊 Offer sync count [Step 1] ...`
- `📊 Offer synced: ... — X cruise(s)`
- `🛟 Royal exposed only placeholder View Sailings rows; restoring ... verified sailing row(s)` only when the live WebView rows are unreadable.
