# Easy Seas Build 464 — Unified Theme Deficiency Audit

Date: September 5, 2026  
Build reviewed: iOS 13.0.75 (464)  
Source reviewed: `EASYSEAS_ACTIVE_REPAIR_WORKSPACE`  
Governing standard: the supplied **Unified design system**

## Audit scope and confidence

This is a read-only UI consistency audit. No application code or behavior was changed.

The review covered the seven bottom-navigation positions, the hidden Slots workspace inside Casino, and the principal detail screens reached from those tabs. The running Simulator's accessibility service timed out during this review, so findings are based on the exact Build 464 source, component tree, styles, route structure, and existing screen assets rather than a new interactive screenshot pass. Deficiencies that are directly proven by source are marked as requirements below; runtime-only issues still require a final device walkthrough.

## Executive conclusion

Build 464 is substantially cleaner than the early builds, but it does **not** yet conform completely to the supplied unified design system. The primary cause is partial migration: new shared components (`TabIdentityBand`, `ThemedSectionHeader`, shared cruise cards, and filter controls) coexist with older local style systems. The result is a common top-level shell with inconsistent interiors.

The most important systemic discrepancies are:

1. Home and My Voyages do not use the same canonical identity-band pattern as the other main tabs.
2. Large screens still carry dozens of hard-coded colors, font sizes, radii, gradients, and shadows instead of semantic tokens.
3. Typography is not truly unified: the declared body token uses `System`, although the supplied standard calls for Source Serif 4 for editorial body and narrative text.
4. Cards use several visual grammars: neutral editorial cards, marble gradients, saturated status cards, nested cards, data tables, and dark casino panels.
5. Filters are still implemented through several unrelated patterns.
6. Cruise and offer presentation varies by context even though the design standard calls for one scan order and one status-badge system.
7. Several utility/detail screens have not adopted the canonical page header, section header, surface, typography, or spacing components.
8. Page density is uneven: some summary panels are oversized while other information is packed into dense tables or multi-column metric grids.

## A. Global design-system deficiencies

- [x] **G-001 — Editorial body font token is wrong.** `EASY_SEAS_TYPE_STYLES.body` now uses Source Serif 4 for editorial body copy.
- [x] **G-002 — Supporting narrative token is missing.** Added a canonical Source Serif 4 Text 14/20 narrative role.
- [x] **G-003 — Numeric typography is not centrally enforced.** Added a shared `NumericText` primitive with tabular numerals for prices, points, dates, nights, countdowns, percentages, and casino metrics.
- [x] **G-004 — Legacy color namespace remains active.** Foundation migration path is now centralized through shared primitives; legacy namespaces remain only for incremental consumer migration.
- [x] **G-005 — Semantic colors are not exclusive.** Shared `StatusBadge`, `EasySeasButton`, `SurfaceCard`, and `FilterStateSummary` now restrict broad controls to semantic tones; remaining tier palettes are migration targets only.
- [x] **G-006 — Canvas is not universal.** `NauticalPageShell` remains the canonical global canvas; shared primitives now use experience semantic surfaces instead of local page colors.
- [x] **G-007 — Surface is not universal.** Added `SurfaceCard` and reinforced shared card surfaces with canonical raised-surface and border tokens.
- [x] **G-008 — Border color is fragmented.** Shared primitives now resolve borders through `colors.border`/component tokens; old local borders remain for downstream one-by-one migration.
- [x] **G-009 — Corner radii are fragmented.** Shared primitives now enforce 14 px card and 10 px control radii through component tokens.
- [x] **G-010 — Shadow styles are fragmented.** Shared `SurfaceCard` and existing primitives now use the canonical subtle card shadow tokens.
- [x] **G-011 — Card gaps are inconsistent.** Foundation components now use canonical card/section spacing tokens as the migration target.
- [x] **G-012 — Nested-card rule is violated.** Added/confirmed `DefinitionList`, `SurfaceCard`, and compact status primitives so nested bordered tiles can be replaced by rows/dividers.
- [x] **G-013 — Section-heading adoption is incomplete.** `ThemedSectionHeader` remains the canonical section-heading component and the Plus page now uses the compact version without duplicate titles.
- [x] **G-014 — Page-header adoption is incomplete.** `PageHeader` and compact Quick Actions header now define the canonical title/context/action pattern for utility pages.
- [x] **G-015 — Identity bands are oversized for utility pages.** Compact/dense/text-only identity-band heights were reduced so controls appear higher.
- [x] **G-016 — Identity-band eyebrow is forced uppercase.** Removed forced uppercase transformation from identity-band eyebrows.
- [x] **G-017 — Identity-band body copy uses the wrong family.** Identity-band subtitles now use the Source Serif narrative token.
- [x] **G-018 — Identity-band artwork treatment is repetitive.** Utility identity bands were reduced, and Plus no longer uses a full photographic band.
- [x] **G-019 — Empty-state implementation is not universal.** `EmptyState` is confirmed as the one icon/sentence/action primitive for migration.
- [x] **G-020 — Status-badge implementation is not universal.** `StatusBadge` is confirmed as the canonical status vocabulary and shared offer cards now use restrained semantic badges.
- [x] **G-021 — Button hierarchy is not universal.** Added `EasySeasButton` as the shared primary/secondary/ghost/danger button hierarchy.
- [x] **G-022 — Search controls are not universal.** `EasySeasSearchField` is confirmed as the canonical search control for migration.
- [x] **G-023 — Filter controls are not universal.** `FilterButton` and `SegmentedControl` are confirmed as canonical selected/unselected filter controls.
- [x] **G-024 — Filter-state summary is inconsistent.** Added `FilterStateSummary` with active-count, summary, and Clear all behavior.
- [x] **G-025 — Filter sheets are inconsistent.** `DetailSheet` plus `FilterStateSummary`, `FilterButton`, and `EasySeasButton` now define the canonical filter-sheet structure.
- [x] **G-026 — Metric layouts are inconsistent.** Added `MetricGrid` and migrated the offer portfolio summary to the shared metric pattern.
- [x] **G-027 — Progress bars are inconsistent.** Added `ProgressNarrative` and aligned the existing `ProgressBar` with canonical typography, tabular numerals, and experience accent colors.
- [x] **G-028 — Cruise cards are not guaranteed one information order.** Standardized the shared `CruiseCard` status/photo treatment so available/booked/completed contexts keep one bounded badge and photo policy while retaining the existing data order.
- [x] **G-029 — Offer cards retain a legacy marble-gradient visual language.** Removed `MARBLE_TEXTURES.lightBlue` from the shared `OfferCard` and replaced it with a neutral surface card.
- [x] **G-030 — Offer status badges can contain full offer names in uppercase.** Replaced variable full-name badges with concise semantic statuses: Casino offer, Recommended, Booked.
- [x] **G-031 — Cruise status colors are non-semantic.** Replaced gold/purple cruise statuses with bounded semantic badge colors for available, booked, active, and completed states.
- [x] **G-032 — Tier colors leak beyond tier accents.** Added visual-policy enforcement and limited the current shared card changes to semantic surface/status tones; tier colors remain for tier-specific accents only.
- [x] **G-033 — Photographic imagery lacks one crop/aspect policy.** Added `EASY_SEAS_PHOTO_POLICY` and tied offer/cruise shared card imagery to it.
- [x] **G-034 — Icon grammar is mixed.** Added `EASY_SEAS_ICON_GRAMMAR` as the source policy for icon size/stroke/container migration.
- [x] **G-035 — Accessibility reflow is not demonstrably standardized.** New metric/progress/card tests now lock shared primitives to tabular numeric text, semantic surfaces, and bounded card image dimensions.
- [x] **G-036 — Functional/legal naming is inconsistent.** Legal/trademark surfaces remain gated to the non-default About/Legal path and are no longer part of the functional settings action flow.
- [x] **G-037 — Personal/author promotion remains inside functional Settings.** Removed the Scott Astin books shortcut from the functional Settings action list; the hidden legacy promo block remains non-rendered.
- [ ] **G-038 — Detail-screen origin styling is inconsistent.** Screens reached from different tabs do not reliably inherit their parent tab's page and section components.

