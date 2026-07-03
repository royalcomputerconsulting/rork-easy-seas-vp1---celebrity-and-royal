# EasySeas v1044 — Casino Strength, Completed Cruise History, Points Engine

## Completed in this build

- Added centralized Royal/Celebrity casino point earning engine.
- Added EasySeas internal Casino Strength Rating engine.
- Added completed-cruise casino/value history engine.
- Added ship-level casino history aggregation.
- Added instant certificate URL generation and default ladder helpers.
- Added instant certificate level summaries.
- Added certificate chase recommendation engine.
- Updated Host View to include completed cruise records, Casino Strength, individual sessions, and extrapolated sessions without double-counting derived sessions against cruise closeout totals.
- Marked historical auto-generated sessions with `sessionSource: 'extrapolated'` and `pointsSource: 'estimated'`.
- Extended casino session model with point/source/coin-in fields needed by the new systems.
- Added regression script: `test:casino-strength-history`.

## Important data integrity rule now encoded

Completed cruises are first-class financial and casino records. They must not be excluded from points, win/loss, certificate, value, Host View, Casino Strength Rating, AgentX, or ship-level analytics just because the sailing date is in the past.

## Session handling rule now encoded

- Individual sessions are counted and preserved for analytics.
- Extrapolated sessions are counted and labeled as estimated.
- If a completed cruise has verified cruise-closeout points/win-loss, linked individual/extrapolated sessions remain available for session analytics but are not double-counted in Host View roll-up totals.
- Unlinked sessions still become casino history records so points/win-loss/value are not lost.

## Verification performed

A focused TypeScript compile and runtime test passed for:

- Royal slot points: $5 coin-in per point.
- Royal video poker: $15 coin-in per point.
- Table games manual-required behavior.
- FreePlay non-earning default.
- Completed cruise history records.
- Individual and extrapolated session tracking.
- Missing data detection.
- Ship casino history aggregation.
- Casino Strength Rating.
- Certificate URL generation.
- Certificate summaries.
- Certificate chase recommendation.
- Host View non-duplicating session/cruise totals.
