# V996 Certificate List Buttons QA

## Purpose
Fixes the missing Club Royale certificate-list buttons that were requested for the Royal/Celebrity sync screen after v995.

## Version
- App version bumped to `9.10.96`.
- Android versionCode bumped to `91096`.

## User-facing changes
- Added two buttons below **SYNC PRICING** and **EXPORT LOG** on the sync screen:
  - **THIS MONTH CERTIFICATE LIST**
  - **NEXT MONTH CERTIFICATE LIST**
- Both buttons scan Royal Caribbean / Club Royale certificate PDFs for A and C certificate sources.
- This month and next month are calculated dynamically from the device date using `YYMM` format.
  - Example: June 2026 = `2606`
  - Example: July 2026 = `2607`
- Buttons open a new full-screen certificate-list modal.

## Certificate list behavior
- Calls new backend tRPC route: `certificateExplorer.monthlyList`.
- Scans known A/C certificate codes for the requested month.
- Downloads/parses PDF text server-side.
- Returns:
  - Unique sailings count
  - Certificate row count
  - PDFs with sailing rows
  - PDF scan summary
  - Certificate summaries
  - Best visible opportunities
  - Full sailing row list
- Displays a filter box for ship, date, code, port, itinerary, or visible benefit.
- Opens individual certificate PDFs from any row.
- Opens the monthly C index directly from the list header.

## Personalization / tailoring
- The modal compares certificate rows against the app user's existing Booked tab by ship and sail date.
- Rows that match the user's booked cruise records are pinned first and marked with a booked-cruise badge.

## Files changed
- `app/royal-caribbean-sync.tsx`
  - Added this-month and next-month certificate-list buttons below Sync Pricing / Export Log.
  - Added modal state and button handlers.
- `components/CertificateMonthListModal.tsx`
  - New modal for full monthly certificate list evaluation.
- `backend/trpc/routes/certificate-explorer.ts`
  - Added `monthlyList` mutation and helper summary/highlight functions.
- `package.json`
- `app.json`

## QA checklist
1. Open Settings → Royal Caribbean Sync.
2. Confirm the main quick action area shows LOGIN / SYNC NOW.
3. Confirm the next row shows SYNC PRICING / EXPORT LOG.
4. Confirm the next row shows THIS MONTH CERTIFICATE LIST / NEXT MONTH CERTIFICATE LIST.
5. Tap THIS MONTH CERTIFICATE LIST.
6. Confirm modal opens and begins scanning A + C PDFs for the current YYMM code.
7. Tap NEXT MONTH CERTIFICATE LIST.
8. Confirm modal opens/scans the next YYMM code.
9. Confirm matching booked ship/date rows, if any, are pinned first and marked.
10. Confirm Open PDF works from certificate rows.
