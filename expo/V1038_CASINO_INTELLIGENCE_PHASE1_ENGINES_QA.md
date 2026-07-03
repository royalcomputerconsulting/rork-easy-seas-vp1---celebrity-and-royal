# V1038 — Casino Intelligence Phase 1 Engines QA

**App version:** 9.11.29  
**Build:** v1038  
**Baseline:** v1037 casino real-data / derived-session build

## Scope

Implemented Phase 1 of the EasySeas Casino Intelligence plan as engine-only reusable logic.

## Added files

- `lib/dates/appDate.ts`
- `lib/certificates/expiration.ts`
- `lib/cruise/casinoOpportunityScore.ts`
- `lib/casino/bestPlayToday.ts`
- `lib/analytics/hostView.ts`
- `scripts/testPhase1Engines.ts`
- `lib/casino/index.ts`
- `lib/cruise/index.ts`
- `lib/certificates/index.ts`
- `lib/analytics/index.ts`

## Version updates

- `app.json` → 9.11.29 / versionCode 91129
- `package.json` → 9.11.29
- `app/(tabs)/settings.tsx` diagnostic version → 9.11.29
- `components/UserManualModal.tsx` version label → 9.11.29
- `USERMANUAL.md` → 9.11.29

## Protected systems not intentionally changed

- SeaPass generator/render/export
- SeaPass key behavior
- Chrome extension scraping
- Royal/Celebrity sync
- Certificate PDF scraping
- Maritime Weather
- Local-first backup/restore
- Existing itinerary trust guard

## Acceptance coverage

### Date utilities

- Normalizes `YYYY-MM-DD`.
- Normalizes ISO timestamp strings using date-only behavior.
- Normalizes `MM/DD/YYYY` and `MM-DD-YYYY`.
- Invalid input returns `null`.
- Date difference and add-days helpers are safe.

### Certificate expiration engine

- Supports `redeemByDate`, `expirationDate`, `expiresAt`, `expiryDate`, and `sailByDate`.
- Uses `redeemByDate` priority over `sailByDate`.
- Returns `unknown`, `expired`, `expires-today`, `urgent`, `expiring-soon`, or `valid`.
- Returns badge label, message, severity, days remaining, source field, warnings, and sort priority.
- Does not hide or delete expired certificates.
- Does not implement move-risk or host-override prediction.

### Casino Opportunity Score engine

- Scores cruises safely or returns unknown.
- Does not fabricate precise day-by-day details from vague labels.
- Adds incomplete-itinerary warnings when appropriate.
- Supports the Star of the Seas July 5–12, 2026 hard-map with Basseterre, St. Kitts & Nevis.
- Sea/marine-zone days improve score.
- Private island days reduce score.
- Embarkation/debarkation days are restricted.

### Best Play Today engine

- Finds active cruise by date.
- Calculates cruise day number.
- Uses `$5 coin-in per point` default.
- Uses `$200` bankroll cap default.
- Sea day recommends play.
- Port day recommends light play.
- Private island and embarkation recommend freeplay-only/light behavior.
- Debarkation recommends avoid.
- No active cruise returns safe fallback.

### Host View engine

- Builds from partial data.
- Aggregates cruises, sessions, points, coin-in, win/loss, averages, favorite ships, favorite machines, strengths, risks, talking points, and copy summary.
- Does not crash on missing sessions or cruises.

## QA performed

- Static inspection of changed files.
- Harness file added for repeatable engine validation: `scripts/testPhase1Engines.ts`.
- The harness was transpiled with a temporary TypeScript config and executed successfully in Node.
- No UI integration was added in this phase.
