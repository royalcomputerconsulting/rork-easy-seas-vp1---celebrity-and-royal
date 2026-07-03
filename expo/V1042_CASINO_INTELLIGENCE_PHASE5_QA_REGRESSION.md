# V1042 — Casino Intelligence Phase 5 QA and Regression Protection

**App version:** 9.11.33  
**Build:** v1042  
**Scope:** Phase 5 testing, QA, and regression protection for the Casino Intelligence implementation plan.

## Purpose

This build completes Phase 5 of the Casino Intelligence plan. It validates the Phase 1 engines, Phase 2 reusable components, Phase 3 screen integrations, and Phase 4 AgentX context integration. It also adds repeatable regression protection for protected app systems.

## Files Added

- `scripts/testPhase5FullRegression.ts`
- `scripts/protectedSystemsManifest.json`
- `V1042_CASINO_INTELLIGENCE_PHASE5_QA_REGRESSION.md`

## Files Updated

- `app.json`
- `package.json`
- `app/(tabs)/settings.tsx`
- `USERMANUAL.md`
- `components/UserManualModal.tsx`
- `lib/certificates/expiration.ts`
- `lib/cruise/casinoOpportunityScore.ts`
- `lib/casino/bestPlayToday.ts`
- `lib/analytics/hostView.ts`
- `scripts/testPhase1Engines.ts`
- `scripts/testPhase3Integration.ts`
- `scripts/testPhase4AgentXIntegration.ts`

## Import Hygiene

The Phase 1 engine files and test harnesses were updated to use relative imports where practical. This makes the test harnesses runnable from a plain `tsx` command without relying on Expo/Rork alias resolution.

## Added Package Scripts

- `npm run test:phase1`
- `npm run test:phase3`
- `npm run test:phase4`
- `npm run test:phase5`

## Regression Harness Coverage

`scripts/testPhase5FullRegression.ts` validates:

- date normalization and date-only math
- certificate expiration edge cases and urgency sorting
- Casino Opportunity Score behavior
- Best Play Today behavior
- Host View behavior
- static UI integration markers
- AgentX casino intelligence context markers
- protected-system SHA-256 file hashes

## Key Acceptance Criteria Validated

- Invalid dates return safe results and do not crash.
- Certificates with unknown/invalid dates return `unknown` with warnings where appropriate.
- Expired certificates remain visible and are not removed.
- `redeemByDate` remains the highest-priority certificate expiration field.
- Star of the Seas July 5–12, 2026 uses Basseterre, St. Kitts & Nevis and does not fabricate Philipsburg.
- Incomplete itineraries produce warnings rather than fake precision.
- Sea days improve casino opportunity scoring.
- Private island days reduce casino opportunity scoring.
- Best Play Today uses the $5 coin-in per point rule.
- Best Play Today uses a $200 default bankroll cap.
- Debarkation recommends avoiding play.
- Host View builds from empty and partial data safely.
- Host View generates strengths, risks, talking points, favorite ships, favorite machines, and copyable summary.
- Phase 2 components stay display-only and do not duplicate engine logic.
- AgentX includes the structured casino-intelligence engine outputs.

## Protected Systems Locked by Hash Manifest

The protected manifest covers 56 files across:

- SeaPass live preview/export/rendering
- SeaPass Key behavior
- Royal/Celebrity sync and certificate PDF parsing
- Chrome extension scraping/export files
- Maritime Weather files
- local backup/restore bundle behavior

## Commands Run

```bash
npx --no-install tsx scripts/testPhase1Engines.ts
npx --no-install tsx scripts/testPhase3Integration.ts
npx --no-install tsx scripts/testPhase4AgentXIntegration.ts
npx --no-install tsx scripts/testPhase5FullRegression.ts
```

## Results

All source-level harnesses passed.

## Protected Systems Not Intentionally Changed

- SeaPass rendering/export
- SeaPass Key rendering
- SeaPass shell image behavior
- Chrome extension scraping
- Royal/Celebrity offer sync
- Certificate PDF scraping
- Maritime Weather card behavior
- Local-first backup/restore

## Limitations

This is source-level and logic-level QA. A real TestFlight/device build is still required before release because native Expo runtime behavior, physical-device storage, and actual PNG/PDF capture cannot be fully proven from this environment.
