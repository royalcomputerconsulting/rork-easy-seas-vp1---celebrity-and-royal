# Easy Seas Build 445 — Final QA Report

Date: September 2, 2026  
Candidate: Easy Seas 13.0.74 (iOS build 445, Android version code 130107)

## Release gates completed

- TypeScript: `npx tsc --noEmit --pretty false` — passed with no diagnostics.
- Expo Doctor: 18/18 checks passed using an isolated npm cache; project schema, assets, and SDK dependencies are aligned.
- iOS production JavaScript bundle: `npx expo export --platform ios` — passed, 3,839 modules bundled, 37 assets included, Hermes bundle generated.
- EAS native App Store build: passed. Remote iOS build 448 was compiled, signed, and packaged from Git snapshot `9c8b7101ca8527aab0508996d3e2740c30ee48b7` (EAS build `e5f6c7c7-6198-44bc-9654-51a7bded27e0`).
- Build 445 focused suite: every `tests/build445*.js` and `tests/build445*.ts` test passed.
- Maintained release suite: 229 passed, 48 optional/historical fixture tests skipped by their declared rules, 0 failed.
- Real supplied-file acceptance: 391 offer rows / 5 offer instances, 776 crew rows, 33 completed cruises plus totals, and two large backups passed parsing, ownership, count, and restore-manifest checks.

## Visual and interaction review

- All seven tabs have dated top, middle, and bottom captures in `BUILD445_VISUAL_EVIDENCE/2026-09-01`.
- Agent SEA, Day Agenda, Certificate Codes, Cert Summary, Data Trust, and Relationship Explorer have dated nested-screen captures.
- Light, dark, high-contrast, extra-large-text, simplified-density, and reduced-motion fixtures were captured from the live Experience screen.
- Each section is governed by one visible section title. Card titles, metric labels, and evidence captions may appear inside the section, but duplicate page/route headings are suppressed.
- The seven tab names, order, and routes are unchanged.
- The Easy Seas logo and Scott Astin signature assets are unchanged.

## Functional acceptance coverage

- Offers: authoritative instance identity, all attached sailing rows, cabin and guest entitlements, value/points, filter sheet, certificate navigation, and count readback.
- Cruises: bounded catalog paging, complete filters and sort, favorites above the catalog, stable detail identity, and no unbounded 1,000-card render.
- Booked: physical voyage/reservation truth, back-to-back cards, itinerary/readiness, sea/port days, casino opportunity, cabin/value/points, and the single allowed upcoming-voyage weather section.
- Calendar: Agenda/Week/Month/90-day/Passenger modes, prior/next Day Agenda navigation, Tarot, Crew navigation, event clearing, canonical cruise links, and the single allowed Day Agenda weather/map section.
- Casino: current-season versus annual history separation, owner isolation, ADT/theo/coin-in/points/value formulas, raw imported points, certificate-created value, evidence, and cruise portfolio.
- Slots: 218-machine library in the test profile, bounded rendering, filters, favorites, ship explorer/map link, session observations, play-hour preferences, and progress.
- Settings: always-visible Account, Connections, and Data Import & Backup; working Save All, Load Encrypted Backup, certificate ZIP, app-data export, recovery-key copy/paste/preview/restore, Trust filters/exports/repairs, and Scott Astin book links.
- Agent SEA: automatic readiness, first-tap single send, keyboard-safe iOS chat layout, owner-scoped durable history, Save/Print/Share/Export Log, deterministic ADT and certificate intelligence, temporal language, concise-first answers, and cited evidence.

## Data, persistence, and fault recovery

- SQLite schema v6, indexed repositories, foreign keys, owner indexes, resumable staged migrations, transaction rollback, and legacy startup bypass are covered.
- Backup manifests include offers, certificate files/rows, cruises, booked/completed history, casino, machines, crew, profiles, preferences, provenance, relationships, and settings.
- Integrity detection, severity/domain/owner/source/status filters, CSV/JSON export, blocked ambiguous repair, before/after preview, repair history, rollback, and Action Inbox surfacing are covered.
- Provider failure, malformed records/dates, missing native modules, corrupt/truncated backup, invalid recovery key, cancellation, interrupted staging, offline weather, and retry retention have regression coverage.

## Performance results

See `BUILD445_PERFORMANCE_BASELINE.md`. Key measured results:

- 2,500-cruise back-to-back analysis: 89–92 ms.
- 250,000 raw inventory rows reconciled to 62,500 physical sailings without lost eligibility rows: 229–252 ms.
- 13 offers / 3,151 sailings scored: 24–25 ms.
- 20,001 slot rows filtered: 3.7–4.1 ms.
- 4,234-record encrypted backup round-trip: 547 ms.
- 147 MiB encrypted-backup stress test: 13.1 seconds with 367 UI yields, exact readback, cancellation/resume, low-space, corruption, and rollback checks.

## Baseline comparison

- Retained baseline: `EASYSEAS_EXPO_V13.0.74_BUILD444_FINAL_SOURCE`.
- Candidate and baseline each contain 103 app route files.
- Set comparison found no route present in Build 444 that is absent from Build 445.
- The maintained route/action and repeatable seven-tab smoke contracts passed.

## Native-device boundary

The local Mac currently selects Command Line Tools rather than a full Xcode installation, so a physical-iPhone/simulator pass cannot be honestly recorded from this machine. EAS successfully produced signed App Store build 448, but TestFlight/device checks remain necessary for Apple share sheets, document picker, Maps round-trip, biometrics, VoiceOver focus order, keyboard on supported iPhone sizes, and low-memory behavior. This is the only environment-dependent acceptance boundary; it is not being mislabeled as completed.
