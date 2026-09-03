# Easy Seas 13.0.34 (Build 400)

## Casino Command Center repair

- Preserves the mounted four-tab Casino navigation: Overview, Trips, Sessions, and Tools.
- Persists the selected Club Royale or Blue Chip program per local user.
- Attributes new onboard sessions to the linked cruise's casino program and marks them as actual user-entered evidence.
- Recovers retained sessions that predate program attribution by inferring the program from their linked cruise.
- Includes separate handpays consistently in onboard and relationship win/loss calculations.
- Excludes generated historical sessions from Relationship Intelligence actual metrics.
- Uses Casino Settings for points-per-hour and house-edge fallback assumptions.
- Aligns Overview win/loss and theoretical totals with the same current earning-year window used by points reconciliation.
- Replaces the mixed-unit session chart with a same-unit recent-session points chart while retaining the Session Performance contract.
- Exposes Relationship Intelligence, comp pace, observations, wallets, benefits, completed sailings, host tools, checklist, alerts, and settings from the active Tools tab.
- Repairs legacy Action Center, Cruise Value, History, and Simulator deep links to open the appropriate current tab.
- Removes an unsafe universal points-times-five calculation from Ship Performance and clarifies formula documentation throughout older casino screens.
- Adds Build 400 regression coverage for reachability, attribution, settings, date scope, formulas, and routing.

## Release identity

- App Store marketing version: 13.0.34.
- Local iOS build baseline: 400; EAS production remote auto-increment remains enabled.
- Android version code: 130057.

## Verification

- 118 maintained release tests passed; two optional private-fixture tests skipped; zero failures.
- 614 TypeScript/TSX files passed syntax transpilation.
- Build 399 casino truth and crew-registry regressions passed.
- Build 400 Casino Command Center repair regression passed.
