# EasySeas v871 Completed Sync Fix QA

## Problem fixed
The dedicated **Sync Completed Cruises** button was capturing one valid completed cruise, but when the user confirmed sync it applied the result as if it were a full booked-cruise sync. That caused the app to replace the 14-booking portfolio with only the completed-sync subset.

## Fixes
1. Completed-only sync is now detected when there are no offer rows and all captured booking rows are completed/past rows.
2. Completed-only sync is now additive/update-only: it does **not** remove existing upcoming cruises.
3. Completed rows now survive transformation into the app model as `status: completed` and `completionState: completed`.
4. Future sailings remain hard-blocked from completed status.
5. Offer row dedupe was tightened to reduce duplicate sailing inflation caused by repeated API payload sweeps.

## Expected behavior from latest logs
- Sync Now should continue capturing the live offer payload sweep.
- Sync Completed Cruises should update/add completed cruises without deleting upcoming cruises.
- After confirming completed sync, log should show existing upcoming cruises preserved, not `Setting 1 active booked cruise(s)`.
