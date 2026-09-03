# Easy Seas Build 445 Release Manifest

## Identity

- Product: Easy Seas
- Version: 13.0.74
- iOS build: 445
- EAS/App Store build: 448 (remote auto-increment)
- Android version code: 130107
- Expo SDK: 54.0.0
- Candidate source: `EASYSEAS_EXPO_V13.0.74_BUILD445_WORKSPACE`
- Retained known-working baseline: `EASYSEAS_EXPO_V13.0.74_BUILD444_FINAL_SOURCE`

## Included release evidence

- `BUILD445_TRACKED_UI_REPAIR_PLAN.md` — uniquely numbered 323-item backlog and completion evidence.
- `BUILD445_FINAL_QA_REPORT.md` — functional, visual, persistence, performance, and build results.
- `BUILD445_PERFORMANCE_BASELINE.md` — measured large-data timings and device boundary.
- `BUILD445_REPRESENTATIVE_DATA.md` — empty/small/large reproducible data matrix.
- `BUILD445_ROUTE_ACTION_INVENTORY.md` — visible route/action behavioral inventory.
- `BUILD445_BUILD_INSTRUCTIONS.md` — clean-install, verification, EAS, and Xcode steps.
- `BUILD445_VISUAL_EVIDENCE/2026-09-01/` — seven-tab, nested-screen, and accessibility/theme captures.

## Verified gates

- TypeScript: pass.
- Expo Doctor: 18/18 pass.
- iOS production bundle: pass.
- EAS native App Store build: pass; build ID `e5f6c7c7-6198-44bc-9654-51a7bded27e0`, Git snapshot `9c8b7101ca8527aab0508996d3e2740c30ee48b7`.
- Build 445 tests: pass.
- Maintained release suite: 229 pass / 48 declared skip / 0 fail.
- Supplied local files: pass.
- Secret scan: no provider secret embedded in distributable source.
- Baseline route comparison: 103/103 routes retained; none removed.

## Exclusions from the source archive

- `node_modules`
- `.expo` and local bundler caches
- generated native/export output
- private external backups and reservation files
- local environment variables and credentials

These exclusions keep the archive reproducible and prevent a backup or provider secret from becoming part of the distributable source.

## Known environment boundary

This Mac currently has Command Line Tools selected instead of a full Xcode installation. The iOS production JavaScript export and signed EAS App Store build 448 both pass, but the physical-device acceptance in QA-023 must be completed using TestFlight before App Store promotion.
