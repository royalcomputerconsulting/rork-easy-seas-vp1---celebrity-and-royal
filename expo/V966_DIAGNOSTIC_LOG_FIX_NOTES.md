# Easy Seas v966 Diagnostic-Driven Fix

Version: 9.10.66
Engine: v9.6.6-production-real-data-continuation

This build addresses the diagnostic log showing that the app was still exporting version 9.10.58 and that Step 1 was being reported as complete after a 240-second timeout with only one offer / 54 sailings captured.

## Fixes

- Settings/Admin diagnostic export now reports version 9.10.66.
- Step 1 timeout with partial Royal offer capture is no longer logged as a successful STEP 1 COMPLETE event.
- Partial Royal offer data is discarded from Apply Sync unless the offer catalog is authoritative.
- Existing offers and available cruise catalog are preserved when Step 1 is incomplete.
- The real-data continuation crawler is retained: authenticated WebView -> saved offer detail URL/playerOfferId -> detail-page rows -> checkpoint ACK.
- If an offer already has staged rows, crawler now continues directly to the next saved offer instead of hard-navigating back to the offers page and losing the injected crawler context.

## Expected healthy log

- Diagnostic snapshot version: 9.10.66
- Engine marker: v9.6.6-production-real-data-continuation
- After 26BCP105: `Continuing to next saved offer 2/5: 26JUL104`
- No `STEP 1 COMPLETE` if only one offer / 54 rows is captured.
- Apply Sync should preserve existing offers/available cruises when Step 1 is incomplete.
