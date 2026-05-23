# Easy Seas v8.6.5 Sync Payload Repair QA

This build patches the actual uploaded Expo archive and keeps the Expo project at the ZIP root.

## Fixes included

### 1. Offer payload sweep across all captured Royal payloads
- The network/auth monitors now keep an array of every captured offer/sailing payload instead of overwriting `capturedPayloads.offers` with only the last one.
- Step 1 now sweeps `capturedPayloads.offers`, `capturedPayloads.offerPayloads[]`, and `window.capturedOfferPayloads[]`.
- Every captured payload is normalized and parsed, then merged with DOM extracted rows.
- This prevents the app from only using the first offer payload, such as `Limitless Luck` with 54 sailings, while losing sailings from `Hot Hot July` and `Variety Selection`.

### 2. Strict closed-card date handling
- The app no longer treats random card text as a valid sailing row.
- Card-level fallback rows are only created when an explicit `Dates` / `Sailing Dates` / `Departure Dates` label is present.
- This prevents expiration dates such as `Redeem by Feb 14, 2026` from being captured as sailing dates.

### 3. Multiple sailing dates on one offer card
- Shared-year date lines like `Dates 2026 Aug 29, Sep 26, Oct 24, Oct 30` are expanded into separate sailings.
- The shared year is applied to every month/day fragment on the same line.

### 4. Ship-name cleanup
- DOM text such as `View detailsShip nameJewel of the Seas` is cleaned so the ship becomes `Jewel of the Seas`, not the whole prefixed UI string.

### 5. Completed cruise hard guard
- Future sailings can no longer be marked `Completed` just because the dedicated completed-cruise sync is running.
- Completed eligibility now requires a past sail date, a loyalty-history payload row, or a real past/completed/history context.
- The old dangerous fallback `completedCruisesSyncInProgress ? Completed : Upcoming` was removed.

### 6. Completed cruises available from both paths
- Loyalty-history payloads are cached for the Sync Completed Cruises button.
- If Sync Now already put completed cruises into app storage, the completed-cruises button can reuse those completed rows for review instead of returning nothing.

## QA performed
- Verified ZIP root contains `package.json` and `app.json` at top level.
- Ran TypeScript parse check with the available global `tsc`; dependency-related errors are expected because `node_modules` is not shipped, but no new syntax parse errors were found in the patched files.
- Manually inspected the patched Step 1 offer parser and completed-cruise guard logic.
