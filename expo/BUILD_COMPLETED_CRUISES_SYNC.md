# Easy Seas v8.5.1 — Completed Cruises Sync Build

This build preserves the working Royal Caribbean sync and adds a dedicated **SYNC COMPLETED CRUISES** action below Export Log.

## What changed

- Added a full-width **SYNC COMPLETED CRUISES** button on `app/royal-caribbean-sync.tsx`.
- Added `runCompletedCruisesSync(coreData)` in `state/RoyalCaribbeanSyncProvider.tsx`.
- The completed-cruises action reuses the existing authenticated WebView session.
- It navigates to `https://www.royalcaribbean.com/myaccount`.
- It relies on the existing Royal Caribbean network capture pipeline for enriched booking payloads.
- It filters only completed / past cruises, or sailings whose start date is before today.
- It persists completed cruises into cruise history without overwriting active offers, available cruises, or active booked cruises.
- Version bumped to `8.5.1`.

## Build notes

I could not run a full Expo/EAS binary build inside this sandbox because the dependency install did not complete here. This archive is ready to build locally with:

```bash
cd expo
npm install --no-audit --no-fund
npx expo export -p web --output-dir dist
# or for store builds:
npx eas build --platform ios
npx eas build --platform android
```
