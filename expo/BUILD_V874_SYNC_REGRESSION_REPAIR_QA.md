# EasySeas v874 — Sync Regression Repair QA

## What this build fixes

### Regular Sync Now
- Removes the regression where a partial live pull could overwrite a previously complete offer set.
- If Royal under-exposes one offer in a run (example: Variety Selection falling from 107 to 1), the app now preserves existing rows for that offer instead of deleting them.
- Offer-row dedupe now includes offer code, ship, sail date, itinerary, cabin type, and guest count so legitimate rows with the same ship/date but different cabin/guest combinations are not collapsed.
- No hard row cap is used. The app can still accept 1200+ rows when Royal exposes them.

### Completed Cruises
- Broadens recognition of Royal loyalty-history URLs with or without a trailing slash.
- Keeps completed-sync additive/update-only, so it cannot wipe upcoming cruises.
- Keeps the future-date guard: future sailings cannot be marked completed.

## Expected sample result for offers (3).csv run
- Limitless Luck (26BCP105): 54
- Hot Hot July (26JUL104): 40
- Variety Selection (26VTY104): 107
- Total: 201

If a live run temporarily reports Variety Selection as only 1 row while existing storage has 107, existing Variety rows are preserved instead of being downgraded to 1.
