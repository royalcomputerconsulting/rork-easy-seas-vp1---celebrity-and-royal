# V1036 — User Manual 9.11.27 Refresh QA

## Purpose
Update the Easy Seas user manual so the source archive reflects the latest app behavior and the newest versioning rule.

## Versioning
- Previous source archive: v1035 / 9.11.26
- New source archive: v1036 / 9.11.27
- App version: 9.11.27
- iOS buildNumber: 9.11.27
- Android versionCode: 91127
- package.json version: 9.11.27
- Settings diagnostic export version: 9.11.27

## Manual updates
Updated `USERMANUAL.md` to include current documentation for:

- Available Cruises vs Booked Cruises vs Completed Cruises
- Dashboard count rules
- Offers count rule
- Royal/Celebrity/Carnival/Silversea navigation context
- Sync, import, export, and backup behavior
- Cruise Itinerary Booklet
- Maritime Weather accordion behavior
- Maritime Weather alert-count badge behavior while closed
- Accurate itinerary-based weather location rules
- Star of the Seas July 5–12, 2026 Basseterre / St. Kitts correction
- Day Agenda weather behavior
- SeaPass Generator latest default fields
- SeaPass shell-vs-editable-default architecture
- SeaPass Key dedupe rule
- SeaPass date alignment rule
- SeaPass ST ship-code rule
- SeaPass port shortening rule
- Versioning rule: every future build increments by one patch version
- Troubleshooting for SeaPass, weather, counts, sync/import, and exports
- Updated legal/disclaimer language for gambling, weather, tax/financial, cruise-line policy, and trademarks

## In-app manual updates
Updated `components/UserManualModal.tsx` to reflect:

- App Version 9.11.27
- Last Updated June 2026
- Accurate Data Overview wording
- Maritime Weather accordion and alert-badge behavior
- SeaPass Generator defaults and one-Key rule
- Latest SeaPass / weather / dashboard count rules

## QA performed
- Verified `USERMANUAL.md` now starts with App Version 9.11.27.
- Verified `USERMANUAL.md` documents all latest SeaPass, weather, count, and versioning rules.
- Verified `app.json`, `package.json`, and Settings diagnostic version use 9.11.27 / 91127.
- Verified no active source version string remains at 9.11.26 except historical QA notes and manual lineage text.
- Verified JSON syntax for app/package metadata.
- Ran a TypeScript smoke command; project-level dependencies/configuration are not available in this container, so it cannot be used as a full device/build validation.

## Device QA still required
This was a documentation/version metadata build. A physical TestFlight/device run is still required to validate native UI rendering and export behavior.
