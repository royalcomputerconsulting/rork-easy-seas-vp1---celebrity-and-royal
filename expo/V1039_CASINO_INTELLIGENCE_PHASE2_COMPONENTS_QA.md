# V1039 — Casino Intelligence Phase 2 Reusable UI Components QA

## Version

- App version: 9.11.30
- iOS buildNumber: 9.11.30
- Android versionCode: 91130
- Package version: 9.11.30

## Scope

Phase 2 creates reusable, display-only UI components for the Phase 1 Casino Intelligence engines. No screen integration was performed in this phase.

## Added files

- `components/certificates/CertificateExpirationBadge.tsx`
- `components/cruise/CasinoOpportunityBadge.tsx`
- `components/casino/BestPlayTodayCard.tsx`
- `components/analytics/HostViewCard.tsx`
- `scripts/testPhase2Components.ts`
- `V1039_CASINO_INTELLIGENCE_PHASE2_COMPONENTS_QA.md`

## Updated files

- `app.json`
- `package.json`
- `app/(tabs)/settings.tsx`
- `USERMANUAL.md`
- `components/UserManualModal.tsx`

## Component behavior

### CertificateExpirationBadge

- Consumes `CertificateExpirationResult` from `lib/certificates/expiration`.
- Supports compact and expanded display.
- Displays valid, expiring-soon, urgent, expires-today, expired, and unknown states.
- Displays badge label, message, expiration date, and warnings when expanded.
- Does not calculate certificate expiration internally.

### CasinoOpportunityBadge

- Consumes `CasinoOpportunityScore` from `lib/cruise/casinoOpportunityScore`.
- Supports compact and expanded display.
- Displays score, label, casino-open days, estimated hours, and warnings.
- Does not calculate opportunity score internally.

### BestPlayTodayCard

- Consumes `BestPlayTodayPlan` from `lib/casino/bestPlayToday`.
- Displays active cruise/ship, date, cruise day, day type, recommended action, target points, estimated coin-in, bankroll cap, bet range, session length, reason, warnings, and recommended machines.
- Does not calculate Best Play Today internally.

### HostViewCard

- Consumes `HostViewProfile` from `lib/analytics/hostView`.
- Displays loyalty snapshot, casino play summary, cruise value summary, player pattern, talking points, strengths, risks/watchouts, and local data source note.
- Exposes `onCopySummary` callback instead of directly depending on clipboard APIs.
- Does not calculate Host View internally.

## Guardrails honored

This Phase 2 build does not intentionally change:

- SeaPass rendering/export
- Key symbol rendering
- Chrome extension scraping
- Royal/Celebrity offer sync
- Certificate PDF scraping
- Maritime Weather logic
- Local-first backup/restore
- Existing itinerary trust guard behavior

## QA performed

- Phase 2 component harness passed using `scripts/testPhase2Components.ts`.
- TSX transpile syntax check passed on the four new component files.
- Harness confirmed all four component files exist, export components, expose testID hooks, consume Phase 1 engine result types, and do not call the core calculation engines directly.
- Manual and in-app manual version label updated to 9.11.30.
- Version metadata updated consistently.

## Not performed in Phase 2

- No Overview integration.
- No certificate screen integration.
- No cruise card integration.
- No Scheduling integration.
- No Analytics Intelligence screen integration.
- No AgentX context integration.

Those belong to later phases.
