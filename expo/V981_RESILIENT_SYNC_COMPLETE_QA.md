# Easy Seas v981 / 9.10.81 — Resilient Sync Complete Fix

Build markers:
- Version: 9.10.81
- Android versionCode: 91081
- iOS buildNumber: 9.10.81
- Sync engine: v9.8.1-resilient-sync-complete

## Why this build exists
The latest diagnostic showed the app was still running 9.10.78 and the Royal sync live page exposed four offers / 1,019 rows. The app incorrectly treated that as a non-authoritative failure because the guard was hard-coded to require five offers. It then zeroed the review offer counts even though valid rows had been captured.

## Fixes
- Treat four visible Royal offers with >=900 rows as a valid current live catalog, not a broken partial.
- Continue rejecting genuinely partial four-offer captures under 900 rows.
- Reject one-, two-, or three-offer Royal captures as partial discovery.
- Keep the five-offer / 1,073-row path valid when all five offers are visible.
- Preserve zero-overwrite safety for true failures.
- Settings/Admin diagnostic version is now 9.10.81.
- Completed-history logic from v980 is preserved: Royal completed/past sync target remains 57.

## Expected QA
1. Settings/Admin diagnostic shows version 9.10.81.
2. If Royal page shows five offers, review shows 5 offers / 1,073 rows.
3. If Royal page shows four offers, review shows 4 offers / about 1,019 rows, not 0.
4. Review shows 13 upcoming and 57 completed.
5. Apply Sync does not overwrite good data with zero rows.
6. Completed/Past after apply shows 57 Royal history rows.
