# Easy Seas v862 Critical Sync Fix

Built from the clean Expo-root v862 package and patched for the 2026-05-21 sync failures.

## Fixes included

1. **Sync Completed Cruises button**
   - Keeps the dedicated completed-cruise flow separated from normal Sync Now.
   - Adds stronger direct Royal loyalty-history fetch fallback.
   - Uses captured loyalty/request payloads plus the saved user Crown & Anchor number when Royal's page does not expose the completed/past tab quickly.
   - Adds clearer logs when accountId or loyaltyNumber cannot be found.

2. **Sync preview offer counts**
   - Preview now shows not only unique offers, but each offer's cruise/sailing count.
   - Log output also lists each offer and count.

3. **Sync Complete summary**
   - Sync Complete now shows offers, available cruises, upcoming cruises, courtesy holds, completed cruises, and loyalty data.
   - Adds an Offers & Available Cruises Synced section with per-offer cruise counts.

4. **Available cruise row preservation and restoration**
   - Restores the old API/network offer extraction fallback when Royal's DOM shows offer cards but hides ship/date sailing rows.
   - Prevents destructive overwrite of available cruises when offer cards are captured but zero ship/date sailing rows are captured.
   - Logs a warning instead of setting available cruises to zero.

## Verification notes

The uploaded logs showed:
- DOM captured 3 offer rows but all were treated as empty/in-progress rows.
- Preview showed 3 offers but 0 available cruises.
- Sync then persisted 0 available cruises.
- Completed sync could not find accountId/loyaltyNumber for direct loyalty-history fetch.

This patch targets those exact failures.
