# EasySeas v880 Sync Source Runtime Repair

Fixes the TestFlight red-screen error:

`Property 'syncSource' doesn't exist`

## Changes

- Added the missing `syncSource` variable inside the main `runIngestion` flow before it is used during offer augmentation/logging.
- Completed-only sync now skips `setCasinoOffers()` and `setCruises()` when no authoritative offer/available-cruise rows were captured, so it cannot write empty offer/cruise arrays.
- Royal offer direct fetch now tries the current `/api/casino/v2/offers/merged` endpoint before falling back to the older endpoint that was returning 404.
- Existing completed-history protections remain: completed-only sync is additive/update-only and future sailings cannot be marked completed.
