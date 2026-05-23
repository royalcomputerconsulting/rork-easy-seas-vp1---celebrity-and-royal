# EASY SEAS v866 Senior Sync QA

This build was re-audited after v865 against the reported logs and the current Royal Caribbean sync failure modes.

## Verified / patched areas

### Sync Now offer parsing
- Keeps every visible offer card discovered by the View Sailings buttons.
- Sweeps every captured offer/sailing payload rather than only the first `/api/casino/v2/offers/merged` payload.
- Merges captured API rows, direct API rows, and expanded View Sailings rows by offer + ship + sailing date.
- Preserves offer cards when Royal hides the expanded sailing rows, but does not count blank offer placeholders as cruises.
- Rejects probable closed-card expiration rows such as `Redeem by Feb 14, 2026 View details Ship name Jewel of the Seas`.
- Expands shorthand date lines such as `Dates 2026 Aug 29, Sep 26, Oct 24, Oct 30` into four sailing rows.

### Completed Cruises sync
- Starts the completed-only flow from completed rows only; stale upcoming rows from prior Sync Now runs cannot bleed into the completed sync.
- Reuses cached Royal loyalty-history payload when available.
- Uses `/guestAccounts/loyalty/history/` as the preferred completed-cruise payload path.
- Uses Past Sailings UI only as fallback.
- Hard guard: future sail dates cannot be marked Completed even if the page/payload parser labels them incorrectly.
- If regular Sync Now captured completed rows, the Completed Cruises button can reuse those completed rows for review/sync.

## Manual QA cases run against the parser logic

- `Dates 2026 Aug 29, Sep 26, Oct 24, Oct 30` => `08/29/2026`, `09/26/2026`, `10/24/2026`, `10/30/2026`.
- `Redeem by Feb 14, 2026 View details Ship name Jewel of the Seas` => rejected as an expiration date, not a sailing.
- `Ship name Adventure of the Seas Dates 2026 Oct 24, Oct 30` => `10/24/2026`, `10/30/2026`.

## Known environment note

`npx tsc --noEmit` cannot be used as a clean final pass in this sandbox because dependencies are not installed and the uploaded archive references `expo/tsconfig.base`; this is an existing project setup issue, not introduced by this patch. The patched files were reviewed statically and parser logic was tested directly.