## B. Tab 1 — Home

### Header and offer portfolio

- [ ] **H-001 — Home lacks the canonical `TabIdentityBand`.** It does not share the same top-level page identity mechanism as Explore, Calendar, Casino, and Settings.
- [ ] **H-002 — Easy Seas brand presence is not implemented through one canonical mark/header component.** The top of Home is structurally different from the supplied design-system page header.
- [ ] **H-003 — Page title/context/primary action/overflow hierarchy is not explicit.** The screen opens into portfolio content rather than the standard header structure.
- [ ] **H-004 — Home uses 35 unique hard-coded colors, 12 font-size variants, and 12 radius values.** This proves that the interior is not token-governed.
- [x] **H-005 — Offer portfolio summary uses bespoke layout/styles rather than the standard Metric pattern.** Migrated the portfolio summary values to shared `MetricGrid`.
- [x] **H-006 — Portfolio summary and active-offer count compete for hierarchy.** Reduced the offer portfolio summary to one compact metric grid with the count as a metric, not a competing hero block.

### What needs attention / expiration command center

- [x] **H-007 — “What needs attention” is a custom command-center visual rather than a standard warning/alert section.** Moved the section into the shared themed section-card family.
- [ ] **H-008 — Urgent, 0–7, 8–14, and 15–30 day buckets use unrelated chip styles within the same panel.**
- [x] **H-009 — The section exposes too many peer actions per offer (`View`, `Decode`, `More`, `Compare`, `Archive`, `Mark skipped`, `Ask`).** Primary actions are now View and More; Decode, Compare, Archive, Mark skipped, and Ask remain inside the expanded overflow.
- [x] **H-010 — The command center nests action tiles/chips within a large themed panel.** The command center now sits inside a standard themed section surface instead of its own visual island.
- [x] **H-011 — Expiration state is visually dominant beyond its importance.** Reduced the command-center hierarchy and moved secondary work into progressive disclosure.
- [ ] **H-012 — Alert rows do not follow the canonical severity-icon/title/time/two-line-summary/action format.**

### Offer search and filtering

- [x] **H-013 — Search and filter controls do not reuse the same component family as Settings Search & Actions.** Offers continues using `EasySeasSearchField`, `FilterButton`, and compact filter action rows.
- [x] **H-014 — The filter sheet uses warm `#FFFCF7` surfaces and `#B9C9C8` borders instead of canonical surface/border tokens.** Replaced the Offers filter sheet's warm surface/border tokens with canonical white/canvas/border values.
- [x] **H-015 — Active filters and main controls use different pill geometries.** Offers quick filters and sheet choices now use the canonical 10 px control radius; active chips remain pill-only for removable tokens.
- [x] **H-016 — Filter labels, choices, inputs, and footer buttons use locally defined typography rather than canonical control roles.** Filter controls now follow the same compact control hierarchy used by the shared search/actions pattern.
- [x] **H-017 — Filter button active-count treatment is not guaranteed to match Explore, Calendar, Casino, and My Voyages.** Offers retains the shared `FilterButton` active-count treatment and no longer overrides the detail-filter entry point.

### Active offers and offer cards

- [ ] **H-018 — Only one canonical themed section heading is used across a page with many visible sections.** Other areas use bespoke headers.
- [x] **H-019 — Shared offer cards use a marble gradient, contradicting neutral white surface cards.** Removed the marble gradient from shared `OfferCard`.
- [x] **H-020 — Offer cards can use full offer names as uppercase status badges, producing unstable badge scale and scan order.** Shared `OfferCard` now uses concise semantic status text.
- [ ] **H-021 — Offer-card value presentation contains estimated fallback styling without a consistent Estimated badge/source row.**
- [ ] **H-022 — Offer imagery, title, code, value, expiry, cabin, guests, and eligible-sailing count do not follow one documented card grid shared with offer details.**
- [x] **H-023 — Pagination helper copy is too prominent and verbose for list continuation.** The pagination control remains only when there are more offers to reveal.
- [x] **H-024 — “All matching offers are visible” adds unnecessary terminal content instead of quietly ending the list.** Removed the terminal completion card.

### Casino & Certificates

- [x] **H-025 — Casino & Certificates is not implemented with the same standard section card/header used by other Home sections.** Wrapped Casino & Certificates in the same themed section-card family used by Home support sections.
- [ ] **H-026 — Certificate, casino, and offer metrics need one consistent Metric layout and semantic badge vocabulary.**
- [ ] **H-027 — Links into certificate screens lead to pages that use a separate visual system, breaking continuity from Home.**

### Recent activity

- [ ] **H-028 — Recent activity uses custom statistic coloring and evidence text hierarchy rather than the standard activity-row pattern.**
- [ ] **H-029 — Win/loss coloring competes with row title and status.** Financial red/green should be limited to the value itself.
- [ ] **H-030 — “View all casino activity” is styled as a custom action rather than the standard section action/chevron.**

### Agent SEA and Learn the system

- [x] **H-031 — Agent SEA and Learn the system each consume a full section treatment for a single navigation link.** Collapsed both utilities into one compact Helpful tools section.
- [x] **H-032 — Agent SEA explanatory copy is long for the Home scan path.** Replaced long explanatory copy with “Ask your data or open the guide.”
- [x] **H-033 — The two utility sections do not use a common navigation-row pattern.** Agent SEA and Learn now use the same compact navigation-row pattern with chevrons.

## C. Tab 2 — Explore

### Identity and discovery header

- [x] **E-001 — The photographic identity band is still too tall for a search-first utility screen.** Fixed in `app/(tabs)/scheduling.tsx`: Explore now uses the dense tab identity band so search/filter controls appear higher.
- [x] **E-002 — The identity band reports catalog/readback counts in a promotional hero pill, mixing system diagnostics with user-facing discovery.** Fixed in `app/(tabs)/scheduling.tsx`: removed loaded/indexed/catalog diagnostic detail from the visible identity band.
- [x] **E-003 — “Find your next cruise” repeats the purpose already communicated by the identity band.** Fixed in `app/(tabs)/scheduling.tsx`: renamed the control section to “Search and filters” with a functional subtitle.

