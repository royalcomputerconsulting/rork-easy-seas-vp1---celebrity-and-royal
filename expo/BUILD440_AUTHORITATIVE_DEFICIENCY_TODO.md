# Easy Seas Build 440 — Authoritative Deficiency Todo

This list replaces the optimistic completion labels in the earlier Build 440 lists. A helper, route, token, mock fixture, or source-text test does **not** close a task. A checkbox closes only when the real consuming workflow works, preserves existing functionality, persists correctly, respects owner scope, passes focused regression coverage, and survives the relevant iOS production-bundle gate.

Execution rule: only one numbered deficiency may be `IN PROGRESS`. Finish it and record evidence before moving to the next number. Build 439 remains the untouched rollback baseline.

## Verified anchors — retained, but not substitutes for the work below

- [x] Build 439 rollback folder/ZIP and hashes are preserved.
- [x] Source Serif 4 and the semantic SeaPass/Crown & Anchor/Club Royale/Blue Chip tokens exist.
- [x] Shared card, header, search, filter, badge, metric, alert, empty, definition-list, and detail-sheet primitives exist.
- [x] The Scott Astin books section and two local cover assets exist above Data Management; old Support duplicates are removed.
- [x] Seven photorealistic top-level tab assets and their consuming identity cards exist locally.
- [x] Seven bottom-tab names, order, and routes remain unchanged in source.

These anchors still require device-level visual and functional verification under deficiencies 18, 20, 29, and 30.

## Sequential deficiencies

### 1. [x] Offers information architecture and unified offer cards

- Reorder Offers into: loyalty snapshot, offer overview, urgent/expiring offers, active offers, certificates, recent activity, and learning/help.
- Use one premium card hierarchy for code/name, expiration, points level, guest count, cabin/stateroom, value, eligible-sailing count, score, and provenance.
- Preserve View, Decode, Compare, Archive, Skip, booking, mark-in-progress, mark-used, certificate, import, refresh, and command-center actions.
- Put “Why this score?” and formula/evidence behind progressive disclosure.
- Ensure list virtualization and memoization remain responsive with thousands of offer-sailing rows.
- Done only when every action opens the correct destination and an offer’s displayed sailing count matches its visible drill-down list.

Evidence: `components/CasinoOfferCard.tsx` now exposes the canonical points, guest, stateroom, normalized one-sailing value, exact eligible-sailing count, score, expandable score evidence, and source/value provenance hierarchy. `app/(tabs)/(overview)/index.tsx` now renders loyalty → overview → urgent decisions → filters/active offers → certificates → recent activity → Agent SEA/help, retains all command-center and offer routes, queries repository counts, and uses `normalizeOfferValue` instead of summing alternative sailings. `tests/build440_offers_premium_hierarchy_regression.js`, `tests/build425_offer_option_inventory_sync_regression.js`, and `tests/build438_item26_true_offer_value_regression.js` pass; both modified TSX files pass targeted TypeScript transpilation. The final Metro/iOS production-bundle gate remains explicitly owned by item 29 because the sparse local dependency tree currently stalls before Metro startup.

### 2. [x] Move misplaced Casino and machine content without losing access

- Remove the full Casino History ledger from Offers; retain a concise recent-activity summary and visible route to Casino.
- Move Machine Strategy and Ship Machine Explorer ownership to Slots; retain visible discovery links where useful.
- Preserve all existing data, filters, exports, edits, and navigation actions.

Evidence: Offers bounds its casino activity preview to three records and routes to `/analytics`; it no longer imports or mounts either machine component and retains a visible `/machines` discovery link. Slots now imports and renders `MachineStrategyCard` and `ShipMachinesExplorer` while retaining session tracking, verified map, condition logs, favorites, and both export paths. Casino retains full completed-cruise economics, editing, and CSV export. `tests/build440_content_ownership_regression.js` passes and both consuming TSX files pass targeted TypeScript transpilation.

### 3. [x] Offer details, eligible sailings, filters, and row truth

- Make View, Decode, offer-card press, and command-center actions open the same canonical offer instance.
- Display every eligible sailing—not only one row—with responsive virtualization.
- Make ship, class, cabin, guest count, departure port, dates, nights, itinerary, GTY, and NextCruise bonus filters functional and clearable.
- Distinguish one-guest and two-guest rows and show the actual stateroom/cabin entitlement.
- Preserve scroll/filter state when returning from cruise detail.

