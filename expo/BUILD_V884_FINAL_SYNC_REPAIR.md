# EasySeas v884 Final Sync Repair

Critical repair built from the working portions of the v861/v862 logs and the v883 codebase.

## Fixed
- Restored reliable WebView network capture during Sync Now by installing both `AUTH_DETECTION_SCRIPT` and `NETWORK_MONITOR_SCRIPT` before/after Royal page navigation.
- Explicitly captures Royal's current `https://www.royalcaribbean.com/api/casino/v2/offers/merged` payload in both fetch and XHR interception paths.
- Keeps the old working API/payload fallback path from v8.6.2 so DOM card rows do not overwrite real offer/sailing rows.
- Prevents placeholder card rows from syncing as real sailings when Royal exposes only offer cards.
- Completed cruise de-dupe now uses normalized `ship + sailing date`, preventing the 54 → 108 duplicate inflation caused by MM-DD-YYYY vs YYYY-MM-DD rows.
- Completed-only sync remains additive: it preserves existing offers, available sailings, and upcoming bookings.
- Existing completed-history seed rows are only used as a safety fallback and are de-duped against live/API/DOM rows.

## Expected healthy logs
- Sync Now should show network capture active, then captured offer payloads from `/api/casino/v2/offers/merged`, then real per-offer sailing rows.
- Sync Completed Cruises should show either live loyalty-history rows or the stored completed-history fallback, de-duped to the actual completed count rather than doubled.
