# Easy Seas v989 — Fast Sync + Friendly Log QA

## Build
- Version: 9.10.89
- Android versionCode: 91089
- iOS buildNumber: 9.10.89
- Sync engine: v9.8.9-fast-sync-friendly-log

## Verified from last 12(2).log
The v988 sync completed successfully:
- 6 offers scraped
- 2,120 available offer sailings staged/applied
- 12 upcoming/booked bookings captured from Royal API during Step 2
- 57 completed/past cruises staged before review
- Apply preview staged 57 completed/past cruises
- Apply persisted 6 offers, 2,120 available cruises, 14 active booked cruises, and 57 completed cruises

## Changes in v989
### Speed improvements
- Increased WebView-to-app offer batch size from 50 rows to 125 rows.
- Increased message character budget from 46,000 to 95,000 chars per batch.
- This should reduce a 2,120-row catalog handoff from about 105 batches to about 17–25 batches depending row size.
- Reduced stable-scroll stop threshold from 8 to 5 stable rounds.
- Reduced per-scroll wait from 240ms to 140ms.
- Reduced Load More/Next wait from 900ms to 650ms.
- Reduced offer detail pre-scrape wait from 2500ms to 1500ms.
- Reduced offer-list startup wait from 2200ms to 1500ms.
- Reduced Step 2 page navigation timeout from 18s to 14s.

### Friendly Sync Log improvements
- The on-screen Sync Log now shows 3 recent lines instead of 2.
- User-facing log entries are converted into friendly statuses.
- URL-heavy HTTPS scrape logs are no longer shown directly in the user-facing green log.
- Technical URLs remain in exported diagnostics/notes for debugging.
- Friendly examples include:
  - Opening offers
  - Reading offers page
  - Found offer 26SIG0804 — 2026 Signature Event
  - Opening offer 1/6: 26SIG0804
  - Scraping offer 26SIG0804
  - Finished offer 26SIG0804: 4 sailing(s)
  - Opening loyalty page
  - Opening booked cruises page
  - Reading booked cruises
  - Scraped completed cruises
  - Sync review is ready
  - Sync applied successfully

### Data safety
- Completed-cruise dedupe now compares bookingId/reservationNumber and sailingStartDate/sailDate so late loyalty/history payloads do not add duplicates after Royal Past(57) staging.
- Local-first mode now skips post-Apply backend flush unless EXPO_PUBLIC_EASYSEAS_CLOUD_BACKUP_ENABLED=true.

## QA Checks Run
- Targeted TypeScript check on logger and step1_offers passed with ES2022 target.
- Source grep confirms no require('@/assets...') calls in app/state/lib/components.
- Source grep confirms Sync Log display uses slice(-3).
- Source grep confirms engine marker v9.8.9-fast-sync-friendly-log.
- Source grep confirms app/package versions 9.10.89 / 91089.

## Device QA Checklist
1. Install v989.
2. Confirm Settings/Admin diagnostic version is 9.10.89.
3. Run Royal sync.
4. Confirm visible log shows 3 friendly status lines.
5. Confirm no raw HTTPS URL appears in green on-screen user log.
6. Confirm offers review shows 6 offers and about 2,120 sailings when the same Royal catalog is visible.
7. Confirm completed/past shows 57 before Apply.
8. Apply all sections.
9. Confirm app persists 6 offers, 2,120 available sailings, active booked cruises, and 57 completed/past cruises.
10. Export diagnostics if any count differs.
