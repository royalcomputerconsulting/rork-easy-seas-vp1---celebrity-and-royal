# Easy Seas v992 — Itinerary Trust Guard QA

## Purpose
Fix a cruise detail itinerary bug where a plain `ports` array was displayed as if it were a dated day-by-day itinerary. This produced impossible routes, such as Anthem of the Seas 12 Night Hawaii 2026-09-29 showing Vancouver, Seattle, then Hawaii on consecutive days.

## Root Cause
Royal booked-cruise payloads sometimes provide only ports-of-call without dates, times, sea-day placement, or overnight context. The detail and casino-availability logic treated those undated ports as Day 1, Day 2, Day 3, etc.

## Fixes
- Plain `cruise.ports` arrays are no longer assigned to consecutive cruise days unless they appear complete enough to include all cruise days or explicit sea days.
- Plain `linkedOffer.ports` arrays are no longer assigned to consecutive cruise days.
- `itineraryRaw` strings like `12 Night Hawaii Cruise` are treated as labels, not ports.
- Casino availability no longer fabricates sea days or casino windows from sparse ports-of-call.
- The detail screen now shows a missing exact itinerary warning and lists known ports-of-call separately without assigning them to days.
- Existing v991 cross-device backup restore fix remains preserved.
- Existing v990 first-run sync retry stabilizer remains preserved.

## Manual QA
1. Import the iPhone backup containing `booked-anthem-2026-09-29`.
2. Open Anthem of the Seas, sail date 2026-09-29.
3. Confirm the itinerary section does NOT show Vancouver, Seattle, Kailua Kona, and Honolulu as consecutive days.
4. Confirm the card says exact day-by-day itinerary is missing.
5. Confirm known ports-of-call may appear as a separate informational line.
6. Confirm casino windows/sea-day estimates are not calculated from sparse ports-only data.
7. Open a cruise with true `portsAndTimes` or full `itinerary` data and confirm it still shows day-by-day rows.

## Automated QA Performed
- Full TS/TSX/JS/JSX transpile parser check.
- Version marker check.
- Static asset alias check.
