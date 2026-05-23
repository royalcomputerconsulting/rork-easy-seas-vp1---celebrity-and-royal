# EasySeas v873 Sync Now + Completed Cruises Final QA

## Purpose
This build addresses the two critical remaining sync issues found in the v870-v872 logs:

1. Regular Sync Now found the correct 201 offer rows during extraction, but the final state/preview inflated the count to 255 because duplicate rows from multiple payload paths were not deduped strictly enough.
2. Sync Completed Cruises found only the one newly completed booking from the current bookings payload instead of the full historical past-cruise payload.

## Regular Sync Now fixes
- Offer row dedupe now uses the real row identity:
  - normalized offer code/name fallback
  - ship name
  - sailing date
  - itinerary
  - cabin type
  - guest count
- It intentionally does not include sourcePage, offer name, expiration date, or offer type in the row-dedupe key because those fields vary between DOM/API/payload sweeps and caused the 201 -> 255 inflation.
- Step 1 and final summary now run through the normalized/deduped offer rows before logging or previewing counts.
- Expected result for the provided 3-offer sample:
  - Limitless Luck (26BCP105): 54
  - Hot Hot July (26JUL104): 40
  - Variety Selection (26VTY104): 107
  - Total: 201
- No hardcoded 201-row cap exists; this is dynamic and can sync 1200+ rows when Royal exposes that data.

## Completed Cruises fixes
- Loyalty-history parsing is no longer limited to `payload.sailings`.
- It now deep-walks Royal loyalty payloads for arrays that look like ship/date sailing history, including nested keys like sailingHistory, cruiseHistory, completedSailings, pastSailings, pastCruises, completedCruises, history, payload, data, items, and results.
- Any loyalty payload, including broader loyalty data payloads, is checked for nested completed/past sailings, not only the exact `/guestAccounts/loyalty/history/` URL.
- Sync Now imports completed/past rows when a valid loyalty-history payload appears, restoring the old successful behavior.
- Sync Completed Cruises reuses the cached full history payload when present.
- Future sailings remain hard-blocked from being marked completed.
- Completed-only sync remains additive/update-only and cannot wipe upcoming bookings.

## Validation performed
- TypeScript parse validation passed for:
  - state/RoyalCaribbeanSyncProvider.tsx
  - lib/royalCaribbean/offerPayloadParser.ts
  - lib/royalCaribbean/step1_offers.ts
  - lib/royalCaribbean/networkMonitorScript.ts
  - lib/royalCaribbean/syncLogic.ts
  - lib/royalCaribbean/dataTransformers.ts
- ZIP root verified: package.json and app.json are top-level.