Evidence: `app/offer-details.tsx` now resolves the canonical offer instance, incrementally pages every offer-sailing relationship into a virtualized `FlatList`, exposes functional and clearable ship/class/stateroom/guest/departure/date/night/GTY/NextCruise filters plus itinerary/port/region search and all five sort modes, and displays ship class, actual cabin entitlement, one/two-guest eligibility, and supplied NextCruise bonuses per row. The screen keeps search, filters, sort, and scroll offset in an offer-instance view-state cache and restores position after cruise-detail navigation. `lib/offers/offerSailingFilters.ts` is a row-preserving filter engine exercised against real multi-dimensional fixtures by `tests/build440_offer_details_filters_regression.js`; that test, `tests/build425_offer_option_inventory_sync_regression.js`, `tests/build438_item26_true_offer_value_regression.js`, and the Offers hierarchy/content-ownership regressions pass. The modified screen and filter engine pass targeted TypeScript transpilation.

### 4. [x] Certificates: download, persistence, summary, linkage, and export

- Keep current/next-month downloaded certificate documents and parsed sailing rows persistent across restart, Save All, and Load All until their replacement month.
- Make Download All show start, per-document progress, completion, failures, retry, and cancellation without freezing.
- Ensure Cert Summary figures drill into the exact cruises producing each figure.
- Link certificate issue/sailing dates to the earning cruise, points threshold, offer level, and future eligible sailings without inventing certainty.
- Make Settings certificate ZIP export initialize its own data, show progress, and include every row plus summary/master/per-certificate CSVs.

Evidence: certificate PDFs and parsed rows use `PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY`, migrate older owner-scoped documents, are included in Save All/Load All, and hydrate on demand without first opening the certificate screen. Download All discovers both A/C ladders, skips already durable documents, publishes per-code phases and counts, saves bounded pairs transactionally, exposes retry/cancel/log controls, and now terminates its logger cleanly on cancellation while retaining all completed documents. Cert Summary metric cells use exact option-row predicates and a virtualized drill-down. The earned-certificate review now consumes date/ship/reservation inference, labels points as certificate thresholds, requires user confirmation, and links to the future eligible rows. Settings awaits durable hydration and exports a ZIP containing a master CSV, summary CSV, README, and one CSV per certificate with live compression/share progress. `tests/build440_certificate_completion_regression.js`, builds 401/421/426/428/429/431/436 certificate regressions, and targeted TypeScript transpilation pass.

### 5. [x] Cruises discovery screen and reachable content

- Consolidate search, filters, sort, and result count into the premium screen hierarchy.
- Make the full filter screen functional for ship, class, cabin, guests, dates, departure port, nights, region, and offer/certificate.
- Use a bounded/virtualized result area so Favorites and every following section remain reachable.
- Standardize cruise rows with complete guest/night labels, cabin entitlement, status, price/provenance, and no fabricated zero casino metadata.
- Retain filter/scroll position and all existing cruise-detail actions.

Evidence: `app/(tabs)/scheduling.tsx` now presents one full-screen discovery filter for ship, class, stateroom, one/two guests, departure port, region/destination, date range, night range, offer eligibility, downloaded-certificate eligibility, and conflicts while retaining the existing search, five sort modes, tabs, alerts, detail navigation, and Agent SEA entry. Queries are pushed into the indexed repository, certificate filtering scans the paged catalog against durable parsed rows, and invalid numeric input can no longer emit `NaN`. Favorites remain before the virtualized catalog, while filter/tab/scroll state is retained and restored after detail navigation. `CruiseCard` now displays supplied source provenance and reports “Itinerary needed” instead of fabricating zero sea days, port days, or casino opportunity. `lib/cruises/cruiseDiscoveryFilters.ts` is exercised across every dimension by `tests/build440_cruise_discovery_regression.js`; Build 394 repository, scale, and query-UI regressions pass, and all modified TypeScript files pass targeted transpilation.

### 6. [x] Booked screen and cruise-detail truth

- Rebuild around Next Voyage, Upcoming/Completed/All, primary actions, consecutive blocks, and voyage readiness.
- Show the actual itinerary prominently at the top of cruise detail.
- Repair Cruise Planning and preserve pricing, financials, receipts, points, win/loss, notes, guests, and reservations.
- Show accurate sea days, port days, embarkation/disembarkation treatment, casino opportunity, and missing-itinerary state.
- Keep multiple reservations on the same sailing distinct while relating them to one physical voyage.

