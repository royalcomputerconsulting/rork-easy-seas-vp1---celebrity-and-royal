# Easy Seas 13.0.74 — Build 444 Release Notes

Prepared 2026-08-31 from the verified Build 443 source baseline. Build 439 remains the recorded rollback baseline.

## Release identity

- Marketing version: 13.0.74
- Local iOS build: 444
- Android version code: 130107
- EAS production version source: remote with automatic increment enabled
- Supported Apple form factor: iPhone (`supportsTablet: false`)

## Principal Build 444 closure work

- Secured Agent SEA delivery: removed the public bundled owner-key path, retained owner-scoped deterministic tools, added the authenticated server-side provider-key path, and kept per-user keys in SecureStore only.
- Preserved all 13 offers and 3,151 row-distinct eligible sailings through canonical offer relationships, filters, actions, persistence, and drill-down contracts.
- Unified Booked, Loyalty, and Casino Crown & Anchor projections using the confirmed occupancy/suite rule: shared standard 1/night per occupant, solo standard 2/night, shared suite 2/night per occupant, solo suite 3/night.
- Consolidated duplicate reservations only for physical-voyage calculations while preserving each reservation independently.
- Added continuous back-to-back weather selection, truthful position language, a visible itinerary-position map, and Calendar/Agenda navigation contracts.
- Qualified Casino annual/current-season truth and a 20,001-row Slots library without relabeling estimates as actual sessions.
- Qualified file pickers, crew workbook import, completed-cruise import, certificate ZIP export, Save All/Load All, and both supplied locally available backups.
- Qualified a sanitized 148 MiB encrypted backup with preflight sizing, cancellation, resume, corruption rejection, conflict preview, rollback, and exact readback.
- Completed indexed-database migration checkpoints, rollback audit, provenance, integrity findings, reversible safe repairs, and owner isolation.
- Applied the premium oceanic visual system, Source Serif headings, seven photorealistic tab stories, adaptive themes, reduced motion, text/control scaling, and fixed seven-tab navigation.
- Repaired the Data Trust browser-preview SQLite access-handle crash without changing native iOS trust behavior.

## Release gates

- App Store identity check: pass for 13.0.74 / Build 444 / Android 130107.
- TypeScript: pass.
- Expo Doctor: 18/18 pass using an isolated temporary npm cache because the user-level npm cache contains legacy root-owned files.
- Maintained release tests: 173 passed, 48 explained historical/private-fixture skips, 0 failed (221 total).
- Current supplied files: pass — 391 offer rows/5 offers, 776 crew rows, 33 completed cruises, two locally available backups, one legacy duplicate profile id routed to repair.
- Production-size offer fixture: pass — 13 offers/3,151 row-distinct sailings.
- iOS production JavaScript export: pass — 3,821 modules, 34 assets, one 19.6 MB Hermes bundle.
- Credential scan: pass for source and iOS production export; no key-shaped credential was found.
- Phone-size web screenshot matrix: pass after Data Trust repair; see the separately delivered Build 444 evidence folder.

## Explicit limitations

- The user explicitly skipped restoration of the full Xcode/simulator verification environment. No native iPhone/simulator, VoiceOver, Files/iCloud, share-sheet, SecureStore, SQLite, CocoaPods, signed archive, or IPA execution is claimed.
- Fresh authenticated Royal, Celebrity, and Carnival provider sessions were not supplied to this run. Provider scope/readback/warning behavior is covered by the maintained acceptance fixture, not mislabeled as a live-account sync.
- Two optional private August certificate manifest tests remain skipped because that private manifest is not packaged.
- Historical tests pinned to older marketing versions remain deliberately skipped by the maintained test runner.
- The older Build 440 supplied-import test requires its original 850-row external offer file and is skipped when that exact legacy file is absent. Build 444's current preserved 391-row fixture and the separate 13/3,151 production-scale fixture both pass.

This ZIP is a clean source package for EAS/TestFlight building. It is not a signed IPA.
