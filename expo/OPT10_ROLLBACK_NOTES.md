# OPT-10 Rollback Notes

- All three optimizer flags default to false.
- `getCertificateRecommendationAuthority()` continues to return `legacy-static` by default.
- `getReleaseGatedRecommendationAuthority()` also returns `legacy-static` unless the typed release gate is `release-ready`.
- Existing Build 314 recommendation cards remain available as the rollback authority.
- Removing the new `certificateOptimization` router entry and OPT-10 release modules restores the OPT-9 checkpoint without data migration.
- Optimizer backend records use the separate `casino_optimization_snapshots` table and can be removed per owner without modifying cruises, sessions, offers, certificates, or loyalty records.
- No package, lock, Expo, React Native, Metro, Babel, TypeScript, native, workflow, server, or deployment configuration was changed.
