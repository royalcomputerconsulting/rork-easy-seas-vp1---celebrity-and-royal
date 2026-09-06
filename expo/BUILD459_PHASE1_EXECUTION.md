# Build 459 — Phase 1 Execution

Scope: shared design foundation plus Home, Explore, My Voyages, Calendar, and their nested screens. Existing functionality is protected.

## Foundation

- [x] Lock visible navigation as Home, Explore, My Voyages, Calendar, Casino, Settings, +.
- [x] Keep route identities and automation IDs stable.
- [x] Keep Machines hidden globally.
- [x] Give + the stable meaning and accessible name Quick Actions.
- [x] Normalize the modern Easy Seas palette and global navigation treatment.
- [x] Update tab identity titles without rewriting feature routes.
- [x] Update the repeatable seven-tab interaction contract for the corrected visible names.
- [x] Finish the canonical metric, cruise-card, filter, progress, header, loading, and empty-state adoption sweep for the primary lifecycle screens.

## Home

- [x] Preserve logo-first and loyalty-first presentation.
- [x] Rename the compact expiration area to What needs attention.
- [x] Complete spacing, hierarchy, card, filter, imagery, and critical nested-screen inspection at phone width.
- [x] Verify offer/certificate counts, actions, pagination, and Agent SEA evidence with maintained and supplied populated data.

## Explore

- [x] Complete shared filter adoption and phone-width visual inspection.
- [x] Verify search, availability modes, Soonest, Latest, Value, advanced filters, paging, and detail routes.
- [x] Standardize every result and back-to-back card on the canonical cruise contract.

## My Voyages

- [x] Complete hero, weather, readiness, filters, cards, favorites, consecutive blocks, and completed history presentation.
- [x] Verify booked/current/completed data and route identity contracts with supplied completed-cruise data.
- [x] Verify receipt ingestion and manual totals against any selected saved voyage, including the supplied Royal receipt.

## Calendar

- [x] Keep calendar primary and Crew Recognition below calendar planning content.
- [x] Complete shared range/filter controls and section presentation.
- [x] Verify Day Agenda, EventKit, one weather section, map, date navigation, timeline, and crew routes through maintained acceptance and phone-width inspection.

## Phase 1 exit gate

- [x] TypeScript passes after the Phase 1 navigation and token foundation.
- [x] Focused navigation, typography, accessibility, Home hierarchy, and visual-system contracts pass.
- [x] Full maintained regression suite passes after the Phase 1 foundation: 254 passed, 41 optional-fixture tests skipped, 0 failed.
- [ ] Expo Doctor is 17/18: the remaining release-configuration warning is that a checked-in native `ios/` project can drift from fields in `app.config.js`; resolve this deliberately without disrupting the working local simulator project.
- [ ] Populated-data readback, accessibility, performance, and iOS screenshot inspection all pass.