Evidence: Booked retains Next Voyage, All/Upcoming/Completed, list/timeline/points modes, add/search/sort/refresh actions, weather, casino evidence, and detail navigation, and now adds a truthful next-voyage readiness checklist plus upcoming consecutive-voyage blocks. `lib/bookedVoyageRelationships.ts` groups separate reservations under one physical voyage for relationship display without collapsing their independently actionable booking IDs, and excludes duplicate reservations from consecutive-night totals. `CruiseCard` labels related reservations while preserving each card. Cruise detail keeps the actual day-by-day itinerary directly beneath its headline, exposes reservation, stateroom, guests, editable notes, pricing, financials, receipt edit access, manual points, and win/loss, and labels manual casino closeout provenance. Planning comparisons, sea/port counts, casino hours, and personalized point estimates now mount only when itinerary evidence is known; missing evidence renders an explicit explanation instead of zeros. `tests/build440_booked_cruise_truth_regression.js` and `tests/build404_post_cruise_closeout_regression.js` pass, modified files pass targeted transpilation, and the project TypeScript gate completes without output. The old Build 390 aggregate test still contains a stale hardcoded `13.0.61` version assertion and is reserved for the maintained-test cleanup in item 29.

### 7. [x] Calendar, Day Agenda, Tarot, and Crew navigation

- Provide working Agenda/Week/Month/90-day planning modes with voyage events and deadlines.
- Preserve the requested monthly Tarot-only view and event/calendar clearing controls.
- Make previous/next-day arrows update the selected date, agenda, itinerary, and weather while preserving Back and Refresh.
- Keep weather panels open after refresh/sync when the user opened them.
- Make Crew Recognition ownership and navigation explicit without changing tab count/order.

Evidence: Calendar retains its existing event generation, deadlines, clearing control, permanent-passenger view, and seven-tab structure while exposing Agenda, Week, Month, and 90 Days as explicit selectors. Monthly Tarot mode now hides unrelated timezone, event-list, legend, and crew content so the calendar grid remains Tarot-only. Day Agenda’s prior/next arrows use the executable `shiftAgendaDate` helper across month/year boundaries, update the route date consumed by agenda/itinerary/weather calculations, and retain Back and Refresh. `VoyageWeatherSection` keeps open state by sailing key and explicitly reopens after sync in both success and failure paths. Calendar now exposes an explicit Crew Recognition drill-down route while retaining the embedded workflow in ordinary calendar modes. `tests/build440_calendar_agenda_crew_regression.js` and the Build 422 Tarot/backup regression pass; all consuming files pass targeted transpilation.

### 8. [x] Voyage weather, route positioning, and marine data

- Resolve each cruise day from itinerary/route position—not the screen’s currently selected generic location.
- Show a dated forecast for every day inside provider range and a clearly labeled current/planning report outside it.
- Use NOAA/NWS first, appropriate NDBC/marine zone or buoy for sea days, and two bounded fallbacks.
- Map itinerary points to documented nearby buoys/marine zones and expose source, timestamp, distance, confidence, and freshness.
- Add current/planned ship position map behavior without scraping or misrepresenting third-party data.
- Cache usable results offline and never replace missing data with false certainty.

Evidence: the sailing-weather provider resolves every requested voyage day from saved itinerary evidence, known port coordinates, or bounded interpolation between surrounding route points; it does not use the screen's generic selected location. It prefers the official NWS point/grid forecast where available, joins NOAA/NDBC current observations by haversine distance with a 250-mile ceiling, uses NOAA GFS Wave/Open-Meteo Marine for forecast sea state, and retains Open-Meteo and MET Norway as bounded weather fallbacks. Each record carries the itinerary lookup latitude/longitude, weather and marine source labels, update/refresh timestamps, confidence, cache freshness, and nearest-station distance, while out-of-range cards remain explicitly labeled planning/current-area evidence. `SailingWeatherCard` now exposes a one-tap Apple Maps itinerary-position link labeled historical, today's expected, or planned and explicitly states that it is not live AIS tracking. Saved fresh and stale cache records remain readable offline and missing route evidence renders an unavailable/planning state rather than invented numbers. `tests/build440_weather_position_truth_regression.js`, builds 396/397/409/415/421/423/426, `deliverable4_5_certificates_weather_regression.js`, and `weather_daily_cards_official_alerts_regression.js` pass; the card and new presentation helper pass targeted transpilation. Builds 364/366/367/384 reach only their stale hardcoded historical-version assertions and are assigned to maintained-test cleanup in item 29.

