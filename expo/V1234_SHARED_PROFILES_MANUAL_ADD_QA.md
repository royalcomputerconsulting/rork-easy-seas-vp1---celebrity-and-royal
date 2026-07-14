# EasySeas v12.3.4 — Shared Profile Travel + Manual Add Cruise QA

## Version

- App version: `12.3.4`
- iOS buildNumber: `12.3.4`
- Android versionCode: `120304`

## Fixes

1. Main User and Second User now keep separate loyalty identities:
   - Crown & Anchor number
   - Crown & Anchor level/points
   - Club Royale ID/tier/points

2. Travel inventory is shared between profiles:
   - Club Royale offers
   - available sailing rows
   - booked cruises
   - completed/past cruises

3. Sync no longer falls back to the primary profile when Second User is selected and blank. A Second User sync updates the Second User's loyalty fields.

4. Offer/cruise/booked/completed sync apply treats Royal/Celebrity/Carnival travel records as shared household inventory instead of profile-exclusive records.

5. Profile filters now keep shared cruise/offer records visible under both User and Second User.

6. Add Cruise modal is now usable on mobile:
   - centered responsive modal instead of bottom-only sheet
   - scrollable form
   - keyboard-aware layout
   - accessible footer buttons

7. Add Cruise now asks what is being added:
   - Booked Cruise -> saves to My Cruises
   - Available Cruise -> saves to available/scheduling inventory

## QA script

`node scripts/testV1234SharedProfilesManualAdd.js`
