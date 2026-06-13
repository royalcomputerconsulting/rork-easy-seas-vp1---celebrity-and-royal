# Easy Seas v973 — Sync Review UI Completed Cruises Fix

Build: 9.10.73
Engine marker: v9.7.3-sync-review-completed-count-ui

## User-reported issues addressed

1. Screenshot 3 showed offer sailings, upcoming cruises, and courtesy holds, but did not show completed cruises.
   - Added a top-level Completed / Past Cruises count card to the Data Extraction Complete modal.

2. Loyalty Status Updates did not clearly state which loyalty program was synced.
   - Added a program summary line under Loyalty Status Updates:
     - Royal sync: Club Royale / Crown & Anchor data captured
     - Celebrity sync: Blue Chip Club / Captain's Club data captured

3. The two orange warning boxes at the bottom of the review modal were noisy and should be removed.
   - Removed both warning boxes entirely.

4. Completed / Past Cruises row said "Apply only after reviewing source breakdown" instead of showing the count.
   - Changed the row subtitle to show the live completed count: "X completed row(s) found".

## Implementation details

- Added a derived completedCruiseCount that uses the max of:
  - state.syncCounts.completedCruises
  - completed/past/history rows in state.extractedBookedCruises
- Updated confirmation modal summary text to use completedCruiseCount.
- Updated sync section picker to display completedCruiseCount.
- Preserved existing Royal/Celebrity sync behavior and v972 data cleanup changes.

## Syntax QA

- Ran TypeScript transpile syntax check across 390 TS/JS files.
- Syntax diagnostics: 0.

## Runtime acceptance checks

After installing, run Royal sync and verify the Data Extraction Complete modal shows:

- Casino Offers: 5
- Available Offer Cruises: 1073
- Upcoming / Booked Cruises: 13
- Completed / Past Cruises: count shown, not source-breakdown text
- Loyalty: Club Royale / Crown & Anchor data captured
- No orange warning boxes

Run Celebrity sync and verify:

- Blue Chip / Celebrity labels are used
- Completed / Past Cruises shows count
- Loyalty: Blue Chip Club / Captain's Club data captured
- No orange warning boxes
