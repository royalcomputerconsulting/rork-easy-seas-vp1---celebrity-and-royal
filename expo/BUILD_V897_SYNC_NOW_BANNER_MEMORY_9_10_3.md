# Easy Seas v897 / app version 9.10.3

## Purpose
Repair Sync Now after `last 48.log` showed the app treating the Royal `READY TO PLAY?` casino-credit banner as a real offer and repeatedly expanding it into 261 false sailing rows.

## Changes
- Incremented `app.json` to:
  - `expo.version`: `9.10.3`
  - `ios.buildNumber`: `9.10.3`
  - `android.versionCode`: `9103`
- Rebuilt the Sync Now offer button matching so only **nearby coded casino offer cards** are processed.
- Removed unsafe index-based matching that assigned `pageOffers[idx]` to an uncoded banner/control button.
- Added a hard block for:
  - `READY TO PLAY?`
  - casino-credit application panels
  - onboard casino-credit marketing copy
- Reduced React Native bridge pressure by removing repeated per-scroll `Expanded offer card/modal...` logs.
- Added one final per-offer expansion summary after collection.
- Added a large-offer safety cap and shorter stable-pass loop so very large offers do not freeze the WebView.
- Kept completed-cruise sync untouched.

## Expected log markers
- `Offer sync engine v8.9.7 active`
- `Skipping non-offer banner/control near View Sailings button`
- No offer named `READY TO PLAY?`
- One expansion summary per real offer, not dozens of duplicate expansion lines.
