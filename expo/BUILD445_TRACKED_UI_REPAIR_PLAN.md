# Easy Seas Build 445 — Tracked UI and Functional Repair Plan

This document is the authoritative, uniquely numbered repair backlog for bringing every visible part of Easy Seas to one polished, production-ready nautical design system without removing, simplifying, or changing existing functionality.

## Completion rules

1. A checkbox may be marked complete only after the exact screen is visually inspected at an iPhone viewport and its related actions are exercised.
2. A shared component passing a static test does not complete every consuming screen. Each listed screen must pass independently.
3. Existing actions, calculations, imports, exports, filters, drill-downs, evidence, owner isolation, and persistence must remain available.
4. Unknown data must remain unknown. A missing value must never be converted to zero or fabricated for visual completeness.
5. Every change must pass light, dark, high-contrast, Dynamic Type, reduced-motion, and VoiceOver checks appropriate to that component.
6. Weather is user-visible in exactly two places: Day Agenda and the upcoming-voyage section of Booked, once in each.
7. Cruise cards use one canonical field order everywhere. Context may change emphasis, but not the position or meaning of shared fields.
8. The Easy Seas logo and Scott Astin signature remain unchanged.
9. Each section has exactly one visible section title. Artwork bands, nested cards, and inner content must not repeat the same title or introduce a second competing heading.

## Execution sequence

- Wave A — Capture the working baseline and behavior contracts.
- Wave B — Build and validate the shared design primitives.
- Wave C — Convert one tab at a time: Offers, Cruises, Booked, Calendar, Casino, Slots, Settings.
- Wave D — Convert shared nested workflows, especially Agent SEA, certificates, cruise details, trust, and backup.
- Wave E — Run full visual, functional, persistence, performance, accessibility, and iOS production checks.

Only one repair item should be in progress at a time within a consuming screen. Shared primitives may be completed first, but they do not close the consuming-screen items automatically.

---

## A. Baseline, inventory, and design-system foundation

- [x] **BASE-001 — Lock the functional baseline.** Preserve a read-only copy of the latest known-working source, version identifiers, test results, representative data backup, and build artifact before visual work begins. Done when the baseline can be restored without relying on the active workspace.
- [x] **BASE-002 — Create a route/action inventory.** Record every visible button, link, filter, modal, export, import, sync, and drill-down by route and test ID. Done when every control in all seven tabs has a behavioral contract.
- [x] **BASE-003 — Capture before screenshots.** Capture the seven tabs and all critical nested screens on the same iPhone viewport. Done when every repair item can be compared against a dated before image. Evidence: the user-provided September 1 recordings at 15:06 and 19:26 plus the dated 06:36 and 06:47 reference captures remain available outside the candidate; after captures are indexed in `BUILD445_VISUAL_EVIDENCE/2026-09-01`.
- [x] **BASE-004 — Establish representative test data.** Load offers, certificate rows, booked/completed cruises, casino history, crew, weather cache, machines, and two owner profiles. Done when empty, small, and large-data states can all be reproduced. Evidence: `BUILD445_REPRESENTATIVE_DATA.md`; the supplied 391-row offers fixture, 776-row crew workbook, 33 completed cruises, and two large backups pass the real-file acceptance tests.
- [x] **BASE-005 — Establish performance baselines.** Measure cold start, tab switching, offer opening, certificate examination, cruise detail opening, Settings opening, and Agent SEA opening. Done when the current median and worst-case timings are recorded. Evidence: `BUILD445_PERFORMANCE_BASELINE.md`; high-volume computation and hydration/query spans are recorded, with physical-device transition timings explicitly reserved for QA-023.

- [x] **SYS-001 — Define typography tokens.** Create named roles for display title, page title, section title, card title, metric, label, body, caption, button, and evidence. Done when no new screen chooses arbitrary font family, size, weight, or line height.
- [x] **SYS-002 — Load and validate the approved fonts.** Use the approved Source Serif family for editorial headings and one consistent sans-serif family for controls and body text. Done when fallback behavior is stable on iOS and font loading cannot block navigation.
- [x] **SYS-003 — Define the core nautical palette.** Establish navy, deep blue, teal, ocean blue, sky, ivory, white, ink, muted text, border, success, warning, and error tokens. Done when ordinary UI no longer uses arbitrary literal colors.
- [x] **SYS-004 — Define tier color semantics.** Map Crown & Anchor, Club Royale, Club Points, and Blue Chip tiers to the supplied colors. Done when tier colors appear only for the correct program and tier.
- [x] **SYS-005 — Define page background treatments.** Create tasteful light, dark, and high-contrast nautical backgrounds using ivory, sky, ocean, and restrained gradients. Done when no primary screen is a stark white canvas.
- [x] **SYS-006 — Define card variants.** Create hero, section, metric, cruise, offer, warning, success, evidence, action, and compact-row variants. Done when radius, border, shadow, padding, and elevation are token-driven.
- [x] **SYS-007 — Define spacing and grid tokens.** Standardize horizontal page gutters, section gaps, card padding, icon spacing, and responsive columns. Done when adjacent sections align to the same visual grid.
- [x] **SYS-008 — Define icon and emoji rules.** Specify icon sizes, stroke weights, containers, semantic colors, and when emoji is appropriate. Done when icons are meaningful and visually consistent rather than decorative noise.
- [x] **SYS-009 — Define button hierarchy.** Standardize primary, secondary, tertiary, destructive, icon-only, and text-link actions. Done when action importance is recognizable on every screen.
- [x] **SYS-010 — Define loading and operation states.** Standardize skeleton, spinner, determinate progress, success, partial success, error, retry, undo, and dismissal. Done when long operations explain what is happening and never resemble a frozen app.
- [x] **SYS-011 — Define empty and missing-data states.** Separate empty collection, filtered-empty, loading, unavailable provider data, unknown field, and genuine zero. Done when no unknown value is presented as zero.
- [x] **SYS-012 — Define provenance disclosure.** Create one expandable source/evidence row with source, owner, timestamp, confidence, record, formula, and notes. Done when raw internal field names are not exposed in normal summaries.
- [x] **SYS-013 — Define reduced-motion behavior.** Centralize animation duration and disable nonessential motion when requested. Done when motion never blocks input or navigation.
- [x] **SYS-014 — Define accessibility behavior.** Centralize minimum targets, focus order, labels, hints, contrast, Dynamic Type, and density. Done when shared controls pass accessibility tests.
- [x] **SYS-015 — Define responsive modal and sheet behavior.** Standardize full-screen pages, bottom sheets, drawers, and popovers. Done when no overlay is clipped, half-width, under the Dynamic Island, or behind bottom navigation.

