# EasySeas v1058 — Loyalty Sync No-Downgrade Fix

## Problem confirmed from `last 22.log`

Royal sync captured Club Royale and Crown & Anchor loyalty endpoints, but the app still applied stale/lower values:

- `/api/casino/v1/loyalty-data` was captured, but Club Royale tier credits were not reliably persisted.
- `/guestAccounts/loyalty/history` was later captured and treated as profile loyalty, causing Crown & Anchor profile totals to downgrade from 632 to 549.
- Manual Club Royale entry of 19,363 was suppressed by stale enrichment/current-year values such as 16,116.
- The edit modal derived Club Royale tier from point thresholds, showing Prime for 19,363 even when the synced/known tier is Signature.

## Fixes

1. `loyalty/history` is now completed-sailing history only. It cannot overwrite Crown & Anchor profile totals.
2. Sync preview and extended loyalty merge now preserve the highest verified profile totals so stale/lower values cannot downgrade 646 or 19,363.
3. Club Royale and Crown & Anchor are still stored separately:
   - Club Royale = Signature / 19,363 casino tier credits.
   - Crown & Anchor Society = Diamond Plus / 646 cruise points.
4. The network monitor attaches visible page text to loyalty payloads so the converter can parse visible website text like `Your Current Tier Credits 19,363` and `646 Cruise Points` even when JSON payload shape changes.
5. DOM fallback loyalty messages are now converted and merged, not ignored because a weaker API payload arrived first.
6. Manual profile save now counts the saved profile Club Royale value as an authoritative candidate and does not let stale enrichment suppress it.
7. The profile edit modal preserves explicit/API Club Royale tier labels, so 19,363 can still display Signature when the official website says Signature.

## Verification

- `node scripts/testV1058LoyaltyNoDowngrade.js`
- `node scripts/testV1057OlderLoyaltySyncRestoration.js`
- TypeScript transpile checks for touched files.
