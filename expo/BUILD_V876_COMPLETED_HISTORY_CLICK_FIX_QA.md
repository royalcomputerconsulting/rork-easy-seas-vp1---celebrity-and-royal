# EasySeas v876 — Completed History Click/API Fix QA

This build addresses the completed-cruise sync failure where the app only captured the current-bookings payload's single completed sailing instead of the full Royal past-cruise history.

## Completed Cruises fixes

- Completed-only sync now ignores normal current/upcoming booking payloads unless the payload or URL is explicitly past/completed/history.
- Added a Loyalty Programs page click helper that searches for and clicks Royal's Cruise History / Past Cruises / Past Sailings link before falling back to My Account.
- Added a second click attempt after the history page opens to activate Past Cruises / Sailing History.
- Direct loyalty-history fetch now tries multiple Royal endpoint shapes instead of only one URL.
- The network monitor now deep-walks loyalty-history payloads instead of requiring `payload.sailings` at the top level.
- Completed-only sync remains additive/update-only and must not confuse upcoming booked cruises with completed cruises.
- Future sail dates remain blocked from being marked completed.

## Expected successful completed-sync log

- Should not process the 14 current/upcoming bookings as the completed result.
- Should show either a captured Royal loyalty-history payload or a successful Past Cruises/Sailing History UI scrape.
- Target result: about 55 past/completed cruises, not 1.
