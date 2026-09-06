# Easy Seas — Video-Driven Adjustment Plan

Date: 2026-09-03  
Active source: `/Users/rcg/Documents/Codex/2026-07-31/i-h/EASYSEAS_ACTIVE_REPAIR_WORKSPACE`

This is the controlling plan for the next UI, interaction, performance, and data-truth pass. It combines the September 3 app recording, the timestamped screen inventory, the unified design-system brief, and the user's direct requirements. It does not remove or simplify existing functionality.

## Functional-protection rule

The current application is approximately 98% functional. Existing behavior is therefore treated as protected production behavior, not as an invitation to redesign the underlying architecture.

- Visual work may change composition, spacing, typography, imagery, component wrappers, and the order in which existing sections are presented.
- Existing data providers, calculations, persistence, imports, exports, sync rules, and navigation targets stay intact unless a defect is first reproduced.
- Every necessary functional correction receives a focused regression test before the implementation changes.
- No capability is removed, merged away, or made less reachable merely to simplify a screen.
- When two materially different information architectures or behaviors are both plausible, implementation pauses at that decision and presents the alternatives to the user.

## Two-phase delivery split

### Phase 1 — Global foundation and voyage lifecycle

Phase 1 covers the first half of the product and establishes the system all later work must reuse:

1. Baseline behavior/data evidence and regression protection.
2. Shared design tokens and reusable visual primitives.
3. Locked global navigation: **Home, Explore, My Voyages, Calendar, Casino, Settings, +**.
4. Home, including all current Offers, loyalty, certificate, Agent SEA, and education capability.
5. Explore, including cruise discovery, search, filters, sorting, results, watched cruises, and back-to-back discovery.
6. My Voyages, including booked/current/completed cruises, weather, readiness, favorite staterooms, voyage details, receipts, and manual totals.
7. Calendar, including month-first presentation, agenda ranges, EventKit, Day Agenda, map, weather, voyage timeline, and Crew Recognition.

Phase 1 exit gate: these four lifecycle destinations and every nested screen reachable from them pass functional, populated-data, accessibility, performance, and iOS visual checks.

### Phase 2 — Casino, administration, commands, and release

Phase 2 completes the second half:

1. Casino shell and its six logical destinations: Overview, Cruises, Play, Analytics, Calculator, Slots.
2. Full consolidation of Slots/Machines under Casino.
3. Settings, including always-visible profiles, connections, Data & Sync, backup/recovery, and Data Trust exports.
4. + Quick Actions, including Load Receipt for a Cruise and Enter Cruise Totals for any saved voyage state.
5. One underlying Agent SEA capability and all contextual entry points.
6. Remaining nested-screen visual sweep and removal of obsolete duplicate UI.
7. Cross-domain data-truth corrections, final performance work, full iOS verification, packaging, and TestFlight readiness.

Phase 2 exit gate: the complete application passes the final release gate with no reachable legacy screen or duplicated authoritative workflow.

## 1. Locked product decisions

- Keep exactly seven visible bottom destinations, in this order: **Home, Explore, My Voyages, Calendar, Casino, Settings, +**.
- Keep **Slots** as the sixth logical local Casino destination after Calculator; it is not a visible bottom tab.
- Keep the first tab backed by the existing Offers/overview route, but label the destination **Home** because the corrected product model is now locked.
- Keep the **+** destination as the seventh tab because the user explicitly requested it. It opens common actions without displacing the current screen context.
- **The corrected navigation model is confirmed and final:** do not create a separate Machines destination and do not remove + Quick Actions.
- Preserve all existing actions, data, calculations, imports, exports, routes, and owner isolation. Relocation is allowed only when the same capability remains clearly reachable.
- Use one Easy Seas visual system across the entire application. Tabs receive different content emphasis, not different brands or incompatible palettes.
- Use one visible title per section. Supporting text must not look like a second section title.
- Weather appears only once on Booked for the upcoming voyage and once on Day Agenda.
- Full loyalty appears first on Offers. Other tabs may show only contextually necessary loyalty data.
- Connections, Data Import & Backup, and profile information remain visible by default in Settings. Security follows those primary sections.
- Crew Recognition remains part of Calendar and stays below the primary calendar and voyage-planning content.

