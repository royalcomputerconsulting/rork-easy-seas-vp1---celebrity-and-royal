# Easy Seas v991 — Cross-Device Backup Restore Fix QA

## Purpose
Fix a backup/restore failure where an iPhone-exported backup could import only partial data on the desktop/web app because the restore profile gate compared the source iPhone `ownerProfileId` to the desktop-generated `ownerProfileId` before checking that both records belonged to the same authenticated email.

## Root cause
Backup rows exported from iPhone had records like:

- `ownerProfileId: user_1777648172923`
- `sourceEmail: scott.merlis1@gmail.com`
- `dataOwnerEmail: scott.merlis1@gmail.com`
- `dataOwnerScopeId: scott.merlis1@gmail.com::install_...`

The desktop install can generate a different local profile id for the same account. The restore filter incorrectly rejected records when the profile id differed, even though the email matched.

## Fix
- Profile-gate matching now accepts a row first when `sourceEmail`, `dataOwnerEmail`, `ownerEmail`, `email`, `userId`, or the email prefix inside `dataOwnerScopeId` matches the active profile email.
- The install-local `ownerProfileId` check remains for same-device multi-profile isolation, but it can no longer block same-email cross-device restores.
- Restored records are still adopted to the active desktop/web profile id during import.

## Uploaded backup validation
Using `Easy Seas - Backup 06.13.26.json` and simulating a desktop profile id mismatch but the same authenticated email, the fixed matcher accepts:

- Available cruise sailings: 1,274 / 1,274
- Booked cruises: 44 / 44
- Casino offers: 5 / 5
- Calendar events: 191 / 191

## Regression protections preserved
- Christie/other users are still separate app users. Records for a different email do not match this account.
- Local-first/optional cloud behavior is preserved.
- v990 first-run sync retry stabilizer is preserved.
- v989 friendly sync log is preserved.
- v988 catalog dedupe and profile safety is preserved.

## Code QA
- TypeScript/JavaScript syntax parser checked 397 TS/TSX/JS/JSX files.
- Syntax diagnostics: 0.
- Targeted parser checks passed on changed files.
- Static asset alias check: no `require('@/assets...')` calls in app/components/lib/state.
- Version markers updated to 9.10.91 / 91091.

## Runtime QA checklist
1. Install v991 on desktop/web.
2. Import `Easy Seas - Backup 06.13.26.json` exported from iPhone.
3. Import dialog should report approximately:
   - 1,274 cruises
   - 44 booked cruises
   - 5 offers
   - 191 events
4. Settings export after restore should preserve those counts.
5. Open Offers tab and confirm available offer sailings exist.
6. Open Booked tab and confirm booked cruises exist.
7. Open Calendar and confirm events exist.
8. Confirm unrelated users do not receive Scott's restored data.