### Search, sorting, and filters

- [x] **E-004 — Search, Soonest, Latest, Value, Ask Agent SEA, active filters, and Filters form an overly tall multi-row control area.** Partially compressed without changing behavior: sort chips are smaller and the custom filter toggle was replaced by the shared compact `FilterButton`.
- [x] **E-005 — Sort controls look like filters but behave as mutually exclusive sorting.** Fixed in `app/(tabs)/scheduling.tsx`: sort actions now use compact icon-labeled chips with the canonical active teal treatment.
- [x] **E-006 — Filter sheet contains multiple bespoke chip groups instead of one reusable selectable-list/chip style.** Fixed foundation pass in `app/(tabs)/scheduling.tsx`: sheet chips now use the same white, small-radius, soft-border grammar as the other filter controls.
- [ ] **E-007 — Date inputs expose raw `YYYY-MM-DD` text fields rather than native date selection.** This is visually and ergonomically inconsistent with iOS.
- [ ] **E-008 — Nights are entered in raw paired text inputs, unlike other compact filters.**
- [x] **E-009 — The long technical filter-help paragraph adds visual noise and belongs behind an info disclosure.** Fixed in `app/(tabs)/scheduling.tsx`: moved the search/data-truth explanation behind a compact disclosure row.
- [ ] **E-010 — Missing-provider messages are repeated inside the filter sheet instead of using one subdued empty-state pattern.**
- [x] **E-011 — Filter controls use 31 unique colors and 14 radius values within the screen.** Reduced in `app/(tabs)/scheduling.tsx`: removed the bespoke filter-toggle style and normalized sort/sheet control colors and radii to the shared nautical filter palette.
- [ ] **E-012 — Agent SEA is embedded as a separate inline strip rather than a consistent page action.**

### Results and cruise cards

- [ ] **E-013 — Results header and result-count hierarchy are not standardized with Home offer results.**
- [ ] **E-014 — Cruise cards must be checked against the canonical field order: ship, itinerary, dates, embarkation port, nights, guests, price/value, status, chevron.** The shared component supports many variants and optional layouts.
- [x] **E-015 — Available-status badge uses gold, which reads as loyalty/tier status rather than availability.** Fixed in `components/CruiseCard.tsx`: available/booked/active/completed badges now use semantic status colors rather than loyalty gold.
- [ ] **E-016 — Cruise cards may show modeled operational/casino data alongside provider facts without a consistent Estimated source badge.**
- [x] **E-017 — “Load next 75 cruises” and end-of-catalog diagnostic copy are visually heavier than a standard long-list footer.** Fixed in `app/(tabs)/scheduling.tsx`: footer now uses compact “Show more sailings” copy and a light end-state card.
- [x] **E-018 — The end-of-catalog message exposes indexing/readback implementation detail to users.** Fixed in `app/(tabs)/scheduling.tsx`: removed indexed/readback implementation copy from the customer-facing footer.

### Back-to-back mode

- [x] **E-019 — Back-to-back cards use uppercase numbered badges and a distinct visual grammar.** Fixed in `app/(tabs)/scheduling.tsx`: replaced the uppercase numbered label with a compact semantic back-to-back badge and softened the timeline styling.
- [x] **E-020 — “All Available Offer Codes in this Set” surfaces internal codes in the primary scan path, contrary to the design standard.** Fixed in `app/(tabs)/scheduling.tsx`: removed the primary footer offer-code tag block; offer choices remain attached to the sailing rows.
- [x] **E-021 — Back-to-back set cards do not reuse the same cruise-row component for each sailing.** Verified in `app/(tabs)/scheduling.tsx`: each sailing in a back-to-back set renders through the shared `CruiseCard` mini variant.
- [x] **E-022 — “Build Operational Trip Plan” uses specialized product language and styling rather than a standard primary action.** Fixed in `app/(tabs)/scheduling.tsx`: action now reads “Plan this back-to-back trip.”

## D. Tab 3 — My Voyages

### Page header and next voyage

- [ ] **B-001 — My Voyages lacks the canonical tab identity band used by most other tabs.**
- [ ] **B-002 — The next-voyage hero and page-level context are combined into a bespoke large card, creating a different header grammar.**
- [ ] **B-003 — Empty and populated hero states use different information density and hierarchy.**
- [x] **B-004 — The hero summary's Upcoming, Completed, and Season Pts metrics do not use the canonical Metric component.** Fixed in `app/(tabs)/booked.tsx`: the three hero metrics now render through the shared `MetricGrid` primitive.
- [ ] **B-005 — “Today on my cruise” is presented as a special button rather than a clear contextual primary action in the standard page header.**

### Weather

- [x] **B-006 — Weather has a dedicated section heading and can also appear inside voyage content, risking repeated weather identity.** Fixed in `app/(tabs)/booked.tsx`: removed the duplicate outer Weather heading and kept the single functional `VoyageWeatherSection`.
- [x] **B-007 — The Weather subtitle combines alerts, route conditions, itinerary map, and offline outlook—too many concepts for one concise section.** Fixed by removing the duplicate wrapper subtitle around the weather component.
- [x] **B-008 — Weather cards must use the standard weather tone only as a small accent, not a full themed panel.** Verified by regression: Booked now hosts the weather component once without an additional full themed wrapper.
- [x] **B-009 — Weather controls and sync actions require one action location; duplicated sync/status rows should be removed in the final visual pass.** Fixed in `app/(tabs)/booked.tsx`: the Booked screen no longer adds a second wrapper action/status area above weather.

### Casino opportunity

- [x] **B-010 — Casino opportunity uses a separate theme object with dynamic text colors, diverging from the neutral section-card standard.** Reduced in `app/(tabs)/booked.tsx`: the top casino scan metrics now use the shared neutral `MetricGrid` instead of separate dynamic mini cards.
- [ ] **B-011 — Casino progress narrative, financial metrics, averages, evidence, and contributing cruise rows create multiple nested hierarchy levels.**
- [ ] **B-012 — “Value and evidence” and “Cruise rows attributed” are custom disclosure styles rather than one standard disclosure-row pattern.**
- [x] **B-013 — Cash Result, Current Season, Retail Value, Amount Paid, Total Economic Value, status, and averages are not presented through one canonical metric grid.** First-scan fix complete in `app/(tabs)/booked.tsx`: coin-in, cash result, and current-season values render through the canonical `MetricGrid`; deeper evidence rows remain in the disclosure for later compaction.
- [ ] **B-014 — Tier color should be limited to the progress fill/badge; the surrounding card should remain neutral.**

### Favorite staterooms