- [x] **SHR-001 — Build the canonical page shell.** Provide the nautical background, safe areas, responsive gutter, scroll behavior, title placement, and optional hero slot. Done when each tab feels related without losing its specific purpose.
- [x] **SHR-002 — Build the canonical section header.** Standardize eyebrow, title, subtitle, meaningful icon, optional count, optional action, and collapse behavior. Done when every section uses the same hierarchy and has exactly one visible section title.
- [x] **SHR-003 — Build the canonical filter launcher.** Standardize Filter, active-count badge, result count, selected summary, and Clear All. Done when every tab launches the same filter experience.
- [x] **SHR-004 — Build the canonical filter sheet.** Standardize sheet header, grouped choices, chips, inputs, reset, apply, keyboard avoidance, and selected states. Done when only the domain-specific choices differ.
- [x] **SHR-005 — Build the canonical segmented control.** Standardize tabs and sort controls with consistent height, radius, spacing, and selected state. Done when tab controls no longer wrap or look unrelated.
- [x] **SHR-006 — Build the canonical progress component.** Standardize label, current value, target, remaining value, milestone markers, tier-aware color, animation, and evidence. Done when all progress bars share structure and semantics.
- [x] **SHR-007 — Build the canonical metric strip.** Standardize icon, value, label, separators, wrapping, and compact behavior. Done when large values never split into unreadable fragments.
- [x] **SHR-008 — Build the canonical cruise card.** Fix the field order: identity; itinerary; dates/nights/port/guests; cabin; operational days; casino opportunity; financials; offer/certificate; status; expandable evidence. Done when every cruise context uses this skeleton.
- [x] **SHR-009 — Build canonical cruise-card density modes.** Provide full, compact, and comparison modes without moving shared fields to different locations. Done when context changes density, not the information architecture.
- [x] **SHR-010 — Build the canonical offer card.** Standardize artwork, offer identity, code, points, guest/cabin entitlement, expiration, value, sailing count, status, and actions. Done when all offer lists use it.
- [x] **SHR-011 — Build the canonical event card.** Standardize event type, date/time, related entity, urgency, location, and action. Done when Calendar event types remain distinguishable inside one visual system.
- [x] **SHR-012 — Build the canonical evidence panel.** Put formulas, sources, missing inputs, confidence, and raw details behind progressive disclosure. Done when summaries stay readable without losing auditability.
- [x] **SHR-013 — Build the canonical virtualized list shell.** Standardize paging, loading-more, end state, result count, scroll restoration, and errors. Done when large lists never mount hundreds of rows at once.
- [x] **SHR-014 — Normalize bottom navigation.** Keep the seven existing names, order, and routes while standardizing icon size, label font, active indicator, background, and safe area. Done when all seven items remain legible on supported iPhones.
- [x] **SHR-015 — Create screenshot regression fixtures.** Capture shared primitives in light, dark, high contrast, large text, empty, loading, error, and populated states. Done when unintended visual drift can fail automated review. Evidence: `BUILD445_VISUAL_EVIDENCE/2026-09-01/README.md` and its dated captures; maintained visual contract tests fail on structural drift.

---

## B. Offers tab and certificate workflows

### Offers page identity

- [x] **OFF-001 — Rebuild the Offers page shell.** Apply the canonical page shell with an Offers-specific navy/gold/certificate identity. Done when the screen is nautical, refined, and not a stack of white bordered containers.
- [x] **OFF-002 — Correct Offers branding placement.** Place the unchanged Easy Seas logo at the top without the oversized empty logo box. Done when branding is visible, proportionate, and does not displace useful content.
- [x] **OFF-003 — Normalize Offers header controls.** Align owner, notification, sync, and settings controls to the shared header hierarchy. Done when they remain accessible without resembling a second Settings screen.

### Loyalty and progress

- [x] **OFF-004 — Rebuild Crown & Anchor summary.** Present program, tier, current points, historical points, nights, and next milestone in one premium loyalty card. Done when the hierarchy matches the reference quality.
- [x] **OFF-005 — Normalize the owner identity treatment.** Replace oversized all-caps identity text with the standard profile treatment. Done when the name does not compete with the page title.
- [x] **OFF-006 — Separate loyalty programs visually.** Keep Crown & Anchor, Club Royale, Celebrity, Silversea, and Carnival states distinct without mixing their tier colors. Done when program switching is obvious and accurate.
- [x] **OFF-007 — Standardize Crown & Anchor progress.** Use the canonical progress component and correct Crown & Anchor tier color. Done when current, target, and retained status are legible without nested progress boxes.
- [x] **OFF-008 — Standardize Club Royale progress.** Use the same progress structure with Club Royale tier colors and season-reset explanation. Done when it cannot be confused with C&A progress.
- [x] **OFF-009 — Preserve loyalty actions.** Retain profile switching, notifications, logout, manual edits, and sync actions. Done when the redesigned card has behavioral parity.

### Offer overview and expiration

- [x] **OFF-010 — Build the offer metric strip.** Present estimated value, active offers, expiring soon, and eligible sailings with consistent icons and definitions. Done when each count explains its unit.
- [x] **OFF-011 — Normalize offer sorting.** Convert Soonest Expiring and Highest Value to the canonical segmented control. Done when state is accessible and sorting remains stable.
- [x] **OFF-012 — Rebuild the Expiration Command Center container.** Replace the oversized purple dashboard with a restrained navy/teal/gold section card. Done when urgency remains visible without dominating the page.
- [x] **OFF-013 — Rebuild expiration buckets.** Standardize urgent, 0–7, 8–14, and 15–30-day counts. Done when count, period, and selected state are immediately clear.
- [x] **OFF-014 — Rebuild expiring-offer rows.** Use compact canonical offer rows with name, code, expiry, days remaining, strength, value, and sailing count. Done when rows are scannable.
- [x] **OFF-015 — Consolidate expiration actions.** Keep View and Decode primary; move Compare, Archive, Skip, and Ask into a consistent secondary-action menu. Done when no action is lost and the row is not button-heavy.
- [x] **OFF-016 — Verify expiration actions.** Confirm each action targets the selected offer and opens on the first press. Done when automated and manual navigation tests pass.

### Offers filters and cards

- [x] **OFF-017 — Rebuild the owner filter strip.** Use the canonical filter treatment for Household, Me, Companion, and Unassigned. Done when choices do not clip and selected state is clear.
- [x] **OFF-018 — Add the Offers filter sheet.** Preserve all available offer, expiry, cabin, guest, value, source, and owner filters in the shared sheet. Done when Clear All and result count work.
- [x] **OFF-019 — Rebuild Active Offers section header.** Apply the canonical header with count and concise guidance. Done when it no longer uses a mismatched gold rail and oversized serif block.
- [x] **OFF-020 — Convert active offers to canonical offer cards.** Preserve every offer field and action. Done when all cards share field placement and interaction.
- [x] **OFF-021 — Add appropriate offer artwork.** Use cached photorealistic ship/destination/cabin imagery with a neutral fallback. Done when artwork is relevant and nonblocking.
- [x] **OFF-022 — Normalize missing cabin data.** Show “Cabin entitlement not supplied” as a quiet data-quality message, not the dominant metric. Done when missing data is truthful but visually subordinate.
- [x] **OFF-023 — Normalize offer value presentation.** Present face value, usable estimate, range, taxes, and savings consistently. Done when no raw formula key is visible.
- [x] **OFF-024 — Verify offer-card navigation.** Make the whole card open its exact offer while retaining direct actions. Done when duplicate names or codes cannot open the wrong record.

### Offer detail and eligible sailings

- [x] **OFF-025 — Convert offer detail to a proper full-screen detail.** Replace the oversized utility sheet and correct safe-area/close behavior. Done when it opens and closes immediately without partial rendering.
- [x] **OFF-026 — Reorder offer-detail information.** Show identity/artwork, core entitlement, expiry/value, recommendation, sailing list, and evidence in that order. Done when conclusions precede formulas.
- [x] **OFF-027 — Consolidate duplicate offer metrics.** Remove repeated points, guests, cabin, value, and intelligence blocks while retaining one authoritative display. Done when every fact has one primary location.
- [x] **OFF-028 — Restyle True Offer Value.** Preserve the calculator and missing-input behavior inside the shared evidence system. Done when raw implementation keys are hidden.
- [x] **OFF-029 — Restyle Offer Intelligence.** Preserve score, strength, source, reasoning, and confidence. Done when recommendation evidence remains accessible.
- [x] **OFF-030 — Restyle “Should I Book?”** Present conclusion, conflicts, confidence, alternatives, and action in one decision card. Done when the result is explainable and actionable.
- [x] **OFF-031 — Convert eligible sailings to the canonical cruise card.** Preserve offer-row-specific cabin, guest, GTY, benefit, and price fields. Done when these cards match Cruises and Booked structurally.
- [x] **OFF-032 — Bound eligible-sailing rendering.** Show at most 20 cards per page/container using virtualization or paging. Done when 1,000 rows never render simultaneously.
- [x] **OFF-033 — Normalize sailing search and filters.** Use the shared search, filter sheet, active filters, and result count. Done when ship, itinerary, date, port, cabin, guest, and value filters work.
- [x] **OFF-034 — Normalize sailing sorting and pagination.** Use shared controls for value, price, length, and date plus fixed Previous/Next feedback. Done when the page position is retained.
- [x] **OFF-035 — Consolidate casino modeling badges.** Present sea days, port days, casino-open hours, modeled play, modeled points, and points/hour once in predictable positions. Done when overlapping terms are removed.
- [x] **OFF-036 — Preserve physical-voyage and eligibility-row identity.** Group duplicate ship/date sailings while retaining cabin/guest/benefit variants. Done when counts reconcile to both physical sailings and offer rows.
- [x] **OFF-037 — Fix sailing-to-detail identity.** Ensure every row opens the correct cruise instead of “Cruise not found.” Done when canonical identity tests pass across imported and synced rows.

