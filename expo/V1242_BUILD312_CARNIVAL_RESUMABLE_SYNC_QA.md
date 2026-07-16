# Easy Seas 12.4.2 Build 312 — Carnival Resumable Sync Repair

## Build identity

- Marketing version: **12.4.2**
- iOS build: **312**
- Android versionCode: **120403**
- Runtime marker: `v12.4.2-build312-carnival-resumable-sync active`

## Defects repaired

1. **Offer-specific personalization now wins.** The exact clicked Shop Now URL is merged last for its selected rate code. A clicked page that also displays Carnival's broader 14/23-code catalog can no longer assign one offer URL to every visible code.
2. **Every sync has a unique run ID and AbortController.** Provider unmounts, user cancellation, iOS WebContent termination, and Android render-process loss abort pending delays, navigation, discovery, and scraping.
3. **Detached runs cannot silently fall back to `logged_in`.** Carnival now has a visible `cancelled` state with the reason retained and a resume path.
4. **Network results are scoped by run, rate code, page, and request.** Fetch/XHR context is snapshotted when each request begins. Multiple inventory/pricing/paging responses are retained together instead of the last facet response overwriting sailing inventory.
5. **API payloads are the primary sailing source.** DOM cards are fallback only. The parser asks for 50 results per page and uses server paging metadata rather than treating two rendered/virtualized cards as the page size.
6. **Long unconditional retries were removed.** An offer gets at most one short retry only when the response is incomplete or unmatched. An authoritative zero result is accepted immediately.
7. **Per-code checkpoints are saved.** Completed offer codes, rows, and zero-row status are stored after every code and may resume for 24 hours when the personalized catalog matches.
8. **The checkpoint remains through review.** It is cleared only after Apply Sync succeeds, preventing a suspension on the review screen from forcing a full redownload.
9. **Past Carnival sailings are date-classified as completed.** Duplicate booking rows are merged with completed status taking precedence, so the September 2023 Panorama sailing cannot remain in upcoming/booked.
10. **Carnival is now present in the visible filter row.** `All Brands` is a real scope and no cruise line remains highlighted while combined totals are being shown.
11. **Carnival offer counts are explicit.** The app retains and displays separate counts for personalized offer codes, offers with eligible sailings, and eligible sailing rows. The ordinary Offers pill remains the active/nonexpired app count rather than being mislabeled as the personalized catalog total.

## Automated validation

Run:

```bash
node scripts/testV1242Build312CarnivalResumableSync.js
node scripts/testV9160CarnivalAdminSync.js
node scripts/verifyAppStoreVersion.js
```

All legacy `scripts/test*.js` checks must also pass.

## Required live-account acceptance test

1. Install build 312 and open **Settings → Sync Carnival Cruises** as an administrator.
2. Sign in, start sync, and verify the log prints one run ID–scoped pass rather than returning to `logged_in` while codes continue in the background.
3. Confirm all personalized rate codes are either completed with sailing rows or explicitly marked with zero eligible sailings.
4. During one run, leave the screen after several codes. Return and restart. The log must say it is resuming from a checkpoint and skip completed codes.
5. Let extraction finish, pause on Review, close/reopen the screen, and restart. Completed offer work must restore from checkpoint.
6. Apply Sync. Confirm the checkpoint-cleared message appears only after successful persistence.
7. Select **Carnival** in the dashboard filter. Confirm the header shows three different metrics: Personalized Offers, With Sailings, and Eligible Sailings.
8. Select **All Brands**. Confirm the header says `All Brands • Combined portfolio`; no Carnival/Royal/Celebrity/Silversea tab may appear active.
9. Confirm Carnival Panorama dated September 2, 2023 appears once in completed history and not in booked/upcoming.
10. Export the final log. It must end in review/complete, cancelled with a reason, or error with a reason—never `logged_in` while background offer processing continues.