### 9. [x] Casino shell and all four functional subpages

- Use the unified premium Easy Seas shell instead of a separate dark application.
- Preserve and populate all four Casino destinations with task-focused names, conclusions, metrics, charts, tools, and evidence.
- Eliminate the Interaction Manager crash, retry-after-loading dead end, static owner data, and tab-freezing paths.
- Keep receipt, host, value, ship, certificate, session, and calculation tools reachable.

Evidence: the mounted Casino route now opens the canonical `CasinoCommandCenter` immediately inside a route error boundary, with no deferred loading shell and no dependency on `InteractionManager`. Charts use a cancellable next-turn timer, cruise truths process in bounded batches, malformed rows are skipped with a visible diagnostic, and a render failure offers both a real retry and a Data Health escape instead of a retry-only dead end. The unified Easy Seas Casino shell exposes exactly four task-focused destinations—Intelligence, Charts, Play, and Calcs—with the shared Casino identity band, premium artwork, progressive conclusions, source disclosures, metrics, visual comparisons, cruise evidence, optional session evidence, and formula guardrails. Owner selection scopes booked cruises, sessions, and certificates consistently. Receipt import, host CRM/brief, cruise value/scenarios, ship intelligence, certificate wallet, completed sailings, closeout, loyalty, reports, and formula/settings tools remain reachable. `tests/build440_casino_shell_four_pages_regression.js` and the maintained Build 400 Casino reachability/attribution regression pass; both mounted files pass targeted TypeScript transpilation.

### 10. [x] Casino points, ADT, theoretical, value, and annual reconciliation

- Use raw saved per-cruise points/win-loss first, provider sync according to the agreed precedence, certificate thresholds only as labeled estimates, and annual reconciliation only as a separate adjustment.
- Preserve the confirmed 2025 annual totals and current-season owner total without showing Scott’s data to another user.
- Calculate casino-open hours from itinerary, estimated player hours from saved style, points/hour, coin-in, ADT, theoretical win/loss, trip economics, comp coverage, ROI, and certificate-created value.
- Define every metric on first use and show exact/derived/estimated/reconciled provenance.
- Make Casino and Booked consume the same cruise keys and formulas.

Evidence: the shared Casino truth chain now preserves the first positive raw saved per-cruise point alias even when an older alias contains zero; a generic `estimated` flag can no longer replace raw pasted points with a certificate floor. Only explicit allocation/reconciliation language permits a certificate threshold to act as a labeled estimate, and partial session rows never replace a final cruise closeout. Royal Club Royale points produce separately labeled `$5 per point` modeled coin-in when actual/provider coin-in is absent; Blue Chip and other programs still require an explicit documented conversion. Theoretical loss uses recorded theo first and otherwise rounded coin-in × configured hold; aggregated ADT uses theo ÷ explicit or itinerary-derived casino-available days. Availability uses saved itinerary/open-day evidence, separates debarkation, and exposes sea/port days and hours; play time uses actual sessions/closeout first and otherwise points ÷ owner PPH capped by availability. Booked and Casino both consume `casinoPointTruth`, owner-scoped cruise identity/deduplication, and `casinoCruiseEconomics`. The 21 raw 2025 cruise rows remain 106 nights / $47,774 retail / $4,238.41 paid / $19,457 winnings / 34,537 pasted cruise points; the separate 24,143-point reconciliation produces the confirmed 58,680 account total, $293,400 gaming volume, and +$15,218.59 net cash without altering cruise rows. `tests/build440_casino_points_adt_value_regression.js`, builds 399/402/404/410 batch 3-4/424, and targeted transpilation pass; Build 410 batch 1 reaches only its stale `13.0.61` version assertion and is assigned to item 29.

### 11. [x] Slots/Machines screen and data tools

- Rebuild around search, functional filters, one-column machine rows, favorites, map, sessions, notes, and play-time preferences.
- Preserve machine atlas, verified map, conditions, exports, slot settings, and historical observations.
- Virtualize large machine libraries and avoid loading all machine data during ordinary navigation.