### Certificates

- [x] **OFF-038 — Rebuild Casino & Certificates section.** Apply the same section/card system as the rest of Offers. Done when it no longer appears to come from a separate product.
- [x] **OFF-039 — Clarify certificate inventory status.** Show month, family, documents, codes, option rows, physical sailings, last download, and persistence state. Done when users understand what is stored.
- [x] **OFF-040 — Normalize certificate actions.** Preserve View Offers, Certificate Codes, Examine Certificates, Download All, Cert Summary, and Export with clear hierarchy. Done when all are first-tap responsive.
- [x] **OFF-041 — Add certificate operation progress.** Show stage, code/document progress, parsed rows, failures, completion, retry, and preserved data. Done when downloading/exporting never resembles a freeze.
- [x] **OFF-042 — Enforce monthly A/C lifecycle.** Automatically promote future month to current and expose next month only in the configured final-days window. Done when boundary-date tests pass.
- [x] **OFF-043 — Persist downloaded certificates.** Retain valid current/next-month documents and rows across restart, update, backup, and owner changes until proper rollover. Done when navigation is not required to hydrate them.
- [x] **OFF-044 — Rebuild Certificate Codes summary.** Present per-code points, guest totals, option totals, weekend, Florida, shortest, longest, and physical sailings. Done when every metric has a consistent card and definition.
- [x] **OFF-045 — Make every certificate metric drillable.** Open the exact contributing rows from code, guest, ship-class, cabin, benefit, and total metrics. Done when exported and on-screen counts reconcile.
- [x] **OFF-046 — Rebuild Cert Summary tabs.** Normalize Summary, Ship Class, Cabin, Guests, Sailings, and Benefits using the shared segmented control. Done when the matrix remains readable on iPhone.
- [x] **OFF-047 — Rebuild Cert Summary filters.** Use the canonical filter sheet for ship, class, cabin, guests, dates, points, and benefits. Done when selected filters and Clear All remain visible.
- [x] **OFF-048 — Virtualize Cert Summary results.** Preserve search, fourteen sort modes, PDF, cruise detail, and Agent SEA actions. Done when thousands of rows remain responsive.
- [x] **OFF-049 — Rebuild Examine Certificates.** Apply the shared shell, filters, status, result cards, and empty states. Done when it visually matches Offers and opens cached data immediately.
- [x] **OFF-050 — Remove certificate-open blocking work.** Move indexing, grouping, and full-inventory derivation out of the first visible navigation frame. Done when cached shell/content appears within the target threshold.
- [x] **OFF-051 — Preserve certificate data on failure.** A failed refresh or parse must leave the previous valid inventory visible with an error notice. Done when failure-injection tests pass.
- [x] **OFF-052 — Restyle certificate PDFs and provenance.** Keep official document access and evidence behind expandable rows. Done when normal users do not see parser internals.

### Lower Offers sections

- [x] **OFF-053 — Restyle Recent Activity.** Use concise canonical cruise rows and distinguish actual zero from missing casino data. Done when the section remains useful but secondary.
- [x] **OFF-054 — Reduce cross-tab casino duplication.** Keep a themed link to full Casino history instead of reproducing the entire history inside Offers. Done when functionality is retained through navigation.
- [x] **OFF-055 — Reduce cross-tab machine duplication.** Keep a themed link to Slots while machine tools remain owned by Slots. Done when Offers stays focused on offers/certificates.
- [x] **OFF-056 — Restyle the Agent SEA launcher.** Place it after core offer/certificate content and before education. Done when it is prominent, themed, and opens chat directly.
- [x] **OFF-057 — Restyle Learn the System.** Apply the shared card system and clear topic categories. Done when it is visibly lower priority than active offers.
- [x] **OFF-058 — Remove Today’s Priorities from Offers.** Preserve the feature by placing it on Day Agenda. Done when no duplicate or dead route remains.

---

## C. Cruises tab

- [x] **CRU-001 — Rebuild Cruises page shell.** Apply a discovery-specific ocean/sky treatment inside the shared page shell. Done when it is visually distinct from Offers but unmistakably Easy Seas.
- [x] **CRU-002 — Build the discovery header.** Present purpose, authoritative catalog count, and freshness compactly. Done when metadata does not crowd the search controls.
- [x] **CRU-003 — Normalize Cruises primary tabs.** Convert All, Booked, and Back-to-Back/For You to the shared segmented control. Done when labels fit supported iPhones.
- [x] **CRU-004 — Rebuild primary search.** Use the shared search field with clear action, keyboard behavior, and result feedback. Done when search remains responsive during catalog loading.
- [x] **CRU-005 — Rebuild filter launcher and sheet.** Preserve ship, class, cabin, guests, port, region, dates, nights, source, and schedule filters. Done when all choices use shared styling.
- [x] **CRU-006 — Rebuild active-filter summary.** Show selected filters, removable chips, Clear All, and current result count. Done when long filter sets remain readable.
- [x] **CRU-007 — Normalize Soonest/Latest/Value sorting.** Use the shared segmented control and explain value semantics. Done when the selected state is accessible.
- [x] **CRU-008 — Rebuild Favorites section.** Keep favorite cruises, ships, and stateroom preferences above the catalog. Done when it is always reachable.
- [x] **CRU-009 — Add Favorites empty and undo behavior.** Provide meaningful setup guidance and immediate favorite/unfavorite feedback. Done when accidental removal can be undone.
- [x] **CRU-010 — Rebuild Back-to-Back cards.** Display the actual constituent cruise cards, gaps, handoff ports, nights, cost/value, and conflicts. Done when abstract invented blocks are eliminated.
- [x] **CRU-011 — Preserve operational trip planning.** Retain all offer codes and Build Operational Trip Plan. Done when grouped cards still launch the existing workflow.
- [x] **CRU-012 — Convert catalog rows to canonical cruise cards.** Preserve all existing data while enforcing common field positions. Done when cabin and guest fields never move between cards.
- [x] **CRU-013 — Normalize cabin entitlement.** Display Interior, Ocean View, Balcony, Suite, GTY, and multiple entitlement choices in the canonical cabin location. Done when terminology is consistent.
- [x] **CRU-014 — Normalize guest entitlement.** Display one/two/unknown guests in the canonical metadata row. Done when row-specific certificate eligibility remains accurate.
- [x] **CRU-015 — Normalize itinerary operations.** Display nights, embarkation, sea days, port days, overnight ports, and casino-open days/hours in fixed positions. Done when calculated values reconcile with itinerary days.
- [x] **CRU-016 — Normalize casino opportunity.** Present score, golden hours, modeled play, modeled points, and points/hour once. Done when redundant badges are removed.
- [x] **CRU-017 — Normalize financial information.** Present offer price, retail value, taxes/fees, stateroom values, and savings in the canonical financial region. Done when actual versus estimated is explicit.
- [x] **CRU-018 — Normalize offer/certificate evidence.** Present offer code, points level, certificate family, and source in the canonical evidence region. Done when details remain drillable.
- [x] **CRU-019 — Fix cruise identity navigation.** Resolve imported, synced, offer, and booked rows through one canonical identity. Done when every card opens its exact physical sailing.
- [x] **CRU-020 — Virtualize the cruise catalog.** Load bounded pages or batches and preserve scroll position. Done when the user can reach the end and sections below it.
- [x] **CRU-021 — Normalize loading-more state.** Use the shared list footer for progress, remaining count, retry, and end of catalog. Done when loading does not jump the list.
- [x] **CRU-022 — Normalize empty states.** Separate no source data, no filter matches, no B2B matches, and loading. Done when recovery actions are relevant.
- [x] **CRU-023 — Rebuild cruise detail header.** Replace the purple legacy header with voyage artwork, identity, dates, status, and back action. Done when it matches the canonical detail pattern.
- [x] **CRU-024 — Rebuild cruise detail sections.** Group itinerary, cabin, guests, financials, offer, casino, notes, and evidence into themed cards. Done when rows of dashes are replaced by intentional missing-data states.
- [x] **CRU-025 — Preserve receipt and manual editing.** Keep upload, edit, precedence, and data-quality behavior. Done when the redesign has feature parity.
- [x] **CRU-026 — Fix cruise detail presentation.** Prevent half-width drawers, clipped content, hidden close controls, and bottom-tab overlap. Done when all entry routes render full-screen correctly.

