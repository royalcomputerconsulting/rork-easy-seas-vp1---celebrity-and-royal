# EasySeas v870 Safe Sync Rollback QA

This build is based on the last non-crashing sync base, then applies only bounded/safe sync fixes.

## Fixed
- Removed the v869 risky Step 1 changes that caused the app/sync to fail.
- Repaired the injected Step 1 script regex so it evaluates successfully before runtime.
- Added bounded All Offers lazy-load scrolling so sync is not limited to the first visible few offers, while avoiding a long/hanging scroll loop.
- Added offer-code normalization for known Royal DOM suffix artifacts:
  - 26BCP105E -> 26BCP105
  - 26JUL104O -> 26JUL104
  - 26VTY104B -> 26VTY104
- Preserved dynamic live sync behavior: no fixed 201-row limit, no embedded CSV cap, no forced replacement with any sample data.
- Kept completed-cruise future-date guard: future upcoming cruises cannot be marked Completed.

## QA performed
- Verified package root contains app.json and package.json.
- Transpiled modified TypeScript files with TypeScript transpileModule.
- Extracted STEP1_OFFERS_SCRIPT and validated it with new Function(...), confirming injected browser script syntax is valid.
- Confirmed no fixed 201-row baseline/fallback function is present in the live Royal sync files.

## Expected behavior
- Sync Now should proceed past Step 1 instead of hanging/crashing.
- Sync Now should sync all currently visible/captured Royal offers dynamically, whether that is 3 offers/201 rows or 15 offers/1200+ rows.
- Sync Completed Cruises should use completed/history rows only and should not corrupt future upcoming cruises as completed.
