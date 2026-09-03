# Easy Seas Build 445 — Evidence-Based Master Todo

This file replaces optimistic completion lists. It is based on:

- the 30-item Build 440 authoritative deficiency list;
- the September 1, 2026 iOS recording `ScreenRecording_09-01-2026 06-20-25_1.MP4`;
- the five failure screenshots `IMG_7513` through `IMG_7517`;
- source and regression inspection in the Build 445 workspace.

Build 444 remains the untouched rollback baseline. A helper, token, source assertion, or passing mock does not close a user-facing task. A task closes only after the consuming iOS workflow works with real or representative data and the rendered result has been inspected.

## Non-negotiable visual acceptance contract

The September 1 premium voyage reference is the standard for every visible section of every tab and every nested screen. “Similar” means the same coherent product language, not merely adding one photograph above an unchanged legacy screen:

- warm white and ocean-white page/card surfaces;
- Source Serif editorial headings with restrained system-font supporting copy;
- deep navy primary text, teal navigation/action accents, and sparing gold emphasis;
- photorealistic ship, ocean, destination, weather, casino, or voyage imagery on story-level sections;
- generous whitespace, consistent radii, light dividers, subtle shadows, and clean metric groupings;
- one readable action hierarchy and one consistent bottom-navigation treatment.

Full green, brown, orange, purple, unrelated gradient, or generic dark legacy sections fail acceptance and must be redesigned. Loyalty/status colors may remain only as bounded semantic accents such as badges, progress marks, icons, or small borders. The seven current tabs, their order, routes, purposes, Easy Seas logo, signature, and functionality remain unchanged.

Status legend:

- `[ ]` not proven complete;
- `[~]` source repair exists, but iOS/device acceptance is still required;
- `[x]` verified anchor only.

## Verified non-negotiable anchors

- [x] Preserve the Easy Seas logo, artwork signature, and disclaimer.
- [x] Preserve exactly seven bottom tabs, their current names, order, routes, and purpose boundaries.
- [x] Preserve Build 444 as the rollback baseline.
- [x] Preserve Source Serif 4 and the approved SeaPass, Crown & Anchor, Club Royale, and Blue Chip color tokens.
- [x] Preserve all existing actions and data while redesigning their consuming screens.

## P0 — Current functional failures

### 1. Royal/Club Royale sync transaction and committed readback

- [x] Serialize cruise-inventory writes with an exclusive native transaction and a test/web fallback.
- [~] Run Royal sync on iOS without `cannot start a transaction within a transaction`. Source/runtime gate passes; authenticated native execution remains queued for Release Acceptance 48 because `simctl` is unavailable on this Mac.
- [x] Prove the success banner appears only after committed readback.
- [x] Prove offers, 3,151 row-distinct eligible sailings for the current fixture, loyalty points/status, and settings counts all read from the same committed generation receipt.
- [x] Prove a Royal refresh replaces only Royal scope and preserves Celebrity and Carnival scope.

Evidence: `tests/build445_item1_royal_committed_generation_runtime.js`, `tests/build444_provider_sync_acceptance_runtime.js`, TypeScript. Provider sync now passes `cruiseInventoryProviders: [syncSource]`, publishes provider and grand-total counts from the post-commit receipt, and records the manifest/generation IDs used by the final banner.

### 2. Completed-cruise casino-history import

- [x] Remove the duplicate booked-cruise persistence call from Apply.
- [~] Import the supplied completed-cruise CSV, review 33 cruise updates, and apply once without collision or freeze. Actual-file runtime and one-apply/readback gates pass; the authenticated native picker tap remains queued for Release Acceptance 48.
- [x] Prove cruise points, win/loss, paid, retail, nights, and annual totals reach Booked and all Casino consumers.
- [x] Prove manual saved values retain precedence over imported fallback history.
- [x] Prove the import is owner-scoped and survives restart, Save All, and Load All.

Evidence: `tests/build445_item2_completed_history_runtime.js`, `tests/build409_owner_scoped_casino_history_regression.js`, `tests/build415_weather_casino_sync_publication_regression.js`, `tests/build411_profile_import_readback_regression.js`, `tests/build444_147mb_backup_acceptance_runtime.js`, TypeScript. Apply now commits once, reloads the owner-scoped booked dataset, rejects incomplete readback before success, and records a diagnostic receipt. Merge identity includes owner; saved/manual alias groups and intentional zeroes take precedence while imported file provenance is retained.

### 3. Cruise detail lookup and navigation

- [x] Add canonical ID, source identity, offer-option identity, reservation identity, and ship/date/code/cabin/guest fallback lookup.
- [~] Open cruise detail from Offers, eligible sailings, Cruises, Booked, certificates, Calendar, and Agent SEA without `Cruise Not Found`. All consuming source/runtime routes pass; authenticated iOS taps remain queued for Release Acceptance 48.
- [x] Preserve the originating offer, filters, sort, and scroll position when returning.
- [x] Keep multiple reservations on one physical voyage distinct.

Evidence: `tests/build445_item3_cruise_detail_navigation_runtime.js`, `tests/build445_sync_import_offer_details_regression.js`, TypeScript. Every listed entry point now uses the same parameter builder; refreshed catalog rows resolve by provider source or offer-option identity; certificate-only rows open an explicitly partial route-evidence detail instead of a false not-found page; ambiguous ship/date evidence never selects a random reservation. Offer Details and Cruises retain their filter/sort/scroll caches across the detail round trip.

### 4. Offer and certificate navigation

- [x] Make offer-card press, View, Decode, command-center View/Decode, Cert Summary, and certificate-row press resolve the same canonical offer/certificate instance.
- [x] Display every attached sailing, not only a count or one representative row. Lists above 20 matches use 20-row virtualized pages with clickable cards and Previous/Next controls; thousands of cards are never rendered as one unbounded page.
- [x] Prevent empty eligible-sailing lists when the displayed count is nonzero.
- [x] Show truthful progress/error/retry states when certificate documents or rows are still loading.

Evidence: `tests/build445_item4_offer_certificate_navigation_runtime.js`, `tests/build444_offer_certificate_acceptance_runtime.js`, `tests/build440_offer_details_filters_regression.js`, `tests/build440_certificate_completion_regression.js`, TypeScript. View and Decode share one canonical marketing-instance key; duplicate codes cannot select an arbitrary offer; eligible rows auto-page from the indexed repository, incomplete readback is visibly retryable, and the displayed count is the exact loaded row count. The 13-offer/3,151-row fixture remains row-distinct, filterable, reachable in 20-card pages, and actionable. Authenticated native tap acceptance remains consolidated under Release Acceptance 48.

### 5. Cruise-card room, itinerary, and casino truth

- [x] Preserve provider day-by-day itinerary and expanded cabin aliases during sync.
- [x] Populate ship, dates, nights, itinerary, departure port, guest entitlement, cabin/stateroom, GTY, and NextCruise bonus from the row that produced the card.
- [x] Derive sea days, port days, embarkation/disembarkation treatment, casino-open hours, golden hours, modeled player hours, and points opportunity from itinerary instead of defaulting to zero.
- [x] Show a clear missing-itinerary state when the provider did not supply enough evidence; never fabricate zero as fact.
- [x] Apply loyalty points correctly: one point per occupant-night in double occupancy, two points per night for a solo occupant, plus one extra point per night in a suite or higher.

