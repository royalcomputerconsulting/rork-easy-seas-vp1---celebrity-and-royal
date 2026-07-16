# OPT-7 Advisor, Ask My Data, and Offer Integration — QA Report

**Checkpoint:** `OPT7_ADVISOR_ASK_MY_DATA_AND_OFFER_INTEGRATION.zip`  
**Starting checkpoint:** `OPT6_PERSONAL_DASHBOARD_ANALYTICS_AND_DRILLDOWN.zip`  
**Status:** PASS  
**Date:** July 15, 2026

## Scope completed

- Added one profile-scoped `OptimizationSnapshotBundle` as the integration contract for live state, recommendation, dashboard, freshness, brand, and program.
- Added a provider that loads and saves the bundle without recalculating formulas in UI components.
- Wired the provider into the app root after profile services are available.
- Added a structured context adapter separating facts, estimates, assumptions, warnings, and missing data.
- Added optimization question handling for target, cost, probability, explanation, history, profile, and general questions.
- Added explicit denial of chat requests to ignore or bypass bankroll, hard-loss, stop, or safety gates.
- Added personal offer evaluation using expected realized certificate value, future-booking fit, conflicts, expiration, and user-paid cost.
- Advisor reads the current saved recommendation bundle.
- Ask My Data displays the same saved recommendation and clearly labels estimates and missing inputs.
- Examine Offers includes personal value evaluations and an instruction that safety gates cannot be overridden.
- Source freshness, profile scope, brand, program, and certificate evidence remain attached to the shared bundle.

## Test results

- Executable regression scripts: **46 passed, 0 failed**.
- TypeScript/TSX syntax transpilation: **480 files passed**.
- App Store version verification: **passed**.
- Protected-file hash comparison: **passed**.
- OPT-0 UI/formula boundary: **passed**.

## Production behavior

Integration is installed, but optimizer feature flags remain false. When no saved personal bundle exists, legacy offer and recommendation behavior remains available.
