# Easy Seas v912 / 9.10.18 — Sync Now V2 Rebuild

This build rebuilds the main **Sync Now** pipeline around the verified v861/v882 offer-sailing scraper behavior while leaving the working **Sync Completed Cruises** path untouched.

## Scope
- Do **not** alter completed-cruise sync logic.
- Do **not** alter SeaPass or logo assets.
- Replace the fragile Sync Now summary/merge behavior with one canonical offer identity and one authoritative final count model.

## Fixes
1. Canonical Royal offer-code normalization is centralized.
   - `26BCP105E` → `26BCP105`
   - `26JUL104O` → `26JUL104`
   - `26VTY104B` → `26VTY104`
   - `26WCR403B` → `26WCR403`
   - `2605C03A` stays `2605C03A`
   - `26VAR303` stays `26VAR303`

2. Placeholder offer rows are never persisted once real or verified rows exist.
   - Prevents duplicate zero-cruise offers such as `26WCR403B` alongside `26WCR403`.
   - Prevents visible-but-unfilled offers/banners from syncing as 0-cruise active offers.

3. Provider-side verified row fill is applied after Step 1 but before the authoritative Step 1 summary and sync preview.
   - The final preview now uses the same canonical rows that will be persisted.

4. Per-offer counts are computed from authoritative cruise rows only.
   - Final preview and apply logs show one row per canonical offer with the true cruise count.

## Expected Sync Now result with the current verified baseline
- May Instant Cruise Reward (`2605C03A`): 888 cruises
- Variety Selection (`26VTY104`): 107 cruises
- West Coast Thrills (`26WCR403`): 56 cruises
- Limitless Luck (`26BCP105`): 54 cruises
- Hot Hot July (`26JUL104`): 40 cruises
- Total: 1,145 available cruises

## Completed Cruise Sync
The completed-cruise function was not modified in this build.