---

## D. Booked tab

- [x] **BOK-001 — Rebuild Booked page shell.** Apply a personal-voyage identity using deep blue, emerald, itinerary/status accents, and voyage imagery. Done when it feels distinct from discovery.
- [x] **BOK-002 — Build the next-voyage hero.** Show ship, itinerary, dates, countdown, cabin, guests, and readiness with relevant artwork. Done when it matches the reference quality.
- [x] **BOK-003 — Rebuild Today on My Cruise launcher.** Use a compact themed action card routing to Day Agenda. Done when it no longer owns a duplicate weather experience.
- [x] **BOK-004 — Rebuild Voyage Readiness.** Present check-in, documents, payment, transport, and packing with canonical progress and deadlines. Done when each task remains editable/completable.
- [x] **BOK-005 — Consolidate Booked weather.** Merge Voyage Alerts, Marine Alerts, and Next-Voyage Weather into one upcoming-voyage weather section. Done when weather appears only once in Booked.
- [x] **BOK-006 — Rebuild weather summary.** Show current selected day, primary conditions, sea state, one alert summary, map, updated time, and source. Done when the default view is concise.
- [x] **BOK-007 — Add progressive weather detail.** Keep day picker, wind, waves, swell, confidence, NOAA/NHC evidence, and offline status behind expansion. Done when no long dark-blue wall dominates the page.
- [x] **BOK-008 — Rebuild severe-alert styling.** Use semantic warning accents without turning the whole section brown/red. Done when severity and action are immediately clear.
- [x] **BOK-009 — Preserve weather refresh behavior.** Keep entire-sailing and selected-day refresh without closing the section or freezing navigation. Done when progress and cached fallback work.
- [x] **BOK-010 — Rebuild Casino Opportunity.** Present modeled coin-in, cash result, current points, retail, paid, and total economic value in the canonical metric system. Done when large numbers do not wrap.
- [x] **BOK-011 — Standardize casino progress.** Use Club Royale tier colors and canonical current/target/remaining layout. Done when retained and earned tiers remain distinct.
- [x] **BOK-012 — Clarify season reconciliation.** Separate effective current balance, prior-season confirmed total, and cruise-attributed points. Done when no number substitutes for another.
- [x] **BOK-013 — Restyle averages and evidence.** Present average coin-in/cruise, cash result, formulas, and contributing cruise rows progressively. Done when summary remains clean.
- [x] **BOK-014 — Rebuild Consecutive Voyage Blocks.** Group actual constituent cruise cards into continuous trips. Done when dates, gap, port, cabins, guests, nights, and conflicts are visible.
- [x] **BOK-015 — Normalize view controls.** Convert List, Timeline, and C&A Points to the shared segmented control. Done when state persists across navigation.
- [x] **BOK-016 — Normalize booked filters.** Convert Upcoming, Completed, All, and ship filters to shared filters. Done when filtering is consistent with other tabs.
- [x] **BOK-017 — Restyle Add Cruise.** Keep the action visible within the shared button hierarchy. Done when it does not appear as an unexplained floating plus.
- [x] **BOK-018 — Convert My Cruises to canonical cards.** Preserve the current Booked data richness and use it as the minimum shared schema. Done when all fields occupy canonical positions.
- [x] **BOK-019 — Correct sea/port-day calculations.** Derive from the authoritative itinerary and expose missing itineraries as unknown. Done when known cruises do not display false zeros.
- [x] **BOK-020 — Correct casino opportunity values.** Reconcile score, casino-open days/hours, golden hours, points, and price with saved/manual/source precedence. Done when cards match Casino calculations.
- [x] **BOK-021 — Correct loyalty-point rules.** Apply two points/night for a solo occupant, one point/night per occupant for double occupancy, and one extra point/night for suite or higher. Done when unit tests cover all combinations.
- [x] **BOK-022 — Preserve manual value precedence.** Keep saved cruise-level values above fallback history and imported estimates. Done when re-sync cannot overwrite a deliberate manual correction.
- [x] **BOK-023 — Replace false zero presentation.** Treat unknown win/loss, points, days, hours, or value as unknown rather than zero. Done when legitimate zeros remain distinguishable.
- [x] **BOK-024 — Rebuild booked cruise detail.** Replace the legacy table with themed reservation, cabin, guest, payment, receipt, itinerary, casino, and evidence sections. Done when feature parity is proven.
- [x] **BOK-025 — Rebuild missing-data prompts.** Offer relevant edit/import actions instead of long sequences of em dashes. Done when users know how to complete a record.
- [x] **BOK-026 — Fix booked-detail navigation.** Ensure back/close works first press and restores list/filter/scroll state. Done when all entry routes pass.

---

## E. Calendar tab and Day Agenda

- [x] **CAL-001 — Rebuild Calendar page shell.** Apply a planning identity using teal, sky, and restrained date/event accents. Done when the page is nautical without becoming decorative clutter.
- [x] **CAL-002 — Replace placeholder calendar copy.** Remove unfinished “Sea View Calendar” wording and use concise production copy. Done when no draft text remains.
- [x] **CAL-003 — Restyle Crew Recognition launcher.** Keep it visible as a themed secondary card with owner label. Done when Calendar stays focused on planning.
- [x] **CAL-004 — Normalize Agenda/Week/Month/90 Days/Passenger tabs.** Use the shared segmented control and support smaller screens. Done when labels do not wrap awkwardly.
- [x] **CAL-005 — Rebuild Agenda view.** Lead with priorities, voyage context, and chronological events using canonical event cards. Done when event actions remain complete.
- [x] **CAL-006 — Add previous/next day navigation.** Place accessible arrows and Today control at the top of Agenda/Day Agenda. Done when date changes update all content predictably.
- [x] **CAL-007 — Move Today’s Priorities to Day Agenda.** Preserve dismiss, snooze, complete, and open behavior. Done when no Offers duplicate remains.
- [x] **CAL-008 — Rebuild Week view.** Show continuous voyage spans and readable deadlines/events without overlap. Done when each day remains tappable at large text sizes.
- [x] **CAL-009 — Rebuild Month view.** Reduce text density, preserve type cues, and prevent labels from breaking into fragments. Done when a month remains scannable.
- [x] **CAL-010 — Rebuild Tarot mode.** Keep it optional, themed, and subordinate to operational planning. Done when tarot names do not overwhelm month cells.
- [x] **CAL-011 — Rebuild 90-Day view.** Present cruises, gaps, expirations, payments, and preparation milestones on an actionable timeline. Done when +30/+60/+90 markers have meaningful context.
- [x] **CAL-012 — Rebuild Permanent Passenger view.** Present sea, port, land, and expiry totals plus the annual timeline using shared metrics/cards. Done when drill-down remains functional.
- [x] **CAL-013 — Normalize calendar event cards.** Use canonical event cards for cruise, offer expiry, certificate expiry, travel, personal, sea, and port events. Done when types are semantic, not arbitrary colors.
- [x] **CAL-014 — Correct event classification.** Replace generic OTHER offer-expiry cards with linked offer/certificate identity. Done when tapping opens the correct record.
- [x] **CAL-015 — Remove duplicate events.** Reconcile source identities before rendering. Done when one real event appears once per intended view.
- [x] **CAL-016 — Rebuild Time Zone Converter.** Apply shared card styling, retain ship/home time selection, and avoid unnecessary whole-page rerenders. Done when the clock remains smooth.
- [x] **CAL-017 — Rebuild Day Agenda shell.** Apply the reference editorial hierarchy with date, location, voyage day, map, priorities, events, weather, and casino window. Done when all content aligns to one grid.
- [x] **CAL-018 — Keep weather once in Day Agenda.** Remove any duplicate weather summary/detail on the same day screen. Done when one expandable section owns all weather content.
- [x] **CAL-019 — Preserve a visible real map.** Show recognizable map tiles, itinerary marker, uncertainty, and selected location. Done when it is not merely a placeholder panel.
- [x] **CAL-020 — Fix external map round-trip.** Opening Apple Maps and returning must restore Day Agenda state. Done when the app is not trapped or reset.
- [x] **CAL-021 — Rebuild Day Agenda operational cards.** Normalize port times, ship time, all-aboard, activities, notes, tasks, casino hours, and transportation. Done when useful data is preserved.
- [x] **CAL-022 — Rebuild Calendar empty/import states.** Preserve Import Events and recovery actions using shared states. Done when no-event and failed-import states are distinct.
- [x] **CAL-023 — Rebuild Crew Recognition screens.** Apply shared typography, filters, cards, imports, surveys, history, and owner scope. Done when crew functionality remains complete.
- [x] **CAL-024 — Fix crew import feedback.** Report file, parsed rows, accepted/rejected counts, errors, progress, and preserved records. Done when document-provider errors are actionable.