## 2. Canonical visual standard

### Typography

- Source Serif 4 Semibold: page titles, section titles, card titles, major numbers.
- SF Pro/system: navigation, buttons, filters, fields, badges, metadata, dense tables.
- Use tabular numerals for points, prices, dates, nights, countdowns, percentages, ADT, ROI, and casino metrics.
- No decorative, script, condensed, or arbitrary substitute typefaces in functional UI.
- Never shrink titles to force one line; permit clean two-line wrapping.

### Color

- Brand navy `#17324D`: headings, active navigation, primary actions.
- Ocean teal `#167C80`: links, selected controls, progress, positive emphasis.
- Seafoam `#DFF2EF`: soft selected/informational surfaces.
- Sand `#F5F1E8`: restrained warm accent.
- Canvas `#F7F9FA`; surface `#FFFFFF`; border `#D9E1E6`.
- Strong text `#17212B`; muted text `#66737F`.
- Success, warning, danger, and information colors are semantic and localized to badges/icons—not whole unrelated panels.
- Loyalty and casino tier colors appear only in badges, progress segments, and meaningful highlights.

### Layout and components

- 16-point page gutters, 8-point spacing grid, 24–32 points between sections.
- Cards: 16-point padding, 14-point radius, one-pixel border, restrained consistent shadow.
- Minimum 44×44-point touch targets.
- One dominant content column; avoid nested cards when dividers or definition rows are sufficient.
- Every page uses the same primitives: page header, section header, surface card, metric row, status badge, progress bar, filter toolbar/sheet, search field, empty state, alert row, and action row.
- Cruise cards use one canonical field order everywhere: image; ship; itinerary; sailing dates; nights; embarkation port; guests; cabin/category; fare/value; offer; status; action.
- All filters use the same chip, active-count, sheet, Clear all, Apply, keyboard, and accessibility behavior.
- Photorealistic imagery belongs in heroes and selected feature cards; smaller icons and occasional meaningful emoji remain appropriate inside sections.

## 3. Phase 0 — Freeze behavior and establish evidence

- [x] Record and contract-lock the current seven-tab names, order, routes, and hidden Slots destination.
- [ ] Inventory every visible button, filter, sort, disclosure, upload, import, export, and navigation action from the recording.
- [ ] Capture baseline data counts for offers, eligible sailings, booked cruises, completed cruises, certificates, calendar events, crew, casino history, and machines.
- [ ] Run the maintained regression suite, TypeScript, Expo Doctor, and current iOS bundle gate before structural UI work.
- [ ] Add route/action contract tests before moving components between sections.
- [ ] Establish simulator screenshot checkpoints for every tab and critical nested screen at standard and large text sizes.

Exit gate: baseline behavior and counts are documented; no existing action can disappear unnoticed.

## 4. Phase 1 — Finish the shared design system

- [ ] Consolidate the existing theme values in `constants/theme.ts` into the canonical typography, color, spacing, radius, elevation, and control tokens above.
- [ ] Make `EasySeasPrimitives`, `ThemedSectionCard`, the shared filter controls, progress bars, status badges, and navigation the only normal building blocks for tab sections.
- [ ] Build one canonical compact metric strip and remove per-screen metric layouts.
- [ ] Build one canonical cruise card with context modes for discovery, booked, offer-eligible, casino history, and back-to-back use. Context may hide irrelevant fields but may not reorder shared fields.
- [ ] Build one canonical filter toolbar and filter sheet, with controlled state and deterministic Apply/Clear behavior.
- [ ] Build one consistent photorealistic hero component with neutral fallback, cached local image, loading skeleton, and readable overlay contrast.
- [ ] Add a single-title assertion for section shells.
- [ ] Remove page-local font substitutions and arbitrary raw colors as each screen migrates.

Exit gate: a component gallery demonstrates all shared states, including loading, empty, error, selected, disabled, large text, and reduced motion.

## 5. Phase 2 — Bottom navigation and global shell

Primary file: `app/(tabs)/_layout.tsx`