Evidence: `tests/build445_item5_cruise_card_truth_runtime.js`, `tests/build444_cruises_booked_acceptance_runtime.js`, `tests/build440_agent_agenda_cruise_ux_regression.ts`, `tests/build440_casino_points_adt_value_regression.js`, TypeScript. Royal API itinerary days now retain provider/verified provenance. Marketing itinerary names are no longer promoted into fabricated day plans. Operational cards show exact port calls separately from embarkation/disembarkation casino treatment, and missing schedules render em dashes plus a corrective message. Crown & Anchor projection shares one occupancy-aware helper and recognizes named or coded suite-or-higher categories.

### 6. Offer-card points, stateroom, guest count, and value

- [x] Prefer explicit point fields, then recognized certificate/code decoding; preserve missing provenance.
- [x] Resolve one cabin type, `Varies by sailing`, or `Not supplied by Royal` without inventing a provider value.
- [x] Compute offer-detail retail ranges using full-room rather than per-person value.
- [x] Show actual one-guest/two-guest entitlement per sailing.
- [x] Show point level, cabin/stateroom, provider price/value, estimated stateroom value, and source consistently on summary and detail cards.
- [x] Distinguish provider value from an estimate visually and in provenance.

Evidence: `tests/build445_item6_offer_display_truth_runtime.js`, `tests/build438_item26_true_offer_value_regression.js`, `tests/build440_offers_premium_hierarchy_regression.js`, `tests/build445_sync_import_offer_details_regression.js`, TypeScript. Cards and details now share one precedence layer: explicit offer fields, then row evidence, then recognized code decoding. Row-level `guests`/`guestsInfo` and cabin values can truthfully report one, two, or `Varies by sailing`. Provider offer value is separate from median full-room stateroom retail; alternative sailings are never summed, and source/evidence labels accompany every displayed fact.

### 7. Counts and stale startup state

- [x] Eliminate startup `0 offers` and contradictory Settings/Offers/Command Center counts.
- [x] Rehydrate persisted shared offers, sailings, and certificate rows before rendering final counts.
- [x] Reconcile raw offer-sailing rows separately from physical voyages without collapsing the user-requested row count.
- [x] Make backup restore replace/update the same repositories the tabs read.

Evidence: `tests/build445_item7_authoritative_startup_counts_runtime.js`, `tests/build425_offer_option_inventory_sync_regression.js`, `tests/build444_147mb_backup_acceptance_runtime.js`, `tests/build445_item1_royal_committed_generation_runtime.js`, TypeScript. Settings now uses the legacy AppState snapshot only while CoreData is hydrating and never merges it back after authoritative readback. Settings, Offers, and Command Center show explicit repository-loading states rather than final-looking zeroes. Account changes clear hook-level count caches before opening the new owner scope. Available option rows remain the user-facing cruise inventory count, while canonical physical departures are measured separately. Load All validates cruise and offer repository counts, refreshes CoreData from that commit, and only then reports success.

## P1 — Global visual system and navigation

### 8. One premium screen anatomy

- [x] Apply one anatomy to every principal and nested screen: compact safe-area header, editorial Source Serif title, optional photorealistic story card, white/ocean-white content cards, consistent section headers, and clear primary/secondary actions.
- [x] Remove the current mixture of dark legacy panels, yellow catalog cards, pale utility forms, and unrelated gradients visible in the recording.
- [x] Use photorealistic art for story-level content only; keep dense facts on highly readable surfaces.
- [x] Retain useful emojis, icons, charts, maps, and contextual section backgrounds.

Evidence: `tests/build445_item8_premium_screen_anatomy_regression.js`, TypeScript, and rendered 430×932 browser inspections of Offers, Cruises, Booked, Calendar, Casino, Slots, Settings, and Day Agenda. The shared loyalty theme now keeps tier colors in bounded badges/progress evidence on neutral Easy Seas surfaces; the Offers logo precedes its story card; `Mode-aware home` was removed from Offers and its function now appears as `Today’s Priorities` on the redesigned light Day Agenda. Specific tab content, canonical cards, lists, maps, and workflows remain individually gated below rather than being falsely closed by this global anatomy pass.

### 9. Typography, spacing, and component hierarchy

- [x] Standardize title, section title, card title, body, caption, metric, badge, and button styles.
- [x] Establish consistent 8-point spacing, card padding, radius, borders, shadow/elevation, and dividers.
- [x] Remove clipped headings, repeated headings, oversized banners, tiny metadata, and crowded badges.
- [x] Keep critical actions and conclusions visible before secondary evidence.

Evidence: `tests/build445_item9_typography_spacing_hierarchy_regression.js`, TypeScript, and rendered 430×932 inspections of Offers and Casino. `EASY_SEAS_TYPE_STYLES` and `EASY_SEAS_COMPONENT_TOKENS` now define the canonical type roles, eight-point grid, surfaces, and minimum controls consumed by the shared page, section, and identity primitives. High-traffic loyalty, filter, offer, and cruise components no longer render metadata below 11 points; the Casino heading reflows without clipping and keeps a compact Agent SEA action.

### 10. Bottom navigation

- [x] Keep all seven tabs readable at iPhone width with clean icons/emojis, labels, selected treatment, safe-area spacing, and 44-point targets.
- [x] Remove tiny or ambiguous tab glyphs and prevent labels from clipping.
- [x] Verify the bar never covers the final list row, composer, or floating action button.

Evidence: `tests/build445_item10_bottom_navigation_safe_area_regression.js`, the retained `tests/build440_bottom_navigation_regression.js`, TypeScript, and a rendered 430×932 Offers inspection. The fixed seven names, routes, and order remain intact; each item has a 56-point target, clean semantic icon, 11-point label, selected teal treatment, device-safe bottom inset, and keyboard hiding. The phone bar now participates in normal layout instead of overlaying tab content, so final rows and floating actions remain above it.

### 11. Standard state language

- [x] Build consistent loading, skeleton, progress, empty, missing, estimated, reconciled, offline, error, partial-success, success, and provenance states.
- [x] Replace false zeros and em dashes with a reason and an available repair/refresh action.
- [x] Keep long operations visible with current item/count, committed/not committed status, cancel, and retry.

Evidence: `tests/build445_item11_standard_state_language_regression.js` and TypeScript. `DataStateCard` now provides the shared loading skeleton, progress, empty, missing, estimated, reconciled, offline, error, partial-success, success, source/freshness, and repair-action language. Offers, Cruises, and Booked use it for repository loading and empty results so an unavailable count is never shown as a confirmed zero. `OperationStatusCard` now distinguishes partial/offline outcomes, current item/count, durable commit state, safe cancel, retry, and undo; Settings, weather, Slots, and the integrity center retain their existing consumers.

### 12. Progressive disclosure

- [x] Begin analytical screens with no more than three useful conclusions.
- [x] Move formulas, source records, reconciliation detail, and long explanations behind expandable evidence.
- [x] Persist user-expanded/collapsed state where appropriate.

Evidence: `tests/build445_item12_progressive_disclosure_regression.js`, TypeScript, and a rendered 430×932 Casino inspection. The shared disclosure hard-limits the lead summary to three conclusions, mounts secondary evidence only when requested, and persists open/closed state by owner, screen, and section. Casino source records, points reconciliation, annual host evidence, cruise-play assumptions, and calculation guardrails are now collapsed behind explicit evidence controls. Data Trust, Certificate Portfolio, Relationship Explorer, and Agent SEA retain their conclusions-first/evidence-on-demand behavior.

### 13. Responsive and accessible rendering