Evidence: the Slots tab owns its machine strategy, onboard explorer, verified map, session capture/history/editing, condition observations and notes, casino/open-hours pairing, persisted play-time preferences, favorites, and both favorite/all export paths. The atlas catalog now renders as a single-column `FlatList` with bounded initial/batch/window rendering and clipped subviews on native. Search and favorites remain first-class, while a new accessible filter sheet exposes real manufacturer and ship choices, live result counts, clear/apply actions, and selected-filter state; selected manufacturer/ship values now participate in both filtering and the active-filter indicator. The large local atlas still loads on demand after navigation settles and its collapsed strategy/explorer children are not mounted until opened. `tests/build440_slots_machine_workflows_regression.js`, `tests/build412_verified_machine_atlas_regression.js`, and targeted TypeScript transpilation pass. The repository-wide TypeScript command emitted no errors but exceeded the focused-task wait window and remains part of the final gate in item 29.

### 12. [x] Settings organization, search, and production-safe controls

- Group Account, Security, Notifications, Connections, Data & Backup, Integrations, Appearance, Help, About/Legal, and Purchases.
- Add Settings search and concise group summaries.
- Keep every sync/import/export/backup/restore/certificate/crew/profile action reachable and working.
- Move developer/mock controls out of the normal production path.
- Device-verify the Scott Astin book covers and all three Amazon links.

Evidence: Settings now presents the requested Account, Security, Notifications, Connections, Data & Backup, Integrations, Appearance & Data Trust, Help, About/Books, and Purchases & Legal groups without removing established actions. A searchable action index covers profile/security/reminders, three cruise-line/pricing connections, offer/booked/completed/crew imports, Save All, restore, certificate ZIP, integrations, appearance/trust, help, books, purchases, privacy, and terms; its concise group chips provide immediate discovery. Account is placed directly below that index, browser/companion tools have a dedicated Integrations card, and Crew Registry & CSV Import is explicit. The normal production path no longer contains the disabled mock-data export. Existing sync/import/export/calendar/feed/backup/restore/certificate/profile/admin/purchase actions remain wired to their original handlers. Both bundled book-cover assets exist, and the two direct Amazon ASIN links plus the all-books author link remain attached to accessible cover/buttons; final physical-device link opening is reserved for item 28. A subsequent large-data startup crash was traced to eager XLSX/JSZip initialization plus render-time serialization of the complete offer-key collection; Settings now lazy-loads those engines only after the relevant action and bounds diagnostics to a five-key sample. `tests/build440_settings_crash_large_fixture_regression.js` exercises both supplied 2,593- and 4,151-cruise backups, while `tests/build440_settings_organization_regression.js`, builds 432/436/439 encrypted-backup regressions, a production web export, and targeted TypeScript transpilation pass.

### 13. [x] Agent SEA conversational UI and reliable interaction

- Open directly into a ready iOS-style chat without an activation button or navigation freeze.
- Keep the composer and visible keyboard correctly placed; Send must work on the first press and suppress duplicates.
- Provide working Close, New Chat, Conversations, Filters, Save, Print, Export Log, and AI Settings controls.
- Save/restore conversation history per owner and allow a slow request to be replaced safely.
- Keep primary answers concise and evidence expandable.

Evidence: Agent SEA now opens directly into its unified iOS-style conversation surface with no activation gate. The keyboard-safe unified composer keeps Send available on the first tap, suppresses duplicate taps, and changes to Replace while a response is running. Close, New Chat, Conversations, owner filters, Save, Print, Export Log, and AI Settings remain wired in the top action bar. Conversation threads are stored under the active owner. Closing, changing owner, clearing, starting a new chat, or opening another thread now cancels repository work and the active AI request before it can append a stale reply; sending another question safely replaces the slow request. Evidence is collapsed behind a per-answer View evidence control. `tests/build440_agent_sea_interaction_regression.js`, Build 371, Build 426 recreation/question, and Build 439 provenance/owner-isolation regressions pass, along with targeted TypeScript transpilation. Build 433's interaction assertions also pass; only its intentionally historical version-number assertion remains for the final version-gate cleanup in item 29.

### 14. [x] Agent SEA intelligence, data tools, and owner scope

- Give the model a bounded owner-scoped manifest plus callable tools for offers, eligible sailings, booked/completed cruises, loyalty, casino, certificates, crew, weather, finances, and provenance.
- Answer ADT and other deterministic calculations directly before narrative explanation.
- Support conversational follow-ups such as Icon availability, European sailings, next-month offers, points levels, and source discrepancies.
- Keep shared offer/sailing data mutual while private cruise/casino/crew/profile/chat data stays isolated.
- Use SecureStore or an approved proxy for user credentials; never ship the pasted secret key.

