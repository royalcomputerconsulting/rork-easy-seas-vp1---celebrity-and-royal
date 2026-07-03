# V1006 Certificate, SeaPass Date, Profile Dedupe QA

## Fixes
- Certificate month list now tries the backend PDF.js parser first instead of accepting a 0-row iOS/device PDF stream parse.
- Backend PDF.js import is a literal dynamic import so bundlers include the parser.
- PDF.js extraction sorts text into lines before parsing certificate rows.
- Fixed global date-regex state in certificate row usefulness checks.
- SeaPass date display no longer pads the day with a leading zero; Jul 5 stays Jul 5.
- Duplicate stored traveler profiles are deduped on load and profile filter chips are label-deduped so Second User appears only once.

## Version
9.11.06 / Android 91106
