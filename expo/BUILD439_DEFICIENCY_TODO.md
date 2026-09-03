# Easy Seas Build 439 — Deficiency Todo

This is the active, evidence-first completion checklist. A screen name, route, helper, schema, or source-text assertion is not enough to close an item. A box closes only after the consuming workflow, persistence behavior, owner isolation, regression evidence, and production build gate are satisfied.

The locked working baseline remains Build 438. Work is performed only in the Build 439 workspace.

## 1. Inventory and evidence control

- [x] Preserve Build 438 as an untouched working baseline.
- [x] Inventory the 50 requested improvements and the five highest-value experiences.
- [x] Create a requirement-by-requirement evidence matrix.
- [x] Separate implemented, partial, unverified, and release-certified states.
- [x] Finish the maintained suite, TypeScript check, and fresh iOS export.
- [x] Record final command evidence and exact failures in this file.

## 2. Unified visual system and adaptive accessibility

- [x] Define the requested SeaPass, Crown & Anchor, Club Royale, and Blue Chip color tokens.
- [x] Preserve the existing Easy Seas logo, signature, tab count, and tab order.
- [x] Apply live theme behavior to root navigation, tab chrome, and shared buttons/cards.
- [x] Add user-selectable light, dark, and high-contrast preferences.
- [x] Add scalable text, minimum touch targets, reduced motion, simplified density, and color-blind chart colors to shared primitives.
- [x] Render every principal tab and the shared major-workflow family in light mode and fix visual exceptions.
- [x] Render every principal tab and the shared major-workflow family in dark mode and fix illegible legacy one-off styles.
- [x] Render every principal tab and the shared major-workflow family in high-contrast mode and fix contrast/touch/scale exceptions.
- [x] Add actual screenshot baselines and image comparison checks; 27 immutable PNG baselines cover all seven tabs, Appearance, and the Relationship Explorer workflow.

## 3. Progressive disclosure, relationship visuals, artwork, and motion

- [x] Add conclusion-first progressive disclosure to the dense target workflows.
- [x] Add an interactive relationship explorer with confidence, correction, and accessible list alternatives.
- [x] Add bounded graph rendering so large relationship datasets do not freeze navigation.
- [x] Add nonblocking owned artwork fallbacks for ship, offer/destination, weather, loyalty, and casino workflows.
- [x] Add purposeful, reduced-motion-aware feedback to shared and high-value workflows.
- [x] Render and inspect artwork crops/placeholders in the target mobile/workflow forms and all themes.
- [x] Capture screenshot evidence for disclosure, relationship maps, artwork, and reduced-motion alternatives.

## 4. Universal provenance and Agent SEA citations

- [x] Define shared source type, timestamp, owner, confidence, source-record, and formula metadata.
- [x] Attach provenance observers to loyalty, casino, finance, certificates, weather, offers, cruises, crew, profiles, and preferences.
- [x] Prevent estimates and derived calculations from appearing as provider facts.
- [x] Preserve provenance through the new database and encrypted backup structures.
- [x] Make Agent SEA include source/provenance citations.
- [x] Verify provenance survives export/encryption, cleared-sandbox reconstruction, and exact restore; traditional Save All/Load All carries the same provenance collection.
- [x] Verify a second user's Agent SEA never cites the primary user's private records.

## 5. Versioned local database and migrations

- [x] Create the local SQLite schema, WAL mode, foreign keys, schema migrations, owner/domain indexes, checkpoints, and diagnostics.
- [x] Complete the Cruise Inventory repository cutover.
- [x] Add resumable migration of legacy high-volume values into indexed domain records.
- [x] Stop Crew Recognition from hydrating the full 925-row registry during ordinary app startup and Settings import.
- [x] Make SQLite repositories the canonical runtime read path for remaining high-volume domains: offers, certificates, calendar events, casino sessions, crew recognition/sailings, machine encyclopedia, and slot atlas.
- [x] Keep legacy source values only as migration/rollback compatibility, not as the normal navigation read path.
- [x] Add repository pagination/filter/count APIs needed by consuming providers and on-demand screens.
- [x] Cut each provider over one domain at a time, preserving CRUD, import, Save All/Load All, and owner isolation.
- [x] Prove startup and tab switching do not deserialize full high-volume AsyncStorage collections; crew hydration is explicitly deferred and core startup excludes high-volume legacy payloads.

