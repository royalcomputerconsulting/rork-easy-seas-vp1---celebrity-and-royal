# Build 440 — Easy Seas UX Execution Checklist

> Consolidated into `BUILD440_AUTHORITATIVE_DEFICIENCY_TODO.md` on August 30, 2026. This file remains background detail only.

This checklist translates the attached **Easy Seas UX/UI Change Report** into release work. The existing seven tab names/order, Easy Seas logo, and signature are retained because the owner previously marked them non-negotiable. No feature may be removed; relocation requires an equally visible route from its owning tab.

## Phase 1 — Foundations

- [ ] Adopt the report's semantic navy/teal/canvas/surface/status palette and remove arbitrary full-card themes.
- [ ] Add the unified typography roles with Source Serif 4 when bundled and platform sans-serif controls.
- [ ] Standardize the 8-point grid, 16-point page margins, 14-point card radius, fine border, and restrained elevation.
- [ ] Standardize PageHeader, SegmentedControl, SearchField, FilterButton, StatusBadge, CruiseRow, MetricCard, AlertCard, EmptyState, DefinitionList, and DetailSheet.
- [ ] Guarantee 44×44 minimum targets, Dynamic Type reflow, VoiceOver naming, reduced motion, and high contrast.
- [ ] Standardize loading skeletons, inline errors, retry, empty, missing, estimated, derived, reconciled, and success states.

## Phase 2 — Global shell and identity

- [ ] Preserve the seven tabs, their order, the Easy Seas logo, and signature assets.
- [ ] Give every primary tab the same compact page anatomy and semantic brand shell.
- [ ] Standardize the bottom navigation icon/label/active indicator without changing destinations.
- [ ] Remove action-obscuring global floating controls; retain each action in its owning page header or toolbar.
- [ ] Make local navigation sticky and visually subordinate to global navigation.
- [ ] Apply sentence case and the report's cruise/voyage, night, guest, status, and destructive-action copy rules.

## Phase 3 — Offers, Cruises, Booked, Calendar

- [ ] Reorder Offers into loyalty, overview, expiring offers, active offers, certificates, recent activity, and learning.
- [ ] Move the full casino-history ledger out of Offers while retaining a recent-activity summary and route.
- [ ] Move machine strategy/explorer entry points to Slots while preserving discoverability.
- [ ] Unify offer cards and expose evidence through “Why this score?” progressive detail.
- [ ] Consolidate Cruises search/filter/sort and retain scroll/filter position.
- [x] Move Favorite Cruises/Staterooms above the unbounded virtualized cruise catalog so it is reachable.
- [ ] Use a unified cruise row with sentence-case itinerary, full guest/night labels, status badge, and hidden zero casino metadata.
- [ ] Reorder Booked around next voyage, primary actions, upcoming/completed scope, and contextual voyage detail.
- [ ] Consolidate voyage weather caveats into one expandable source/freshness row.
- [ ] Keep Calendar focused on agenda/week/month/90-day planning and make Crew Recognition ownership explicit.
- [ ] Preserve the requested daily Tarot view, event filters, deadlines, and voyage-day navigation.

## Phase 4 — Casino and Slots

- [ ] Make Casino use the same Easy Seas shell rather than a visually separate dark application.
- [ ] Rename local Casino destinations to task language while preserving all legacy routes/actions.
- [ ] Present three conclusions first, then charts/comparisons, then expandable sources and calculations.
- [ ] Standardize metric cards and hide truly unavailable metrics behind an expandable needs-data summary.
- [ ] Define average daily theoretical, theoretical loss, coin-in, and points per hour on first use.
- [ ] Preserve all four Casino page functions and every host, value, ship, receipt, certificate, session, and calculation tool.
- [ ] Rebuild Slots around search, filters, one-column machine rows, favorites, map, sessions, notes, and play-time preferences.
- [ ] Preserve the machine atlas, verified map, condition logs, sessions, exports, and slot settings.

## Phase 5 — Settings and content

- [ ] Group Settings into Account, Security, Notifications, Connections, Data & Backup, Integrations, Appearance, Help, and About.
- [ ] Move developer/mock-data controls out of the production path.
- [ ] Keep every sync/import/export/backup/restore/certificate/crew control reachable and working.
- [ ] Replace the legal wall with navigable About & Legal content.
- [ ] Add Settings search and concise group summaries.
- [ ] Apply the complete visible-copy rewrite without changing calculation meaning.

## Phase 6 — Relationship, motion, artwork, validation

- [ ] Provide accessible relationship maps and equivalent lists for certificates → offers → cruises, voyage value, loyalty, and casino evidence.
- [ ] Use premium voyage artwork only at story-level surfaces; preserve offline caching and neutral fallbacks.
- [ ] Apply purposeful sync, parsing, tier, chart, favorite, offline, weather, and undo micro-interactions with reduced-motion alternatives.
- [ ] Verify comfortable, compact, and focused density modes on every dense screen.
- [ ] Capture fresh phone screenshots for all seven tabs, Agent SEA, voyage weather, offer details, and Casino subpages.
- [ ] Test empty, partial, stale, offline, thousands-of-cruises, large backups, primary/secondary owners, and both casino programs.
- [ ] Run full functional parity for imports, exports, sync, calculations, filters, reminders, certificates, favorites, weather, crew, machines, backup, and restore.
- [ ] Pass TypeScript, maintained regressions, Expo Doctor, version checks, and a fresh iOS production bundle.