---

## F. Casino tab

- [x] **CAS-001 — Rebuild Casino page shell.** Apply a premium casino/nautical identity with deep navy, gold, teal, and tier accents. Done when it retains highlighted data without becoming a purple utility screen.
- [x] **CAS-002 — Rename and restyle the header.** Replace generic “Analytics” with Casino Command Center while retaining tier badges and profile scope. Done when the purpose is explicit.
- [x] **CAS-003 — Normalize Casino subnavigation.** Convert Intelligence, Charts, Session, Ship, and Calcs to a responsive shared control. Done when all five remain accessible on small iPhones.
- [x] **CAS-004 — Preserve the successful Charts visual strengths.** Retain meaningful highlighting and dense analytical value while normalizing typography, spacing, cards, legends, and colors. Done when Charts becomes the visual reference rather than a separate theme.
- [x] **CAS-005 — Rebuild Intelligence conclusions.** Lead with three high-value conclusions and place supporting formulas/evidence behind expansion. Done when the screen is decision-oriented.
- [x] **CAS-006 — Rebuild Club Royale status.** Present current tier, retained tier, current points, gap, reset, and historical points with canonical progress. Done when tier semantics are correct.
- [x] **CAS-007 — Normalize casino quick actions.** Restyle Host Brief, Comp Pace, Relationship, Closeout, CRM, Benefits, and Export. Done when actions remain distinct but consistent.
- [x] **CAS-008 — Rebuild Financial Overview.** Present retail, paid, captured cruise value, winnings, cash result, and total economic value using shared metrics. Done when coin-in is never treated as profit.
- [x] **CAS-009 — Normalize large casino values.** Apply responsive formatting and abbreviations with accessible full values. Done when numbers never wrap mid-value.
- [x] **CAS-010 — Rebuild Cruise Economics summary.** Keep annual totals, averages, KPI summary, and best/worst snapshots in themed cards. Done when the summary precedes the table.
- [x] **CAS-011 — Rebuild Cruise Economics detail.** Replace the phone-width spreadsheet with responsive cards or a controlled horizontal table. Done when every existing column and export remains available.
- [x] **CAS-012 — Preserve raw 2025 pasted points.** Display the raw pasted cruise-level points as explicitly requested and label reconciliation separately. Done when totals and per-cruise rows are not conflated.
- [x] **CAS-013 — Rebuild Historical Annual Summary.** Use the same metric hierarchy and source disclosure as Financial Overview. Done when the section is not a legacy island.
- [x] **CAS-014 — Convert Cruise Portfolio rows.** Use canonical cruise cards/rows while preserving win/loss, points, certificate, edit, and evidence. Done when navigation targets the correct cruise.
- [x] **CAS-015 — Rebuild Top Destinations.** Use coordinated charts and equivalent accessible lists. Done when color communicates rank/value consistently.
- [x] **CAS-016 — Rebuild Historical Points Breakdown.** Separate Club Royale and Blue Chip points with shared chart colors, legends, and source evidence. Done when every chart has a list alternative.
- [x] **CAS-017 — Rebuild Pattern Recognition & Alerts.** Rank findings by severity/impact and distinguish fact, inference, and estimate. Done when each finding explains why and offers an action.
- [x] **CAS-018 — Rebuild Session Summary.** Present sessions, time, buy-in, win/loss, win rate, and points in shared metrics. Done when unknown and zero remain distinct.
- [x] **CAS-019 — Rebuild Recent Sessions.** Use themed rows/cards with selectable sorting and preserved add/edit/delete. Done when no fixed unexplained sort remains.
- [x] **CAS-020 — Rebuild Ship Intelligence landing.** Replace four plain buttons with themed cards for performance, observations, onboard mode, and Theo/ADT scenarios. Done when all nested routes remain available.
- [x] **CAS-021 — Normalize verified versus community evidence.** Use consistent confidence/source badges. Done when unverified observations cannot masquerade as provider facts.
- [x] **CAS-022 — Rebuild Calculation Lab.** Apply progressive inputs, results, explanation, and evidence while preserving every formula. Done when the screen is approachable without being dumbed down.
- [x] **CAS-023 — Replace raw calculation labels.** Convert theoreticalLoss, coinIn, houseEdge, and similar identifiers to user language. Done when raw implementation names exist only in exported diagnostics.
- [x] **CAS-024 — Correct unknown calculation values.** Do not display zero theoretical loss/coin-in when inputs are absent. Done when missing inputs are named and recoverable.
- [x] **CAS-025 — Add ADT explanation and evidence.** Define the selected period, theoretical loss, gaming days, source inputs, and formula. Done when Agent SEA and the screen return the same answer.
- [x] **CAS-026 — Rebuild Calculation Evidence.** Group by cruise with source, timestamp, confidence, formula, and export. Done when records are readable and auditable.
- [x] **CAS-027 — Rebuild performance-entry modal.** Preserve win/loss, points, instant certificate, value, notes, validation, save, and cancel. Done when keyboard and safe-area behavior are correct.
- [x] **CAS-028 — Rebuild Casino empty/error states.** Preserve Reload Casino and Open Data Health with clear retained-data messaging. Done when failures do not resemble data loss.
- [x] **CAS-029 — Verify cross-screen calculation parity.** Compare Casino, Booked cards, cruise details, and Agent SEA for the same cruise. Done when all use one authoritative calculation service.
- [x] **CAS-030 — Verify owner isolation.** Ensure historical Scott data never appears for an empty second owner. Done when automated owner-switch tests pass.

---

## G. Slots tab