- [x] Preserve the exact visible order: Home, Explore, My Voyages, Calendar, Casino, Settings, +.
- [x] Use consistent 24-point nautical line icons and 11–12-point labels; reserve emoji for meaningful in-content actions and metrics.
- [x] Use navy/teal active state with a restrained top indicator and slate inactive state.
- [x] Keep the Slots route hidden from global navigation and reachable as Casino's sixth logical local destination.
- [ ] Ensure tab presses remain responsive while heavy sections are still hydrating.
- [ ] Preserve state and scroll position when moving between primary tabs.
- [ ] Ensure the + tab opens a compact action menu and returns cleanly to the prior destination.

Exit gate: all seven tabs navigate on first tap, labels remain readable, and no tab is blocked by another screen's data loading.

## 6. Phase 3 — Home and related offer screens

Primary file: `app/(tabs)/(overview)/index.tsx`  
Nested screens include offer details, certificate portfolio/summary/codes/results, Agent SEA, and Learn the System.

Section order:

1. Easy Seas logo and compact account controls.
2. Loyalty profile: Crown & Anchor and Club Royale progress, matching the approved loyalty mockup at a compact scale.
3. What Needs Attention: maximum three actionable priority rows.
4. Your Offer Portfolio: balanced compact metrics and sort priority.
5. Filter Offers: canonical toolbar/sheet.
6. Active Offers: compact, consistent offer cards.
7. Casino & Certificates: wallet-style summary in the former quick-actions location.
8. Agent SEA: contextual prompt panel below operational offer content.
9. Learn the System: compact themed education links.

Repairs:

- [ ] Remove the “Your next voyage starts here” promotional box and let the proper Easy Seas mark use that space.
- [ ] Do not put a generic offers blurb above the logo/profile.
- [ ] Reduce the oversized loyalty/profile presentation while retaining every value and progress explanation.
- [ ] Replace Expiration Command Center with a compact What Needs Attention section; keep all decisions and recommendations reachable.
- [ ] Rebalance portfolio metrics and make expiry/value sorting functional.
- [ ] Standardize offer card field order, imagery, certificate/offer identity, value, points, stateroom, guests, expiration, and eligible-sailing count.
- [ ] Use the canonical cruise card for eligible sailings inside offer details.
- [ ] Paginate or virtualize attached sailings; more than 20 rows must live in a bounded, scrollable, clickable container.
- [ ] Track downloaded certificates and expose summaries by offer, ship class, and individual sailing row.
- [ ] Keep certificate month rollover and next-month availability rules date-driven.
- [ ] Remove “Mode-aware home”; Today's Priorities belongs only on Day Agenda.
- [ ] Apply the same design system to Agent SEA, Ask My Data, certificate screens, and Learn the System.
- [ ] Fix Agent SEA evidence semantics so estimated certificate floors are never stated as exact “recorded” points or “high confidence.”

Exit gate: every Offers control works; eligible cruises open; certificate counts reconcile; no estimate is presented as fact.

## 7. Phase 4 — Explore and cruise discovery

Primary file: `app/(tabs)/scheduling.tsx`  
Shared card: `components/CruiseCard.tsx`

Section order:

1. Photorealistic discovery header with integrated search.
2. Recommended for You.
3. Compact availability summary.
4. Sticky Filters & Sort.
5. All Cruises results.
6. Back-to-Back opportunities.
7. Watched cruises.

Repairs:

- [ ] Use Brand only; derive its loyalty program automatically instead of showing Brand and Program separately.
- [ ] Make search operate across ship, class, itinerary, port, destination, dates, nights, and relevant offer fields.
- [ ] Make Available, All, Back-to-Back, and Booked filters deterministic and mutually understandable.
- [ ] Keep Soonest, Latest, and Value sorts functional after pagination and data refresh.
- [ ] Use one Filters button with active-count badge and an expandable advanced sheet.
- [ ] Ensure every result has a stable unique identity and opens the correct cruise—never “Cruise not found.”
- [ ] Use the canonical cruise card and consistent information order.
- [ ] Keep large catalogs virtualized and bounded.
- [ ] Move Favorite Staterooms out of Cruises and into Booked above consecutive-voyage blocks.
- [ ] Keep Agent SEA contextual and compact; it must compare visible results against real offers/certificates.

Exit gate: each search/filter/sort changes the visible results correctly, survives reopening, and routes to the matching cruise detail.