- [x] Verify Dynamic Type reflow, VoiceOver order/labels, 44-point targets, contrast, color-blind-safe charts, reduced motion, keyboard avoidance, and simplified density.
- [x] Fix Signature points and every other overlap/clipping case.
- [x] Verify small phone, large phone, and tablet-width layouts in light, dark, and high-contrast modes.

Evidence: `tests/build445_item13_responsive_accessibility_regression.js` plus the retained Build 440/444 accessibility suites and TypeScript all pass. Progress headers, Signature/Club Royale point totals, tier labels, footers, and compact dashboard statistics now wrap or scale without leaving their cards. Safe-area-aware navigation, 44-point controls, VoiceOver roles/labels, reduced-motion routing/chat behavior, keyboard avoidance, extra-large text, simplified density, high contrast, and color-blind-safe charts are owner-scoped through `ExperienceProvider`. Rendered checks passed at 320×568 and 430×932, and at 834×1112 responsive web width, including light, dark, and high-contrast appearances. The native App Store target remains intentionally iPhone-only (`ios.supportsTablet: false`), so the tablet result is a responsive web-layout check rather than a claim of native iPad support.

### 14. Performance and reachability

- [x] Virtualize or strictly page large offer-sailing, cruise, machine, crew, event, and certificate lists.
- [x] Do not mount every chart, relationship graph, image, or large JSON collection during ordinary navigation.
- [x] Preserve tab responsiveness while repositories hydrate.
- [x] Ensure every section after a long list remains reachable.

Evidence: `tests/build445_item14_performance_reachability_regression.js` and TypeScript pass. Offers, Cruises, Booked, Slots, certificate catalogs, and certificate results use bounded virtualized lists with controlled render batches. Offer details show exactly 20 clickable sailing cards per page even when hundreds or thousands are attached. Crew recognition hydrates only when deliberately opened and mounts a maximum 50-row provider page; the duplicate full registry was removed from ordinary Calendar rendering while the explicit Crew Recognition route remains. The permanent-passenger event timeline now pages 20 rows at a time. Casino charts/calculations mount only on their active task tab, casino truth calculation yields between 125-row batches, relationship maps are bounded with list alternatives, and Agent SEA defers large context until visible. Headers, favorites, priority sections, footers, and pagination remain outside or around the unbounded catalogs so the true bottom and every following action stay reachable.

### 15. Purposeful motion

- [x] Add restrained, reduced-motion-aware feedback for sync, parsing, import/export, certificate download, favorite, tier progress, weather, and undo.
- [x] Remove animation or overlays that delay navigation or obscure committed state.

Evidence: `tests/build445_item15_purposeful_motion_regression.js`, retained accessibility tests, and TypeScript pass. The canonical operation card now presents live progress, explicit durable-commit truth, partial/offline/error states, safe cancel/retry, purposeful success, and undo. Settings Save All/Load All/certificate export, weather refresh, certificate download/parsing, machine export, and favorite changes use those shared states; tier and casino progress use the same reduced-motion-aware progress primitive. Cruise-card press feedback, casino session progress, points-per-hour bars, goals, and streak feedback now honor the owner’s reduced-motion choice and clean up animations. The old blocking celebration modal is now a non-interactive, short-lived status overlay (`pointerEvents="none"`) with a static reduced-motion mode, so it cannot intercept taps, delay navigation, or hide whether data actually committed.

## P1 — Offers and Certificates tab

### 16. Offers top-level hierarchy

- [x] Put the non-negotiable Easy Seas logo/signature treatment at the top of Offers; do not put a generic Offers identity/blurb above it.
- [x] Rebuild the recorded Offers screen into: Crown & Anchor loyalty/progress, Expiration Command Center, themed filters, active offer cards, Casino & Certificates, recent activity, Agent SEA, and learning/help.
- [x] Give Crown & Anchor progress, Expiration Command Center, filters, offer cards, offer details, Casino & Certificates, recent activity, Agent SEA/Ask My Data entry, and Learn the System the same premium editorial card anatomy.
- [x] Keep Agent SEA on the Offers page after the operational offer/certificate/activity content and before learning/help; remove the unexplained `Mode-aware home` block from Offers.
- [x] Reduce the oversized Easy Seas artwork block and eliminate duplicated `Casino & Certificates` sections.
- [x] Use one unified offer-card hierarchy throughout the tab.
- [x] Keep Casino history concise here and link to Casino; keep machine discovery concise and link to Slots.

Evidence: `tests/build445_item16_offers_hierarchy_regression.js`, `tests/build445_item17_offer_cards_sailings_regression.js`, TypeScript, and rendered 430×932 Offers and Offer Details inspections. The compact non-negotiable logo is the first content, followed by the neutral SeaPass loyalty/progress card and themed filters. Real saved offer instances are now the only source for offer cards; the legacy fallback that could turn thousands of raw cruise rows into fake offer cards was removed. The expiration center uses a neutral editorial surface with tier color limited to semantic accents. Casino & Certificates has one heading, casino activity is bounded to three records with a Casino link, Slots is a concise operational link, Agent SEA follows operational content, and Learn the System is last. The canonical photorealistic offer card and its neutral Offer Details story/fact/filter surfaces now complete the same anatomy.

### 17. Offer cards and eligible-sailing lists

- [x] Show code/name, expiration, points, guests, cabin, value, eligible count, score, and source in a scan-friendly card.
- [x] Give offer cards and offer-detail cards restrained photorealistic story artwork while keeping dense facts on white/ocean-white surfaces.
- [x] Render attached-sailing cards through the same canonical complete cruise-card component used by Cruises and Booked and designated for Casino cruise rows; no context-specific reduced imitation.
- [x] Make View, Decode, Compare, Archive, Skip, booking, mark-in-progress, mark-used, PDF, refresh, and command-center actions functional.
- [x] Virtualize all eligible rows and make ship, class, cabin, guests, port, dates, nights, itinerary, GTY, and bonus filters functional and clearable.
- [x] Make the displayed eligible count exactly match the visible unfiltered list.

Evidence: `tests/build445_item17_offer_cards_sailings_regression.js`, the retained Item 4/6 and Build 440 offer-detail filter gates, TypeScript, and rendered 430×932 Offer Details and filter-sheet inspections. Summary cards now share one photorealistic `CasinoOfferCard` with explicit provider-versus-estimate evidence. Offer Details uses the canonical `CruiseCard`, retains row-level cabin/guest/class/point/GTY/bonus facts, pages exactly 20 clickable rows, preserves filter/sort/scroll state, and exposes truthful partial-readback retry. The unfiltered count is the exact loaded list length; a provider expectation is shown only as loading/readback progress and never substituted for visible rows.

### 18. Certificates lifecycle

- [x] Keep current-month and next-month documents/rows downloaded and persistent until the calendar month advances and replacement rules apply.
- [x] Automatically roll future month to current month at month change; expose next month only during its availability window.
- [x] Add Download All progress, cancellation, retry, and completion detail.
- [x] On the main certificate-code page, show every downloaded code and points level with clear code-level totals for one-guest offers, two-guest offers, total eligible rows, weekend rows, Florida departures, and shortest/longest voyages.
- [x] Add certificate summaries by offer code/points and by ship class, including separate one-guest and two-guest breakdowns.
- [x] Make every Cert Summary figure tappable into the exact individual sailing rows that produced it; each row must retain code, points, ship, class, departure port, sail date, nights, start/end day, itinerary, stateroom, guest type, GTY, and Next Cruise bonus.
- [x] Page or virtualize every summary drill-down in bounded groups (20 rows per page) while keeping every row clickable into the canonical cruise detail.
- [x] Export every certificate row plus summary/master/per-certificate CSVs in a ZIP.

