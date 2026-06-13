# Easy Seas v980 — Completed History 57 Fix QA

## Build
- Version: 9.10.80
- Android versionCode: 91080
- iOS buildNumber: 9.10.80
- Engine marker: v9.8.0-completed-history-57-fix

## Fixes
1. Apply Selected Sync page now floors Royal completed/past count to the visible Royal Past(57) source-of-truth once Royal history is available.
2. Loyalty/history parser updates `syncCounts.completedCruises` as completed rows arrive, so the review modal can refresh from 0/placeholder to the actual completed count.
3. Royal completed history reconciliation now repairs missing rows if the app only persists/displays 54 or fewer completed rows after sync.
4. Booked/completed dedupe no longer merges same-ship/same-date rows when both records have different reservation numbers.
5. The 2026-05-10 Symphony row is retained as a 0-point Royal history item for Past(57) reconciliation, with a note that the user says it was replaced by Icon 2026-05-09.
6. Supplemental Symphony 2026-05-17 is now marked completed, not upcoming.
7. Stale overlapping Symphony 2026-05-10 is no longer treated as an active upcoming cruise.

## Expected QA
- Royal sync review modal shows Completed / Past Cruises: 57 completed rows found.
- After Apply Selected Sync, Booked/Completed view shows 57 Royal completed history rows.
- Completed list includes the 0-point Symphony 2026-05-10 and 2026-05-17 records if Royal history reports them.
- Active upcoming count should not include Symphony 2026-05-10 as an upcoming cruise.
- Royal completed points total should remain 542 from the pasted history list, because the two Symphony records are 0-point records.