## 8. Phase 5 — My Voyages and voyage detail

Primary file: `app/(tabs)/booked.tsx`  
Nested screens include `app/cruise-details.tsx`, today-on-cruise, readiness, invoice/document flows, and value reports.

Section order:

1. Next voyage hero.
2. Upcoming-voyage weather—one section, one refresh action.
3. Voyage readiness.
4. Standard filters.
5. Upcoming booked cruises.
6. Favorite Staterooms.
7. Consecutive voyage blocks.
8. Completed voyages/history.

Repairs:

- [ ] Make the next upcoming voyage visually dominant and fully populated.
- [ ] Consolidate five repeated weather lines/actions into one forecast section.
- [ ] Standardize all booked cards on the canonical cruise data order without losing their richer data.
- [ ] Connect back-to-back cruises as real cruise cards in a timeline, with same-port/same-ship/gap information.
- [ ] Replace giant expanding voyage pages with local navigation: Overview, Itinerary, Cabin, Travel, Casino, Value, Notes.
- [ ] Populate itinerary, reservation, cabin/category, deck, guests, nights, C&A points, offer, retail value, paid amount, savings, FreePlay/OBC, and source state wherever the data exists.
- [ ] Show an explicit Missing data state only when no trusted source supplies the field.
- [ ] Provide visible actions to import a Royal invoice PDF locally or enter totals manually.
- [ ] Parse the supplied cruise receipt and show a preview before committing values.
- [ ] Apply single-occupancy and suite loyalty rules correctly: two base points per night for a solo guest; one per occupant in double occupancy; one additional point per night for suites or higher.

Exit gate: every booked cruise opens with trustworthy data, invoice actions are visible and functional, and no Harmony itinerary/value fields are falsely empty.

## 9. Phase 6 — Calendar and Day Agenda

Primary file: `app/(tabs)/events.tsx`  
Nested screens include Day Agenda, passenger calendar, and crew recognition.

Section order:

1. Compact Calendar header and canonical range selector.
2. Monthly calendar grid immediately at the top.
3. Compact legend.
4. Upcoming agenda.
5. Voyage timeline.
6. Crew recognition below the calendar/timeline, as explicitly requested.
7. Time zones only when contextually relevant.

Repairs:

- [ ] Replace page-specific filters with the shared filter component.
- [ ] Keep Agenda, Week, Month, 90 Days, and Passenger modes readable and functional.
- [ ] Integrate EventKit permission and on-device calendar selection so personal events can appear alongside Easy Seas events without uploading private calendar data.
- [ ] Preserve source/type differentiation for cruise, flight, hotel/travel, personal, deadline, and offer-expiry events.
- [ ] Make open voyage windows actionable for cruise discovery.
- [ ] Keep Today's Priorities on Day Agenda.
- [ ] Show weather once on Day Agenda with one refresh action.
- [ ] Render an actual visible map with a truthful fallback when map tiles/location are unavailable.
- [ ] Refresh date, map, and weather correctly when moving to previous/next day.

Exit gate: calendar navigation, filters, EventKit overlay, map, day changes, and event routing work on an iOS simulator and device-permission states are handled gracefully.

## 10. Phase 7 — Casino workspace, including Slots

Primary file: `app/(tabs)/analytics.tsx`  
Slots source: `app/(tabs)/machines.tsx`

Keep six logical local destinations in the requested order: **Overview, Cruises, Play, Analytics, Calculator, Slots**.

- [ ] Replace the second application-style header with the standard Easy Seas page shell.
- [ ] Make the Casino status/progress card compact, tier-colored, and historically explanatory.
- [ ] Use one Season Snapshot metric system for points, coin-in, cash result, cruise days, play time, ADT, and evidence coverage.
- [ ] Clearly distinguish actual, reconciled, estimated, and missing values in every metric and chart.
- [ ] Move detailed formulas behind consistent evidence disclosures without hiding them.
- [ ] Standardize all charts to the same axes, typography, legend, interaction, and semantic palette.
- [ ] Build cruise-contribution rows with points, coin-in, cash result, certificate, and evidence state.
- [ ] Make tier/certificate strategy compare incremental gambling cost with incremental reward.
- [ ] Keep calculators focused and input-driven rather than surrounded by duplicate dashboard metrics.
- [ ] Render Slots as the sixth local Casino destination with machine search, favorites, ship locations, sessions, notes, conditions, and preferences intact.
- [ ] Use machine photography where available and one consistent machine-card layout.
- [ ] Ensure all casino totals reconcile to their underlying cruise records and never convert certificate thresholds into exact earned points.

