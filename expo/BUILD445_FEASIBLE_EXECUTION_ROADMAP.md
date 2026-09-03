# Easy Seas Build 445 — Feasible Execution Roadmap

This roadmap converts the 323 uniquely numbered repairs in `BUILD445_TRACKED_UI_REPAIR_PLAN.md` into bounded work packages. It is designed to prevent functional regressions, unfinished visual islands, and broad claims of completion without device evidence.

## Operating rules

1. Freeze new feature work until this roadmap is complete, except for a production-blocking defect discovered during verification.
2. Keep the existing seven tabs, names, order, routes, Easy Seas logo, and signature.
3. Do not rewrite domain logic merely to restyle a screen. Extract or adapt only when required for shared presentation or a proven defect.
4. Before changing a screen, lock its current behavior in tests and record every action it exposes.
5. Complete one bounded screen or component family at a time. Do not partially theme several tabs simultaneously.
6. Each package ends with: focused tests, TypeScript for touched scope, an iPhone screenshot, first-tap interaction checks, and a comparison with the functional baseline.
7. A shared primitive can be complete while its consuming screens remain incomplete. Each consuming-screen ID closes only after that screen is inspected.
8. Use representative small and large datasets. A screen that works only with empty or tiny data is not complete.
9. Preserve valid data on every error path. Unknown remains unknown; it must never become zero.
10. Commit or archive a recoverable checkpoint after every accepted work package.
11. Render exactly one visible title per section; remove duplicate artwork-band, card-header, and inner-content headings without removing the section's actions or information.

## Definition of a work-package pass

Each work package uses the same six-step loop:

1. **Observe:** capture the current screen, performance, actions, data sources, and failure states.
2. **Contract:** add or update behavior tests before changing presentation.
3. **Repair:** implement only the IDs assigned to the package.
4. **Exercise:** test every control with small, large, empty, loading, offline, and failure states that apply.
5. **Inspect:** capture light, dark, high-contrast, and large-text screenshots on an iPhone viewport.
6. **Accept:** close IDs only when behavior, appearance, performance, and persistence all pass.

---

## Phase 0 — Baseline and immediate stability

Goal: make the current app safe to change and remove the defects that prevent reliable visual verification.

### Package 0.1 — Recoverable baseline

- IDs: `BASE-001` through `BASE-005`
- Preserve the working baseline, route/action inventory, representative datasets, before screenshots, and performance timings.
- Exit gate: the current build can be restored and every visible action has an expected behavior.

### Package 0.2 — Crash and first-tap stabilization

- IDs worked early: `SLT-017`, `SET-048`, `SEA-003`, `SEA-004`, `SEA-024`, `CRU-019`, `CRU-026`, `BOK-026`, `OFF-016`, `OFF-024`, `OFF-037`
- Fix Settings startup crashes, Machines startup crashes, Agent SEA open/send/close freezes, partial detail overlays, wrong cruise identity, and multi-press controls.
- Keep styling changes minimal in this package; complete final presentation under the owning tab packages.
- Exit gate: all seven tabs open after cold start, all nested routes used in the recording open and close, and Send works with one press.

### Package 0.3 — Large-data navigation stabilization

- IDs worked early: `OFF-032`, `OFF-048`, `OFF-050`, `CRU-020`, `CRU-021`, `SLT-014`
- Stop certificate, cruise, and machine screens from mounting or deriving entire collections before first paint.
- Introduce bounded list reads, cached first content, paging/virtualization, and scroll restoration without changing visible information.
- Exit gate: Examine Certificates, offer sailings, Cruises catalog, and Machine Library display a responsive shell and usable cached content under representative large data.

---

## Phase 1 — Shared visual language

Goal: build the system once before converting tabs.

### Package 1.1 — Typography and palette

- IDs: `SYS-001` through `SYS-005`
- Define the approved font roles, load Source Serif safely, define the nautical palette and tier semantics, and create page backgrounds.
- Exit gate: a design-token specimen shows every text role, color, tier, and page background in light/dark/high-contrast modes.

### Package 1.2 — Cards, spacing, icons, and buttons

- IDs: `SYS-006` through `SYS-009`
- Define card variants, spacing grid, icon/emoji rules, and action hierarchy.
- Exit gate: a component specimen demonstrates all variants at small and large text sizes.

### Package 1.3 — States, evidence, accessibility, and overlays