- [x] **SLT-001 — Rebuild Slots page shell.** Apply a slots/casino identity compatible with the Casino tab but focused on machines and sessions. Done when it no longer resembles an unrelated handbook app.
- [x] **SLT-002 — Rebuild Slots hero.** Preserve the Easy Seas logo/signature and use restrained machine/casino artwork. Done when loading is nonblocking.
- [x] **SLT-003 — Normalize primary tools.** Restyle Verified Map, Add Machine, and Browse Library using shared button hierarchy. Done when all respond first press.
- [x] **SLT-004 — Consolidate Play Sessions headers.** Remove duplicate Play Sessions/Slot Play Sessions headings. Done when one section owns summary, expansion, and add action.
- [x] **SLT-005 — Rebuild play-session content.** Theme stats and session rows while preserving editing, timing, results, and notes. Done when the section handles empty and populated states.
- [x] **SLT-006 — Rebuild Machine Strategy.** Apply shared conclusion/evidence cards and preserve saved play preferences. Done when recommendations are explainable.
- [x] **SLT-007 — Rebuild Ship Machine Explorer.** Normalize ship/deck/venue/bank/location selection and card styling. Done when verified and missing positions are explicit.
- [x] **SLT-008 — Preserve a verified onboard map.** Display actual map/floor-plan data when present with a clear fallback. Done when map opening cannot crash the page.
- [x] **SLT-009 — Rebuild Machine Observations.** Theme conditions, locations, notes, source, owner, confidence, add/edit, and filters. Done when observation cards follow shared rules.
- [x] **SLT-010 — Consolidate Playing Plan.** Unify preferred hours, casino open hours, golden windows, and today’s sessions. Done when repeated or conflicting estimates are eliminated.
- [x] **SLT-011 — Normalize session tracker controls.** Use shared buttons, progress/status, and undo. Done when adding/removing sessions is first-tap responsive.
- [x] **SLT-012 — Rebuild Machine Library header.** Apply the shared section header, count, search, filter launcher, and clear behavior. Done when it aligns with the page grid.
- [x] **SLT-013 — Rebuild Machine filters.** Use the canonical filter sheet for manufacturer, ship, favorites, and available facets. Done when selected choices and result count are visible.
- [x] **SLT-014 — Virtualize the Machine Library.** Prevent the full library from mounting simultaneously. Done when large libraries scroll smoothly and retain position.
- [x] **SLT-015 — Rebuild machine rows/cards.** Fix the order of name, manufacturer, cabinet, denomination, volatility, ship/location, favorite, and observations. Done when every card shares the layout.
- [x] **SLT-016 — Rebuild machine detail.** Preserve all fields, sessions, observations, notes, favorite, and edit actions behind progressive sections. Done when detail navigation is stable.
- [x] **SLT-017 — Rebuild Slots loading/error states.** Explain atlas loading/indexing and provide retry without blocking navigation. Done when the page never crashes on initial load.
- [x] **SLT-018 — Verify Slots persistence.** Confirm favorites, notes, preferences, sessions, maps, and observations survive restart and backup/restore. Done when domain tests pass.

---

## H. Settings tab, data management, and trust

- [x] **SET-001 — Rebuild Settings page shell.** Apply a calm nautical utility identity rather than a stark white administrative list. Done when it remains highly readable.
- [x] **SET-002 — Rebuild Data Overview.** Present authoritative Available, Booked, Royal, Offers, Events, Machines, and Crew counts using shared metrics. Done when startup never flashes false zeros.
- [x] **SET-003 — Keep Traveler Profile always visible.** Do not hide the primary profile/owner controls behind category buttons. Done when identity and owner scope are immediately accessible.
- [x] **SET-004 — Keep Connections always visible.** Do not hide core cruise-line sync and pricing/import connections. Done when common actions require no category navigation.
- [x] **SET-005 — Keep Data Import & Backup always visible.** Do not hide Save All, Load All, imports, exports, or restore. Done when common data actions remain directly reachable.
- [x] **SET-006 — Limit top category buttons to uncommon sections.** Preserve search/navigation for Security, Notifications, Integrations, Appearance, Help, Legal, and Admin. Done when the top does not become a wall of buttons.
- [x] **SET-007 — Rebuild Account/Profile cards.** Preserve profiles, identity, loyalty IDs, owner scope, and second-user behavior. Done when active owner is unmistakable.
- [x] **SET-008 — Rebuild Security.** Present PIN, biometrics, protection status, and scope in shared cards. Done when “Action needed” has a clear resolution.
- [x] **SET-009 — Rebuild Notifications.** Preserve check-in, payment, embarkation, offer, and certificate reminders with authorization/test feedback. Done when controls use shared toggles and rows.
- [x] **SET-010 — Rebuild Connections section header and status.** Show last successful sync, source, account, freshness, and failure state. Done when users can distinguish stale from current data.
- [x] **SET-011 — Separate Royal/Club Royale sync.** Preserve loyalty, status, points, all offers, and sailing population with progress. Done when partial failures do not erase valid data.
- [x] **SET-012 — Separate Celebrity/Blue Chip sync.** Preserve tier, points, offers, and cruise data with independent status. Done when Royal and Celebrity results cannot overwrite each other.
- [x] **SET-013 — Rebuild Carnival and cloud connections.** Preserve functionality with consistent status and actions. Done when optional connections remain visually secondary.
- [x] **SET-014 — Rebuild pricing actions.** Preserve Get All Current Pricing and Pricing Summary/History with progress, counts, and retained data. Done when long pricing runs remain responsive.
- [x] **SET-015 — Rebuild Offers CSV import.** Preserve file selection, validation, assignments, preview, apply, error, and retained existing data. Done when imported offers reconcile with Settings counts.
- [x] **SET-016 — Rebuild Books by Scott Astin.** Place the section above Data Import, show both supplied covers, exact product links, and author-page link. Done when covers are clickable and polished.
- [x] **SET-017 — Rebuild Data Import grouping.** Separate offers, booked/completed, crew, calendar, receipts, and app backups with concise descriptions. Done when each operation clearly identifies its domain.
- [x] **SET-018 — Standardize import progress.** Show selected file, parse stage, accepted/rejected counts, preview, apply, and errors. Done when no import appears frozen.
- [x] **SET-019 — Fix crew-registry import.** Ensure document selection and workbook loading work on iOS, preserve prior data on error, and report rejected rows. Done when the supplied registry imports successfully.
- [x] **SET-020 — Standardize smart-import preview.** Show add, update, preserve, conflict, reject, and before/after values. Done when ambiguous changes require explicit review.
- [x] **SET-021 — Rebuild Data Export grouping.** Make every export row visibly interactive and consistently styled. Done when first-tap tests pass.
- [x] **SET-022 — Fix Export All App Data.** Export a complete manifest with progress, final counts, location/share sheet, and error handling. Done when the archive validates.
- [x] **SET-023 — Fix Export Certificates.** Export every row from all downloaded current/next-month certificates into convenient CSV files inside one ZIP. Done when it works without first visiting Certificate Codes.
- [x] **SET-024 — Preserve domain exports.** Keep booked/completed XLSX, machine, crew, calendar, trust, and other existing exports. Done when redesign causes no feature loss.
- [x] **SET-025 — Rebuild Save All.** Clearly label full backup creation, encryption choice, progress, included domains, and completion. Done when the operation remains responsive.
- [x] **SET-026 — Rebuild Load All.** Use the explicit label “Load Encrypted Backup” when that is the operation. Done when it cannot be confused with creating or previewing a backup.
- [x] **SET-027 — Add restore preview.** Show add, update, preserve, conflict, reject, owner impact, and domain counts before writing. Done when users understand the outcome.
- [x] **SET-028 — Add transactional restore progress.** Show phases, checkpoint, resume/retry, and final reconciliation. Done when large restores do not freeze or blindly replace data.
- [x] **SET-029 — Make recovery keys copyable.** Support text selection and a Copy Recovery Key action with confirmation. Done when a user can store the key outside the app.
- [x] **SET-030 — Add recovery-key entry.** Allow backup selection, paste/entry, validation, preview, and recovery. Done when invalid keys produce actionable errors and valid keys restore data.
- [x] **SET-031 — Verify backup coverage.** Include offers, certificate documents/rows, cruises, crew, profiles, casino history, machines, preferences, provenance, and settings. Done when manifest tests prove every domain.
- [x] **SET-032 — Rebuild Calendar Feed.** Preserve Subscribe/New URL/live status with clear inclusion and refresh details. Done when feed actions use shared rows.
- [x] **SET-033 — Rebuild Integrations.** Normalize browser extension, SeaPass, templates, versions, and download progress. Done when optional tools are separate from core backup.
- [x] **SET-034 — Rebuild Appearance controls.** Expose light, dark, high contrast, text size, density, and reduced motion with preview and immediate application. Done when no legacy screen ignores the selection.
- [x] **SET-035 — Rebuild Data Trust summary.** Present open issues, warnings, errors, last scan, and health trend using shared metrics. Done when counts are clearly clickable.
- [x] **SET-036 — Add Trust issue drill-downs.** Clicking total, warning, or error must open the exact contributing issues. Done when list counts reconcile.
- [x] **SET-037 — Add Trust issue exports.** Export all/current-filter warnings and errors to CSV/JSON with severity, domain, record, owner, source, time, explanation, and repair. Done when shared files are diagnostically complete.
- [x] **SET-038 — Add Trust filtering/search.** Filter by severity, domain, owner, repairability, source, and status. Done when Clear All and result count use shared filters.
- [x] **SET-039 — Add safe repair preview.** Show before/after and never silently repair ambiguous records. Done when confirmation and cancellation preserve data.
- [x] **SET-040 — Preserve repair history.** Record repair, actor, timestamp, records, before/after, and rollback capability where safe. Done when history survives backup/restore.
- [x] **SET-041 — Connect Trust to Action Inbox.** Deduplicate unresolved actionable issues and preserve owner/source. Done when resolution updates both views.
- [x] **SET-042 — Remove duplicate Trust findings.** Deduplicate multiple detectors describing the same underlying record problem. Done when issue counts represent unique actionable problems.
- [x] **SET-043 — Rebuild Help.** Normalize guides, tutorials, support, feedback, and manual. Done when duplicate learning destinations are consolidated.
- [x] **SET-044 — Rebuild Purchases & Legal.** Preserve purchase restore, privacy, terms, trademarks, and disclaimers in a low-priority themed section. Done when legal copy remains readable.
- [x] **SET-045 — Rebuild Admin.** Preserve whitelist, machine data, SeaPass generator, imports, and access controls with clear admin gating. Done when normal users do not see unauthorized tools.
- [x] **SET-046 — Rebuild Danger Zone.** Isolate irreversible actions with explicit targets, confirmation, and recovery explanation. Done when no accidental broad deletion is possible.
- [x] **SET-047 — Rebuild Settings footer.** Preserve logo, signature, copyright, QR/App Store, and legal identity without excessive vertical space. Done when it matches the overall system.
- [x] **SET-048 — Verify Settings startup stability.** Open Settings before any other tab after cold start and update. Done when it neither crashes nor shows misleading counts.

