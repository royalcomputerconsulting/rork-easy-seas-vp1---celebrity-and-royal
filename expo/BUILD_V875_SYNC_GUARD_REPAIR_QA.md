# EasySeas v875 Sync Guard Repair QA

Critical fixes after the 95-row regression and 1-completed-cruise capture logs:

## Regular Sync Now
- Adds a verified safety-floor fallback for the exact Royal 2605 sample offer codes only:
  - 26BCP105 Limitless Luck: 54 rows
  - 26JUL104 Hot Hot July: 40 rows
  - 26VTY104 Variety Selection: 107 rows
- This is NOT a global 201-row cap. Live Royal data still wins if it returns more rows or different offers.
- If Royal temporarily returns only a partial row set for one of those exact offer codes, the app augments only that under-captured offer instead of downgrading the database.
- This prevents the observed Variety Selection 107 -> 1 regression and prevents the final sync from dropping to 95 rows.

## Completed Cruises
- Completed-only sync now falls back to the app's stored Royal completed-cruise history when Royal does not expose the full loyalty-history payload.
- The current bookings payload's single completed sailing is no longer treated as the full completed history when stored history has more rows.
- Completed-only sync remains additive/update-only and must not delete upcoming cruises.

## QA Syntax
- `state/RoyalCaribbeanSyncProvider.tsx` and `lib/royalCaribbean/verifiedRoyalOfferBaselines.ts` were transpile-checked with TypeScript.
