# EasySeas v1059 — My Account Loyalty Sync Restoration

## Issue
The Royal sync was not actually using the My Account loyalty profile totals. The log showed `/api/casino/v1/loyalty-data` and `/guestAccounts/loyalty/history`, but it never captured `/guestAccounts/loyalty/info` with Crown & Anchor profile totals. The `/loyalty/history` endpoint contains completed sailing history and must not satisfy the profile loyalty step.

## Fix
- Changed Royal loyalty page navigation to the My Account root page so the visible `Diamond Plus / 646 Cruise Points` card can render.
- Restored the v963-style behavior: WebView-first, then direct `/guestAccounts/loyalty/info` fallback, then DOM fallback.
- Prevented `/guestAccounts/loyalty/history` from auto-completing the loyalty step.
- Prevented cached history-only payloads from blocking direct loyalty/info fetches.
- Kept Club Royale casino loyalty separate from Crown & Anchor cruise loyalty.

## Expected result
After syncing Royal:
- Crown & Anchor Society: Diamond Plus / 646 cruise points.
- Club Royale: Signature / 19,363 tier credits.

## Test
`npm run test:v1059-myaccount-loyalty`