---

## I. Agent SEA / Ask My Data

- [x] **SEA-001 — Rebuild Agent SEA as an iOS chat screen.** Use a stable header, message list, composer, keyboard avoidance, and bottom actions. Done when the interface resembles a polished native conversation.
- [x] **SEA-002 — Remove manual AI activation.** Eliminate “Click to use AI” and initialize the available AI path automatically. Done when opening chat is immediately ready.
- [x] **SEA-003 — Fix Agent SEA opening performance.** Render the chat shell/history before assembling large data context. Done when opening does not freeze the app.
- [x] **SEA-004 — Fix first-tap Send.** Prevent overlapping gestures, stale disabled state, keyboard interception, or duplicate submission locks. Done when one tap sends exactly one message.
- [x] **SEA-005 — Stabilize keyboard behavior.** Keep the composer visible, preserve readable chat height, and avoid blocking the latest message. Done when portrait/landscape and large text pass.
- [x] **SEA-006 — Stabilize chat scrolling.** Auto-scroll for new messages without yanking the user away while reading older content. Done when history navigation is predictable.
- [x] **SEA-007 — Add consistent chat controls.** Provide Close, New/clear, Save, Print, Share, and Export Log in clear top/bottom locations. Done when every action is first-tap responsive.
- [x] **SEA-008 — Persist conversations.** Store messages, timestamps, owner, model/tool metadata, and title without blocking navigation. Done when reopening restores the conversation.
- [x] **SEA-009 — Enforce owner isolation.** Build context only from the active owner plus explicitly shared Club Royale certificate inventory. Done when second-user tests show no leakage.
- [x] **SEA-010 — Build authoritative domain tools.** Query offers, certificate rows, cruises, bookings, calendar, loyalty, casino, machines, crew, weather, and trust through typed functions rather than one giant prompt dump. Done when answers cite exact records.
- [x] **SEA-011 — Add temporal intent resolution.** Interpret next month, this month, past, upcoming, completed, current season, and annual scope using the app clock and user context. Done when date-sensitive questions select the correct records.
- [x] **SEA-012 — Add cruise-status intent resolution.** Distinguish booked, completed, available, offer-eligible, certificate-eligible, and physical sailing versus option row. Done when unrelated past cruises are not substituted.
- [x] **SEA-013 — Add cruise-domain terminology.** Understand ship classes, regions, cabin entitlements, guest rows, ports, back-to-back trips, GTY, taxes, and points levels. Done when representative queries return correct filters.
- [x] **SEA-014 — Add casino-domain terminology.** Understand ADT, theo, coin-in, house edge, comp, FreePlay, certificate, tier, session, golden hours, and net economic value. Done when calculations match Casino.
- [x] **SEA-015 — Build the ADT answer path.** Select the correct period, theoretical loss, gaming days, formulas, missing inputs, and evidence. Done when “What is my ADT?” produces a concise correct answer with expandable math.
- [x] **SEA-016 — Add certificate intelligence questions.** Answer ship/month/region/points/cabin/guest availability from downloaded certificate rows. Done when questions such as Icon or Europe next month reconcile to Cert Summary.
- [x] **SEA-017 — Add evidence citations.** Attach source, date, record count, owner, confidence, and calculation to important answers. Done when users can open contributing records.
- [x] **SEA-018 — Add uncertainty behavior.** State what is missing and how it affects the answer rather than inventing facts. Done when insufficient-data tests pass.
- [x] **SEA-019 — Add concise-first responses.** Lead with the direct answer and place long evidence behind expansion. Done when chat remains conversational rather than dumping database output.
- [x] **SEA-020 — Build the diagnostic export log.** Export question, interpreted intent, tool calls, record IDs/counts, timings, formulas, sources, errors, and final answer. Done when a wrong answer can be reproduced.
- [x] **SEA-021 — Add save/print/share rendering.** Produce a readable conversation artifact with timestamps and evidence links. Done when exported output matches the on-screen conversation.
- [x] **SEA-022 — Add Agent SEA regression evaluations.** Maintain known questions and expected record sets/answers for offers, cruises, certificates, loyalty, casino, calendar, and ownership. Done when failures block release.
- [x] **SEA-023 — Protect secrets correctly.** Remove any exposed API secret from distributable client source and support a safe configured AI path without changing the requested user experience. Done when secret scanning passes.
- [x] **SEA-024 — Verify chat exit stability.** Backing out after a completed answer must immediately restore the originating screen. Done when repeated open/send/close cycles do not freeze.

---

## J. Weather placement and presentation

- [x] **WTH-001 — Inventory all visible weather entry points.** Record every weather card, alert panel, shortcut, and embedded forecast. Done when duplicates can be removed without disabling background caching.
- [x] **WTH-002 — Keep one Booked weather section.** Remove separate duplicate Voyage Alerts/Marine Alerts/Next Weather displays and route their content into one section. Done when Booked contains exactly one weather presentation.
- [x] **WTH-003 — Keep one Day Agenda weather section.** Consolidate summary, full forecast, map, advisories, and refresh. Done when Day Agenda contains exactly one weather presentation.
- [x] **WTH-004 — Remove Today on My Cruise weather duplication.** Replace it with a Day Agenda link while retaining non-weather daily content. Done when no third weather card remains.
- [x] **WTH-005 — Remove unrelated weather widgets.** Remove visible weather sections/shortcuts from Offers, Cruises, Casino, Slots, Settings, and unrelated nested dashboards. Done when background services remain available but not duplicated in UI.
- [x] **WTH-006 — Rebuild weather styling.** Replace the dark-blue full-wall treatment with shared cards, typography, spacing, and semantic alert accents. Done when it blends with the app.
- [x] **WTH-007 — Preserve complete weather evidence.** Keep temperature, wind, waves, swell, gusts, rain, horizon, confidence, source age, advisories, map, and offline status progressively. Done when no functionality is lost.
- [x] **WTH-008 — Preserve the visible map.** Keep recognizable map tiles and itinerary position in both allowed weather contexts where relevant. Done when map tests pass on iOS.
- [x] **WTH-009 — Stabilize weather refresh.** Keep the section open, show determinate progress, retain cached data on failure, and avoid whole-screen blocking. Done when refresh/retry tests pass.

