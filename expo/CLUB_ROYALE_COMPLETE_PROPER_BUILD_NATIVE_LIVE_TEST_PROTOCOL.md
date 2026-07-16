# Club Royale Complete Proper Build — Native Live Test Protocol

This protocol validates the authenticated Royal Caribbean behavior that cannot be reproduced in an offline container.

## 1. Install and open the build

Use the normal existing Build 314 native build process. Do not replace package, lock, Expo, EAS, Metro, Babel, or workflow files.

## 2. Record the pre-sync state

In Settings, note:
- Crown & Anchor number, tier, and points
- Club Royale ID, tier, and casino points
- upcoming and completed cruise counts
- unique offer count and offer-sailing row count

## 3. Run Royal/Celebrity Casino Sync

Select all five sections:
- Offers
- Available cruises
- Booked/upcoming cruises
- Completed cruises
- Loyalty

Expected log behavior:
- Casino endpoint captures `Signature / 20,941` when the account still reports that value.
- Step 3 says it is keeping the current authenticated page alive.
- Step 3 attempts `dedicated loyalty/info` immediately.
- A casino-only or history-only payload does not close the C&A lane.
- If the dedicated endpoint responds, the log reports authoritative C&A tier and points.
- If it does not respond, the log explicitly preserves existing C&A values.
- Review counts reconcile extracted and canonical rows before Apply Sync.

For the supplied July 15 logs, the comparison target was:
- 4 offers
- 1,467 offer-to-sailing rows
- 12 upcoming bookings
- 60 completed/history rows
- Club Royale Signature with 20,941 casino points

Current live account counts may legitimately differ from that historical run; the required rule is that every extracted authoritative row remains represented after Apply Sync.

## 4. Apply Sync and verify immediately

Without restarting the app, Settings should show:
- Club Royale tier and points from the current casino payload
- C&A tier and points only from the dedicated C&A payload
- no transfer of 20,941 casino points into C&A
- upcoming/completed counts matching the final reconciliation log
- all offers with their complete sailing attachments

## 5. Restart verification

Force-close and reopen the app. Verify that:
- loyalty values remain identical
- upcoming/completed counts remain identical
- offer and sailing counts remain identical
- no account-specific mock cruises or hard-coded point totals reappear

## 6. Idempotence verification

Run the same sync again without account changes. Expected result:
- no count drift
- no duplicate bookings
- same-date cruises with different reservations/cabins/guests remain separate
- exact duplicate rows merge once
- all offer-to-sailing relationships remain attached

## 7. Failure handling

If any required write fails, the log should report a Royal/Celebrity rollback and the complete pre-sync offers, sailings, booked/history, loyalty storage, and selected profile should be restored.

Export the new sync log after this test if any live count or value differs from the final reconciliation summary.
