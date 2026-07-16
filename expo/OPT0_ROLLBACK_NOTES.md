# OPT-0 Rollback Notes

OPT-0 does not change production recommendation behavior.

## Current authority

- `KeepPlayingDecisionCard` still calls the existing `buildCertificateChaseRecommendation()` implementation.
- `BestPlayTodayCard` still calls the existing `buildBestPlayTodayPlan()` implementation.
- All new optimizer feature flags default to `false`.
- `getCertificateRecommendationAuthority()` therefore resolves to `legacy-static` by default.

## Rollback procedure

To return exactly to the uploaded Build 314 source tree, remove only the OPT-0 additions listed in `OPT0_CHANGED_FILES.txt`. No protected package, Expo, React, Babel, Metro, TypeScript, server, build, or deployment file was modified.

## Future rollout rule

Later checkpoints may route consumers through the optimization public boundary, but the legacy implementation must remain available until OPT-10 parity, safety, and rollback tests pass.