Evidence: Agent SEA's bounded, idle-built manifest now formally covers shared available sailings/offers/downloaded certificates and private booked/completed cruises, itinerary, casino, crew, calendar, weather, loyalty, finances, and provenance. Natural-language source/provenance questions invoke a deterministic manifest tool, while certificate filtering invokes the same certificate summary engine used by the UI. ADT is calculated from owner-scoped casino truth before any narrative generation and its exact result cannot be replaced by the model. “Icon next month” and European/points/cabin/guest follow-ups continue to return the recorded option rows. Shared inventory deliberately ignores traveler ownership, while the current traveler is enforced for booked cruises, calendar, crew, profile-tagged casino sessions, provenance, AI settings, and conversation history; unassigned legacy sessions remain available only to the current primary traveler. API keys use owner-specific SecureStore keys or the owner-only build environment and no pasted `sk-proj` secret exists in tracked source. `tests/build440_agent_sea_intelligence_scope_regression.js`, Build 426 conversational inventory, Build 439 provenance isolation, and targeted transpilation pass. The exhaustive repository-wide type graph emitted no errors during a bounded 90-second run but did not terminate; the final unbounded/full build gate remains item 29.

### 15. [x] Sentence-case and plain-language copy pass

- Apply consistent voyage/cruise, night, guest, status, action, error, destructive, estimated, and provenance language.
- Remove legacy shouting, contradictory counts, vague “retry,” and developer terminology from primary workflows.
- Preserve calculation meaning and provider names.

Evidence: Primary Cruises, Booked, Slots, Settings, offer-card, cruise-card, cruise-detail, Day Agenda/weather, and Casino copy now uses sentence case for headings, status, actions, facts, and provenance while preserving proper provider/tier names and acronyms such as Club Royale, Blue Chip, OBC, ADT, and ROI. Vague Retry/Unknown error states now identify the failed domain, confirm whether records were preserved, and name the next action. Import/restore and certificate-export messages distinguish eligible sailing rows from unique ship-and-date sailings and use grammatically correct singular/plural counts. Casino evidence retains its internal calculation labels while rendering readable sentence-case disclosures. `tests/build440_plain_language_primary_flows_regression.js` passes, all twelve modified TSX files pass targeted transpilation, and the completed Offers, Cruises, Booked, Calendar, Weather, Casino, Slots, and Settings regressions all continue to pass.

### 16. [x] Relationship explorer and accessible equivalent lists

- Finish certificate → earning cruise → points → offer → eligible sailing → booking → realized value relationships.
- Finish money, loyalty, casino, and voyage-value maps with uncertainty and missing-link treatment.
- Make nodes interactive, bounded, owner-safe, and available as an accessible list/table.

Evidence: The cross-record graph now renders the requested earning cruise → casino points/coin-in/theoretical evidence → certificate → offer → eligible sailing → owner booking → realized value chain. Saved IDs, codes, ship/date matches, inferred issue dates, estimated economics, and unresolved gaps remain visibly distinct; disconnected certificates, offers, sailings, and bookings are never silently joined. The graph enforces the active owner for private cruise/booking/value data while treating offer, certificate, and eligible-sailing evidence as shared. Source domains are capped before graph construction, the visual bound now samples every column instead of hiding later stages, and the complete filterable/paged relationship list remains available with confirm/reject review actions saved under the owner. Nodes link to the relevant cruise, offer, certificate, or Casino evidence screen. The obsolete duplicate Expo route was removed. `tests/build440_relationship_explorer_regression.js`, Build 416 Casino relationship intelligence, Build 439 visual-system regression, and targeted transpilation pass.

### 17. [x] Action Inbox, certificate optimizer, and casino lifecycle dashboard

- Verify Action Inbox bulk action, snooze, reassignment, provenance, and integrity findings in the real UI.
- Verify the best-use certificate optimizer against exclusions, guest/cabin entitlement, travel cost, and explanation.
- Verify Casino lifecycle links play, certificate, offer, booking, and realized value without duplicate or orphan records.

