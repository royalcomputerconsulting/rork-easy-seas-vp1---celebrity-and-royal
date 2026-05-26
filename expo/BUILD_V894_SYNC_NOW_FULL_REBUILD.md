# Easy Seas v8.9.4 Sync Now Full Rebuild

Built from the current v893 full codebase, using all findings from the working sync history:

- v8.6.0/v8.6.1 was the verified offer/sailing baseline: 3 offers / 200 sailings.
- v8.6.3 supplied the correct multi-date expansion behavior.
- The May 8 build supplied the working network-monitor/upcoming-cruise foundation.
- Completed-cruise sync is working and was not changed.

## Sync Now changes

1. **Every View Sailings button is authoritative**
   - If Royal shows 4 View Sailings buttons, Sync Now builds 4 work items even if the card parser only names 3.
   - Work items are tied to `buttonIndex` so the correct fresh button is reacquired after returning to the offer list.

2. **Large-offer scrolling restored/hardened**
   - The View Sailings modal/page is scrolled up to 160 passes, with stable-row detection after enough passes.
   - Progress logs fire during long large-offer scrolls.

3. **v8.6.3 multi-date expansion preserved and expanded**
   - Handles lines like `Dates 2026 Aug 29, Sep 26, Oct 24, Oct 30`.
   - Carries the shared year forward and creates separate sailing rows.
   - Logs `Expanded offer card/modal ... into X sailing date(s)`.

4. **Dead Royal offer API remains skipped**
   - Sync Now does not depend on `/api/casino/v2/offers/merged` or `/api/casino/casino-offers/v1` after DOM extraction.

5. **Safety protections remain**
   - Blank placeholder/card-only rows are not allowed to wipe stored sailing data.
   - Existing completion sync code was not modified.
   - v891/v893 logo header remains preserved.

## Expected log markers

- `Offer sync engine v8.9.4 active`
- `DOM-first offer scan: expected ... parsed ... found ... View Sailings button(s)`
- `Opening View Sailings ... button X/Y`
- `large-offer scroll pass ...`
- `Expanded offer card/modal ... into X sailing date(s)`
- `STEP 1 ALL-OFFER MERGE COMPLETE`
