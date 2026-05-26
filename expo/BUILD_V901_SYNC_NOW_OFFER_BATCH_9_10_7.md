# Easy Seas v901 / app 9.10.7 Sync Now Repair

Based on the v900 full codebase.

## Fixes

- Incremented `app.json` to `9.10.7` / iOS build `9.10.7` / Android `9107`.
- Fixed real coded offers being skipped as banners when Royal concatenates name+code text such as `Hot Hot July26JUL104`.
  - The offer-code detector no longer requires word boundaries.
  - A real casino offer code always wins over nearby page chrome/banner text.
- Fixed the primary Step 1 crash shown in logs: `Can't find variable: normalizeBaselineCode`.
  - Replaced the stale helper name with `normalizeCasinoOfferCode`.
- Reduced bridge/memory pressure for large offer payloads.
  - Rows are compacted before crossing the React Native bridge.
  - Very large DOM text blobs are trimmed/removed from row payloads.
  - Batch size is reduced to 25 with a 26k character cap.
- Preserved completed-cruise sync untouched.
- Preserved logo/header changes untouched.

## Expected marker

`Offer sync engine v9.0.1 active`

## Expected behavior

- Coded offer buttons such as `26BCP105`, `26JUL104`, `26WCR403B`, and `2605C03A` should not be skipped as `READY TO PLAY?` banners.
- Large offers should no longer send one massive row per bridge batch due to embedded DOM text.