Evidence: `tests/build445_item18_certificate_lifecycle_summary_regression.js`, retained Build 428/429/436/440/444 certificate gates, Item 14/4 reachability gates, TypeScript, and fresh 430×932 rendered Certificate Codes and Cert Summary inspection. Downloaded PDFs and parsed rows use the shared durable certificate document store and are included in portable backup/restore. Calendar rollover derives current/next month at runtime, gates next-month access to the final ten days, and resets the visible target when the month changes. The main one-column code ledger shows points plus eight tappable per-code metrics; the overall ledger adds tappable guest/physical-sailing totals and ship-class guest breakdowns. Every result card retains the exact parsed sailing facts and canonical Cruise action, with explicit Previous/Next pages of at most 20 rows. The ZIP contains a master row file, code summary, ship-class/guest summary, and one CSV per certificate code.

### 19. Offer/certificate relationship evidence

- [x] Link certificate issue date and earning cruise to threshold/points with explicit confidence.
- [x] Link certificate to future eligible sailings, booking, and realized value without inventing certainty.
- [x] Provide an accessible list alternative to relationship maps.

Evidence: `tests/build445_item19_offer_certificate_relationship_evidence_regression.js`, retained Build 439 top-five/completion gates, TypeScript, and fresh 430×932 rendered Relationship Explorer map/list interaction. Exact earning links now require a saved earning-cruise identifier and state actual cruise points, certificate threshold, and issue date. Date-proximity links require valid dates, remain inferred, and explicitly require confirmation; missing dates cannot create a false match. Downloaded PDF rows connect certificates to eligible sailings, offer-code evidence connects offers, and a booking becomes exact only when ship/date plus offer/certificate code agree. Realized value distinguishes complete saved formulas—including a saved $0 paid amount—from partial-evidence estimates. The owner-scoped review ledger exposes issue date, earning voyage, saved points, threshold, eligible rows, and confidence, while the interactive map retains a labeled, filterable, paged list alternative.

## P1 — Cruises tab

### 20. Cruises discovery header and controls

- [x] Replace the recorded repeated yellow-card catalog with the premium oceanic discovery hierarchy.
- [x] Consolidate and theme search, result count, sort, active-filter summary, primary tabs, Soonest/Latest/Value controls, and Favorite Staterooms.
- [x] Make the full filter sheet work for ship, class, cabin, guests, dates, port, nights, region, and offer/certificate.
- [x] Retain filter and scroll state.

Evidence: `tests/build445_item20_cruises_discovery_controls_regression.js`, retained Build 440 discovery and Build 444 Cruises/Booked acceptance gates, TypeScript, and a fresh 430×932 rendered interaction pass. The Cruises page now exposes a real controlled search field; explicit Soonest/Latest/Value controls; a readable active-filter chip summary with one-tap clear; neutral oceanic section cards; and Favorites above the virtualized catalog. The page-sheet filter covers ship, repository-wide ship class and guest facets, cabin, port, region, sailing dates, night range, exact offer linkage, downloaded-certificate linkage, and booking conflicts. The prior global-count shortcut that marked every catalog row as offer-linked was removed. Primary tab, complete filter state, and scroll offset survive detail navigation through the retained scheduling state cache.

### 21. Cruise result cards

- [x] Use one canonical premium one-column cruise card everywhere (Offers details, Cruises, Booked, Casino) with ship/date/itinerary first, then nights, sea/port days, guests, cabin, source offer/certificate, price/retail/value, casino/golden hours, points, status, and provenance.
- [x] Remove `Casino Opp 0 sea 0 port` when itinerary evidence is missing.
- [x] Distinguish duplicate offer rows from duplicate physical voyages and explain the relationship.
- [x] Open the correct cruise detail on the first tap.

Evidence: `tests/build445_item21_canonical_cruise_card_regression.js`, retained Build 440 discovery, Build 444 Cruises/Booked acceptance, Item 17 offer-sailing, Item 3 canonical-detail, and Item 8 premium-anatomy gates, TypeScript, and a fresh 430×932 Casino navigation smoke check. `CruiseCard` now supplies the same one-column story/fact hierarchy to Offer Details, Cruises, Booked, and Casino. It displays actual paid/advertised/value fields and saved casino points when present, preserves cabin/guest/class/offer/certificate/price/retail/casino/loyalty/provenance evidence, and explicitly explains whether multiple offer rows or reservations share one physical voyage. Unknown itinerary evidence renders `Itinerary needed for casino score` and does not fabricate zero sea/port facts. Every consumer uses `buildCruiseDetailsParams` on its primary press; Casino now opens the same canonical detail instead of ending at a custom evidence-only row.

### 22. Favorites and following sections

- [x] Keep Favorites and priority sections above the unbounded catalog or in a separately bounded list.
- [x] Ensure the user can reach every section and the true bottom of the tab.

Evidence: `tests/build445_item22_cruise_catalog_reachability_regression.js`, retained Item 14 performance, Item 20 discovery, Build 440 discovery gates, TypeScript, and a fresh 430×932 rendered Cruises inspection. Discovery, all filters, and Favorite Cruises/Staterooms remain above the virtualized catalog. The catalog loads a bounded 75 rows and now waits for an explicit `Load next` action instead of moving the bottom whenever the user approaches it. Variable-height complete cruise cards no longer use a false 140-point layout assumption. The footer provides loaded/total progress, a definite end-of-catalog state, and an always-reachable `Back to discovery and favorites` action; 120 points of bottom spacing keeps it clear of navigation.

## P1 — Booked tab and cruise detail

### 23. Booked top-level hierarchy

- [x] Rebuild around a photorealistic Next Voyage card, Upcoming/Completed/All controls, consecutive blocks, readiness, weather, and casino opportunity.
- [x] Theme My Cruises, weather, Casino Opportunity, ship/status filters, and every launched Today on My Cruise screen with the shared premium anatomy.
- [x] Render consecutive voyage blocks as understandable back-to-back sets of the same complete cruise cards, not invented compact summaries that hide the producing voyages.
- [x] Reduce the crowded metadata visible in the recording and move secondary reservation detail behind disclosure.
- [x] Preserve multiple reservations and guest assignments.

Evidence: `tests/build445_item23_booked_hierarchy_regression.js`, retained Build 444 Cruises/Booked acceptance, Item 21 canonical-card and Item 8 premium-anatomy gates, TypeScript, and a fresh rendered Booked navigation smoke check. The page retains its photorealistic voyage portfolio/Next Voyage story, readiness, route-aware weather, casino opportunity, All/Upcoming/Completed controls, search/filtering, and owner-scoped list. Consecutive blocks now render every producing voyage through the complete canonical `CruiseCard`, each opens its exact detail, and multiple reservation counts remain attached to the physical voyage without collapsing the underlying reservation or guest records. Today on My Cruise now uses the same editorial section headers for location, agenda, and voyage essentials instead of separate legacy headings.

### 24. Cruise detail and Cruise Planning

- [x] Show actual itinerary prominently at the top.
- [x] Repair every Cruise Planning action.
- [x] Preserve pricing, financials, receipts, points, win/loss, notes, guests, cabin, and reservation data.
- [x] Feed saved post-sailing points/win-loss into completed history, Casino, backup, and restore.

