# V1033 Release Candidate QA and Regression Fixes

Date: 2026-06-30
Base: v1032 SeaPass edited text alignment/font fix

## Purpose

This build is a release-candidate pass for the issues reported after the SeaPass, Maritime Weather, and dashboard-count updates. It does not layer a new SeaPass design. It preserves the approved SeaPass shell and applies only the minimum verified text overlays.

## Implemented fixes

### SeaPass Generator

- Keeps the approved baked-in SeaPass shell.
- Does not render a synthetic Key icon/path.
- Therefore the Key can only come from the shell and should appear once.
- Default SeaPass data remains:
  - Ship code: `ST`
  - Sailing date: `Jul 5`
  - Port: `ORLANDO (PORT CANAVERAL),...`
- The renderer still compares edited/default values against the baked shell values:
  - Shell ship: `QN`
  - Shell date: `Apr 07`
  - Shell port: `LOS ANGELES, CALIFORNIA`
- Date overlay was reduced and moved to better match the original shell typography:
  - `Jul 5` font size reduced from 50 to 44
  - baseline moved from y=160 to y=156
- Ship-code overlay was reduced and moved to better match the original shell typography:
  - `ST` font size reduced from 46 to 40
  - baseline moved from y=755 to y=753
  - letter spacing reduced from -0.8 to -0.3

### Maritime Weather

- Maritime Weather remains closed by default.
- Closed Maritime Weather continues to scan in the background and show alert counts when watchouts exist.
- Star of the Seas July 5-12, 2026 remains hard-mapped to the official itinerary:
  - Day 1: Port Canaveral
  - Day 2: Perfect Day at CocoCay
  - Day 3: Northwest Bahamas marine zone
  - Day 4: Charlotte Amalie, St. Thomas
  - Day 5: Basseterre, St. Kitts & Nevis
  - Day 6: Western Atlantic marine zone
  - Day 7: Western Atlantic marine zone
  - Day 8: Port Canaveral
- Date-window logic now derives the end date from `nights` when `returnDate` is missing or malformed, so weather cards do not fail silently for valid booked cruises that only have sail date + nights.

### Dashboard counts

- Compact dashboard still says `Available Cruises`.
- Available cruises count is wired to the available cruise data length.
- Booked count is wired to `activeBookedCruises.length`.
- Offer count is wired to `totalOffersInSystemCount` instead of alert/urgent-only counts.

## Automated QA performed in this workspace

### SeaPass static/logic test

Command:

```bash
node /mnt/data/test_seapass.js
```

Verified:

- `getSeaPassData({}).ship === 'ST'`
- `getSeaPassData({}).date === 'Jul 5'`
- `getSeaPassData({}).port === 'ORLANDO (PORT CANAVERAL),...'`
- Dynamic overlays include exactly the needed defaults: `date`, `ship`, and `port`.
- Dynamic overlays do not include any Key overlay.
- SVG contains one rendered `ST` overlay and no rendered `QN` overlay.
- SVG contains one rendered `Jul 5` overlay.
- SVG does not include the synthetic Key path.

### Weather/dashboard static test

Command:

```bash
node /mnt/data/test_weather_static.js
```

Verified:

- Star Day 5 override is `Basseterre, St. Kitts & Nevis`.
- There is no Star Day 5 Philipsburg override.
- Basseterre / St. Kitts coordinate aliases exist.
- Weather date ranges can derive cruise end date from nights.
- Maritime Weather closed-state alert label exists.
- Dashboard label uses `Available Cruises`.
- Dashboard booked and offer counts are wired to the intended values.

### TypeScript syntax smoke check

Command:

```bash
node /mnt/data/syntax_check_ts.js
```

Files syntax-checked with TypeScript transpilation:

- `lib/seaPassWebPass.ts`
- `components/seapass/SeaPassWebPass.tsx`
- `app/seapass-generator.tsx`
- `state/SailingWeatherProvider.tsx`
- `components/MarineAlertsPanel.tsx`
- `components/CompactDashboardHeader.tsx`
- `app/(tabs)/(overview)/index.tsx`
- `app/day-agenda.tsx`

Result: all checked files transpiled without TypeScript syntax errors.

## Not performed

This environment does not have the app's npm/bun dependencies installed, so a full Expo native/TestFlight runtime build could not be executed here. The checks above are source-level and logic-level QA, not physical-device QA.