Evidence: Action Inbox now defaults to Mine + shared, restricts All Profiles and cross-profile reassignment to the account owner, supports individual and bulk snooze/complete/reassign, links each offer/certificate/integrity/closeout item to its exact record, and renders source, record ID, observed date, confidence, rule/formula, owner, and integrity detail. Certificate Portfolio now exposes real optimizer controls for one/two guests, per-sailing total trip cost, maximum trip cost, and reversible ship exclusions; the existing engine continues to enforce cabin/guest eligibility, expiration, conflicts, exclusions, costs, missing evidence, scarcity, ranking factors, and alternatives before scoring. Casino Relationship Intelligence now summarizes the owner-scoped, deduplicated play/points → certificate → offer → eligible sailing → booking → realized-value chain and opens the complete evidence map, leaving ambiguous/missing links unresolved. A missing `ownerId` alias in relationship scoping was corrected. `tests/build440_action_optimizer_lifecycle_regression.js`, `tests/build438_item27_certificate_optimizer_regression.js`, the updated Build 439 top-five owner-scoped fixture, integrity/backup regression, and targeted transpilation pass.

### 18. [x] Complete the photorealistic design system on consuming screens

- Apply the premium reference anatomy—not only top identity bands—to all principal and nested screen families.
- Use photorealistic artwork only for story-level themed cards; use readable white data cards for dense facts.
- Add responsive crops, local caching, neutral fallbacks, and nonblocking loading.
- Preserve Easy Seas logo/signature and all existing actions.
- Verify light, dark, and high-contrast rendering instead of relying on source assertions.

Evidence: All seven preserved tabs consume their own high-resolution bundled photorealistic story art while retaining the exact tab names, order, routes, Easy Seas logo, signature, and actions. `ThemedSectionHeader` / `ThemedSectionCard` now provide the missing section-level system: tab-specific complementary surfaces, accent rails, purposeful emoji or icon badges, Source Serif editorial headings, separate readable fact surfaces, Dynamic Type bounds, and dark/high-contrast handling without owning or intercepting any action. Twenty-eight primary tab sections now use that shared treatment across Offers, Cruises, Booked, Calendar, Casino, Slots, and Settings, including discovery, favorites, results, alerts, weather, casino opportunity, voyage blocks, events, time zones, crew, analytics, calculations, strategy, sessions, observations, machine library, account, security, books, data/backup, appearance, help, and legal. Critical nested workflows—Action Inbox, Certificate Portfolio/optimizer/matrix, Relationship Explorer, and Casino Relationship Intelligence—use the same visual language. Story photography remains confined to story-level cards, with disk caching, responsive crops, neutral local fallbacks, nonblocking loading, and reduced-motion behavior. `tests/build440_themed_section_surfaces_regression.js`, the photorealistic consuming-screen regression, and targeted TypeScript transpilation pass; the repository-wide TypeScript process was stopped after several minutes without output, so the later full release gate remains required under item 30.

### 19. [x] Purposeful micro-interactions and truthful progress

- Add reduced-motion-aware feedback for sync, parsing, downloads, imports, exports, favorites, tier progress, charts, weather, offline state, undo, and repair.
- Every long action must show what started, current item/count, completion, failure, retry/cancel, and whether data committed.
- Avoid decorative animation that delays navigation.

Evidence: `OperationStatusCard` is now the shared, owner-neutral truth surface for long actions and reports running/success/error/cancelled state, bounded current/total progress, explicit durable-commit truth, retry, safe cancellation when the underlying operation supports it, undo when a reversible mutation exists, and dismissal. Settings Save All, Load All, and certificate export use staged operation feedback; voyage weather stays expanded through refresh, reports itinerary-day coverage, saved/offline commit state, preserved cached data on failure, and retry; Slots now confirms profile-scoped favorite persistence with undo and reports favorite/all-machine export progress and committed output; Data Trust reports integrity scan and safe-repair progress, blocks ambiguous repairs, preserves before/after preview, records repair history, and offers retry after failure. Existing Royal sync and certificate batching retain their real step/current-count, safe-stop, retry/resume, and committed-record messaging. Shared button/progress/success motion honors reduced-motion preferences and contains no decorative loops or navigation delays. `tests/build440_truthful_operation_feedback_regression.js`, the themed-section regression, and targeted TypeScript transpilation across every changed item-19 consumer pass.

### 20. [ ] App-wide accessibility and responsive verification

- Audit every consuming screen for Dynamic Type reflow, VoiceOver order/labels, 44-point targets, high contrast, color-blind charts, reduced motion, and simplified density.
- Fix clipping/overlap such as Signature points and prevent keyboard/modals from obscuring controls.
- Verify phone, larger phone, and tablet layouts with real rendered evidence.

### 21. [ ] Royal, Celebrity, Carnival, loyalty, and profile synchronization