Evidence: `tests/build445_item24_cruise_detail_planning_persistence_regression.js`, retained Build 444 Cruises/Booked, completed-history, casino-points/ADT/value, and Item 21 canonical-card gates, plus TypeScript. Cruise Detail now puts the actual day-by-day itinerary before all planning intelligence and distinguishes missing itinerary evidence from a zero-day itinerary. Port-history actions, optimization-goal chips, and every replacement result have first-tap routes with canonical identity. Full edits retain booking, stateroom, guest, pricing, receipt, benefit, notes, points, and win/loss fields. Both casino save paths stamp manual/exact provenance and a post-closeout timestamp, write every compatibility alias to the owner-scoped booked-cruise repository, feed the shared Casino truth engine, and remain included in versioned portable backup and restore.

### 25. Booked casino/weather truth

- [x] Show accurate sea/port days, casino availability, modeled player hours, points/hour, and opportunity score using shared formulas.
- [x] Show itinerary-position weather and a visible map without closing the panel after refresh.

Evidence: `tests/build445_item25_booked_casino_weather_truth_regression.js`, retained Build 444 Cruises/Booked and Calendar/Weather acceptance, Build 440 weather-position truth, every-voyage-day weather, and TypeScript gates. The canonical booked cruise card now consumes the same itinerary density, casino-availability, and personalized playing-window formulas as Cruise Detail, and explicitly shows sea/port truth, casino-open days/hours, modeled player hours, golden hours, modeled or saved point basis, and points/hour. Missing itinerary evidence still suppresses fabricated zero metrics. Voyage weather renders every itinerary day, resolves port or interpolated sea-route position, shows the map even for honest out-of-window planning forecasts, cites the nearest NOAA/NDBC observation when available, retains offline cache truth, and forces the expanded folder to remain open before, during, and after refresh.

## P1 — Calendar tab

### 26. Calendar planning modes

- [x] Apply the premium planning theme to Agenda, Week, Month, and 90-day modes.
- [x] Preserve voyage events, deadlines, monthly Tarot-only view, and clearing controls.
- [x] Make Crew Recognition ownership/navigation explicit without changing tabs.

Evidence: `tests/build445_item26_calendar_planning_modes_regression.js`, retained Build 444 Calendar/Weather and Item 8 premium-anatomy gates, TypeScript, and a fresh rendered browser interaction pass through Agenda, Week, Month, 90 Days, and monthly Tarot. All four planning modes retain the shared voyage-planning identity band and editorial section anatomy. Imported events, generated cruise events, offer expiration deadlines, and certificate expiration deadlines merge into the same owner-filtered calendar. The 90-day cells are individually accessible and open the exact Day Agenda; cruise events use canonical detail identity. Tarot is isolated to Month and deliberately hides unrelated profile/navigation controls until normal planning resumes. Clear All remains an explicit persisted Core Data action. Crew Recognition stays a nested Calendar destination and states that names and recognition history are saved separately for the active user profile.

### 27. Day Agenda

- [x] Add clear previous/next-day arrows that update date, itinerary, events, position, and weather.
- [x] Add a themed `Today's Priorities` section here, replacing the unexplained `Mode-aware home` block removed from Offers.
- [x] Preserve Back and Refresh and keep an opened weather section open after refresh/sync.
- [x] Show the itinerary point and actual visible route/position map.

Evidence: `tests/build445_item27_day_agenda_regression.js`, retained Build 440 Calendar/Agenda/Crew, Agent/Agenda/Cruise UX, and Build 444 Calendar/Weather gates, TypeScript, plus a fresh rendered interaction from the 90-day Calendar into Day Agenda and forward to the next date. Previous/next arrows change the route date and every date-derived itinerary, event, casino, position, weather-selection, and forecast-prefetch calculation. The premium `Today’s Priorities` card is now on Day Agenda and opens the explainable action workspace. Back and Refresh are explicit accessible actions; Refresh reconciles persisted cruise events. Open weather folders persist across refresh/remount, and each voyage day shows its scheduled port or sea-route position, a visible OpenStreetMap tile map and marker, source/confidence text, and nearest buoy evidence when available. Day Agenda’s weather, schedule, luck, events, golden-hour, and timeline headings now use the shared Calendar theme.

### 28. Weather and marine intelligence

- [x] Resolve forecast location from the day itinerary or route position.
- [x] Use dated forecast data inside provider range and clearly labeled current/planning reports outside it.
- [x] Map ports/sea routes to NOAA/NWS marine zones and nearby NDBC buoys with source, timestamp, distance, freshness, and confidence.
- [x] Cache usable results offline and never present climatology as a dated forecast.

Evidence: `tests/build445_item28_weather_marine_intelligence_regression.js`, retained Items 25/27 and Build 444 Calendar/Weather gates, TypeScript, and a live official-source verification that the Port Canaveral water coordinate resolves through `api.weather.gov/points` to marine zone `AMZ552`, whose official name is then read from its linked zone record. Each cruise day resolves from the saved port, verified itinerary coordinates, or an interpolated point between surrounding ports. In-range dates use dated NWS/Open-Meteo/NOAA GFS/MET Norway data according to availability; future out-of-range dates are explicitly `Planning` or `Current area` and cannot masquerade as dated forecasts. U.S. marine points retain official NOAA/NWS zone ID, name, link, and resolution timestamp. The nearest NOAA/NDBC station is selected by haversine distance within 250 miles and now displays observation timestamp, distance, fresh/aging/stale status, and high/medium/low confidence. Forecasts, official-zone evidence, current-area evidence, and buoy observations persist in the owner-scoped offline weather cache; climatological ranges remain visibly labeled as planning ranges only.

## P1 — Casino tab

### 29. Casino shell

- [x] Keep the strong casino hero direction visible in the recording but unify the content area with the premium Easy Seas shell.
- [x] Make Intelligence, Charts, Play, and Calcs fully populated, task-focused, and responsive.
- [x] Remove missing/zero cards caused by unhydrated completed-cruise data.

Evidence: `tests/build445_item29_casino_shell_regression.js`, retained Build 440 Casino-shell and Build 444 Casino/Slots runtime gates, Item 8 premium-anatomy gate, and TypeScript. Casino now uses the shared tab identity, photorealistic casino artwork, editorial headings, neutral cards, accessible 44-point selectors, responsive content width, and task-specific Intelligence, Charts, Play, and Calcs destinations. Casino economics merges and canonically reconciles both legacy imports and transactional completed-cruise records within the selected owner scope. Repository hydration is now explicit: the screen shows a restoration card and `Loading…` conclusions instead of rendering final-looking zero cruise/coverage cards before saved history is ready.

### 30. Casino calculations

- [x] Use raw saved cruise points/win-loss first, provider values by agreed precedence, certificate thresholds only as labeled estimates, and annual reconciliation separately.
- [x] Calculate casino-open hours, modeled player hours, points/hour, coin-in, ADT, theoretical, trip economics, comp coverage, ROI, and certificate-created value.
- [x] Define each metric on first use and show exact/derived/estimated/reconciled provenance.
- [x] Keep Casino and Booked on the same cruise identities and formulas.

