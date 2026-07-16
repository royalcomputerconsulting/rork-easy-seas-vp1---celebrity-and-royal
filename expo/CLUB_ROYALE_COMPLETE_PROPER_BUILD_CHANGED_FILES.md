# Club Royale Complete Proper Build — Changed Files

Baseline: `EasySeas_V1242_Build314_CARNIVAL_SYNC_COMPLETE_ALL_DATA_FULL_CODEBASE(1).zip`

No package, Expo, Metro, Babel, TypeScript configuration, dependency, lock, EAS, or workflow files were changed.

## Runtime files

- `state/RoyalCaribbeanSyncProvider.tsx`
  - Separates Club Royale and Crown & Anchor field authority.
  - Maps and applies all authoritative Club Royale fields, including the 20,941-point API value shown in the supplied log.
  - Runs the dedicated C&A `loyalty/info` request immediately without navigating away and killing its timer.
  - Requires both authoritative C&A tier and points before closing the C&A lane.
  - Preserves existing C&A fields when the dedicated endpoint does not return authoritative data.
  - Adds transactional Royal/Celebrity Apply Sync rollback and readback verification.
  - Reconciles extracted upcoming/completed counts and logs canonical persistence counts.

- `state/LoyaltyProvider.tsx`
  - Persists Club Royale ID, tier, points, relationship points, and evaluation dates only when each field is authoritative in the current transaction.
  - Persists C&A ID/tier/points/relationship points independently by field authority.
  - Verifies AsyncStorage and selected-profile readback before committing provider state.
  - Rehydrates UserProvider immediately after successful persistence and after rollback.
  - Removes account-specific hard-coded Club Royale/C&A display totals from production loyalty calculation.

- `state/UserProvider.tsx`
  - Exposes scoped-storage rehydration so Settings/Profile can show verified post-sync values immediately.

- `state/CoreDataProvider.tsx`
  - Adds transactional write/readback/rollback guards for offers, available sailings, and booked/completed cruises.
  - Adds complete reconciliation ledgers and cardinality verification.
  - Keeps offer-to-sailing relationships and booked/history rows aligned with verified storage.

- `state/coreData/storageLoaders.ts`
  - Hydrates booked/history data only from persisted authenticated production rows.
  - Removes account-specific mock cruise injection that could change counts after restart.

- `app/(tabs)/settings.tsx`
  - Uses the selected persisted profile as the authoritative post-sync display source.
  - Displays canonical offer-sailing rows and separate upcoming/completed counts.

- `components/ui/UserProfileCard.tsx`
  - Prioritizes verified persisted C&A and Club Royale values over stale enrichment.
  - Treats an authoritative numeric zero as a real value.
  - Prevents impossible current/next tier cards and labels requalification correctly.

- `lib/royalCaribbean/loyaltyConverter.ts`
  - Recognizes the current casino endpoint fields: `casinoLoyaltyId`, `cruiseLoyaltyId`, `tier`, `individualPoints`, `relationshipPoints`, and evaluation dates.
  - Interprets generic `tier`/`individualPoints` only in verified casino context.
  - Tracks source and confidence separately for every loyalty field.
  - Prevents Club Royale values from becoming C&A values.

- `lib/royalCaribbean/types.ts`
  - Adds loyalty authority metadata and current casino API fields.

- `lib/royalCaribbean/bookedExtractionIdentity.ts` (new)
  - Creates stable extraction identities using reservation, cabin, guests, dates, and full payload evidence.
  - Prevents same-ship/same-date bookings from collapsing before Apply Sync.

- `lib/royalCaribbean/dataTransformers.ts`
  - Preserves guest and cabin identity through transformation.
  - Prevents generated `unconfirmed:` IDs from becoming real reservation numbers.

- `lib/royalCaribbean/syncLogic.ts`
  - Preserves every authoritative booked/completed record through preview and apply.
  - Retains all offer-to-sailing eligibility rows and rebuilds attachments after canonical IDs finalize.
  - Adds explicit reconciliation audits.

- `lib/dataIdentity.ts`
  - Uses reservation-first identity with cabin/guest signatures for reservation-free rows.
  - Prevents a shared internal ID from merging different real reservations.
  - Adds input-to-output dedupe ledgers.

- `lib/cruiseOverlapGuards.ts`
  - Converts the confirmed manifest from a replacement list into a non-destructive metadata overlay.
  - Rejects ambiguous ship/date fallback matches.
  - Ignores generated placeholder identifiers as authoritative reservations.

## Regression coverage

Updated legacy tests:
- `scripts/testV1230LoyaltySyncRepair.js`
- `scripts/testV1235BookedCompletedSyncRules.js`

New Club Royale regression suites:
- `scripts/testV1242Build314ClubRoyaleLoyaltyCompleteness.js`
- `scripts/testV1242Build314ClubRoyaleCruiseCompleteness.js`
- `scripts/testV1242Build314ClubRoyaleExtractionIdentity.js`
- `scripts/testV1242Build314ClubRoyaleOfferAttachmentCompleteness.js`
- `scripts/testV1242Build314ClubRoyaleApplySafety.js`
- `scripts/testV1242Build314ClubRoyaleEndToEndStateUI.js`

All new fixtures use sanitized test identities.