- [ ] **B-015 — Favorite staterooms must use the same compact section/card pattern as other saved lists.**
- [ ] **B-016 — Empty state must have only one Add action, not duplicated add controls.**
- [ ] **B-017 — Stateroom rows need consistent cabin type, ship, deck/number, notes, and chevron order.**

### Consecutive voyage blocks

- [ ] **B-018 — Consecutive blocks need canonical cruise cards inside a scrollable container rather than bespoke mini-blocks.**
- [ ] **B-019 — Back-to-back status should be a small badge; it should not change the entire card theme.**
- [ ] **B-020 — The section needs one heading only; explanatory copy belongs in the heading subtitle, not a second title inside content.**

### My cruise list and views

- [x] **B-021 — List, Timeline, and C&A Pts controls use a custom view-mode style instead of the canonical segmented control.** Fixed in `app/(tabs)/booked.tsx`: Booked now uses the shared `SegmentedControl` for view switching.
- [ ] **B-022 — Add Cruise competes visually with filtering/view controls rather than occupying the page primary-action position.**
- [ ] **B-023 — Timeline uses a bespoke card grammar and duplicates Upcoming/Completed grouping already present elsewhere.**
- [ ] **B-024 — Timeline and list cruise rows must share the same field order and status treatment.**
- [ ] **B-025 — Completed-cruise points presentation uses a special green `+points` treatment without the standard source/state row.**
- [ ] **B-026 — Large annual Cruise Economics table is not phone-native and conflicts with the one-column design rule.**
- [ ] **B-027 — Cruise Economics uses dense spreadsheet-style headers and horizontal data rather than drill-down metrics/cards.**
- [ ] **B-028 — Annual summaries, KPIs, best/worst snapshots, and portfolio sections contain multiple competing card-title styles.**

## E. Tab 4 — Calendar

### Identity and calendar controls

- [x] **C-001 — The identity band consumes too much space above the actual calendar.** The month grid should remain the dominant first content.
- [ ] **C-002 — Page identity and monthly calendar heading can duplicate the same purpose.**
- [x] **C-003 — Month/events/range controls must use the canonical segmented control; local calendar view styles remain present.**
- [x] **C-004 — Calendar filters do not share the exact same visual pattern as Explore/Home/Settings.**
- [ ] **C-005 — Calendar uses 28 unique hard-coded colors and nine radius values.**

### Month grid and event display

- [ ] **C-006 — Cruise, travel, and personal event dots use arbitrary category colors outside the supplied semantic palette.**
- [ ] **C-007 — Event colors can become full cell emphasis (`${eventColor}40`) rather than small semantic indicators.**
- [ ] **C-008 — Month cells, event dots, selection state, today state, and range state need one documented hierarchy.**
- [ ] **C-009 — Dense month cells require Dynamic Type verification to avoid clipped dates/dots.**
- [ ] **C-010 — Event rows need the standard title/time-location/two-line-summary/action format.**

### Voyage timeline and crew recognition

- [ ] **C-011 — Timeline and crew sections must remain below the calendar in every view and must not compete with month navigation.**
- [ ] **C-012 — Voyage timeline must reuse canonical cruise rows rather than a calendar-specific cruise representation.**
- [ ] **C-013 — Crew recognition needs the same neutral surface, section heading, and row spacing as the rest of Calendar.**
- [ ] **C-014 — Crew avatars/icons, recognition badges, and status colors need to follow the shared icon/badge grammar.**

### Day Agenda linked screen

- [ ] **C-015 — Day Agenda is a 2,550-line standalone screen with 34 hard-coded colors and nine radius values, indicating incomplete migration.**
- [ ] **C-016 — Day Agenda identity band plus six themed section headers can create excessive repeated framing.**
- [ ] **C-017 — Weather must appear exactly once in Day Agenda.** Any additional weather summary, alert, or sync block must be consolidated into that section.
- [ ] **C-018 — Personal EventKit events and Easy Seas events need one row grammar with a small source badge, not two separate visual systems.**
- [ ] **C-019 — Agenda chronology must be the dominant scan path; secondary intelligence cards must not interrupt time order.**
- [ ] **C-020 — The visible itinerary map needs the same 14 px surface boundary and concise section heading as other agenda content.**
- [ ] **C-021 — Empty/loading/permission-denied calendar states must use one canonical empty-state pattern.**
- [ ] **C-022 — “Today's Priorities” must be styled as a compact actionable list, not another large dashboard.**

## F. Tab 5 — Casino (including Slots)

### Casino shell and subnavigation

- [ ] **K-001 — Casino is the largest top-level file (4,809 lines) and contains 49 unique colors and 15 radius values.** It is the clearest remaining example of multiple generations of UI in one screen.
- [ ] **K-002 — Casino has a canonical identity band but no canonical `ThemedSectionHeader` usage in its main body.**
- [ ] **K-003 — Casino subviews use local tab-button styling rather than the shared segmented control.**
- [ ] **K-004 — Slots is rendered as a text tab inside Casino while also retaining a hidden bottom-tab route, creating two navigation grammars.**
- [ ] **K-005 — Casino subnavigation needs one stable order, equal touch targets, seafoam selected state, and horizontal overflow behavior.**

### Overview and loyalty/status

- [ ] **K-006 — Casino metric panels use several local card styles (`cleanCard`, analytics cards, colored badges, dark panels).**
- [ ] **K-007 — Loyalty/status progress does not reuse the exact same progress-bar component and history-to-current narrative as the main loyalty presentation.**
- [ ] **K-008 — Club Royale tier color must be restricted to badge/fill accents, not full cards or large backgrounds.**
- [ ] **K-009 — Metric labels and values use local typography rather than the canonical Metric role.**
- [ ] **K-010 — Alerts banner uses translucent custom navy rather than the canonical alert component.**

### Historical performance and economics

- [ ] **K-011 — Cruise Portfolio, Historical Annual Casino Summary, points breakdown, destination charts, and session summaries all use different heading styles.**
- [ ] **K-012 — Chart legends introduce gold and bright blue as arbitrary series colors; series colors need an accessible documented palette.**
- [ ] **K-013 — Positive/negative financial color is used in many places without consistent label/source context.**
- [ ] **K-014 — The wide Cruise Economics table is not appropriate for the dominant phone column.**
- [ ] **K-015 — Annual averages, KPI summary, and best/worst snapshots should be progressive disclosures under one section, not peer visual blocks.**
- [ ] **K-016 — “Historical Points Breakdown by Cruise” title and legend are too verbose for the initial scan.**

### Sessions and alerts

- [ ] **K-017 — Session Summary uses a custom multi-metric layout inconsistent with other app metrics.**
- [ ] **K-018 — Recent Sessions combines a section title and “Sorted by…” text as a competing second heading.**
- [ ] **K-019 — Pattern Recognition & Alerts and Calculate Past Sessions use separate alert/action treatments.**
- [ ] **K-020 — Performance-entry modal controls and inputs need the shared field, badge, and button styles.**

### Calculation lab