## 6. Integrity and reconciliation center

- [x] Detect duplicate records, broken links, malformed dates, stale loyalty, inconsistent totals, and owner leakage.
- [x] Assign severity and block ambiguous automatic repairs.
- [x] Show before/after repair previews.
- [x] Record repair history and reversible quarantine metadata.
- [x] Surface unresolved issues in the Action Inbox.
- [x] Run the center against representative primary-user, second-user, restored-backup, and post-sync fixtures.
- [x] Verify repairs cannot silently alter shared offers/cruises or cross owner boundaries.

## 7. Incremental encrypted backup and restore

- [x] Define a versioned manifest and AES-256-GCM/PBKDF2 encrypted full/incremental chain.
- [x] Include certificates/documents, crew, profiles, casino history, preferences, and provenance.
- [x] Add restore preview and preserve-current conflict policy.
- [x] Yield progress during large work so the interface remains responsive.
- [x] Extend traditional Save All/Load All to owner-scoped UI, inbox, relationship, home-layout, and watchlist preferences.
- [x] Execute and time a representative 4,234-record backup/restore round trip (590 ms in the final maintained-suite run; 543 ms in the focused run).
- [x] Verify cancel/retry/resume behavior and that no partial restore is published as success.
- [x] Verify exact post-restore counts, owner isolation, certificates, casino points/win-loss, crew registry, provenance, and preference state.

## 8. Five highest-value experiences

- [x] Cross-record relationship explorer exists with full-data/list/correction paths.
- [x] Action Inbox supports bulk actions, snooze, reassignment, and integrity findings.
- [x] Best-use certificate optimizer exists with exclusions and explanation.
- [x] Casino relationship lifecycle links play, certificate, offer, cruise, and realized value records.
- [x] Versioned database + automatic integrity center is complete with Section 5 runtime cutover and Section 6 fixture verification.
- [x] Verify all five end to end with owner-scoped fixture data and navigation tests.

## 9. Final release gates

- [x] TypeScript passes after the final source change.
- [x] Expo Doctor passes all 18 checks; the redundant npm lockfile was removed so EAS deterministically uses Bun.
- [x] Every Build 439 regression passes after the final source change.
- [x] Build 438 items 1–46 regressions pass against Build 439.
- [x] The complete maintained legacy suite passes with no unexpected skip/failure.
- [x] Accessibility and screenshot audits pass on principal workflows.
- [x] A fresh production iOS export completes after the final source change.
- [x] App Store version verification passes for 13.0.73 (439).
- [x] Package and hash the release without modifying or replacing Build 438.

## Final command evidence — 2026-08-30

- `tsc --noEmit`: passed with zero diagnostics.
- TypeScript/TSX syntax scan: 688 files passed.
- Expo Doctor: 18/18 checks passed after removing the duplicate `package-lock.json`; `bun.lock` is the sole package-manager lock.
- Build 439 focused regressions: 12/12 passed, including owner isolation, provenance, repository paging, integrity, backup, top-five workflows, and 27 visual baselines.
- Maintained release suite: 133 passed, 45 intentional historical-version/private-fixture skips, 0 failed (178 total).
- App Store identity: Easy Seas 13.0.73, local iOS baseline 439, Android 130105; EAS remote auto-increment enabled.
- Fresh iOS production export: 3,793 modules bundled; 19.4 MB Hermes bundle produced at `/private/tmp/easyseas-build439-final-ios-20260830`.
- The Build 438 source folder and ZIP remain untouched and retain SHA-256 `d7449f2bca251f6e0917be7c95aeb26e4467642803e330cd799c62e8eb24c78e`.