- IDs: `SYS-010` through `SYS-015`
- Standardize operation feedback, missing/empty states, provenance, reduced motion, accessibility, modals, sheets, and drawers.
- Exit gate: loading, error, unknown, zero, offline, success, retry, and modal behavior pass shared tests.

---

## Phase 2 — Shared components

Goal: create reusable parts that enforce sameness across every tab.

### Package 2.1 — Page and section structure

- IDs: `SHR-001`, `SHR-002`, `SHR-007`, `SHR-011`
- Build the canonical page shell, section header, metric strip, and event card.
- Exit gate: all four work across supported iPhone widths and accessibility modes.

### Package 2.2 — Filters and segmented controls

- IDs: `SHR-003` through `SHR-005`
- Build one filter launcher, one filter sheet, and one segmented-control system.
- Exit gate: a sample domain supports selection, keyboard entry, Clear All, Apply, result count, and VoiceOver.

### Package 2.3 — Progress and evidence

- IDs: `SHR-006`, `SHR-012`
- Build canonical progress and evidence disclosure with tier-aware semantics.
- Exit gate: C&A, Club Royale, readiness, and operation examples share structure but use correct semantic colors.

### Package 2.4 — Canonical cruise and offer cards

- IDs: `SHR-008` through `SHR-010`
- Build full, compact, and comparison cruise modes plus the canonical offer card.
- Use Booked cards as the minimum information contract.
- Exit gate: the same test sailing renders with the same field positions in all density modes.

### Package 2.5 — Large-list shell and bottom navigation

- IDs: `SHR-013` through `SHR-015`
- Complete the virtualized list shell, normalize seven-tab navigation, and establish screenshot fixtures.
- Exit gate: paging, loading-more, end state, tab labels, and safe areas pass on the smallest supported iPhone.

---

## Phase 3 — Offers tab, core offer experience

Goal: complete the main Offers screen before moving into certificate subflows.

### Package 3.1 — Offers shell and loyalty

- IDs: `OFF-001` through `OFF-009`
- Convert the page identity, branding, owner controls, program switching, and loyalty progress.
- Exit gate: the top of Offers matches the reference quality and retains every current action.

### Package 3.2 — Offer overview and expiration center

- IDs: `OFF-010` through `OFF-016`
- Convert metrics, sorting, expiration buckets, rows, and actions.
- Exit gate: every expiring item opens the correct offer and secondary actions remain available.

### Package 3.3 — Offer filters and cards

- IDs: `OFF-017` through `OFF-024`
- Convert owner/domain filters, Active Offers heading, canonical cards, artwork, missing cabin, value, and navigation.
- Exit gate: populated, empty, loading, expiring, and missing-data states pass visual and behavior review.

### Package 3.4 — Offer detail and decisions

- IDs: `OFF-025` through `OFF-030`
- Convert the detail screen, information order, True Offer Value, Offer Intelligence, and Should I Book.
- Exit gate: open/close is immediate, the summary is concise, and all evidence/actions remain available.

### Package 3.5 — Offer-eligible sailings

- IDs: `OFF-031` through `OFF-037`
- Convert canonical cards, bounded list, search, filters, sorting, casino metrics, row grouping, and cruise identity.
- Exit gate: a large offer remains responsive and every displayed count/detail reconciles.

---

## Phase 4 — Certificates and remaining Offers content

Goal: finish all certificate workflows as one coherent family.

### Package 4.1 — Certificate landing and persistence

- IDs: `OFF-038` through `OFF-043`
- Convert Casino & Certificates, actions, operations, month lifecycle, and persistence.
- Exit gate: downloaded current/next-month certificates survive restart without opening Certificate Codes first.

### Package 4.2 — Certificate Codes and drill-downs

- IDs: `OFF-044`, `OFF-045`
- Convert per-code summaries and exact contributing-row navigation.
- Exit gate: code/guest/class/cabin/benefit/total counts reconcile to result rows.

### Package 4.3 — Cert Summary and results

- IDs: `OFF-046` through `OFF-048`
- Convert tabs, filters, matrices, virtualized results, PDFs, cruise links, and Agent SEA links.
- Exit gate: thousands of options remain readable and responsive on iPhone.

### Package 4.4 — Examine Certificates and evidence

- IDs: `OFF-049` through `OFF-052`
- Complete the examiner presentation, nonblocking open, retained-data failure behavior, PDF, and provenance.
- Exit gate: the supplied certificate inventory opens quickly before and after a download and remains after failed refresh.