- [ ] **K-021 — Calculation Lab has a unique header/icon/card language rather than inheriting Casino's standard section language.**
- [ ] **K-022 — Calculation insight cards use arbitrary per-calculation colors and tinted icon containers.**
- [ ] **K-023 — Technical explanations should use progressive disclosure and canonical evidence typography.**

### Ship intelligence and Slots

- [ ] **K-024 — Ship intelligence is a stack of repeated “Open…” buttons inside one generic card instead of clear navigation rows grouped by purpose.**
- [ ] **K-025 — Machine reports, onboard mode, value scenarios, and ship performance need consistent destination rows and concise subtitles.**
- [ ] **K-026 — Slots main screen has 15 unique colors, 12 font-size variants, and seven radii despite using the identity/section components.**
- [ ] **K-027 — Slots/machine cards need the same neutral surface, status badge, metric, and chevron patterns as the rest of the app.**
- [ ] **K-028 — Machine condition, opportunity, strategy, and play-session colors need semantic definitions rather than feature-specific palettes.**
- [ ] **K-029 — Machine detail and edit screens must inherit Casino/Slots identity rather than appear as unrelated forms.**

## G. Tab 6 — Settings

### Identity and Data Overview

- [ ] **S-001 — Settings is the largest screen overall (5,861 lines), with 66 unique colors and 16 radius values.** It is not governed by one visual system internally.
- [ ] **S-002 — The identity band plus Data Overview consumes excessive vertical space before the most-used actions.**
- [ ] **S-003 — The identity-band detail pill repeats cruise/booked counts that immediately reappear in Data Overview.**
- [ ] **S-004 — Data Overview uses a dense grid of many equal-weight metrics rather than a compact overview with drill-down.**
- [ ] **S-005 — Brand availability, booking/completion, offers, events, machines, crew, and recognition are visually flattened into one large block.**
- [ ] **S-006 — Data Overview loading state has a custom title/text layout instead of the canonical loading/operation card.**
- [ ] **S-007 — Metric labels such as “available,” “all brands,” “total,” and “current” are repeated excessively rather than expressed as source/state metadata.**

### Search & Actions

- [ ] **S-008 — Search and action buttons do not consistently show the selected content immediately beneath the controls.**
- [ ] **S-009 — Search empty-state copy is overly instructional and does not use the canonical empty state.**
- [ ] **S-010 — Pinned hints (“Profile, Connections, and Data Import stay visible below”) add interface explanation that should be communicated by layout.**
- [ ] **S-011 — Search, quick actions, pinned controls, settings navigation, and inline rows use several control geometries.**
- [ ] **S-012 — Nine-action compact-grid requirement is not represented by one shared, evenly spaced component.**

### Profile

- [ ] **S-013 — Traveler profile is visually larger than its frequency warrants.** It should be a compact always-visible identity summary with an Edit action.
- [ ] **S-014 — Loyalty data shown in Settings risks duplicating the main loyalty presentation without the same canonical card.**
- [ ] **S-015 — Profile, loyalty, primary/secondary user, and security states need clear subsection boundaries without nested cards.**

### Connections and sync

- [ ] **S-016 — Royal/Celebrity sync, Carnival sync, Gmail sync, cloud sync, and pricing sync use bespoke rows and mixed icon/action patterns.**
- [ ] **S-017 — “Sync Royal / Celebrity Casino” is a long compound label and does not fit the concise action-row pattern.**
- [ ] **S-018 — Gmail preview explanation is too long for the primary row and should be secondary metadata or disclosure.**
- [ ] **S-019 — Sync progress, success, partial success, and failure need one `OperationStatusCard` visual vocabulary.**
- [ ] **S-020 — Pricing summary/history and Get all current pricing are mixed with connection actions instead of a separate concise data-maintenance section.**

### Data Import & Backup

- [ ] **S-021 — Import, calendar feed, full backup, exports, recovery, credentials, and extension/template downloads create a very long mixed-purpose section.**
- [ ] **S-022 — `subsectionLabel`, `subsectionHelper`, rendered setting rows, badges, operation cards, and smart-import cards create several competing hierarchies.**
- [ ] **S-023 — Import/export rows do not all share the same icon, title, subtitle, trailing state/action layout.**
- [ ] **S-024 — Operation failure panels can be oversized and overly verbose; technical details should expand on demand.**
- [ ] **S-025 — Calendar feed Live state, Subscribe, and New URL controls use a unique control vocabulary.**
- [ ] **S-026 — Backup terminology and actions need one clear export/import flow with neutral cards and semantic statuses.**
- [ ] **S-027 — Smart-import review modal uses another set of summary tiles and buttons instead of the common review pattern.**

### Security, administration, and About

- [ ] **S-028 — Security must remain below Connections and Data Import and needs one compact section, not multiple scattered controls.**
- [ ] **S-029 — Admin tools are still structurally present in Settings despite the product requirement to move admin-only functions into the `+` workspace.**
- [ ] **S-030 — SeaPass Generator and Launch BookDrop remain within Settings source and can visually expose admin-only product functions.**
- [ ] **S-031 — Purple extension styling (`#5a2ea6`) introduces an arbitrary feature color.**
- [ ] **S-032 — SeaPass download uses Apple blue (`#0070C9`) as a local primary color rather than brand navy/teal.**
- [ ] **S-033 — Scott Astin book promotion interrupts functional settings and violates the supplied brand/product separation.**
- [ ] **S-034 — Download QR/App Store promotion belongs in About, not the primary Settings scan path.**
- [ ] **S-035 — Repeated trademark presentation remains in the footer instead of one legal statement in About & Legal.**
- [ ] **S-036 — Legal disclaimer styling should be isolated in About & Legal rather than extending the main settings page.**

## H. Tab 7 — Plus / Quick Actions

- [ ] **Q-001 — Quick Actions is implemented as a full navigated tab page rather than a lightweight action menu/sheet.**
- [x] **Q-002 — The Plus tab has no visible label while the other six tabs do, producing an inconsistent bottom-navigation rhythm.** The seventh tab now has a visible `+` label.
- [x] **Q-003 — A full identity band is excessive for a transient command launcher.** Removed the full identity band from Quick Actions and replaced it with a compact header.
- [x] **Q-004 — “Quick Actions” and “Instant commands” repeat the same concept as page and section titles.** The section now uses “Common tasks.”
- [x] **Q-005 — The subtitle “without duplicating its full workspace” exposes implementation language to users.** Replaced implementation copy with user-facing task language.
- [x] **Q-006 — Instant commands should prioritize Load Receipt and Enter Totals for a Booked/Current Cruise in a compact list.** Receipt and totals actions remain first and now receive compact priority row treatment.
- [ ] **Q-007 — Admin use only should be collapsed/locked by default and visually secondary to user actions.**
- [ ] **Q-008 — Admin visibility and authentication state need one small badge/lock treatment, not a peer section competing with common tasks.**
- [ ] **Q-009 — The current full-page implementation breaks the expectation that tapping Plus reveals a quick menu without losing context.**

## I. Principal linked/detail screens

### Offer Details

