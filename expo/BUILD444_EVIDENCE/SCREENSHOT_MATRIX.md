# Build 444 Screenshot and State Matrix

Captured 2026-08-31 from the current Build 444 source at a 390 × 844 browser viewport.

## Capture context

- Runtime: Expo SDK 54 web development runtime served from the current source tree
- App version: 13.0.74; Build 444 worktree before final identifier bump
- Fixture: clean `local-default` profile with empty catalogs for visual empty-state coverage
- Owner: `local-default`
- Appearance: light/system, standard text size, standard density, motion enabled
- Network: localhost available; no live provider authentication and no native iOS services
- Scope limitation: these images prove responsive React Native Web rendering only. They do not claim VoiceOver, iOS Files, SecureStore, SQLite, share-sheet, native keyboard, simulator, or real-device behavior.

## Seven-tab matrix

| Screen | File | State | Result |
|---|---|---|---|
| Offers | `screenshots/web-phone-empty/01-offers.png` | Empty/default | Pass |
| Cruises | `screenshots/web-phone-empty/02-cruises.png` | Empty/default | Pass |
| Booked | `screenshots/web-phone-empty/03-booked.png` | Empty/default | Pass |
| Calendar | `screenshots/web-phone-empty/04-calendar.png` | Empty/default | Pass |
| Casino | `screenshots/web-phone-empty/05-casino.png` | Empty/default | Pass |
| Slots | `screenshots/web-phone-empty/06-slots.png` | Empty/default | Pass |
| Settings | `screenshots/web-phone-empty/07-settings.png` | Empty/default | Pass |

Every tab displays its distinct photorealistic destination band and retains the seven fixed, readable bottom destinations in the required order.

## Critical nested screens

| Screen | File | State | Result |
|---|---|---|---|
| Agent SEA | `screenshots/web-phone-nested/agent-sea.png` | Ready/empty conversation | Pass |
| Certificates | `screenshots/web-phone-nested/certificates.png` | Cold/empty certificate catalog | Pass |
| Offer Details | `screenshots/web-phone-nested/offer-details-empty.png` | Missing catalog relationship | Pass; error is explicit |
| Offer Filters | `screenshots/web-phone-nested/offer-filters.png` | Full filter modal, zero facets | Pass |
| Cruise Detail | `screenshots/web-phone-nested/cruise-detail-missing.png` | Missing route record | Pass; recovery action visible |
| Day Agenda | `screenshots/web-phone-nested/day-agenda.png` | Empty agenda/weather | Pass |
| Casino Intelligence | `screenshots/web-phone-nested/casino-intelligence.png` | Empty owner evidence | Pass |
| Casino Charts | `screenshots/web-phone-nested/casino-charts.png` | Empty owner evidence | Pass |
| Casino Play | `screenshots/web-phone-nested/casino-play.png` | Empty owner evidence | Pass |
| Casino Calcs | `screenshots/web-phone-nested/casino-calcs.png` | Empty owner evidence | Pass |
| Settings Data & Backup | `screenshots/web-phone-nested/settings-data-backup.png` | Import section | Pass |
| Settings export controls | `screenshots/web-phone-nested/settings-export-controls.png` | Export/restore controls | Pass |
| Data Trust Center | `screenshots/web-phone-nested/data-trust.png` | Browser-compatibility state | Pass after repair |

## State evidence outside this empty-data visual set

The following states are exercised by maintained executable acceptance tests rather than being relabeled as browser screenshots:

- Production-size 13-offer/3,151-sailing loading, filtering, Clear All, and canonical relationship counts: `tests/build444_offer_certificate_acceptance_runtime.js`
- Completed-cruise/casino/Slots populated and large-library calculations: `tests/build444_casino_slots_acceptance_runtime.js`
- Provider success, stale-readback, wrong-owner, scope replacement, and completion-with-warning states: `tests/build444_provider_sync_acceptance_runtime.js`
- File import/export readback and generated certificate ZIP contents: `tests/build444_settings_files_acceptance_runtime.js`
- 148 MiB backup progress, cancellation, resume, success, low-space failure, corruption failure, restore conflict preview, and exact readback: `tests/build444_147mb_backup_acceptance_runtime.js`
- Migration interruption/resume/rollback, integrity findings, ambiguous repair blocking, safe repair, and repair rollback: `tests/build444_database_integrity_owner_acceptance_runtime.js`
- Light, dark, high-contrast, large-text, large-control, reduced-motion, color-blind palette, image fallback, and 44/54-point contracts: `tests/build444_visual_accessibility_acceptance.js`

## Defect found and resolved during capture

Severity: critical for the web preview; no native iOS regression introduced.

The Data Trust Center directly opened a second Expo SQLite web access handle, producing `NoModificationAllowedError` and the development crash overlay. The rest of the application already uses a deliberate AsyncStorage compatibility path on web because Expo SQLite web access handles require isolation and exclusive ownership.

Resolution:

- Data Trust Center now refuses to open native indexed trust storage on web.
- It renders a clear compatibility notice and disables integrity, migration, encrypted-backup, and restore actions in the browser preview.
- Native iOS keeps the complete SQLite/integrity/encrypted-backup behavior unchanged.
- `tests/build444_data_trust_web_compatibility_regression.js` prevents regression.
- The repaired 390 × 844 capture contains no crash overlay.

## Explicitly unclaimed states

- Native iPhone/simulator interaction, VoiceOver focus order, iOS keyboard avoidance, Files/iCloud pickers, share sheets, Apple Maps handoff, SecureStore, and SQLite execution remain unclaimed because item 2 was explicitly skipped.
- A fresh authenticated provider session and a populated visual restore preview were not available in this local clean-profile run.
- Large-data behavior is covered by executable production-scale tests; it is not represented by a fabricated screenshot.

No unresolved critical or high-severity defect was discovered in the captured web workflow after the Data Trust repair.