Exit gate: every local Casino destination works; all charts and calculations disclose their sources; totals reconcile; Slots retains full functionality.

## 11. Phase 8 — Settings and data administration

Primary file: `app/(tabs)/settings.tsx`

Section order:

1. Compact Settings header and search.
2. Nine equally spaced shortcut buttons/actions.
3. Compact Data Overview at roughly half its current height.
4. Account & Travelers/profile information—open by default.
5. Cruise Accounts and Connections—open by default.
6. Data Import & Backup—open by default.
7. Security.
8. Notifications, Integrations, Appearance, Help, About & Legal.
9. Advanced.
10. Danger Zone last.

Repairs:

- [ ] Balance the Data Overview grid and remove oversized empty space.
- [ ] Use the shared nine-button action grid plus search, with consistent icons and hit targets.
- [ ] Reduce profile and loyalty footprint while retaining all data.
- [ ] Consolidate sync/import/export/backup/restore status and actions.
- [ ] Make Data Trust warning/error counts clickable and export filtered downloadable issue lists.
- [ ] When Load All is selected, visibly offer Load Encrypted Backup.
- [ ] Make recovery keys selectable/copyable, provide a clear paste/enter flow, and restore data only after validation and preview.
- [ ] Keep destructive operations isolated in Danger Zone with explicit confirmation.
- [ ] Split legal content into readable linked screens instead of a long wall.

Exit gate: every import/export/backup/restore path gives truthful progress and completion state; Settings no longer crashes; primary tasks are visible without drilling through secondary categories.

## 12. Phase 9 — Plus/common-action destination

Primary file: `app/(tabs)/quick-actions.tsx`

- [ ] Present a compact action menu rather than a promotional page.
- [ ] Include Browse Cruises, Add/Import Booking, **Load Receipt for a Cruise**, **Enter Cruise Totals**, Import/Restore Data, Add Calendar Event, Add/Recognize Crew, Record Casino Session, Add Machine, Scan Certificate, and Ask Agent SEA.
- [ ] Make both cruise-financial commands support any saved voyage state: upcoming/booked, currently sailing, or completed.
- [ ] Make **Load Receipt** open the saved-voyage selector when necessary, then the local PDF/file ingestion workflow for that selected voyage.
- [ ] Make **Enter Cruise Totals** open the saved-voyage selector when necessary, then the manual retail value, amount paid, taxes/fees, onboard credit, FreePlay, and related voyage-value entry workflow.
- [ ] If a saved voyage is already active, carry that voyage identity and status into either action instead of asking the user to select it again.
- [ ] Group the voyage selector into Upcoming, Current, and Completed sections and include ship, dates, reservation number, and cabin so similarly named sailings cannot be confused.
- [ ] Preview parsed or manually entered values before saving and identify which booked cruise will be updated.
- [ ] Route each action to the canonical owner screen rather than duplicating its implementation.
- [ ] Preserve the user's prior tab and return location after completing or canceling an action.
- [ ] Use a single title and short labels; remove explanatory walls.

Exit gate: every action opens the correct task on the first tap and returns without navigation duplication.

## 13. Phase 10 — Nested-screen visual sweep

- [ ] Enumerate every reachable nested route from all seven tabs.
- [ ] Apply the same page shell, typography, cards, filters, status badges, button hierarchy, loading states, and backgrounds.
- [ ] Remove stark-white unstructured pages, duplicate section titles, legacy purple/green/brown themes, and inconsistent floating actions.
- [ ] Ensure modal, sheet, detail, import, certificate, machine, casino, calendar, and report screens follow the same design tokens.
- [ ] Confirm that nested screens preserve back navigation and never strand the user.

Exit gate: no reachable production screen remains outside the design system.

## 14. Phase 11 — Data truth and Ask My Data