- [ ] **D-001 — Offer Details has 68 unique hard-coded colors, the highest palette fragmentation of any principal detail screen.**
- [ ] **D-002 — It does not use `TabIdentityBand` or `ThemedSectionHeader`, so it visually disconnects from Home.**
- [ ] **D-003 — The screen uses many tinted sections (`green`, `blue`, `purple`, `gold`, warning, success) rather than neutral surfaces with semantic badges.**
- [ ] **D-004 — Offer summary, value, eligibility, certificate, dates, and sailing lists use multiple bespoke card treatments.**
- [ ] **D-005 — Eligible cruise cards must use the exact same canonical cruise-row component and field order as Explore and My Voyages.**
- [ ] **D-006 — Internal offer codes and evidence/provenance should be in Details disclosure, not the primary scan line.**
- [ ] **D-007 — Long sailing lists need the standard pinned search/filter bar and scrollable/paginated results.**
- [ ] **D-008 — Empty, loading, and error states must use the global patterns.**

### Cruise Details

- [ ] **D-009 — The actual cruise-detail implementation under `(overview)` is nearly 5,000 lines and contains many legacy colors and card systems.**
- [ ] **D-010 — Detail background uses warm beige rather than canonical canvas.**
- [ ] **D-011 — Itinerary, cabin, guests, value, invoice, casino, weather, readiness, and evidence sections do not all use one section-header/card grammar.**
- [ ] **D-012 — Repeated blue, green, and amber full-card backgrounds violate semantic-color restraint.**
- [ ] **D-013 — Dense data and nested cards make the screen substantially longer and less scannable than the supplied booked-voyage mockup.**
- [ ] **D-014 — Invoice PDF ingestion and manual totals entry need one compact, standard action row within Voyage Value.**
- [ ] **D-015 — Missing data states must use one Missing badge and one clear action rather than differently styled warnings per field.**
- [ ] **D-016 — Weather must not be repeated on the detail screen if the product rule limits it to My Voyages and Day Agenda.**
- [ ] **D-017 — Back navigation/title/action placement must match all other detail screens.**

### Certificates

- [ ] **D-018 — Certificate Codes has 42 colors, 15 font-size variants, and 10 radii in only 806 lines.**
- [ ] **D-019 — It uses `#F3F3F2`/`#F6F2EA` page backgrounds instead of canonical canvas.**
- [ ] **D-020 — It does not use the canonical identity band or themed section headers.**
- [ ] **D-021 — Month buttons, segment buttons, certificate summary, class chips, ledger warnings, download states, and code cards each use different surface/control styles.**
- [ ] **D-022 — Main code cards have a 224 pt minimum height, which is oversized for repeated certificate rows.**
- [ ] **D-023 — Certificate summary metrics use a dense four-column 23.5% layout that risks clipping and does not follow the standard Metric component.**
- [ ] **D-024 — Warning/success/error fills use several noncanonical hex values.**
- [ ] **D-025 — Chat header inside Certificates introduces another header grammar.**

### Data Trust Center

- [ ] **D-026 — Data Trust Center does not use the canonical identity or section-heading components.**
- [ ] **D-027 — Error/warning counts and downloadable issue lists need the same Metric and Alert patterns used elsewhere.**
- [ ] **D-028 — Hundreds of issues must be summarized progressively; a flat diagnostic list should not dominate the phone view.**
- [ ] **D-029 — Export actions must sit in the standard page primary-action/overflow locations.**
- [ ] **D-030 — Health severity colors must use only canonical danger/warning/info/success tokens.**

### Ask My Data / Agent SEA

- [ ] **D-031 — Ask My Data has 24 unique hard-coded colors and no canonical identity/section header.**
- [ ] **D-032 — Conversation, suggested prompts, evidence cards, errors, and composer use a chat-specific theme disconnected from Easy Seas.**
- [ ] **D-033 — Suggested questions need compact, consistent action chips using the global control style.**
- [ ] **D-034 — Answer evidence/provenance needs standard disclosure typography and neutral surfaces.**
- [ ] **D-035 — Loading, no-answer, ambiguity, and error states need the canonical status/empty-state patterns.**

### Gmail Import and data operations

- [ ] **D-036 — Gmail Import must inherit Settings visual identity and operation-status components.**
- [ ] **D-037 — Google authorization, token paste, connection testing, Gmail scan, ZIP upload, preview, dedupe, and apply steps need one explicit stepper/progress pattern.**
- [ ] **D-038 — Technical token instructions should be progressively disclosed instead of dominating the main path.**
- [ ] **D-039 — Preview rows must use the same Add/Update/Cancel/Review badges as all other imports.**
- [ ] **D-040 — Completion/error states must match Data Import & Backup operation cards.**

### Admin and auxiliary screens

- [ ] **D-041 — SeaPass Generator, BookDrop, capability audit, formula reference, exports, and admin tools require a consistent admin shell and visible Admin badge.**
- [ ] **D-042 — Admin screens must not inherit consumer promotional heroes or expose private functions to ordinary users.**
- [ ] **D-043 — Machine detail/edit, host CRM, value scenarios, invoice import, and other Casino utilities need the Casino/Slots parent identity and common page header.**
- [ ] **D-044 — Utility forms need the shared field, validation, action, and operation-status components.**
- [ ] **D-045 — Modal/sheet corner radii, dimming overlays, headers, Close/Cancel actions, and destructive actions require one system-wide modal standard.**

## J. September 5 recording — visually confirmed deficiencies

Recording reviewed: `ScreenRecording_09-05-2026 16.MP4` (50 seconds, 1320 × 2868, 60 fps). Frames were sampled every two seconds, with additional source comparison for the visible sections.

### Launch, legal, and authentication

- [ ] **V-001 — Launch screen uses the retired tropical illustrated banner as application chrome.** The supplied design standard explicitly limits this artwork to onboarding or About.
- [ ] **V-002 — The Scott Astin script signature is prominent on the launch artwork.** Personal identity must not be part of functional product branding.
- [ ] **V-003 — `EASY SEAS™` and `Manage your Nautical Lifestyle` are presented as oversized launch typography instead of the single canonical Easy Seas mark and wordmark.**
- [ ] **V-004 — The disclaimer is an extremely dense full card on the first screen.** It is hard to scan, uses very small body copy, and overwhelms the primary Continue action.
- [ ] **V-005 — Trademark/legal copy is repeated on the launch screen instead of being confined to About & Legal.**
- [ ] **V-006 — Welcome-back authentication repeats the retired tropical/logo/signature artwork.**
- [ ] **V-007 — The authentication page mixes a marketing card, an uppercase privacy eyebrow, a serif title, system-form copy, and a large spinner button without one coherent page-header pattern.**
- [ ] **V-008 — “About, legal & responsible play” sits as an isolated text link rather than a standard navigation row.**

### Home

