# Build v877 – Sync Button/Auth-State Repair

Fixes regression where Sync Now and Sync Completed Cruises could be disabled or blocked because the local auth state reverted to `not_logged_in` even though the WebView still had a valid Royal session/cookies.

Changes:
- Sync Now button is no longer disabled solely by stale auth state.
- Sync Completed Cruises no longer hard-stops solely because local auth state says not logged in.
- Both flows log a warning and attempt to use the current WebView session/cookies.
- Existing completed-cruise protections from v876 remain in place: do not confuse upcoming bookings with past cruises, future-date guard remains, completed-only sync is additive.