- [ ] Attach field-level provenance and confidence to cruise, offer, certificate, casino, loyalty, weather, crew, and financial values.
- [ ] Treat certificate point levels as minimum thresholds unless an actual closeout records exact earned points.
- [ ] Correct the Star of the Seas July 5 answer: exact Club Royale points are currently pending, not a verified 800.
- [ ] Answer casino, points, certificates, offers, eligible cruises, completed cruises, crew, weather, ROI, ADT, and loyalty questions through domain-specific resolvers.
- [ ] Separate search-match confidence from evidence confidence.
- [ ] Cite the exact saved records used and state exclusions or missing evidence plainly.
- [ ] Apply brand-specific authoritative-sync replacement: a current Royal sync replaces Royal upcoming bookings only; Celebrity replaces Celebrity only; Carnival replaces Carnival only.
- [ ] Remove previously booked cruises for that brand when the authoritative current sync no longer returns them, while preserving completed history and other brands.

Exit gate: a fixed question suite returns numerically correct, source-backed answers and never labels inferred values as recorded facts.

## 15. Phase 12 — Performance and perceived speed

- [ ] Profile tab-switch, certificate-opening, cruise-detail, and filter-apply latency with populated production-sized data.
- [ ] Keep route render paths free of synchronous full-dataset parsing.
- [ ] Pre-index certificates, offers, cruises, and Ask My Data documents after import/sync rather than on screen entry.
- [ ] Virtualize long cruise/certificate/machine/history lists with stable identities and bounded pages.
- [ ] Defer charts, relationship maps, and evidence panels until visible.
- [ ] Cache photorealistic assets locally and render neutral fallbacks immediately.
- [ ] Cancel stale weather/search requests and prevent mutually exclusive request parameters.
- [ ] Keep loading nonblocking and display purposeful skeleton/progress states.

Performance targets on the populated test fixture:

- Tab feedback begins within 100 ms.
- Previously visited tab becomes interactive within 300 ms.
- Cold heavy tab becomes interactive within 800 ms, with meaningful skeleton earlier.
- Filter/sort feedback begins within 100 ms and the first result batch updates within 500 ms.
- Certificate summary opens without a minute-long blank or frozen screen.

## 16. Phase 13 — Verification and release gates

After each tab phase:

- [ ] Run TypeScript and the maintained regression suite.
- [ ] Run tab-specific interaction tests for every button, filter, sort, disclosure, and route.
- [ ] Compare data counts and representative records against the Phase 0 baseline.
- [ ] Capture standard and large-text simulator screenshots of the tab and all changed nested screens.
- [ ] Inspect screenshots for font, color, spacing, hierarchy, single-title, overflow, contrast, and image quality.
- [ ] Verify VoiceOver labels/order, 44-point targets, Dynamic Type, high contrast, reduced motion, and keyboard handling.
- [ ] Verify owner isolation and persistence after restart.

Final release gate:

- [ ] Fresh iOS install and populated-backup restore.
- [ ] Royal sync plus brand-precedence reconciliation.
- [ ] Offer/certificate download and analysis.
- [ ] Cruise discovery search/filter/sort/detail.
- [ ] Booked voyage, invoice import/manual entry, weather, readiness, and value.
- [ ] Calendar/EventKit/Day Agenda/map.
- [ ] Casino/Slots calculations and histories.
- [ ] Settings imports/exports/encrypted backup/recovery/Data Trust export.
- [ ] Ask My Data truth suite.
- [ ] Expo Doctor, production iOS bundle, native build, and TestFlight smoke test.

No tab is marked complete from code inspection alone. Completion requires behavior tests, populated-data verification, and visual inspection on iOS.

## 17. Execution order

Work strictly in this order:

1. Phase 0 baseline.
2. Shared design system.
3. Navigation shell.
4. Offers plus its nested screens.
5. Cruises plus cruise details.
6. Booked plus voyage details and invoice flow.
7. Calendar plus Day Agenda/EventKit/map.
8. Casino plus embedded Slots.
9. Settings/data administration.
10. Plus/common actions.
11. Remaining nested-screen sweep.
12. Ask My Data and cross-domain truth verification.
13. Performance pass.
14. Full iOS release gate.

Within each phase: inventory behavior, add regression coverage, migrate the UI, verify populated data, inspect screenshots, and only then move forward.