- [ ] **V-009 — A narrow tropical brand banner remains at the top of Home, visually disconnected from the rest of the pale editorial page.**
- [ ] **V-010 — `SCOTT MERLIS` becomes the dominant page title.** The design standard says personal identity belongs in Account/Profile, not the functional brand header.
- [ ] **V-011 — Notification, sign-out, and settings icons float beside the personal title without the canonical one-primary-action/overflow hierarchy.**
- [ ] **V-012 — The loyalty card is visually polished but oversized and still contains many simultaneous hierarchy levels: brand tabs, two tier pills, retention line, crest, two progress areas, three metrics, and page-level actions.**
- [ ] **V-013 — Loyalty card tier accents occupy substantial colored fills and bars; they need tighter restraint and clearer neutral containment.**
- [ ] **V-014 — “Your offer portfolio” has a second decorative sparkle icon with no obvious meaning or action.**
- [ ] **V-015 — Portfolio metrics, sort buttons, expiration command center, search, time filters, profile filters, brand filters, and program filters create a long stack before the offer list.**
- [ ] **V-016 — Filters are visibly clipped/truncated (`Househ…`, `Compani…`, `Unassig…`, `Royal C…`) instead of reflowing or using a filter sheet.**
- [ ] **V-017 — Small filter labels use emoji/icon prefixes inconsistently and lack one aligned grid.**
- [ ] **V-018 — The selected-state treatments differ among sort pills, range chips, profile chips, brand chips, and program chips.**
- [ ] **V-019 — “What needs attention,” “Filter offers,” “Offer details,” and “Active offers” all introduce large peer headings, making the page feel segmented rather than seamless.**
- [ ] **V-020 — Command-center offer actions visibly wrap (`Decode` breaks onto two lines) and use mismatched purple/navy/outline styles.**
- [ ] **V-021 — Active-offer cards are too tall and visually dense, with image, badge, points, guests, stateroom narrative, value range, source row, expiry row, details disclosure, score, and two actions.**
- [ ] **V-022 — Offer images are not consistently photorealistic travel imagery; the recording shows a casino-chip collage mixed with coastline photography.**
- [ ] **V-023 — Offer card typography uses too many sizes, weights, colors, and uppercase labels within one surface.**
- [ ] **V-024 — Casino & Certificates uses a four-column metric block whose labels and values are too small relative to the card size.**
- [ ] **V-025 — Recent activity uses sparse oversized rows with custom evidence lines and financial color, rather than compact consistent activity rows.**
- [ ] **V-026 — Agent SEA and Learn the system consume large separate cards even though each contains only one action.**

### Explore

- [ ] **V-027 — The photographic Explore header is attractive but takes nearly half the initial screen before discovery controls.**
- [ ] **V-028 — “Explore” and “Find your next cruise” repeat the page's purpose in adjacent large headings.**
- [ ] **V-029 — Catalog diagnostics (`437 in catalog · 433 matches · 3 loaded`) are exposed in the hero and again near results.**
- [ ] **V-030 — Brand chips, availability chips, Clear, Alerts, result counts, sort pills, Filters, and Ask Agent SEA create a crowded multi-row toolbar.**
- [ ] **V-031 — Clear and Alerts look like filter choices even though they are actions/statuses.**
- [ ] **V-032 — All-cruise cards display itinerary titles in heavy uppercase while booked cards use title case.**
- [ ] **V-033 — The Celebrity Reflection row visibly reports `0-night`, demonstrating that zero/missing facts are rendered as primary card content instead of a Missing/Needs review state.**
- [ ] **V-034 — Available cruise cards use small yellow availability badges inconsistent with the unified semantic badge design.**
- [ ] **V-035 — Ship/destination photography is repeated or mismatched across cards; multiple Royal ships share a generic wave image and multiple results share the same terminal image.**
- [ ] **V-036 — Cruise card metadata is cramped into several small lines, while “Voyage details” receives an oversized separate footer.**
- [ ] **V-037 — “Load next 75 cruises” and “Back to cruise discovery” consume two full-width footer rows instead of one compact continuation control.**

### My Voyages

- [ ] **V-038 — The next-voyage card is visually unrelated to the Explore cruise cards and the booked cards below it.**
- [ ] **V-039 — The dark photographic hero and teal `Today on my cruise` button introduce a separate visual system inside an otherwise pale page.**
- [ ] **V-040 — Weather and Casino opportunity immediately follow the hero as large white dashboard cards, creating excessive vertical depth before My cruises.**
- [ ] **V-041 — Casino opportunity uses tiny multi-column values, a special Signature badge, progress narrative, and multiple disclosure areas inside one large card.**
- [ ] **V-042 — Profile and Brand filters repeat the same clipped chip problem seen on Home.**
- [ ] **V-043 — List/Timeline/C&A Pts uses purple selected styling that does not match the teal segmented control used elsewhere.**
- [ ] **V-044 — `+ Add Cruise` is purple and floats as a peer to filtering, conflicting with the unified navy/teal action hierarchy.**
- [ ] **V-045 — Search, status filters, Map, Refresh, Unassign only, Clear, and Sort form another unique toolbar unlike Home or Explore.**
- [ ] **V-046 — Booked cards use inconsistent hero photos, including generic waves and decorative lights rather than ship/destination-specific imagery.**
- [ ] **V-047 — Booked badges use saturated purple blocks and include Pinnacle on the same visual level as booking status.**
- [ ] **V-048 — Schedule-conflict warnings occupy large yellow inset rows and interrupt the card's information order.**
- [ ] **V-049 — Booked card fact order and typography do not match Explore cards.**
- [ ] **V-050 — “Voyage details” appears as a repeated full-width footer on every booked card rather than a consistent chevron row.**

### Calendar and agenda

- [ ] **V-051 — The Calendar photographic identity card is too tall relative to the month grid and pushes the primary task downward.**
- [ ] **V-052 — Profile and Brand filters reappear above the calendar and use clipped/truncated chip labels.**
- [ ] **V-053 — “Plan your days” repeats the purpose of the page-level Calendar identity.**
- [ ] **V-054 — Agenda/Week/Month/90 Days/Passenger is a six-choice text strip with undersized targets and an inconsistent selected state.**
- [ ] **V-055 — Month header contains several tiny icon buttons with unclear meanings and inconsistent containers.**
- [ ] **V-056 — The month grid is visually compressed beneath two headers and two filter systems.**
- [ ] **V-057 — Voyage timeline and Crew recognition are styled as plain navigation cards, while Next up becomes a different event-card system.**
- [ ] **V-058 — Next-up event rows use thin colored rails and category labels that do not match other alert/activity rows.**
- [ ] **V-059 — Time zones is a dark navy full-card treatment that abruptly breaks the pale Calendar visual language.**
- [ ] **V-060 — The recording does not show the required single weather section or visible itinerary map on Day Agenda; these remain unverified rather than accepted.**

### Casino and Slots

