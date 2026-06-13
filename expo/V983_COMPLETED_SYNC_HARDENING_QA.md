# V983 Completed Sync Hardening QA

Build: 9.10.83 / engine v9.8.3-completed-sync-hardening

## Purpose
This build hardens completed-cruise staging and apply behavior so Royal Past(57) is visible on the Apply Selected Sync page and persisted into the completed/history lane, even when Royal's loyalty/history payload arrives a few seconds after the upcoming-booking payload.

## Completed-cruise fixes
- Apply Selected Sync stages Royal Completed / Past Cruises before review.
- Royal Past(57) reconciliation runs before the review screen, not only after Apply.
- The review page should show **57 completed row(s) found** for Royal sync.
- The final Apply step still runs the completed-history repair before persistence.
- The loyalty/history parser still accepts the live 57-row payload and dedupes against staged truth rows.
- The completed sync count is initialized even if the history payload arrives before `syncCounts` exists.
- Royal completed rows remain in the completed/history lane and should not inflate active upcoming counts.

## Expected Royal sync results
- Club Royale offers: 4 visible / ~1,019 rows or 5 visible / 1,073 rows depending the live Royal page.
- Upcoming / Booked: 13 active rows.
- Completed / Past: 57 rows shown in Apply Selected Sync.
- After apply: Booked/History completed section shows 57 Royal completed cruises.
- Diagnostic version: 9.10.83.

## Important note
The uploaded diagnostic showing the broken flow was from 9.10.78. Install this build and confirm the diagnostic reports 9.10.83 before retesting.