### Package 4.5 — Offers lower sections

- IDs: `OFF-053` through `OFF-058`
- Convert Recent Activity, reduce cross-tab duplication, restyle Agent SEA/Learn, and move Today’s Priorities.
- Exit gate: Offers is focused on offers/certificates while every moved capability remains reachable.

---

## Phase 5 — Cruises tab

Goal: complete discovery/search while validating the canonical cruise card in a large catalog.

### Package 5.1 — Discovery shell, tabs, search, filters, and sorting

- IDs: `CRU-001` through `CRU-007`
- Exit gate: all discovery controls use shared components and remain responsive during incremental loading.

### Package 5.2 — Favorites and back-to-back discovery

- IDs: `CRU-008` through `CRU-011`
- Exit gate: Favorites stays above the catalog; B2B groups show actual cruise cards and retain operational planning.

### Package 5.3 — Cruise-card data normalization

- IDs: `CRU-012` through `CRU-019`
- Normalize cabin, guests, itinerary days, casino opportunity, financials, offer/certificate evidence, and navigation.
- Exit gate: the same sailing matches its Offers and Booked representations.

### Package 5.4 — Catalog behavior and states

- IDs: `CRU-020` through `CRU-022`
- Finish virtualization, loading-more, end, and empty states.
- Exit gate: users can reach the bottom and return to Favorites without losing position.

### Package 5.5 — Cruise details

- IDs: `CRU-023` through `CRU-026`
- Convert header, sections, receipt/edit flows, and full-screen navigation.
- Exit gate: every entry route opens a correct, complete, visually coherent detail screen.

---

## Phase 6 — Booked tab and calculation truth

Goal: make Booked the definitive personal-voyage experience and data schema reference.

### Package 6.1 — Booked shell, hero, Today, and readiness

- IDs: `BOK-001` through `BOK-004`
- Exit gate: next voyage, Today, and readiness form one coherent opening experience.

### Package 6.2 — Upcoming-voyage weather consolidation

- IDs: `BOK-005` through `BOK-009`
- Work jointly with `WTH-001` through `WTH-009`; do not close weather IDs until Calendar conversion is complete.
- Exit gate: Booked has exactly one responsive weather section with all existing evidence available progressively.

### Package 6.3 — Casino opportunity and reconciliation

- IDs: `BOK-010` through `BOK-013`
- Exit gate: metrics fit, tier progress is correct, and current/prior/attributed points remain distinct.

### Package 6.4 — B2B groups and controls

- IDs: `BOK-014` through `BOK-017`
- Exit gate: actual constituent cards, filters, view controls, and Add Cruise are complete.

### Package 6.5 — Booked cruise cards and loyalty rules

- IDs: `BOK-018` through `BOK-023`
- Correct day calculations, casino values, loyalty rules, manual precedence, and false zeros.
- Exit gate: known reference cruises reconcile to itinerary, Casino, and loyalty expectations.

### Package 6.6 — Booked cruise detail

- IDs: `BOK-024` through `BOK-026`
- Exit gate: reservation/receipt/detail actions have parity and navigation restores state.

---

## Phase 7 — Calendar and Day Agenda

Goal: complete daily and long-range planning and establish the second/last weather location.

### Package 7.1 — Calendar shell and navigation

- IDs: `CAL-001` through `CAL-004`
- Exit gate: Calendar identity, Crew link, and all five modes are coherent and responsive.

### Package 7.2 — Agenda, Week, and Today’s Priorities

- IDs: `CAL-005` through `CAL-008`
- Exit gate: previous/next/Today navigation and priority actions work without duplicate Offers content.

### Package 7.3 — Month, Tarot, 90-Day, and Passenger

- IDs: `CAL-009` through `CAL-012`
- Exit gate: each mode is readable, functional, and shares the design language.

### Package 7.4 — Events and time zones

- IDs: `CAL-013` through `CAL-016`
- Exit gate: events are deduplicated/linked correctly and timezone updates do not cause page-wide churn.

### Package 7.5 — Day Agenda and maps

- IDs: `CAL-017` through `CAL-021`
- Complete the second allowed weather experience, visible map, Maps round-trip, priorities, and operational cards.
- Exit gate: Day Agenda preserves its useful content and matches the reference polish.

### Package 7.6 — Calendar import and Crew Recognition

- IDs: `CAL-022` through `CAL-024`
- Exit gate: empty/import/crew flows use shared states and the supplied crew workbook succeeds or reports exact row errors.