Evidence: `tests/build445_item30_casino_calculation_truth_runtime.js`, retained Build 399/402 Casino truth/calculation gates, Build 444 Casino/Slots acceptance, and TypeScript. A cruise closeout's raw saved points and gaming result beat partial session rows and certificate thresholds; provider authority is preserved in the evidence label; a certificate threshold is an estimate only; and the provider season balance remains a separate reconciliation total. The shared truth rows calculate itinerary/open-day casino availability, actual or modeled player hours, points/hour, eligible Club Royale slot coin-in, theoretical loss, ADT, trip economics, comp coverage, cash ROI, and saved certificate-created value. Certificate-created value is counted once from a saved cruise closeout or linked award value; point thresholds and mutually exclusive eligible sailing prices cannot inflate it. Casino portfolio rows use the same owner-scoped cruise record, canonical detail parameters, and cruise ID as Booked, and each displayed metric states its formula/source or missing status.

### 31. Casino data controls and owner truth

- [x] Make cruise-level edit, receipt, host, value, certificate, session, and calculation tools reachable.
- [x] Preserve the confirmed annual/current-season values without leaking them to an empty secondary user.
- [x] Eliminate interaction-manager crashes, frozen paths, and retry-after-loading dead ends.

Evidence: `tests/build445_item31_casino_controls_owner_truth_regression.js`, retained Build 415 secondary-profile isolation, Build 411 Casino scheduler, Build 440 Casino-shell gates, and TypeScript. Casino now provides direct routes to post-cruise editing, receipt import, host CRM, value scenarios, certificate wallet, actual session history, and formula/calculation evidence. Cruises, sessions, certificates, loyalty balances, annual facts, and economics remain selected-owner scoped; known annual facts require the matching owner-scoped import and an empty secondary profile receives no primary-user floor. Casino computation is bounded into 125-record batches and yields through cancellable timers without a direct `InteractionManager` dependency. A route error boundary preserves navigation, offers a clean retry, and links to Data Health instead of trapping the app behind a loading dead end.

## P1 — Slots tab

### 32. Slots discovery experience

- [x] Replace the recorded plain alphabetical white list with a premium Slots header, search, filter summary, favorites, and readable one-column machine cards.
- [x] Keep the alphabet index usable without overlapping favorites or card content.
- [x] Use contextual machine imagery/icons without sacrificing data density.

Evidence: `tests/build445_item32_slots_discovery_regression.js`, retained Build 444 Casino/Slots, Build 440 photorealistic-screen, Item 8 premium-anatomy gates, and TypeScript. Slots retains its photorealistic identity band and editorial Machine Library section, but the old plain compact row is now a premium one-column card with a cached saved machine image when available, a contextual AP/game fallback visual, manufacturer/series, volatility, ship count, favorite action, and disclosure affordance. Search, Favorites, manufacturer, and ship filters remain first-tap controls; a visible summary states both the matching count and active criteria. Long results retain the draggable alphabet index and scroll thumb, while every machine row reserves a dedicated right gutter so the rail cannot cover the favorite or disclosure controls.

### 33. Slots functions and performance

- [x] Preserve machine atlas, verified map, conditions, sessions, notes, exports, settings, historical observations, and play-time preferences.
- [x] Virtualize the machine library and avoid loading all machine data during ordinary navigation.

Evidence: `tests/build445_item33_slots_functions_performance_regression.js`, retained Item 32 and Build 444 Casino/Slots gates, a 20,001-row filter runtime (4.0 ms), and TypeScript. Slots directly reaches Add Machine, the shared library, verified onboard map, condition-history log, machine detail/notes, play sessions, preference editing, favorites, and both exports. The main machine results remain a keyed, clipped, single-column `FlatList` with bounded initial/batch/window rendering. The 262-machine offline JSON no longer evaluates with the root provider; it is lazily required only when a Slots/machine/Agent request asks for index data. Pro entitlement is additionally gated by an explicit hydration request, preventing the former two-second whole-atlas load during unrelated navigation while retaining the packaged offline catalog.

## P1 — Settings tab

### 34. Settings hierarchy

- [x] Remove the duplicated/partially clipped top identity/title treatment visible in the recording.
- [x] Use one compact Data Overview and one searchable category hierarchy: Account, Security, Notifications, Connections, Data & Backup, Integrations, Appearance, Help, About/Legal, Purchases.
- [x] Move developer/admin/mock controls out of normal production paths.

Evidence: `tests/build445_item34_settings_hierarchy_regression.js`, retained Build 440 Settings organization/crash-large-fixture gates, and TypeScript. Settings renders exactly one compact shared identity band with its native title bar disabled and exactly one Data Overview. Search spans Account, Security, Notifications, Connections, Data Import & Backup, Integrations, Appearance, Help, About/Legal, and Purchases. The UI now explicitly tells users that Traveler Profile, Connections, and Data Import/Backup remain always visible, while the labeled More Settings chips reveal less-common groups. Admin/session-log/machine-import/generator tools require real admin state, and no mock-data actions appear in production Settings.

### 35. Settings actions

- [x] Make Royal, Celebrity, Carnival, loyalty, profile, crew, completed history, certificate, and pricing sync/import controls work and report committed counts.
- [x] Make every import/export, certificate ZIP, Save All, Load All, backup, and restore control tappable with truthful progress.
- [x] Device-verify book covers and all Amazon links.

Evidence: `tests/build445_item35_settings_actions_regression.js`, retained Build 432/434/436/438/444 Settings, sync, loyalty, completed-history, certificate-hydration, and supplied-format runtime gates, plus TypeScript and a fresh rendered 430-pixel-wide Settings interaction. Offers, eligible sailings, booked cruises, calendar events, crew imports, and profile/loyalty edits now read the owner-scoped durable store after each write; success states and count badges use verified committed rows, while incomplete readback becomes an explicit error. Certificate ZIP, Save All, Load All, export, and restore retain first-tap targets and the shared progress/commit card. Both local book-cover PNGs render cleanly, the author storefront resolves to Scott Astin, and live Amazon verification corrected the cover targets to `B0GYRDTS6L` and `B0G4NG1L2M`, whose pages identify the exact two books.

## P1 — Agent SEA

### 36. Native chat interaction

- [x] Open directly into a ready chat with no activation button or freeze.
- [x] Use actual user/assistant message bubbles, timestamps/status where useful, a compact answer, and expandable evidence—not the long document wall visible in the recording.
- [x] Keep composer/keyboard visible and correctly inset; Send must work on first press and suppress duplicates.
- [x] Make Close, New, Chats, Filter, Save, Print, Export Log, and AI Settings work.

Evidence: `tests/build445_item36_agent_sea_native_chat_regression.js`, retained Build 371/440 Agent SEA interaction suites, TypeScript, and a fresh rendered 430×932 conversation. Agent SEA now mounts ready, accepts `What is my ADT?` on the first Send tap, adds exactly one user bubble and one compact evidence-backed assistant bubble, keeps the composer pinned above the bottom inset, and expands the cited owner-scoped calculation in place. New preserves the previous thread, Chats reopens it after a full reload, Filter exposes profile/brand/program scope, AI Settings opens its secure configuration, Save and Export invoke real file operations, and Print builds the native print document. Close tears down repository/network work before navigation and has an Offers fallback when no back route exists.

### 37. Agent SEA intelligence

- [x] Provide owner-scoped tools for offers/sailings, booked/completed cruises, loyalty, casino, certificates, crew, calendar/weather, finance, and provenance.
- [x] Answer deterministic questions such as ADT with the calculation first.
- [x] Support follow-ups about ships, regions, next-month offers, points levels, room/guest eligibility, and source discrepancies.
- [x] Cite records/formulas and say exactly what data is missing.

