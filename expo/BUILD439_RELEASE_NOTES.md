# Easy Seas 13.0.73 (Build 439)

Build 439 completes the cutting-edge experience and Phase 5 health, persistence, and trust work while preserving Build 438 as the locked rollback release.

## Experience and interaction

- One Easy Seas design-token system now defines typography, spacing, radius, controls, elevation, status presentation, tier colors, dark/high-contrast themes, text scaling, reduced motion, and color-blind-safe charts.
- Progressive disclosure presents three conclusions first and preserves each user's expansion choices.
- The Relationship Explorer traces completed play to points, certificates, offers, bookings, and realized value with exact/inferred/estimated/unresolved labels and both map and list views.
- Premium voyage artwork uses one visual language, memory/disk caching, lightweight fallbacks, and separate ship, destination, casino, weather, and loyalty treatments.
- Purposeful motion components support sync/progress/success feedback and collapse to zero-duration behavior when reduced motion is enabled.
- Accessibility settings add extra-large text, high contrast, color-blind-safe charts, 44-point minimum controls, VoiceOver labels, reduced motion, and simplified density.
- Existing Easy Seas logos, signature art, tab count, tab order, and working screen actions remain unchanged.

## Provenance and Agent SEA

- A shared provenance object records source type, observation time, owner, confidence, source record, provider, source hash, parent evidence, formula, and derived status.
- Loyalty, casino, financial, certificate, weather, offer, cruise, crew, profile, and preference fields can carry provenance.
- Provider facts and derived/estimated values remain visibly distinct.
- Agent SEA's source registry can produce record-level provenance citations.
- Provenance survives backup, restore, and local database migration.

## Versioned local data

- Health/trust data uses a versioned SQLite schema with WAL, foreign keys, owner/domain indexes, transactions, resumable checkpoints, migration diagnostics, and rollback source references.
- Available cruise inventory remains SQLite-backed; certificate documents and large crew collections remain lazy/file-backed so startup does not materialize them.
- Other eligible account/shared collections are indexed after navigation settles in 250-record batches. Completed source hashes are skipped before parsing on later launches.
- No backend is required; files remain compatible with local and user-controlled iCloud workflows.

## Integrity and reconciliation

- Background and on-demand checks detect duplicate cruises, orphan offer-sailing links, malformed dates, stale loyalty, unlinked certificates, impossible casino totals, broken relationships, and owner leakage.
- Findings include severity, affected records, evidence, and a repair preview.
- Ambiguous repairs never run automatically.
- Repair results and before/after evidence are retained.
- Open findings feed the Action Inbox.

## Incremental encrypted backup

- Backups use AES-256-GCM with a PBKDF2-SHA256 user password and a recoverable user-controlled key.
- Every export contains a complete, validated baseline-plus-increment chain.
- Incrementals store only added, updated, or deleted records while preserving unchanged-record counts.
- Restore preview reports additions, updates, preserved records, conflicts, rejected records, and potential deletions before any write.
- The default safe restore preserves current conflicting records.
- Included domains cover certificate documents, crew recognition and sailings, profiles, cruises, offers, casino history, loyalty, machines, settings, provenance, and user/experience preferences.

## Integrated operating system

- Cross-record Relationship Explorer.
- Unified Action Inbox.
- Existing Best-use Certificate Optimizer.
- Existing Casino Relationship Lifecycle dashboard.
- Data Trust Center for provenance, database diagnostics, integrity, encrypted backup, and restore preview.

## Verification

- Build 439 visual, provenance, database, integrity, backup, relationship, and integration regressions pass.
- Encrypted backup passed a runtime full/incremental/password/recovery-key/preview round trip.
- All Build 438 items 1-46 acceptance regressions remain passing.
