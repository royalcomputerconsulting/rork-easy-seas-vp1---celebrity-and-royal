# Easy Seas v972 / 9.10.72 — Remaining Issues Cleanup QA

Build: 9.10.72  
Engine marker: `v9.7.2-production-detail-data-cleanup`

## Why this build exists
The latest diagnostic exported by the device reported version `9.10.66`, which means the installed app was stale. The log also showed thousands of `CruisePlanning` calculations where available-offer rows were counted as real upcoming bookings. That polluted planning metrics and could freeze the app when opening cruise detail screens.

## Fixes applied

1. **Version hardening**
   - `app.json` version: `9.10.72`
   - iOS buildNumber: `9.10.72`
   - Android versionCode: `91072`
   - `package.json` version: `9.10.72`
   - Settings/Admin diagnostic export version: `9.10.72`

2. **Cruise detail freeze protection**
   - Fixed the detail-context `useMemo` dependency so it no longer self-references `detailContextCruiseRecords`.
   - Cruise detail context now separates real booked/completed/history records from available-offer catalog rows.
   - Large offer rows are allowed only as a small contextual match set when needed for replacement suggestions.

3. **CruisePlanning data cleanup**
   - `buildPortTracker` now uses only real booked/upcoming/completed trip records for history calculations.
   - `calculateShipFamiliarityScore` now uses only real booked/upcoming/completed trip records for `timesSailed`, `nightsOnboard`, and `upcomingBookings`.
   - Available-offer catalog rows no longer inflate ship familiarity, port history, or upcoming booking counts.
   - Verbose `CruisePlanning` logs are gated behind `globalThis.__EASYSEAS_VERBOSE_CRUISE_PLANNING` so the diagnostic log is not flooded during normal app use.

4. **Offer-row classification safety**
   - A row with `status=booked` or `status=upcoming` is never treated as an available-offer catalog row simply because it has an offer code.
   - Completed records remain in completed/history lanes.

## Syntax QA
A syntax-only TypeScript transpilation pass was run across the codebase:

- Files checked: 390
- Syntax diagnostics: 0

A full `tsc --noEmit` cannot complete in this container because the uploaded source archive does not include `node_modules` and the Expo base tsconfig is unavailable, but the edited files pass syntax validation.

## Runtime acceptance checks after install

1. Settings diagnostic must report `version: 9.10.72`.
2. Opening any Cruise tab row should route to `/cruise-details` without freezing.
3. Opening any Booked tab row should route to `/cruise-details` without freezing.
4. Diagnostic logs should no longer show hundreds/thousands of `[CruisePlanning] Ship familiarity calculated` lines during normal navigation.
5. Ship familiarity should no longer show impossible values like `upcomingBookings: 282` for available-offer sailings.
6. Royal offer catalog should settle at 5 offers / 1,073 available rows after a clean Royal sync.
7. Celebrity/Blue Chip sync should remain brand-scoped and not overwrite Royal loyalty values.
8. Completed cruises should remain in the completed/history lane and not inflate upcoming/booked counts.
