# EasySeas v1057 — Older Loyalty Sync Restoration

## Reason
The older app successfully updated loyalty by saving program totals directly into scoped manual storage after an ExtendedLoyaltyData capture. The newer sync could capture loyalty/history completed-sailing payloads and mark loyalty as captured before the profile totals payload arrived, leaving Settings stuck on older values.

## Fixes
- Added a synchronous `extendedLoyaltyDataRef` in `RoyalCaribbeanSyncProvider` so Apply Sync uses the latest captured payload even before React state finishes updating.
- Added `mergeAndStoreExtendedLoyaltyData()` for immediate ref + state updates.
- Prevented `/guestAccounts/loyalty/history` completed-sailing payloads from being treated as profile loyalty totals unless they actually contain program tier/points.
- Continued to `/guestAccounts/loyalty/info` fallback when history-only payloads are captured.
- Strengthened `loyaltyConverter` with loose visible-text parsing for:
  - Club Royale current tier credits / Signature
  - Crown & Anchor cruise points / Diamond Plus
- Preserved separation of Crown & Anchor vs Club Royale and Captain's Club vs Blue Chip.

## Expected result
After sync, Settings should update to the values visible on the Royal pages:
- Crown & Anchor Society: Diamond Plus, 646 cruise points
- Club Royale: Signature, 19,363 tier credits

## Test
`npm run test:v1057-older-loyalty-sync`