Evidence: `tests/build445_item37_agent_sea_intelligence_runtime.ts`, retained Build 401/413/426/430/439/440/444 Agent SEA and casino gates, TypeScript, and the Item 36 live ADT conversation. The typed source planner covers every requested domain, keeps shared catalogs separate from the active owner’s private records, and builds a bounded source/provenance manifest. ADT is calculated before optional AI from theoretical loss divided by rated casino days and refuses a false zero when evidence is absent. Certificate questions now retain the deterministic downloaded-certificate result instead of being overwritten by a broader legacy search; month, ship, class, region, cabin, guest, points, GTY, port, and date filters return row-level evidence. Follow-up questions retain the preceding user request, and compact answers expose records/formulas through expandable citations.

### 38. Agent SEA persistence and security

- [x] Persist conversations per owner; support save, print, export, close/reopen, and safe request replacement.
- [x] Keep shared catalogs mutual and private cruise/casino/crew/profile/chat data isolated.
- [x] Use user-provided SecureStore credentials or an approved proxy; never ship a secret key.

Evidence: `tests/build445_item38_agent_sea_persistence_security_runtime.js`, retained Build 439/440/444 isolation, interaction, and secure-delivery gates, TypeScript, and the Item 36 reload test. Durable conversation storage hashes authenticated account, profile, brand, and program; cross-owner writes are rejected and the secondary test owner loads no primary conversation. New/open/close/request replacement abort active repository and AI work before replacing state. Shared offers, available sailings, and downloaded certificate evidence use household scope, while booked/completed cruises, casino sessions, crew, profile, provenance, and chat use the active private profile. Personal provider credentials are account-scoped in iOS SecureStore only; plaintext storage, Save All, exports, logs, and source contain no key. The built-in owner path uses the bounded, rate-limited server proxy with its provider credential read only from server environment variables.

## P2 — Persistence, trust, and platform completeness

### 39. Owner-scoped persistence

- [x] Persist profiles, loyalty edits, manual cruise casino values, completed history, crew recognition, preferences, and chat by owner.
- [x] Prove secondary users never receive the primary owner’s casino totals, recognition, reservations, or chat.
- [x] Keep shared offers/sailings/certificate catalog mutual where requested.

Evidence: `tests/build445_item39_owner_scoped_persistence_runtime.js`, retained Build 406/409/415/426/438 isolation and persistence gates, and TypeScript. The focused runtime test proves owner-key separation, profile stamping, legacy-primary handling, secondary passenger attribution, preference export/restore rejection across owners, and shared certificate storage. It also exposed and fixed a real legacy-reservation leak: an unattributed reservation naming only the secondary traveler can no longer fall through to the primary profile. Profiles and appearance preferences are account-owner scoped; loyalty edits, manual/completed casino records, crew recognition, booked reservations, and Agent SEA conversations additionally enforce the active profile boundary. Offers, available sailings, and the public monthly Club Royale certificate catalog remain shared household inventory by design.

### 40. Local file import/export

- [x] Verify CSV, XLSX, ICS, JSON, document picking, and iOS security-scoped file access without undefined `getDocumentAsync`.
- [x] Verify crew, offers, booked, completed casino, calendar, certificates, and full-data imports using supplied files.
- [x] Verify all required exports and diagnostic logs from real buttons.

Evidence: `tests/build445_item40_local_file_io_runtime.js`, retained `tests/build444_settings_files_acceptance_runtime.js`, retained `tests/build444_supplied_files_acceptance_runtime.js`, and TypeScript. The iOS-mode runtime gate invokes the namespace `DocumentPicker.getDocumentAsync`, requires `copyToCacheDirectory`, reads actual CSV/ICS/JSON content through the native file abstraction, and produces a clear reinstall error when the native picker is absent instead of dereferencing `undefined`. It parses the supplied 776-row `master_crew_registry.xlsx`, all 33 cruise rows in the supplied completed-history CSV (including 21 rows with complete economics), the retained 391-row/5-offer fixture, a booked-CSV round trip, an ICS event, and the surviving 4,151-cruise/78-booking/16-offer/633-event backup. Native CSV/ICS/JSON exports reach the share sheet, certificate ZIP contents are opened and inspected, and Settings plus Agent SEA import/export actions remain real press targets. This gate also exposed and fixed a timezone bug in both booked and offer CSV exporters: date-only sailings now round-trip on the exact calendar day instead of shifting one day in Phoenix.

### 41. Save All, Load All, backup, and restore

- [x] Replace monolithic blocking work with staged/indexed progress that does not freeze on ~147 MB backups.
- [x] Include all requested domains, documents, caches, provenance, relationships, and preferences.
- [x] Preview add/update/preserve/conflict/reject counts and apply transactionally.
- [x] Verify cancellation/resume and exact post-restore counts.

Evidence: `tests/build445_item41_save_load_restore_acceptance.js`, `tests/build444_147mb_backup_acceptance_runtime.js`, retained Build 439 encrypted-backup/integrity runtime gates, and TypeScript. All four primary Settings actions now open the indexed encrypted Data Trust workflow instead of invoking the legacy monolithic JSON serializer/parser. Save All and Load All arrive at the relevant section with explicit instructions; the user supplies a password or recovery key, receives bounded progress, and no restore mutates data until the add/update/preserve/conflict/reject preview is approved. The versioned AES-256-GCM chain contains every durable domain plus certificate documents, owner preferences, provenance, offer/sailing evidence, and the Agent SEA source-manifest/rebuildable-cache checkpoint. The 148 MiB qualification generated 193 progress events and 366 event-loop yields, published one transactional manifest only after completion, restored all 171 test records exactly, and passed low-space refusal, cancellation/resume, owner mismatch, conflict preservation, rollback, corruption, and truncation checks.

### 42. Versioned local database

- [x] Prove high-volume domains use indexed repositories during normal runtime.
- [x] Complete resumable migrations, owner/domain indexes, foreign keys, checkpoints, diagnostics, and rollback.
- [x] Ensure startup and tab switching never depend on parsing entire large JSON collections.

Evidence: `tests/build445_item42_versioned_database_acceptance.js`, retained `tests/build439_high_volume_repository_runtime_regression.js`, `tests/build444_database_integrity_owner_acceptance_runtime.js`, `tests/build394_cruise_inventory_repository_regression.js`, and TypeScript. The version-six local SQLite trust database uses WAL mode, transactional migrations, foreign keys, owner/domain indexes, migration checkpoints, diagnostics, quarantine, and audited rollback. Nine high-volume domains are cut over through the indexed repository in their normal providers, while the separate available-cruise repository uses owner-scoped generations, offer/sailing foreign keys, indexed filters, transactional promotion, and paged queries. Cold startup obtains catalog counts from SQLite, deliberately skips the available-cruise and booked/offer/calendar JSON collections when indexed data exists, and migrates a retained legacy snapshot only when its repository is empty. A completed source hash is recognized before legacy JSON parsing, so repeated launches do not rematerialize old large collections.

### 43. Provenance and integrity center

- [x] Attach source, timestamp, owner, confidence, source record, and formula to important values.
- [x] Preserve provenance through sync/import/backup/restore/migration and expose it to Agent SEA.
- [x] Detect duplicates, broken links, malformed dates, stale loyalty, impossible totals, and owner leakage.
- [x] Preview ambiguous repair, retain repair history/rollback, and surface unresolved findings in Action Inbox.

