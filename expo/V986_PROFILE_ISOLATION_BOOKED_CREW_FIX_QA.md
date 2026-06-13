# Easy Seas v986 — Profile Isolation, Booked Count, Loyalty, and Crew Link QA

## Build
- Version: 9.10.86
- Android versionCode: 91086
- iOS buildNumber: 9.10.86
- Engine marker: v9.8.6-profile-isolation-booked-crew-fix

## Issues Addressed

### 1. Second user was inheriting primary user's loyalty/status data
- Added profile-scoped record filtering helper in `lib/profileIsolation.ts`.
- Loyalty calculations now filter booked/completed cruises to the active app profile.
- Known Scott/primary fallbacks only apply to the primary profile.
- A secondary profile without a C&A/loyalty identity now shows zero/unsynced loyalty values instead of Scott's values.

### 2. Main / Offers header showed wrong C&A and Club Royale values
- `CompactDashboardHeader` now checks whether the active profile has Royal loyalty identity.
- Incomplete profiles show a setup prompt instead of fake Prime/Diamond Plus/Pinnacle projections.
- C&A label changed from “C&A Nights” to “C&A Points.”

### 3. Cruises / Booked summaries mixed 0 cruises with 590 points/nights
- Active profile filter now defaults to the current selected app profile instead of “All Profiles.”
- Unassigned legacy records are no longer auto-assigned to the second traveler.
- Primary profile can still see legacy unassigned records for backward compatibility.
- Secondary profile only sees records explicitly assigned to it or matching its guest name.

### 4. Booked tab did not show the second user's booked cruise
- Intelligence profile filters now follow the selected app user.
- Booked tab remains profile-scoped and no longer silently pulls “All Profiles.”
- New manually added booked cruises are stamped with the active profile owner.

### 5. New records lacked profile ownership
- CoreData setters/adders now stamp offers, available cruises, booked cruises, and calendar events with the active profile.
- This includes `ownerProfileId`, `sourceEmail`, `ownerProfileName`, and `profileType`.

### 6. Crew member sailing link failed
- Add Crew Member modal now builds its sailing picker from both crew-recognition sailings and current booked/completed cruises.
- If a booked cruise is selected as the sailing, a `sailingSnapshot` is passed through the save pipeline.
- CrewRecognitionProvider persists that sailing snapshot locally before saving the crew entry.
- Linked crew entries now retain ship/date after save and restart.

### 7. Wording cleanup
- C&A “nights” wording replaced with “C&A Points” in the dashboard header and Club Royale points component.

## QA Performed
- Syntax parser checked 397 TS/TSX/JS/JSX files.
- Syntax diagnostics: 0.
- Targeted parser check passed for changed files:
  - `lib/profileIsolation.ts`
  - `lib/intelligenceFilters.ts`
  - `state/IntelligenceFiltersProvider.tsx`
  - `state/CoreDataProvider.tsx`
  - `state/LoyaltyProvider.tsx`
  - `components/CompactDashboardHeader.tsx`
  - `components/crew-recognition/AddCrewMemberModal.tsx`
  - `state/CrewRecognitionProvider.tsx`
  - `components/ClubRoyalePoints.tsx`

## Manual QA Script
1. Install build and confirm Settings/Admin diagnostic shows `9.10.86`.
2. Switch to Primary User / Scott.
3. Confirm Scott's Royal/Celebrity data still appears.
4. Switch to Second User.
5. Confirm Scott's C&A points, Diamond Plus, Pinnacle projection, Club Royale points, offers, and booked count do not appear.
6. Confirm a blank second-user profile says Royal loyalty is not synced / add loyalty number or run sync.
7. Add one booked cruise under Second User.
8. Confirm Booked tab shows that cruise and Primary User does not inherit it.
9. Add a crew member and select that sailing.
10. Save, restart, and confirm the crew entry remains linked to ship/date.
11. Switch back to Scott and confirm Scott data returns.

## Known Notes
- This build is intentionally local-first and preserves v985 backend-optional behavior.
- Unassigned legacy records now remain visible only to the primary profile or the explicit Unassigned filter, preventing second-user data leakage.
