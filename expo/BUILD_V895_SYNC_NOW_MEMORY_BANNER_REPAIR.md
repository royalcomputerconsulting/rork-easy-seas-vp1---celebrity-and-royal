# Easy Seas v8.9.5 Sync Now Memory + Banner Repair

Based on `easyseas_v894_sync_now_v861_large_offer_rebuild_FULL_CODEBASE.zip`.

## Fixed

1. Removed the huge embedded QA/baseline offer dataset from the injected WebView script.
   - v894 embedded the large 2605C03A baseline inside `step1_offers.ts`.
   - That made the injected script very large and could freeze the app when Sync Now tried to handle a large offer.
   - v895 is live-capture only: Royal DOM/network rows are used; if Royal exposes zero real ship/date rows, existing app data is preserved.

2. Added explicit banner filtering.
   - `READY TO PLAY?` is now treated as a banner/control, not an offer.
   - Uncoded/banner View Sailings controls are skipped instead of becoming `UNKNOWN_#` offers.

3. Made Sync Now memory safer for large offers.
   - Offer batches reduced from 150 rows / 120k chars to 50 rows / 45k chars.
   - Large-offer scroll passes reduced from 160 to 70.
   - Stability break threshold tightened so the WebView does not keep scrolling indefinitely after row count stops increasing.

4. Preserved the important working behavior.
   - Completed-cruise sync was not changed.
   - v8.6.1/v8.6.3 offer logic remains: coded offer cards + View Sailings + multi-date expansion + merge/dedupe.
   - Existing stored sailings are preserved if a sync captures only card placeholders and no real ship/date rows.

## Expected log markers

- `Offer sync engine v8.9.5 active`
- `Skipping non-offer banner/control ... READY TO PLAY`
- `Built X real coded offer object(s) from Y View Sailings button(s); skipped uncoded/banner buttons`
- Batched sends should appear as smaller `50 sailing(s)` chunks.

