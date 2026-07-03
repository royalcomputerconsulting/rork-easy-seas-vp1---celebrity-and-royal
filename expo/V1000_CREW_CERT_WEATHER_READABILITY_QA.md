# V1000 Crew, Certificate, Weather, Export, and Readability Repair QA

## Version
- App version: 9.11.00
- Build number: 9.11.00
- Android versionCode: 91100

## Fixes included

### Certificate month list
- Converted the certificate month modal to a readable dark/black interface with white text.
- The close/X button now cancels the active load token, stops the visible spinner, and closes the modal immediately.
- Reload still downloads and re-scrapes the public Royal Caribbean A/C certificate banks and every discovered detail certificate PDF.
- Added backend public parser fallback after device parser returns zero rows, still using the direct public Royal Caribbean PDF URL formula and no Royal login.
- Source pill now identifies whether results came from the on-device public parser or Easy Seas public backend parser.

### Crew recognition import/save/load
- Hardened copied crew-list imports.
- First line now accepts ship + date in formats like `Quantum of the Seas 6/19`, `Quantum of the Seas 06/19/2026`, or ISO dates.
- Dates are normalized to ISO where possible so survey/export matching works.
- Crew lines like `Shairene- public area cleaner` now parse as name + role instead of using the whole line as the crew name.
- Department is inferred from role keywords where possible.
- Duplicate detection now includes name/role/department within the sailing to prevent accidental duplicate explosions.

### Crew export and survey export
- Replaced web-only Blob download export with Expo FileSystem + Sharing on iOS/Android, while keeping Blob export for web.
- Export Results should no longer crash TestFlight/iOS after a large crew import.
- Survey List export uses the same mobile-safe export path.

### Survey List behavior
- If filters are active, Survey List no longer forces the user to choose a sailing.
- It uses the current filtered crew results directly.
- If no filters are active, the sailing picker still appears.

### Weather alerts
- Fixed the forecast-window bug where weather could load dates before the cruise actually starts.
- Marine alerts now start at the later of today or the cruise sail date.
- Default marine alert horizon is now 10 days.
- Empty-state wording now explains that weather requires cruise dates plus a resolvable departure/itinerary port.

## Manual QA
1. Open This Month Certificate List.
2. Confirm modal text is readable in white on dark background.
3. Press X during load; modal should close immediately and not keep updating visible state.
4. Import a crew list using:
   - `Quantum of the Seas 6/19`
   - `Shairene- public area cleaner`
   - `Yulfikar - stateroom attendant 9118`
5. Confirm names/roles split properly and data persists after app restart.
6. Tap Export Results on iOS/TestFlight; share sheet should appear instead of crashing.
7. Set ship or department filter, then tap Survey List; it should use current filters and not force a sailing choice.
8. Open Booked weather alerts; forecast days should be inside the cruise date window, not pre-cruise days.
