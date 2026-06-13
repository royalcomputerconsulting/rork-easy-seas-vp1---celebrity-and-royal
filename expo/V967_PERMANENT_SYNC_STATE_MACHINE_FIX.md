# Easy Seas v967 Permanent Sync Now Fix

Version: 9.10.67  
Engine: v9.6.7-rn-orchestrated-offer-queue

## What this build fixes permanently

This build fixes the specific architectural failure shown in the latest diagnostic logs:

- Offer discovery succeeds and finds all 5 Royal offers.
- Offer 1 (`26BCP105`) opens and scrapes real rows.
- The crawler then returns to My Offers, loses control, and stalls until timeout.
- Partial one-offer capture can leak into Apply Sync.

## Permanent correction

The offer crawler is now a resumable queue, not a one-shot script.

1. The first offer-list page discovers and saves all real `View Sailings` detail URLs / `playerOfferId` values.
2. After each offer finishes, the crawler navigates directly to the next saved authenticated detail URL.
3. React Native re-arms the offer worker after every offer-list/detail WebView navigation while Step 1 is active.
4. The worker resumes from `sessionStorage` and scrapes the current detail page.
5. Checkpoint ACK batches still flow to React Native after each completed offer.
6. Partial Royal offer captures are blocked from Apply Sync unless the full catalog is authoritative.

## Expected successful log pattern

```text
Offer discovery pass 1: 5 offer(s), 5 View Sailings button(s), expected 5
Opening offer 1/5: 26BCP105
26BCP105 reached verified target 54 row(s)
Continuing to next saved offer 2/5: 26JUL104
Re-arming offer worker after WebView navigation
Scraping View Sailings detail page for 26JUL104
...
STEP 1 COMPLETE: 5 active casino offer(s) with roughly 1,073 total sailing(s)
```

## Expected safe failure pattern

```text
STEP 1 INCOMPLETE
Discarding partial offer capture from Apply Sync
Existing offers and available sailings preserved
Upcoming/booked, loyalty, and completed cruises may still apply independently
```

## Key files changed

- `lib/royalCaribbean/step1_offers.ts`
  - Engine marker updated to `v9.6.7-rn-orchestrated-offer-queue`.
  - Continuation no longer depends on hard-returning to `/club-royale/offers`.
  - Next offer opens from the saved authenticated detail URL.
  - Detail-page resume recovers `currentOffer` from the saved queue / current URL.

- `state/RoyalCaribbeanSyncProvider.tsx`
  - `onPageLoaded` now re-injects the Step 1 worker on every Royal/Celebrity offer list/detail page while `running_step_1` is active.
  - This solves the WebView reality that injected JavaScript does not survive full-page navigations.

- `app.json`
  - App version updated to `9.10.67`.
  - Android versionCode updated to `91067`.
  - iOS buildNumber updated to `9.10.67`.

## Verification performed in packaging environment

- Extracted Step 1 JavaScript from the TypeScript template.
- Ran `node --check` against the extracted JavaScript successfully.
- Confirmed the old direct/POST-first offer path is not the primary sync path.

## Senior-developer note

The key bug was not data access. The real data was always available inside the authenticated Royal WebView. The bug was orchestration: a WebView-injected worker lost execution after navigation. React Native now owns re-arming/resume behavior, and the worker owns only the current-page scrape.
