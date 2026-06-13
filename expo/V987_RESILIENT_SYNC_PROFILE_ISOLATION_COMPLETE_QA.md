# Easy Seas v987 — Resilient Sync + Christie/Profile Isolation Complete QA

## Build identity
- Version: 9.10.87
- Android versionCode: 91087
- iOS buildNumber: 9.10.87
- Engine marker: v9.8.7-resilient-sync-profile-isolation-complete

## Purpose
This build consolidates the latest sync repair work with the Christie/Second User profile-isolation work.

It is intended to fix the case where Royal currently exposes 4 offers / about 1,019 sailings instead of the older 5 offers / 1,073 sailings, while preserving zero-overwrite protection for true partial failures. It also preserves the v986 fixes so Christie/Second User cannot inherit Scott's loyalty, C&A, cruise, offer, booked, or crew-link data.

## Sync acceptance criteria
- Royal 5-offer / 1,073-row catalog is accepted as authoritative.
- Royal 4-offer / >=900-row catalog is accepted as a valid live catalog.
- Royal 1-3 offer captures are rejected as suspicious partial runs.
- Royal 4-offer captures below 900 rows are rejected as suspicious partial runs.
- Royal 5+ offer captures below 1,000 rows are rejected as suspicious partial runs.
- Valid ACK'd offer rows must not be converted to 0 rows on the Apply Selected Sync page.
- Apply Selected Sync should show the captured offer count/rows, 13 upcoming bookings, and 57 Royal completed/past cruises when those sections are captured.
- Completed history is staged before review for Royal Past(57) and repaired/deduped again during apply.
- Failed sections preserve existing data instead of overwriting with zero.

## Christie / Second User acceptance criteria
- Second User does not inherit Scott's C&A points, Diamond Plus, Pinnacle path, Club Royale points, cruise count, offers, or booked/completed rows.
- Incomplete Second User profile shows setup/not-synced messaging instead of fake loyalty tiers.
- Main/Offers loyalty cards are active-profile-aware.
- Cruises and Booked summaries are active-profile-aware.
- New records are stamped with ownerProfileId.
- Crew member add/edit can link to active profile booked/completed cruises and persists the linked sailing.
- Switching from Scott to Second User hides Scott's data; switching back shows Scott's data again.

## Runtime QA checklist
1. Install build and confirm Settings/Admin diagnostic reports version 9.10.87.
2. Run Royal sync.
3. Confirm Apply Selected Sync shows either:
   - 5 offers / 1,073 available sailings, or
   - 4 offers / about 1,019 available sailings.
4. Confirm Apply Selected Sync also shows 13 upcoming and 57 completed/past cruises.
5. Apply sync and confirm completed cruises persist and available rows do not inflate or zero out.
6. Switch to Christie/Second User and confirm Scott's loyalty/status data does not display.
7. Add/assign Second User booked cruise; confirm it appears under Second User only.
8. Add crew member and link to Second User sailing; restart and confirm link persists.
9. Switch back to Scott and confirm Scott's Royal data returns.
10. Export diagnostic and verify version/data counts.

## Static QA performed in container
- ZIP unpack/package verification.
- TS/TSX/JS/JSX parser sweep.
- Static asset require alias check.
- SHADOW theme import check.
- Version/engine marker update check.