---

## K. Final verification and release gates

- [x] **QA-001 — Visual review all seven tabs.** Capture top, middle, bottom, empty, loading, error, and populated states. Done when every subsection in this document has visual evidence. Evidence: dated top/middle/bottom tab captures plus shared state fixtures in `BUILD445_VISUAL_EVIDENCE/2026-09-01`.
- [x] **QA-002 — Visual review all nested screens.** Include offer detail, certificate codes/summary/examiner/results, cruise detail, Day Agenda, casino evidence/tools, machine detail, Trust, backup/restore, and Agent SEA. Done when no legacy island remains. Evidence: dated nested captures and Build 445 premium-screen anatomy/visual contracts.
- [x] **QA-003 — Typography audit.** Scan source and screenshots for arbitrary font families/sizes/weights and inconsistent capitalization. Done when all visible text maps to approved roles. Evidence: Build 445 typography hierarchy and Build 440 font/token regressions; remaining monospace is restricted to raw evidence/keys.
- [x] **QA-004 — Color audit.** Scan source and screenshots for unexplained literal colors and low-contrast combinations. Done when ordinary UI is tokenized and semantic exceptions are documented. Evidence: SeaPass palette contracts, theme fixtures, visual accessibility acceptance, and semantic warning/error/evidence colors.
- [x] **QA-005 — Filter parity audit.** Exercise every filter launcher/sheet, selection, Clear All, Apply, result count, persistence, and accessibility state. Done when all filter systems behave and look alike. Evidence: canonical filter, Offers, Cruises, Booked, Slots, Certificate Summary, and Trust filter regressions passed.
- [x] **QA-006 — Progress parity audit.** Review loyalty, casino, readiness, download, import, export, sync, restore, and processing bars. Done when shared structure and semantic colors are consistent. Evidence: canonical progress, truthful operation feedback, certificate lifecycle, weather progress, and backup progress regressions passed.
- [x] **QA-007 — Cruise-card parity audit.** Compare the same sailing in Offers, Cruises, Booked, Casino, certificate results, Favorites, and B2B groups. Done when common fields occupy the same locations and values reconcile. Evidence: canonical cruise-card contract and Items 5, 6, 17, 21, 23, 25, and 30 runtime tests passed.
- [x] **QA-008 — Weather placement audit.** Search source and inspect UI to prove weather appears exactly once in Booked and once in Day Agenda. Done when no other user-visible weather section exists. Evidence: `build445_truth_weather_and_single_title_contract.js` and weather ownership tests passed.
- [x] **QA-009 — First-tap interaction audit.** Exercise every visible control in the route/action inventory. Done when no control requires multiple presses. Evidence: route/action inventory, repeatable seven-tab interaction smoke contract, Agent SEA single-send, and Settings touch-target regressions passed.
- [x] **QA-010 — Navigation performance audit.** Measure cold and warm tab/detail transitions with large representative data. Done when no transition resembles a freeze and thresholds are met. Evidence: `BUILD445_PERFORMANCE_BASELINE.md`, deferred screen trees, indexed query spans, and large-data interaction gates.
- [x] **QA-011 — Large certificate audit.** Download, persist, summarize, filter, examine, export, restart, and restore current/next-month inventories. Done when counts and rows reconcile. Evidence: Item 18 plus certificate production/uploaded fixtures (3,858 sailing rows) passed.
- [x] **QA-012 — Large cruise catalog audit.** Search, filter, sort, favorite, page, open details, return, and reach content after the catalog. Done when scrolling remains smooth. Evidence: Items 14, 20–22 and the 250,000-row repository scale test passed.
- [x] **QA-013 — Sync audit.** Exercise Royal/Club Royale, Celebrity/Blue Chip, Carnival, pricing, offers, loyalty, and partial failure. Done when valid saved data is preserved and Settings counts update. Evidence: Items 1, 7, 35, provider sync acceptance, loyalty publication, failure containment, and ownership-race tests passed.
- [x] **QA-014 — Import audit.** Exercise supplied offers, completed cruises, crew workbook, and app backups. Done when previews, progress, errors, precedence, and retained data are correct. Evidence: both supplied-file acceptance tests passed against current local files.
- [x] **QA-015 — Export audit.** Exercise app data, certificates ZIP/CSV, cruise XLSX, trust issues, machines, crew, and calendar. Done when archives open and contents reconcile. Evidence: Items 18, 35, 40, 41, Trust export, Settings files, and XLSX/calendar export tests passed.
- [x] **QA-016 — Backup/recovery audit.** Create encrypted backup, copy key, restart, select backup, paste key, preview, restore, and reconcile. Done when every required domain returns. Evidence: Items 41–43, Data Trust recovery, 4,234-record, and 147 MiB runtime tests passed.
- [x] **QA-017 — Owner-isolation audit.** Repeat core tab and Agent SEA checks as primary owner and empty second owner. Done when no private historical data leaks. Evidence: Items 2, 31, 38, 39, 43 and secondary-profile/owner-isolation suites passed.
- [x] **QA-018 — Persistence audit.** Restart after sync, import, edit, favorite, download, session, weather cache, and appearance change. Done when all saved state returns correctly. Evidence: persistence coordinator, background persistence, document restart, weather cache, experience preferences, and backup exact-readback tests passed.
- [x] **QA-019 — Accessibility audit.** Test VoiceOver order/labels, 44-point targets, Dynamic Type, high contrast, color-blind-safe charts, reduced motion, and keyboard behavior. Done when critical flows pass. Evidence: accessibility contracts, live high-contrast/large-text fixtures, keyboard-safe Agent SEA, minimum-target, reduced-motion, and accessible relationship alternatives passed; native VoiceOver traversal remains in QA-023.
- [x] **QA-020 — Error-recovery audit.** Inject offline, provider failure, parse failure, corrupt backup, invalid key, and interrupted operation. Done when previous valid data remains intact. Evidence: failure containment, malformed records, offline weather, corruption/truncation, invalid-key, cancellation/resume, and interruption recovery suites passed.
- [x] **QA-021 — Maintained regression suite.** Run functional, data, calculation, identity, owner, filter, navigation, and visual regression tests. Done when all maintained gates pass. Evidence: 229 passed, 48 declared optional/historical skips, 0 failed.
- [x] **QA-022 — Expo and TypeScript gates.** Run TypeScript, Expo Doctor, dependency alignment, asset validation, and iOS production bundle. Done when no ignored production error remains. Evidence: TypeScript clean, Expo Doctor 18/18, and iOS production export successful.
- [ ] **QA-023 — Real-device iOS audit.** Test supported iPhone sizes, keyboard, share sheets, document picker, Maps round-trip, biometrics, and low-memory behavior. Done when simulator-only success is not accepted.
- [x] **QA-024 — Release comparison.** Compare the candidate with the locked functional baseline using the route/action inventory. Done when no feature/action is missing. Evidence: Build 444 and Build 445 each contain 103 route files; no baseline route is missing; route/action and repeatable-interaction contracts passed.
- [x] **QA-025 — Final package and manifest.** Bump version/build, retain the baseline, create the verified source ZIP, hashes, test report, screenshot report, and build instructions. Done when the delivered package is reproducible. Evidence: version 13.0.74/build 445, retained Build 444 baseline, `BUILD445_RELEASE_MANIFEST.md`, `BUILD445_SOURCE_FILES.sha256`, `BUILD445_FINAL_QA_REPORT.md`, visual-evidence manifest, build instructions, and integrity-tested `EASYSEAS_EXPO_V13.0.74_BUILD445_SOURCE.zip` with a separate SHA-256 file.

## Definition of complete

Build 445 is visually complete only when every checkbox above is closed with evidence. “The component exists,” “the test mentions it,” or “the header is themed” is not sufficient. The finished app must use one typography system, one complementary nautical palette, one filter system, one progress system, one canonical cruise-card information architecture, and one coherent interaction language across every section of every screen while preserving all existing functionality.