Evidence: `tests/build445_item43_provenance_integrity_acceptance.js`, retained Build 439 provenance/integrity/Agent SEA isolation gates, `tests/build444_database_integrity_owner_acceptance_runtime.js`, and TypeScript. The field registry now includes the important itinerary, guest, cabin, casino-opportunity, retail, stateroom, offer-points, and financial fields in addition to loyalty, certificates, weather, crew, profile, and preferences; every link retains source type, observed timestamp, owner, confidence, source record, formula, parent sources, provider, and derived status. Automatic and manual scans now read the native indexed cruise authority instead of the deliberately empty post-cutover React catalog, so offer/sailing relationships and available-cruise provenance are no longer skipped. Large provenance refreshes commit in 250-link batches with event-loop yields. The runtime gate detects strict invalid calendar dates (including `2026-02-31`), orphan/broken relationships, owner leakage, unlinked certificates, stale loyalty, and impossible casino totals; ambiguous repairs remain blocked, safe quarantines are reversible and audited, unresolved findings retain citations in the owner-aware Action Inbox, and Agent SEA receives only shared or active-owner provenance.

### 44. Relationship explorer and high-value tools

- [x] Finish accessible relationship maps/lists for certificates, offers, cruises, bookings, points, loyalty, casino play, money, and realized value.
- [x] Verify Action Inbox bulk/snooze/reassignment flows.
- [x] Verify certificate optimizer with exclusions, travel costs, guest/cabin truth, and explanation.
- [x] Verify casino lifecycle links without duplicate or orphan records.

Evidence: `tests/build445_item44_relationship_high_value_acceptance.js`, retained Build 416/438/439/440 lifecycle, optimizer, Action Inbox, and top-five experience gates, plus TypeScript. Both relationship consumers now hydrate the indexed native sailing authority instead of the deliberately empty post-cutover React catalog. The accessible map/list chain explicitly includes owner-scoped casino sessions, cruise points, saved loyalty balances, certificates, provider offer instances, deduplicated eligible sailings, owner bookings, and recorded realized value; final node/edge normalization guarantees unique identifiers and removes every dangling endpoint while preserving explicitly labeled unresolved records. The optimizer retains ranked eligible options with cabin, guest, port, itinerary, travel cost, confidence, and factor explanations, and now exposes a bounded review list containing every hard-exclusion reason instead of silently discarding ineligible rows. Action Inbox selection, bulk completion, seven-day snooze, owner-only cross-profile reassignment, provenance, and profile isolation remain intact.

### 45. Copy, legal, and truthful language

- [x] Apply sentence case and consistent cruise/night/guest/status/action/error/estimate language.
- [x] Remove developer text, contradictory counts, vague retry messages, and false certainty from primary flows.
- [x] Preserve provider names, trademark disclaimer, calculation meaning, and responsible-gaming language.

Evidence: `tests/build445_item45_copy_legal_truth_acceptance.js`, retained Build 440 plain-language and Item 34 Settings-hierarchy gates, and TypeScript. Primary cruise, booked, calendar, certificate, Casino, and Settings flows now use a shared plural-aware count formatter instead of developer-facing `guest(s)`, `day(s)`, `cruise(s)`, `row(s)`, or `item(s)` copy. Generic retry labels identify the failed operation or reload target, sort/action labels use sentence case, failure copy states whether prior data was preserved, and admin/developer controls remain gated from normal production paths. Provider-reported, user-entered, derived, estimated, and unavailable evidence labels remain distinct; Royal Caribbean, Celebrity Cruises, Club Royale, and Blue Chip Club names are preserved; and the legal/trademark, no-guaranteed-outcome, calculation-limit, and responsible-gaming language remains intact.

## Release acceptance

### 46. Fresh rendered interaction audit

- [x] Capture all seven tabs plus every critical nested workflow on iPhone.
- [x] Inspect light, dark, high contrast, large text, offline, empty, partial, error, and large-data states.
- [x] Compare every capture against the premium reference anatomy and this todo.

Evidence: `BUILD445_RENDERED_INTERACTION_AUDIT.md` records the clean 430×932 pass across all seven tabs; Agent SEA, Day Agenda, Offer Details, Cruise Details, Certificate Portfolio, Relationship Explorer, Data Trust, Action Inbox, and Offline Voyage Pack; and the full state matrix. The rendered audit exercised first-tap Agent SEA Send and evidence expansion, Day Agenda next-day navigation, relationship map/list switching, shared theme/accessibility controls, truthful missing-record states, and a non-destructive 2,689-line supplied offers import that produced a bounded 250-of-2,694-row review. It also found and closed four defects: the Action Inbox web SQLite worker crash, the Cruise Detail internal route header, the unthemed offline-pack empty state, and remaining developer-style plural placeholders. A clean-server recheck showed Action Inbox with no error overlay and the preview import was cancelled without writing data.

### 47. Functional regression gates

- [x] Pass focused tests for every closed item, maintained legacy tests, supplied-file runtime tests, owner isolation, persistence, offline, large data, calculations, migrations, sync, import/export, backup/restore, and accessibility.
- [x] Pass TypeScript, Expo Doctor, App Store identity/version checks, and fresh iOS production bundle.

Evidence: the post-bump release run passed all Build 445 Item 1–45 gates plus the sync/import/offer-detail blocker gate; `npm run verify:source-release` passed its 711-file syntax scan and 219 maintained tests with 47 intentionally skipped historical-version/private-fixture checks and zero failures. The supplied-file run parsed 2,690 current offer rows/4 offer codes, 776 crew rows, 33 completed cruises plus three total rows, and two large backups. `npx tsc --noEmit` passed; Expo Doctor passed 18/18; App Store identity passed for Easy Seas 13.0.74 (445), Android 130107; and the fresh production-mode iOS Metro bundle completed with 3,825 modules and 33 copied assets. `BUILD445_RELEASE_VERIFICATION.md` records the exact commands, results, and acceptance boundary.

### 48. Final native acceptance and packaging

- [~] Run simulator/device interaction for every button and route; source-text assertions are insufficient. The user explicitly directed that the restored full-iOS verification requirement not be performed, so this remains intentionally deferred and is not represented as passed.
- [x] Close only defects with recorded before/after evidence.
- [x] Increment the release only after all gates pass, retain Build 444 unchanged, create a verified source ZIP, verify extraction, and publish checksums and exact build results.

Evidence: `BUILD445_RENDERED_INTERACTION_AUDIT.md` records the rendered browser before/after audit and the defects closed during it. Build identity advanced only after Item 47 passed. Build 444 was not modified. The source archive, independent extraction test, checksum, and exact release results are recorded in `BUILD445_RELEASE_VERIFICATION.md`; simulator/device acceptance remains explicitly deferred rather than silently claimed.

## Recording-specific findings that must not be lost

- Offers: oversized branding, inconsistent cards, zero/stale offer state, missing cabin/value, duplicated Casino & Certificates content.
- Agent SEA: attractive shell direction, but long document output, weak conversational bubbles, and excessive top controls.
- Cruises: repetitive yellow catalog cards, duplicated-looking rows, false zero casino metadata, and weak visual hierarchy.
- Booked: dense metadata, uneven card hierarchy, and no clear next-voyage/readiness emphasis in the recorded section.
- Casino: useful hero direction, but missing points/coverage/ADT/economic metrics and a mismatched content shell.
- Slots: functional-looking alphabetical list, but visually unfinished, crowded, and not aligned with the premium reference.
- Settings: repeated/clipped header hierarchy, mixed card generations, and dense category chips.
- Bottom navigation: correct seven-tab structure, but icons/labels are too small and the selected treatment needs a cleaner premium standard.
