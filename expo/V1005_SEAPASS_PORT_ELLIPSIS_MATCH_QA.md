# V1005 SeaPass Port Ellipsis Match QA

## Scope
Targeted SeaPass Generator display patch only. No certificate scraping, sync, storage, or cruise-data logic changed.

## User-reported issue
The real Royal Caribbean SeaPass example does not show the full Port Canaveral line. It shows the port field as:

`ORLANDO (PORT CANAVERAL),...`

The v1004 patch incorrectly tried to fit the full `ORLANDO (PORT CANAVERAL), FLORIDA` wording.

## Fix
- Updated `normalizeSeaPassPortDisplayValue` so Orlando / Port Canaveral aliases normalize to the Royal-style truncated display:

`ORLANDO (PORT CANAVERAL),...`

- Preserves the required comma before the ellipsis.
- Preserves three literal period dots, not a single ellipsis glyph, to match the screenshot style.
- Keeps the existing typo correction from `CANABERAL` to `CANAVERAL`.

## Files changed
- `lib/seaPassWebPass.ts`
- `package.json`
- `app.json`

## Version
- App/package version: `9.11.05`
- iOS buildNumber: `9.11.05`
- Android versionCode: `91105`