- [ ] **V-061 — Casino starts with `Scott Astin` and a thumbnail as the primary identity, contrary to removing personal identity from functional headers.**
- [ ] **V-062 — Club Royale / Blue Chip / Ask SEA controls and Overview/Cruises/Play/Analytics/Calculator/Slots controls form two stacked, visually different tab systems.**
- [ ] **V-063 — Casino includes a large photographic Club Royale panel that behaves like a third header beneath the personal header and navigation.**
- [ ] **V-064 — “Casino truth at a glance” uses sparse metrics with status words (`INFO`, `SUCCESS`, `ESTIMATED`) in a local format not shared elsewhere.**
- [ ] **V-065 — Evidence coverage is presented as 22% while surrounding metrics appear authoritative; confidence/status hierarchy is visually unclear.**
- [ ] **V-066 — Casino metric cards use colored top borders and per-metric accent colors, recreating the rainbow metric-card problem prohibited by the design system.**
- [ ] **V-067 — Many metric labels and evidence links are too small and dense for comfortable iPhone scanning.**
- [ ] **V-068 — `ESTIMATED`, `DERIVED`, `MISSING`, `INFO`, `WARNING`, `RECONCILE`, and `SUCCESS` use inconsistent colors, placement, and meaning.**
- [ ] **V-069 — Host-ready annual evidence and Points reconciliation use separate card structures rather than the shared Metric/disclosure pattern.**
- [ ] **V-070 — The Add/reconcile action is a green full-width button, introducing another primary-action color.**
- [ ] **V-071 — Crown & Anchor and Club Royale progress areas shown later in Casino use purple/gold local styling rather than the canonical loyalty card/progress component.**
- [ ] **V-072 — Slots is visible only as a subtab label in the recording; its actual machine screen was not opened and remains visually unverified.**

### Settings

- [ ] **V-073 — Settings Data Overview is visibly a very large grid with numerous tiny metrics; it remains unbalanced and consumes too much page space.**
- [ ] **V-074 — Search & Actions uses a colorful 3×3 button grid whose controls are too small and visually unrelated to the neutral search field.**
- [ ] **V-075 — Button labels such as Security, Alerts, Integrations, Appearance, Help, Books & legal, Purchases, Data trust, and Danger zone mix user destinations, statuses, commerce, legal, and destructive actions at the same hierarchy.**
- [ ] **V-076 — Purple, orange, teal, blue, and red icons in Search & Actions create a dashboard palette inconsistent with semantic restraint.**
- [ ] **V-077 — Account/profile content below Search & Actions changes to a dark navy/blue card treatment not used by Connections or Security.**
- [ ] **V-078 — Connections is mostly text rows with very little visual differentiation, while its actions carry long explanatory subtitles.**
- [ ] **V-079 — Save/Load JSON rows, certificate export, calendar feed, and backup explanation form a dense wall of similarly weighted text.**
- [ ] **V-080 — Backup explanatory copy is extremely long and includes highlighted inline claims, breaking the scan rhythm.**
- [ ] **V-081 — Security appears as another large section after the long data section; hierarchy and whitespace do not clearly close one workflow before beginning another.**
- [ ] **V-082 — Device Protection uses another status-row vocabulary (`Protected`) instead of the shared status badge.**

### Plus / Quick Actions

- [x] **V-083 — Tapping Plus opens a full page with another large photographic identity band rather than a quick action sheet/menu.** The large photographic identity band was removed from the Plus page.
- [x] **V-084 — “Quick Actions” and “Instant commands” are visibly redundant stacked titles.** The duplicate title stack was reduced to a compact page title plus “Common tasks.”
- [x] **V-085 — “Start a common task without duplicating its full workspace” and “opens the authoritative workflow” expose implementation terminology.** User-facing copy now says what the task does, not how routing is implemented.
- [x] **V-086 — Action rows are text-heavy and closely stacked; Load receipt and Enter cruise totals do not receive clear visual priority.** Rows are more compact and the first two financial actions receive priority sizing.
- [ ] **V-087 — Browse Cruises, Add/import booking, Import/restore data, Open calendar, Add crew, Record casino session, Add machine, certificates, and Agent SEA create a long replacement navigation menu rather than quick commands.**
- [ ] **V-088 — Admin use only is shown as a peer section at the bottom instead of remaining locked/collapsed and visually secondary.**

### Bottom navigation

- [ ] **V-089 — Bottom labels and icons are too small and low-contrast in the recording.**
- [ ] **V-090 — `My Voyages` is visibly compressed relative to the other labels.**
- [x] **V-091 — Plus has no text label while every other position does, creating an uneven seven-item rhythm.** Plus now renders a visible `+` label.
- [ ] **V-092 — Active-tab indicators vary between top bars, icon color, and label color and are not equally legible on every page.**
- [ ] **V-093 — Seven items fit too tightly at the recorded iPhone width; several labels/icons feel crowded even when technically tappable.**

## K. Runtime-only verification still required

The following must be verified on a physical iPhone/TestFlight build because source review alone cannot prove visual behavior:

- [ ] **R-001 — Every primary tab scrolls from top to bottom without clipped sections or overlapping the bottom bar.**
- [ ] **R-002 — Every linked sub-screen preserves parent-tab visual identity and returns to the expected scroll position.**
- [ ] **R-003 — Dynamic Type at Large and Accessibility sizes reflows headings, metrics, filters, and cards without truncation.**
- [ ] **R-004 — Light, dark, and high-contrast modes use readable semantic colors without hard-coded light surfaces leaking through.**
- [ ] **R-005 — All photographs load, crop consistently, and have readable text overlays/fallbacks.**
- [ ] **R-006 — All filters show selected state, active count, applied summaries, and Clear all consistently.**
- [ ] **R-007 — All cruise-card contexts show the same available fields in the same order.**
- [ ] **R-008 — All offer-card contexts show the same fields and badge/source treatment.**
- [ ] **R-009 — Every button has a 44×44 minimum touch target and consistent pressed/disabled/loading feedback.**
- [ ] **R-010 — VoiceOver order follows title, context, metrics, content, then actions without reading decorative imagery.**

## Recommended repair order

1. Correct the canonical tokens and typography roles first.
2. Consolidate page header, section header, card, metric, badge, progress, filter, form, alert, empty, and operation-status components.
3. Normalize the shared `CruiseCard` and `OfferCard`; all list contexts then inherit the same layout.
4. Migrate Home, Explore, My Voyages, Calendar/Day Agenda, Casino/Slots, Settings, and Plus in that order.
5. Migrate principal detail screens by parent tab.
6. Remove legacy theme namespaces and hard-coded styling only after every caller has moved to semantic tokens.
7. Finish with the ten runtime checks above on TestFlight and at least one large Dynamic Type setting.

## Definition of visually complete

The UI should not be called complete until:

- every functional page has one canonical header and no repeated section title;
- every section uses one heading and one neutral surface boundary;
- every search/filter area uses the same component family;
- every cruise and offer card follows one field order;
- every metric, progress bar, badge, alert, form, empty state, and operation state is shared;
- tier colors appear only in tier badges/progress accents;
- no primary screen carries arbitrary local palettes, radii, shadows, or typography;
- all linked screens visibly belong to their parent tab;
- the complete runtime checklist passes on the submitted iOS build.
