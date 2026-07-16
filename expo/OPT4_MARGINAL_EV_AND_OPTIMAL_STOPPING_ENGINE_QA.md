# OPT-4 Marginal EV and Optimal Stopping Engine — QA Report

**Checkpoint:** `OPT4_MARGINAL_EV_AND_OPTIMAL_STOPPING_ENGINE.zip`  
**Starting checkpoint:** `OPT3_PERSONAL_PROBABILITY_LOSS_AND_TARGET_MODELS.zip`  
**Status:** PASS  
**Date:** July 15, 2026

## Scope completed

- Added current locked-certificate detection using program, family, cruise length, and effective period.
- Added candidate evaluation for every reachable higher threshold.
- Calculates points required, additional coin-in, additional time, personal success probability, expected loss, downside range, incremental certificate value, raw EV, risk-adjusted EV, ROI, bankroll-exceedance probability, and projected end points.
- Uses conservative replacement value when certificate stacking behavior is unknown.
- Added hard daily/trip bankroll and loss-limit gates.
- Added Profit-Protected Mode that preserves a configured profit floor without changing house-edge math.
- Added conservative Loss Mode with no chase or “win it back” behavior.
- Added transparent fatigue/performance signals from session duration, same-day play, pace deterioration, loss-per-point deterioration, and user-entered fatigue.
- Added user dismissal/correction of fatigue signals.
- Implemented recommendation precedence from data unavailable and hard stop through stop, bank win, do not chase, bounded session, continue, profit-protected push, and excellent opportunity.
- Added one explainable `CertificateRecommendationSnapshot` with calculations, evidence, assumptions, source freshness, model version, warnings, and candidate drill-down.
- Added a rollback-safe legacy-shape adapter without changing the existing production function.
- Prohibited “Risk-Free Push” wording and explicitly states that profit mode does not alter mathematical risk.

## Required safety test

The test case where the current 4,000-point certificate is worth $2,500 and the 6,500-point certificate is worth only $300 more produces a stop/do-not-chase result because expected additional loss exceeds incremental certificate value.

## Additional focused coverage

- Daily hard loss limit and zero remaining bankroll force `HARD_STOP`.
- Positive EV, sufficient protected profit, and a Stretch classification can produce `PROFIT_PROTECTED_PUSH` while preserving the configured profit floor.
- Fatigue/performance penalties reduce risk-adjusted EV and can be explicitly dismissed.
- Missing thresholds/models/value snapshots return `DATA_UNAVAILABLE` rather than guessing.
- Profile mismatch throws before any recommendation is generated.
- Identical input snapshots produce identical recommendations.
- Legacy adapter preserves the old public return shape for future controlled integration.

## Test results

- Executable regression scripts: **40 passed, 0 failed**.
- TypeScript/TSX syntax transpilation: **452 files passed**.
- Strict standalone typecheck for executable OPT-4 modules: **passed**.
- App Store version verification: **passed**.
- Protected-file hash comparison: **passed**.

## Production behavior

The OPT-4 core safety gate passes, but current UI and public recommendation authority remain unchanged. All optimizer feature flags still default to false and `legacy-static` remains active until live-state persistence, UI integration, parity, and later release checks are completed.
