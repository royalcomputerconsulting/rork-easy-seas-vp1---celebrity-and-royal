# Easy Seas v979 Portfolio + Pinnacle + Harmony Fix QA

## Build
- Version: 9.10.79
- Android versionCode: 91079
- iOS buildNumber: 9.10.79
- Engine marker: v9.7.9-portfolio-pinnacle-harmony-fix

## Fixes
- Casino tab Cruise Portfolio cards are constrained to the screen width and no longer scroll/cut off horizontally.
- Cruise Portfolio cards now open `/cruise-details` with full fallback params when tapped.
- Cruise Portfolio cards include an `Edit play` chip to keep win/loss and points editing available without replacing detail navigation.
- Removed stale September 2026 Ovation bookings from user-confirmed manifest and invalidated stale synced Ovation rows for 2026-09-04 and 2026-09-11.
- Added user-confirmed Harmony of the Seas bookings:
  - 2026-09-05 to 2026-09-10, Port Canaveral / Orlando, 5 nights.
  - 2026-09-10 to 2026-09-15, Port Canaveral / Orlando, 5 nights.
  - 2026-09-15 to 2026-09-19, Port Canaveral / Orlando, 4 nights.
- Pinnacle projection no longer points to Ovation after the stale September Ovation rows are repaired.

## Manual QA
1. Settings diagnostic should show version 9.10.79.
2. Casino tab → Cruise Portfolio should display cards within the screen bounds.
3. Tap a portfolio cruise card: cruise detail page should open.
4. Tap `Edit play`: casino performance editor should open.
5. Offers page loyalty/Pinnacle card should show the July 2026 threshold crossing / end-of-July Pinnacle path, not Ovation.
6. Booked tab should show Harmony 9/5-9/10, 9/10-9/15, and 9/15-9/19 instead of the September Ovation sailings.
