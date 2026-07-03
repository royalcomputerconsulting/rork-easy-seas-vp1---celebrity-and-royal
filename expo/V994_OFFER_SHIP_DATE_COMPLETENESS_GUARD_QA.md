# V994 Offer Ship/Date Completeness Guard QA

## Purpose
Guarantee that a Royal/Celebrity offer sync is not considered authoritative unless every visible offer code produces valid sailing rows with both ship name and sailing date.

## Issue from latest log
The latest Royal run discovered five Club Royale offers:

- 26VAR303 — 79 sailing rows captured correctly
- 26AUG104 — 0 / expected 33 rows
- 26SHC403 — 0 rows
- 2606C08 — 0 / expected 144 rows
- 26TOR303 — 0 rows

The app correctly failed safe and preserved the existing offer database, but the next build must make this rule explicit and testable.

## Changes
- Added per-offer ship/date completeness validation before Step 1 can become authoritative.
- Added explicit validation logging: `Verified <offerCode>: <count> ship/date sailing row(s)`.
- Known current offer row expectations are enforced where available:
  - 26VAR303 = 79
  - 26AUG104 = 33
  - 2606C08 = 144
  - 2606C05 = 1038
  - 2605C03A = 846
  - 26WCR403 = 55
  - 26SIG0804 = 4
- Any visible current offer with zero rows fails safe unless it is explicitly marked as a known stale/expired visible card.
- Any known offer with a short ship/date row count fails safe rather than applying a partial catalog.
- Ship/date duplicate detection logs warnings when row count exceeds unique ship/date pairs.
- Successful completion message now says: `Offer ship/date completeness verified`.

## Expected user-facing behavior
A valid Royal offer run must show all visible offers with non-zero row counts before the review page shows new available sailings.

If any visible offer still returns 0 rows, Easy Seas must preserve the existing database and show review with preserved offers/available cruises, not overwrite with a partial scrape.

## QA checklist
1. Install build 9.10.94.
2. Run Royal Sync Now fresh.
3. Confirm the green log shows offers found.
4. Confirm each visible offer produces rows.
5. Confirm technical NOTES include one `Verified <code>` line per visible offer with rows.
6. Confirm review shows authoritative offer count and sailing count only when all visible offer codes pass.
7. Confirm that if Royal returns a zero-row detail shell, Apply preserves existing offers and available cruises.
8. Confirm bookings and completed history still sync independently.
