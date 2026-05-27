# Easy Seas v925 / 9.10.31 Live Regex Sync Rebuild QA

## Scope
- Rebuilt Sync Now Step 1 from scratch as a live-only Royal Caribbean v2/RSC/DOM scraper.
- No verified CSV baseline fallback.
- No provider-side row fill.
- No fake zero-cruise offers.
- Every detected cruise date is expanded into one individual row per ship/date.

## Key changes
- Royal v1 casino-offers POST is no longer used by Step 1.
- Step 1 now tries live sources in order:
  1. `/api/casino/v2/offers/merged`
  2. `/api/casino/v2/offers/facets`
  3. `/club-royale/offers/{offerCode}?playerOfferId=...` RSC/detail pages
  4. View Sailings DOM/modal fallback
- Added regex date expansion for grouped date lines:
  - `Dates 2026 Aug 29, Sep 26, Oct 24, Oct 30`
  - `Jun 12, Jun 26, Jul 10, 2026`
  - `June 12, 14, 21, 28, 2026`
  - numeric, ISO, compact YYYYMMDD, and month-name formats
- A valid row requires offer code + offer name + ship name + sailing date.
- Dedupe key is canonical offer code + ship + sailing date + cabin + guests.

## Expected marker
`Offer sync engine v9.2.5 active: LIVE-ONLY Royal v2/RSC + regex ship/date row expansion; no CSV/baseline fallback`

## QA performed
- app.json version updated to 9.10.31 / 9131.
- Step 1 injected JavaScript extracted and checked with node --check.
- RoyalCaribbeanSyncProvider TypeScript syntax/bundle check performed with external app dependencies.
- Grep verified no `royalOffersQaBaseline` in Royal sync code.
- Grep verified Step 1 no longer references `/api/casino/casino-offers/v1`.
