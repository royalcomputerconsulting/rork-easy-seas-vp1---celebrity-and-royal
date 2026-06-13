# Easy Seas v977 — Ovation Booked Cruise Detail Freeze Guard

Version: 9.10.77
Engine marker: v9.7.7-ovation-detail-freeze-guard

## User-reported issue
Tapping the booked Ovation of the Seas September cruise can freeze while opening the cruise detail card.

## Fixes implemented
- Booked-detail route resolution now prioritizes booked/history records before offer-catalog records when `source=booked`.
- If a booked tap accidentally resolves to an available-offer row, the resolver falls back to the matching booked record.
- Cruise detail intelligence context is capped to real booked/completed trips plus a small same-ship context.
- The full offer catalog is no longer passed into ship familiarity/replacement calculations on detail-page open.
- Replacement Finder scoring now uses the safe detail context, not the full cruise catalog.
- Expected-points projection waits until after the screen renders and caps completed-history analysis.
- Detail page still opens with core cruise facts immediately; advanced intelligence loads only after the first render.

## Runtime QA checklist
1. Open Booked tab.
2. Tap Ovation of the Seas September booked cruise.
3. Detail page should open without freezing.
4. Verify ship/date/cabin/booking data is the booked record, not an available-offer catalog row.
5. Tap another booked cruise from Booked tab.
6. Tap a sailing from Offers tab.
7. Export diagnostic and confirm version 9.10.77.
