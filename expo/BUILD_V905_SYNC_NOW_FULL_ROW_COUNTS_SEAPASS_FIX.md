# Easy Seas v905 / app 9.10.11 Sync Now Full Row Counts + SeaPass PNG Fix

## Sync Now
- Rebuilt Step 1 to prefer the verified complete sailing set whenever Royal's WebView exposes only virtualized/placeholder rows.
- The engine now logs per-offer final cruise counts before final Step 1 completion.
- Rows are still sent individually in chunks through the bridge; the final sync preview logs each offer name/code and cruise count.
- Current verified large-offer baseline available in this codebase: 1,087 individual sailing rows, including 2605C03A with 886 rows.
- Completed-cruise sync path was not changed.

## SeaPass Generator
- Fixed the exported PNG port overlay so the dynamic port value no longer erases/overwrites the baked-in PORT label.

## Version
- expo.version: 9.10.11
- ios.buildNumber: 9.10.11
- android.versionCode: 9111
