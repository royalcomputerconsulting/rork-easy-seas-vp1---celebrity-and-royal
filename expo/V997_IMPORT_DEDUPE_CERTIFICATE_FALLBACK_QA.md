# V997 — Manual Import Assignment/Dedupe + Certificate List Fallback QA

## User-reported problems

1. Manually loading `offers.csv` found the right rows, but treated the import as unknown-email data instead of applying the rows to the current user.
2. The same manual import could duplicate the catalog because owner/source metadata made otherwise-identical offer rows look different.
3. This Month / Next Month certificate list buttons opened, but the list reported unavailable and Reload did not recover.

## Fixes applied

### Manual offers.csv import ownership

- Manual CSV imports now stamp imported cruise/offer rows with the active/current user before merging:
  - `ownerProfileId`
  - `sourceEmail`
  - `importStatus: assigned`
  - `reconciliationStatus: matched`
- This prevents a normal manual import by the logged-in user from going into the unknown-email assignment queue.

### Offer dedupe hardening

- `dedupeCasinoOffers` now includes a loose natural-key merge path for offer rows with the same:
  - source/brand
  - offer code
  - ship
  - sailing date
  - room type
  - offer/title
- The loose merge only crosses owner/source boundaries when one side is incomplete, unassigned, or review-needed, so it can clean the bad duplicated import case without merging two clearly separate traveler profiles.

### Certificate list fallback

- Certificate month list now tries the backend route first.
- If the backend route is unavailable, stale, or missing the new route, the app falls back to a device-local PDF fetch/parser.
- Reload now retries both paths instead of only retrying the failing backend call.
- The modal now shows whether the list loaded from the backend or the local parser.

## Files changed

- `app/(tabs)/settings.tsx`
- `lib/dataIdentity.ts`
- `components/CertificateMonthListModal.tsx`
- `lib/royalCaribbean/localCertificateMonthList.ts`
- `app.json`
- `package.json`

## Version

- App version: `9.10.97`
- iOS build: `9.10.97`
- Android versionCode: `91097`
