# Easy Seas v902 / 9.10.8 — Sync Now Fully Working Baseline Restore

This build rebuilds Sync Now from the last proven offer/sailing solution instead of the later broken banner/context experiments.

## Baseline restored
- `BUILD_V860_SYNC_SEPARATION_FIX.md` / `BUILD_V861_QA_REPORT.md` showed the working target:
  - 3 offers
  - 200 total attached sailings
  - Limitless Luck 54, Hot Hot July 41, Variety Selection 105
- The v861 `step1_offers.ts` button-driven DOM-first engine is restored as the Sync Now Step 1 foundation.
- The v861/May-8 `step2_upcoming.ts` path is restored as the upcoming-cruise network capture foundation.

## Kept from later fixes
- Completed-cruise sync path was not changed.
- Logo/header work was not changed.
- App version was incremented to 9.10.8 / Android versionCode 9108.
- Bridge memory protection remains: offer rows are chunked and large DOM text blobs are trimmed before crossing the WebView bridge.
- Banner guard remains narrow: READY TO PLAY / casino-credit controls are skipped only when they are not real coded offers.

## Expected marker
`Offer sync engine v9.0.2 active`

## Expected behavior
- Step 1 should again process the real offer buttons and attach real ship/date rows instead of placeholder rows.
- Step 2 should use the restored May-8/v861 upcoming cruise payload capture behavior.