### Package 7.7 — Weather placement closure

- IDs: `WTH-001` through `WTH-009`
- Remove all other visible weather surfaces, finish shared presentation, preserve caching/evidence, and verify refresh.
- Exit gate: source and device inspection prove weather appears once in Booked and once in Day Agenda only.

---

## Phase 8 — Casino tab

Goal: retain the strong analytical content and highlighted charts while making every Casino subsection one product.

### Package 8.1 — Casino shell and navigation

- IDs: `CAS-001` through `CAS-004`
- Exit gate: all five subpages are reachable, responsive, and share the successful Charts visual strengths.

### Package 8.2 — Intelligence, tier, and quick actions

- IDs: `CAS-005` through `CAS-007`
- Exit gate: conclusions lead, Club Royale progress is accurate, and all operational actions remain.

### Package 8.3 — Financial overview and large values

- IDs: `CAS-008`, `CAS-009`
- Exit gate: coin-in/value semantics are correct and every value remains readable.

### Package 8.4 — Cruise economics and annual history

- IDs: `CAS-010` through `CAS-013`
- Exit gate: summary, detailed rows/table, raw 2025 points, totals, and evidence reconcile.

### Package 8.5 — Portfolio, destinations, and points

- IDs: `CAS-014` through `CAS-016`
- Exit gate: canonical cruise rows and accessible chart/list alternatives pass.

### Package 8.6 — Patterns and sessions

- IDs: `CAS-017` through `CAS-019`
- Exit gate: findings are explainable and session CRUD/sorting remains complete.

### Package 8.7 — Ship intelligence

- IDs: `CAS-020`, `CAS-021`
- Exit gate: all four nested tools are themed and verified/unverified evidence is unmistakable.

### Package 8.8 — Calculation Lab and ADT

- IDs: `CAS-022` through `CAS-027`
- Exit gate: calculations, ADT, evidence, modal entry, unknown handling, and exports agree with Agent SEA.

### Package 8.9 — Casino resilience and parity

- IDs: `CAS-028` through `CAS-030`
- Exit gate: failures preserve data, cross-screen values reconcile, and owner isolation passes.

---

## Phase 9 — Slots tab

Goal: finish machine discovery, strategy, maps, and sessions without a page crash or separate visual identity.

### Package 9.1 — Slots shell and tools

- IDs: `SLT-001` through `SLT-003`
- Exit gate: the page loads with a coherent hero and first-tap tools.

### Package 9.2 — Sessions and strategy

- IDs: `SLT-004` through `SLT-006`
- Exit gate: duplicate headers are gone and all session/strategy behavior remains.

### Package 9.3 — Ship explorer, map, and observations

- IDs: `SLT-007` through `SLT-009`
- Exit gate: verified positions/maps and observation evidence work without crashes.

### Package 9.4 — Playing plan

- IDs: `SLT-010`, `SLT-011`
- Exit gate: hours, golden windows, and session tracker agree and retain actions.

### Package 9.5 — Machine Library

- IDs: `SLT-012` through `SLT-016`
- Exit gate: shared filters, virtualized list, canonical cards, details, favorites, and notes pass large-data tests.

### Package 9.6 — Slots resilience and persistence

- IDs: `SLT-017`, `SLT-018`
- Exit gate: cold start, error/retry, restart, backup, and restore pass.

---

## Phase 10 — Settings, data, and trust

Goal: make the common data controls immediately visible and make every data operation explicit, recoverable, and polished.

### Package 10.1 — Settings shell and pinned common areas

- IDs: `SET-001` through `SET-006`
- Exit gate: Profile, Connections, and Data Import & Backup are always visible; uncommon areas remain navigable.

### Package 10.2 — Account, security, and notifications

- IDs: `SET-007` through `SET-009`
- Exit gate: owner, protection, and reminder behavior has parity.

### Package 10.3 — Connections and sync

- IDs: `SET-010` through `SET-015`
- Exit gate: Royal, Celebrity, Carnival, cloud, pricing, and offer import show progress and never erase valid data on partial failure.

### Package 10.4 — Books section

- ID: `SET-016`
- Exit gate: both supplied covers and exact Amazon links work above Data Import.

### Package 10.5 — Imports and review

- IDs: `SET-017` through `SET-020`
- Exit gate: supplied offer, completed-cruise, and crew files show preview/progress and preserve prior records on error.

