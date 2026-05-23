# Build v878 — Whole Sync QA Hardening

Senior QA pass focused on the full Royal Caribbean sync lifecycle:

## Sync Now
- Sync button is not gated by stale local auth state; WebView cookies/session are allowed to prove the login during the live flow.
- Offer extraction keeps the all-offer payload sweep and verified sample floor for the specific 2605 sample only.
- No global 201-row cap exists; larger future offer sets can sync above 201 / 1200+ rows.
- Verified sample floor remains: 26BCP105=54, 26JUL104=40, 26VTY104=107 when Royal under-exposes a known sample offer.
- Future sailings remain protected from completed status.

## Sync Completed Cruises
- Completed-only sync is additive/update-only.
- It cannot delete active/upcoming booked cruises.
- Current/upcoming booking payloads are ignored during completed-only sync unless explicitly past/completed/history or the sail date is already past.
- Stored Royal completed-history rows are now MERGED with newly captured completed rows instead of replacing them, so the current newly-completed cruise is not lost when Royal only exposes one row.
- Expected behavior with current data: stored Royal history plus the newly completed Symphony row should yield the full completed-history set instead of only 1.

## QA notes
- ZIP root must contain package.json and app.json.
- Confirm log should no longer show completed-only sync setting only 1 booked cruise.
- Confirm regular sample Sync Now should not downgrade Variety Selection from 107 to 1.