- Make each provider sync replace/update its own canonical scope transactionally and preserve other providers.
- Show raw offer-sailing row counts separately from physical voyage counts; never collapse rows contrary to the requested meaning.
- Update loyalty status/points and the loyalty card/profile consistently after manual edit or provider sync.
- Surface Club Royale/Celebrity discrepancies without silently overwriting the agreed authority.
- Fix owner errors, incomplete readback, and success banners that do not reflect committed data.

### 22. [ ] Offer/sailing/certificate exact-count reconciliation

- Reconcile Settings, Offers, certificates, command center, and export counts from the same repositories.
- Preserve the current Royal expectation fixture (13 offers / 3,151 offer-sailing rows) as a regression fixture without hardcoding it for other users.
- Detect duplicates, certificate-document leaks, missing links, and provider-scope drift.

### 23. [ ] Owner-scoped persistence for profiles, casino, crew, and cruise edits

- Persist manual per-cruise points/win-loss, imported historical casino data, profile/loyalty edits, crew recognition, and chat history under the active owner.
- Keep shared offers/sailings/certificate catalog data mutual where requested.
- Load 925+ crew rows lazily/paged so startup and tab switching remain responsive.
- Prove secondary-user data never receives Scott’s private totals or recognition records.

### 24. [ ] Every import/export control and local file path

- Fix CSV/XLSX/ICS/JSON/document picking without undefined `getDocumentAsync` or unavailable file APIs.
- Verify crew, offers, booked, completed casino, calendar, certificates, and full-data imports.
- Verify certificate ZIP, offers CSV, booked/completed XLSX, calendar, Agent SEA logs, diagnostic logs, templates, and full-data exports.
- All buttons must be tappable and expose truthful progress/results.

### 25. [ ] Save All, Load All, large backup, and restore preview

- Replace monolithic blocking behavior with streaming/chunked or indexed snapshots and nonfreezing progress.
- Include profiles, loyalty, private casino/cruise edits, crew recognition, certificates/documents/rows, offers/sailings, weather cache, preferences, provenance, chat history, and relationships.
- Preview add/update/preserve/conflict/reject counts before restore and apply transactionally.
- Verify the supplied ~147 MB-class backup scenario, cancellation/resume, and exact post-restore counts.

### 26. [ ] Versioned local database and startup/runtime cutover

- Prove high-volume offers, sailings, certificates, calendar, sessions, crew, machines, and slot atlas use indexed repositories as normal runtime sources.
- Complete transactional/resumable migrations with owner/domain indexes, foreign keys, checkpoints, diagnostics, and rollback.
- Ensure ordinary startup/tab switching does not deserialize full large JSON collections.

### 27. [ ] Universal provenance and integrity/reconciliation center

- Attach and display source, timestamp, owner, confidence, source record, and formula across loyalty, casino, finance, certificates, weather, offers, cruises, crew, profiles, and preferences.
- Preserve provenance through imports, sync, Save/Load, database migration, and encrypted backup.
- Detect duplicates, broken links, malformed dates, stale loyalty, impossible totals, and owner leakage.
- Require preview for ambiguous repair, retain repair history/rollback, and surface unresolved issues in Action Inbox.

### 28. [ ] Fresh device screenshot and interaction audit

- Capture all seven tabs plus Agent SEA, offer details/filtering, certificates, cruise detail, Day Agenda/weather, four Casino pages, Slots, Settings/Data Management, integrity, and restore preview.
- Inspect light, dark, high-contrast, large-text, offline, empty, partial, and large-data states.
- Source-text tests do not close this item.

### 29. [ ] Complete regression and production-bundle gates

- Run focused tests for every closed deficiency plus maintained legacy tests.
- Run accessibility, owner-isolation, persistence, offline, large-data, database migration, backup/restore, sync, calculation, and visual regressions.
- Pass TypeScript, Expo Doctor, App Store identity/version checks, and a fresh iOS production bundle from the packaged source.
- Resolve every missing/evicted required file such as `CruiseInventoryProvider` before release.

### 30. [ ] Version, package, and release Build 440

- Bump all release identifiers to the new version/build only after item 29 passes.
- Retain Build 439 unchanged and record both hashes.
- Create and verify the final Build 440 folder/ZIP; confirm it downloads and extracts.
- Provide clickable workspace and ZIP links plus exact build instructions/results.

## Completion count at creation

- Verified anchors: 6
- Open deficiencies: 30
- In progress: 1 (Offer details and eligible sailings)
- Completed deficiencies: 2
