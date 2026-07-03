# V1035 — Version Metadata 9.11.26 QA

## Request
Update the app JSON/version metadata to `9.11.26` and make this the forward versioning rule: every future Easy Seas build must increment the app file version by one patch number.

## Files changed
- `app.json`
- `package.json`
- `app/(tabs)/settings.tsx`

## Version values set
- Expo app version: `9.11.26`
- iOS buildNumber: `9.11.26`
- Android versionCode: `91126`
- npm/package version: `9.11.26`
- Settings diagnostic export snapshot version: `9.11.26`

## Future build rule
For each future build, increment the patch version by one:
- next build after this: `9.11.27`
- then `9.11.28`
- then `9.11.29`

When the patch passes `9.11.99`, move to the next minor version as needed.

## QA performed
- Parsed `app.json` as valid JSON.
- Parsed `package.json` as valid JSON.
- Verified no remaining active source references to `9.11.22`, `91122`, or diagnostic version `9.10.94` in non-historical source files.
- No SeaPass, weather, dashboard, sync, cruise, offers, or data logic was changed.
