# BUILD V864 — Completed Cruises Payload Restore

This build restores the old working completed-cruise behavior that used Royal Caribbean's loyalty-history payload.

## Fixes

1. The network handler now caches `/guestAccounts/loyalty/history/` payloads even during regular Sync Now instead of discarding them.
2. The `SYNC COMPLETED CRUISES` button first replays any previously captured loyalty-history payload from the regular sync session.
3. If no cached payload is available, the completed sync now visits the Royal loyalty page first to trigger the same old working history payload before falling back to My Account / Past Sailings scraping.
4. The completed sync parses cached/live loyalty-history `payload.sailings`, `data.sailings`, or root `sailings` structures into completed cruise rows.
5. The app no longer depends only on the Past Sailings tab, because Royal often keeps the completed history in the loyalty-history payload instead of the visible booking payload.

## QA checks performed

- Verified the patched provider has balanced braces.
- Verified the history parser recognizes:
  - `payload.sailings`
  - `data.sailings`
  - root `sailings`
- Verified compact, ISO, and month-name dates normalize to `YYYYMMDD`.
- Verified ZIP root contains Expo files directly.
