# OPT-9 Learning, Backtesting, and Accuracy — QA Report

**Checkpoint:** `OPT9_LEARNING_BACKTEST_AND_ACCURACY.zip`  
**Starting checkpoint:** `OPT8_PERSONAL_OPTIMIZATION_ALERTS.zip`  
**Status:** PASS  
**Date:** July 15, 2026

## Scope completed

- Added finalized recommendation outcome records with actual target, cost, result, realized certificate value, recommendation-followed status, and continued/stopped behavior.
- Added target accuracy, stop/continue accuracy, mean EV error, mean expected-loss error, Brier score, calibration bins, and confidence reliability.
- Added chronological expanding-window backtests where every training record predates its test cruise.
- Added explicit future-data-leakage detection and promotion disqualification.
- Added candidate-versus-baseline model promotion requiring sufficient out-of-sample predictions, improved accuracy/calibration, improved EV error, and no worse safety violation rate.
- Added target-label stabilization requiring consecutive completed-cruise support and minimum evidence.
- Added winsorization, robust centers, and bounded observation weights so one jackpot, extreme loss, or unusually long cruise cannot rapidly rewrite the profile.
- Added profile-scoped learning storage and controls for exclude-record, reset, and rebuild requests.
- Added a native Optimizer Accuracy screen with calibration and reset/rebuild controls.
- Preserved transparent baseline models as the fallback and kept learning disabled by default.

## Test results

- Executable regression scripts: **50 passed, 0 failed**.
- TypeScript/TSX syntax transpilation: **499 files passed**.
- App Store version verification: **passed**.
- Protected-file hash comparison: **passed**.
- Chronological no-leakage test: **passed**.
- Safety-no-worse model-promotion gate: **passed**.
- Single-outlier target rewrite prevention: **passed**.

## Production behavior

Learning and model promotion remain feature-flagged off. Raw evidence and finalized outcomes can be stored, but the production model cannot silently self-promote.