### Package 10.6 — Exports

- IDs: `SET-021` through `SET-024`
- Exit gate: all exports are visibly clickable, share successfully, and reconcile to stored rows without prerequisite navigation.

### Package 10.7 — Save All, Load All, and recovery

- IDs: `SET-025` through `SET-031`
- Exit gate: encrypted backup, copyable key, key entry, preview, transactional restore, and domain coverage pass end to end.

### Package 10.8 — Calendar feed, integrations, and appearance

- IDs: `SET-032` through `SET-034`
- Exit gate: all actions work and the selected appearance applies to every converted screen.

### Package 10.9 — Data Trust Center

- IDs: `SET-035` through `SET-042`
- Exit gate: counts drill down/export, filters work, repair previews/history are safe, Action Inbox reconciles, and duplicate findings are removed.

### Package 10.10 — Help, legal, admin, danger, footer, startup

- IDs: `SET-043` through `SET-048`
- Exit gate: lower-frequency areas are polished, permissions/destructive actions remain safe, and Settings opens after cold start.

---

## Phase 11 — Agent SEA

Goal: make Agent SEA a responsive native conversation grounded in authoritative app data.

### Package 11.1 — Native chat shell and stability

- IDs: `SEA-001` through `SEA-007`, `SEA-024`
- Exit gate: direct open, first-tap send, keyboard, scrolling, controls, and repeated open/send/close cycles pass.

### Package 11.2 — Conversation persistence and ownership

- IDs: `SEA-008`, `SEA-009`
- Exit gate: history survives restart and the second owner sees only permitted data.

### Package 11.3 — Typed data tools and intent

- IDs: `SEA-010` through `SEA-014`
- Exit gate: date/status/domain intent selects exact authoritative record sets instead of dumping all app data.

### Package 11.4 — ADT and certificate intelligence

- IDs: `SEA-015`, `SEA-016`
- Exit gate: ADT and month/ship/region/points/cabin/guest certificate questions match Casino and Cert Summary.

### Package 11.5 — Evidence, uncertainty, and conversational quality

- IDs: `SEA-017` through `SEA-019`
- Exit gate: answers lead with the result, cite records, expand evidence, and refuse to invent missing facts.

### Package 11.6 — Diagnostics, artifacts, evaluations, and secrets

- IDs: `SEA-020` through `SEA-023`
- Exit gate: diagnostic export, save/print/share, evaluation suite, and secret scan pass.

---

## Phase 12 — Full verification and production release

Goal: prove the app is complete rather than infer completion from code presence.

### Package 12.1 — Visual completion audit

- IDs: `QA-001` through `QA-008`
- Exit gate: every tab/nested screen has evidence; typography, color, filters, progress, cruise cards, and weather placement pass.

### Package 12.2 — Interaction and performance audit

- IDs: `QA-009` through `QA-012`
- Exit gate: every control is first-tap responsive and large certificate/cruise datasets meet navigation/scroll targets.

### Package 12.3 — Data operation audit

- IDs: `QA-013` through `QA-016`
- Exit gate: sync, import, export, backup, recovery, restore, and reconciliation pass with supplied data.

### Package 12.4 — Ownership, persistence, accessibility, and recovery

- IDs: `QA-017` through `QA-020`
- Exit gate: owner isolation, restart persistence, accessibility, offline/failure recovery, and retained valid data pass.

### Package 12.5 — Production gates and package

- IDs: `QA-021` through `QA-025`
- Exit gate: maintained regressions, TypeScript, Expo Doctor, assets/dependencies, real-device iOS, baseline comparison, bundle, manifest, hashes, screenshots, and reproducible ZIP all pass.

---

## Progress reporting format

After each package, report:

- Package and repair IDs attempted.
- IDs completed, still open, or blocked.
- Files changed.
- Behavior preserved and tests added.
- Before/after screenshot links.
- Performance before/after where relevant.
- Tests and production checks run.
- Newly discovered deficiencies, each assigned a new immutable ID before work continues.

## Practical release policy

- Do not wait until Phase 12 to discover regression. Run focused tests after every package.
- Do not bump the App Store build number for intermediate visual packages.
- Maintain a runnable internal candidate at the end of every tab phase.
- If a package breaks behavior, restore the last accepted checkpoint and repair the smallest cause before continuing.
- The production candidate is created only after all 323 IDs, including the 25 final QA IDs, are closed with evidence.
