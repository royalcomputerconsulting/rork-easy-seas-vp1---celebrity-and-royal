# V1041 — Casino Intelligence Phase 4 AgentX Context QA

**App version:** 9.11.32  
**Build:** v1041 Casino Intelligence Phase 4 AgentX Context Integration

## Scope

Phase 4 connects the Casino Intelligence engine outputs to AgentX / Ask My Data context. This is an AgentX context and prompt integration build.

## Implemented

- Added Phase 1 engine outputs to AgentX context:
  - `buildBestPlayTodayPlan()`
  - `getCertificateExpirationResult()`
  - `calculateCasinoOpportunityScore()`
  - `buildHostViewProfile()`
- Added a new app-wide Ask My Data context block: `casino-intelligence-engine-outputs`.
- Added AgentX prompt guidance to use engine outputs rather than inventing new calculations.
- Added Ask My Data / AgentX trigger keywords for:
  - Best Play Today
  - Should I play today?
  - Target points
  - Casino Opportunity Score
  - Best casino cruise
  - Certificate expiration
  - Which certificate expires first?
  - Host View
  - What would a casino host see?
  - Host message / player profile summary
- Added quick actions for Best Play, Casino Scores, and Host View.
- Updated user manual and in-app manual version text.
- Bumped app version metadata to 9.11.32.

## Guardrails Preserved

This build does not intentionally change:

- SeaPass rendering/export
- SeaPass Key rendering
- Royal/Celebrity sync
- Chrome extension scraping/export
- Certificate PDF scraping
- Maritime Weather behavior
- Local-first backup/restore
- Itinerary trust guard behavior

## AgentX Rules Added

- Use Casino Intelligence engine outputs for Best Play Today, Casino Opportunity Scores, Certificate Expiration Intelligence, and Host View.
- Do not fabricate day-by-day itinerary details.
- Repeat incomplete-itinerary warnings when present.
- Certificate intelligence remains expiration-only.
- Do not provide certificate move-risk scoring, host override prediction, auto-redemption, or automatic deletion of expired certificates.

## QA Performed

- `state/AgentXProvider.tsx` TypeScript/TSX transpile syntax check passed.
- `scripts/testPhase4AgentXIntegration.ts` TypeScript transpile syntax check passed.
- Version metadata verified:
  - `app.json` expo.version = 9.11.32
  - `app.json` ios.buildNumber = 9.11.32
  - `app.json` android.versionCode = 91132
  - `package.json` version = 9.11.32
  - Settings diagnostic export version = 9.11.32
- User manual updated for Phase 4.

## Notes

The full Expo TypeScript build cannot be completed in this environment because local node_modules / Expo type dependencies are not installed. Source-level syntax/transpile checks passed on the changed AgentX integration files.
