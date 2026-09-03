# Easy Seas Build 444 — Current Completion Todo

Updated from the Build 443 requirement audit on 2026-08-31. This list supersedes the Build 440 deficiency checklist for future execution. Build 443 remains the current verified source baseline; Build 439 remains the untouched rollback baseline.

## Operating rules

- Work on only one numbered item at a time.
- Do not remove, rename, or reorder the seven bottom tabs.
- Preserve the Easy Seas logo, Scott Astin signature, existing user data, routes, actions, and owner isolation.
- A source marker or source-text assertion is supporting evidence, not completion by itself.
- UI work closes only after the consuming workflow is exercised on iOS.
- Shared offers/sailings/certificate catalogs remain shared; private profile, booked-cruise, casino, crew, preference, and Agent SEA data remain owner scoped.
- Do not place API keys, reservation exports, backup data, or credentials in source archives.
- Every completed item must record its focused tests, device evidence, and resulting files.

## Preserved baseline

- [x] Build 439 rollback hashes remain recorded in `BUILD439_ROLLBACK_BASELINE.sha256`.
- [x] Build 443 source ZIP extracts successfully and contains no dataless placeholders.
- [x] Build 443 passes TypeScript, Expo Doctor 18/18, native prebuild, 160 maintained tests, and the 3,814-module iOS production export.
- [x] Build 443 includes the 13-offer/3,151-sailing Offers responsiveness repair.
- [x] Build 443 includes the Settings `Search` crash repair and scheduling guest-count type repair.

## Sequential closure work

### 1. [IMPLEMENTED — DEVICE/AUTH ACCEPTANCE PENDING] Secure and reliable Agent SEA delivery

- Remove the `EXPO_PUBLIC_AGENT_SEA_OWNER_OPENAI_API_KEY` runtime path; an `EXPO_PUBLIC_*` secret can be embedded in the application bundle.
- Select one safe production design:
  - Preferred: a minimal authenticated AI proxy that keeps the provider key server-side.
  - Fully local alternative: every owner enters a key once and it is stored only in iOS SecureStore.
- Keep owner-scoped manifests and direct deterministic tools for ADT, casino totals, loyalty, offers, eligible sailings, booked/completed cruises, certificates, crew, finances, weather, and provenance.
- Open directly into ready chat; preserve first-tap Send, replacement/cancellation, Close, New, Conversations, Filters, Save, Print, Export Log, and AI Settings.
- Add tests proving no secret appears in the JavaScript bundle, logs, backup, exported conversation, or source ZIP.

Done when a real iPhone can conduct a multi-turn owner-scoped conversation, deterministic questions return exact answers first, and bundle scanning finds no credential.

Implementation evidence (2026-08-31):

- Removed the client-bundled `EXPO_PUBLIC_*` owner-key path.
- Added `/api/agent-sea/respond`, which reads only `AGENT_SEA_OPENAI_API_KEY`/`OPENAI_API_KEY` in the backend runtime, bounds input, rate-limits requests, suppresses provider details, and sends `store: false` to the Responses API.
- Personal keys now use iOS SecureStore only; the previous AsyncStorage fallback is removed and legacy plaintext storage is deleted when encountered.
- Owner UI opens as built-in AI ready without a key-entry/activation step; deterministic local answers remain the fallback.
- `tests/build444_agent_sea_secure_delivery_regression.js` passes.
- `npx tsc --noEmit` passes.
- A fresh 3,814-module iOS export completed; all 36 output files (36,036,085 bytes) were scanned with zero matches for public/server secret names or key-shaped values.
- Remaining acceptance: the existing Easy Seas login is device-local and the backend currently has no independently verifiable account session, so the owner email allowlist is not yet strong server authentication. A real iPhone multi-turn run and a production backend session/attestation decision remain required before this item can be checked complete.

### 2. [SKIPPED BY USER] Restore the full iOS verification environment

- Install a stable full Xcode release compatible with Expo SDK 54; Command Line Tools alone are insufficient.
- Accept the Xcode license and select the full Xcode developer directory.
- Install at least one supported iPhone simulator runtime.
- Confirm `xcodebuild -version`, `xcrun simctl list devices available`, CocoaPods, and an Expo native build all work.
- Do not use a corrupted beta Xcode archive as the release toolchain.

Done when Build 443/444 can launch in an iPhone simulator and native logs/screenshots can be collected.

Disposition (2026-08-31): The user explicitly directed that this item not be performed. No Xcode, simulator, CocoaPods, license, or developer-directory changes will be made as part of Build 444. Later items will separate source/web/repeatable-smoke evidence from unavailable real-iOS evidence.

### 3. [IMPLEMENTED — NATIVE EXECUTION NOT CLAIMED] Add repeatable interaction smoke coverage

- Add automated or repeatable iOS smoke flows for all seven tabs and critical nested screens.
- Exercise tap targets, back navigation, modal dismissal, scrolling, keyboard behavior, and navigation-state restoration.
- Load a production-sized fixture containing 13 offers and 3,151 offer-sailing rows.
- Fail on frozen JS interaction, blocked tabs, invisible overlays, missing icons, navigation loops, or uncaught runtime errors.

Done when the app completes the smoke route without a crash, dead tap, or JS-thread interaction stall.

Implementation evidence (2026-08-31):

- Added stable `tabBarButtonTestID` targets for all seven preserved tabs.
- Added `.maestro/build444-seven-tab-smoke.yaml`, which taps every tab, waits for its themed destination identity, then proves Settings can return to Offers.
- Added the missing Casino `TabIdentityBand`, giving all seven tab roots a consistent destination assertion and photorealistic identity card.
- `tests/build444_repeatable_interaction_smoke_contract.js` passes.
- The 13-offer/3,151-sailing interaction budget regression passes in 199 ms.
- `npx tsc --noEmit` passes.
- Local running-app evidence: Offers, Cruises, Booked, Calendar, Casino, and Slots accepted navigation taps with no captured console error. A diagnostic DOM-enumeration call itself timed out on the large Slots tree before Settings could be verified; it was stopped rather than mislabeled as an app pass.
- Native Maestro execution is not claimed because item 2 was explicitly skipped by the user.

### 4. [IMPLEMENTED — NATIVE EXECUTION NOT CLAIMED] Offers, eligible sailings, certificates, and command center acceptance

- Tap View, Decode, card press, Compare, Archive, Skip, booking, in-progress, used, certificate, import, refresh, and command-center actions.
- Confirm each action targets the same canonical offer instance.
- Confirm displayed counts equal drill-down rows and all 3,151 rows remain available.
- Exercise ship, class, cabin, guests, departure port, dates, nights, itinerary, GTY, and NextCruise filters and Clear All.
- Confirm one-/two-guest and cabin entitlements display row-by-row.
- Download current/next-month certificates; restart; Save All/Load All; drill through Cert Summary; export the complete certificate ZIP.

Done when all actions and rows work on iPhone with production-sized data and persist after restart.

Implementation evidence (2026-08-31):

- Corrected offer redemption so `Mark as Used` persists `status: 'used'` and `updatedAt` instead of deleting the offer and destroying its historical/certificate relationship.
- Replaced the Offers pull-to-refresh delay-only placeholder with a real durable CoreData reload plus indexed inventory count/facet refresh.
- Added stable interaction identifiers for closing offer details, row-level eligible sailings, in-progress, and used actions; cabin and one-/two-guest eligibility are included in each row's accessibility label.
- Added `tests/build444_offer_certificate_acceptance_runtime.js`, which retains 13 distinct offers and all 3,151 canonical offer-sailing options, and exercises itinerary, ship class, cabin, guest count, GTY, NextCruise bonus, and night-range filtering plus Clear All semantics.
- The new acceptance test passes; `tests/build442_ios_offers_interaction_regression.js` passes with 13 offers/3,151 sailings in 29 ms; `npx tsc --noEmit` passes.
- A direct audit of 45 offer/certificate regressions produced 35 passes. The ten nonpasses were eight intentionally historical version-snapshot checks and two optional tests whose private August manifest is not present; maintained release gates already exclude those files for those reasons.
- Certificate summary stages, month rollover, hydration/export progress, backup retention, production PDF parsing, and the uploaded Royal certificate fixture (four PDFs/3,858 rows) remain covered by passing maintained regressions.
- The supplied 2026-08-27 backup contains 10 offers/2,593 sailings, not 13/3,151; the production-scale acceptance fixture is deliberately separate so older backup truth is not rewritten or mislabeled.
- Native iPhone execution/restart is not claimed because item 2 was explicitly skipped by the user.

### 5. [IMPLEMENTED — NATIVE EXECUTION NOT CLAIMED] Cruises and Booked acceptance

- Exercise discovery search, complete filter sheet, sort, Favorites reachability, bounded results, and return-state restoration.
- Confirm cruise rows never fabricate zero casino, sea-day, or port-day values.
- Exercise Next Voyage, Upcoming/Completed/All, consecutive blocks, itinerary, readiness, Cruise Planning, receipts, points, win/loss, guests, reservations, and notes.
- Confirm multiple reservations remain distinct but relate to one physical voyage.
- Reconcile Booked and Casino calculations through the same canonical cruise keys.

Done when representative future, active, completed, back-to-back, and missing-itinerary cruises display correct truth on iPhone.

Implementation evidence (2026-08-31):

- Added occupancy-aware Crown & Anchor projection using the owner-confirmed rule: one point per night for each occupant in shared accommodations and two points per night for a solo traveler. Unknown occupancy remains unknown; cabin category does not silently change the rule.
- Updated the rule after the owner's final clarification: a suite adds one additional Crown & Anchor point per night, producing 3 points/night for a solo suite and 2 points/night for each occupant in a shared suite. The shared projection engine now drives Booked, Loyalty, and Casino loyalty evidence consistently.
- Removed the Booked card's blanket `nights × 2` points display. Cards now label projected C&A points explicitly and do not confuse them with recorded casino points.
- Strengthened physical-voyage identity across legacy profile-id changes and date formats while preserving every reservation record independently.
- Added canonical physical-voyage consolidation for Casino/economics calculations so a second cabin/reservation cannot double-count voyage nights, casino points, cash result, ADT inputs, or averages. Manual/user-entered casino evidence wins over lower-authority duplicates.
- Added consensus-only catalog enrichment for Booked cards: exact ship/date catalog rows may fill a missing itinerary only when all material matches agree; conflicts remain visibly unknown instead of choosing an arbitrary offer row.
- Added `tests/build444_cruises_booked_acceptance_runtime.js`, covering solo/shared/unknown occupancy, two reservations on one voyage, manual point precedence, consecutive blocks, catalog itinerary consensus/conflict, sea/port-day truth, casino opportunity, and planning/detail action targets.
- The new acceptance test, Build 440 Cruise Discovery, Build 440 Booked truth, Build 399 Casino truth, Phase 1 critical sync repair, Build 414 confirmed Agent actions, and `npx tsc --noEmit` all pass.
- Favorites remain above the virtualized catalog; discovery filters and return-state cache remain covered by executable regression tests.
- Native iPhone tapping and restart are not claimed because item 2 was explicitly skipped by the user.

### 6. [IMPLEMENTED — NATIVE EXECUTION NOT CLAIMED] Calendar, Day Agenda, Tarot, Crew, weather, and position acceptance

- Exercise Agenda/Week/Month/90-day modes, Tarot-only month view, clearing controls, Crew navigation, and generated deadlines.
- Confirm previous/next-day arrows update date, itinerary, events, weather, and selected cruise day.
- Confirm weather remains expanded after refresh/sync.
- Verify in-range dated forecasts and clearly labeled current/planning reports outside provider range.
- Verify NOAA/NWS/NDBC source, timestamp, buoy/zone, distance, confidence, freshness, fallbacks, offline cache, and position-map disclosures.
- Test an entire multi-sailing back-to-back voyage block.

Done when every voyage day resolves from itinerary/route position and never substitutes false certainty.

Implementation evidence (2026-08-31):

- Added a canonical physical-voyage weather selector that deduplicates multiple reservations and exposes the complete connected same-ship back-to-back block from any selected day, including same-day turnaround dates.
- Day Agenda now renders every leg in the selected back-to-back weather block as its own collapsible folder and labels the block's total sailings and date range.
- Added a visible geographic map to every resolved Day Agenda weather card. It uses a real 3×3 OpenStreetMap tile grid centered on the forecast coordinates, includes attribution and a position marker, and opens the same point in Apple Maps when tapped.
- Position language remains truthful: historical, today's expected itinerary position, or planned itinerary position; every map states that it is not live AIS tracking.
- Added stable Calendar previous/next-period and Go to Today targets while retaining Agenda, Week, Month, 90 Days, Passenger, Tarot-only month, Crew, and Clear controls.
- `tests/build444_calendar_weather_acceptance_runtime.js` passes, including month/leap-day navigation, three consecutive Harmony legs, duplicate-reservation suppression, continuous Sep 10–26 route-day coverage, map tile geography, source disclosures, and persistent expansion.
- Build 440 Calendar/Agenda/Crew, Build 440 weather-position truth, Build 423 every-voyage-day weather, Build 426 Harmony route-position, and `npx tsc --noEmit` all pass.
- Native iPhone tapping, online tile rendering, provider refresh, and offline restart are not claimed because item 2 was explicitly skipped by the user.

### 7. [IMPLEMENTED — NATIVE EXECUTION NOT CLAIMED] Casino and Slots acceptance

- Exercise all four Casino pages, every chart, metric, definition, evidence panel, receipt/host/value/ship/certificate/session/calculation tool, and progressive disclosure.
- Reconcile raw cruise points, annual adjustment, current-season totals, casino-open hours, player hours, points/hour, coin-in, ADT, theoretical, ROI, and certificate-created value.
- Exercise Slots search, filters, one-column rows, favorites, map, sessions, notes, preferences, exports, atlas, and historical observations.
- Test large libraries and switching tabs while data is loading.

Done when Casino and Slots remain responsive and all owner-scoped values match their canonical sources.

Implementation evidence (2026-08-31):

- Added one guarded Slots filtering/keying engine used by the consuming tab. Missing names/manufacturers/assignments no longer throw during search, manufacturer, ship, or favorites filtering, and list keys no longer depend on the row index.
- Added selected-state accessibility semantics to the four Casino destination controls while preserving Intelligence, Charts, Play, and Calcs.
- Added `tests/build444_casino_slots_acceptance_runtime.js`, which runs the 21 annual cruise records through canonical Casino truth, season reconciliation, dashboard metrics, and full economics reconciliation.
- The runtime acceptance keeps 34,537 raw cruise-level points separate from the 24,143 annual account reconciliation and verifies final totals of 58,680 points, $293,400 modeled coin-in, $19,457 winnings home, and +$15,218.59 net cash. With no user sessions, play hours and ADT remain explicitly estimated rather than being labeled actual.
- The same test filters a 20,001-row machine library—including a malformed row—by search, favorites, manufacturer, and ship in about 6 ms and verifies stable identities.
- Build 440 points/ADT/value, four-page Casino shell, Slots workflows, Build 424 annual ledger, Build 438 casino acceptance, Build 400 command center, Build 399 Casino truth, Build 402 calculations, Build 404 owner-scoped visuals, Build 412 verified atlas, Build 416 relationship intelligence, and `npx tsc --noEmit` all pass.
- Native tab switching, modal operation, export share sheets, and restart persistence are not claimed because item 2 was explicitly skipped by the user.

### 8. [IMPLEMENTED — NATIVE EXECUTION NOT CLAIMED] Settings, files, imports, exports, and Amazon links acceptance

- Exercise every Settings group and Settings search result.
- Test CSV, XLSX, ICS, JSON, PDF/document selection using iOS Files and iCloud Drive.
- Import offers, booked cruises, completed casino history, calendar, crew workbook, certificates, and full data.
- Export certificate ZIP, offers CSV, booked/completed workbook, calendar, Agent SEA log, diagnostic log, templates, and full data.
- Verify progress, cancellation, retry, success, failure, and exact readback.
- Tap both book covers and the all-books link; confirm all three open the intended Amazon pages.

Done when every control is tappable and every imported/exported file is readable and counted correctly.

Implementation evidence (2026-08-31):

- Hardened the generic CSV/ICS/JSON picker, completed-cruise CSV/XLSX picker, full-backup picker, and crew-registry picker. Each now verifies that `getDocumentAsync` exists before invoking it, so a missing native module returns a clear reinstall message instead of the former undefined-property crash.
- Added `tests/build444_settings_files_acceptance_runtime.js`. It builds and reads back a real certificate ZIP containing the master CSV, certificate summary, per-certificate CSVs, guest counts, cabins, and README; it also creates and converts a real XLSX crew workbook and verifies exact rows.
- The same acceptance test proves Save All, Load All, certificate export, full-data export, and restore remain explicit executable controls; certificate export hydrates retained records before use; progress UI is present; and both individual book covers plus the all-books action retain their intended Amazon destinations.
- The supplied 2026-08-27 backup was parsed through the production summary builder without mutation and reported 2,593 sailings, 83 booked cruises, 10 offers, 630 calendar events, 218 machine records, two profiles, 55,997 casino points, and $279,985 modeled coin-in.
- Build 444 Settings/file acceptance, Build 432 Settings touch/progress, Build 440 Settings organization, Build 399 crew import, Build 380 certificate device/export safeguards, Build 436 certificate hydration/progress, and `npx tsc --noEmit` all pass.
- Native iOS Files/iCloud selection, cancellation, share-sheet destinations, and Amazon handoff are not claimed because item 2 was explicitly skipped by the user.

### 9. [IMPLEMENTED — LIVE AUTH ACCEPTANCE PENDING] Live provider synchronization acceptance

- Perform fresh authenticated Royal/Club Royale, Celebrity, and Carnival syncs.
- Confirm each provider replaces only its own canonical scope transactionally and preserves the others.
- Confirm raw offer-sailing counts and physical-voyage counts remain distinct.
- Confirm loyalty points/status update Settings, profile, loyalty cards, and Agent SEA only after committed readback.
- Test primary and secondary users independently while retaining shared catalogs.
- Capture discrepancy handling, owner errors, interruption, retry, and truthful completion banners.

Done when committed repository counts match every consuming screen after restart.

Implementation evidence (2026-08-31):

- Added `lib/sync/profileSyncReadback.ts` and wired it into Royal, Celebrity, and Carnival publication. A provider profile update is now re-read from owner-scoped durable storage and checked field-by-field before the UI reports it as published.
- Loyalty, extended-loyalty, profile, and Carnival VIFP publication failures can no longer end with an unqualified success banner. They are retained as publication warnings and force `complete_with_warnings` after the offer/cruise/booked transaction commits.
- Added `tests/build444_provider_sync_acceptance_runtime.js`. It proves an authoritative Royal primary-user replacement removes only Royal primary rows, preserves Royal secondary plus all Celebrity/Carnival rows, and then proves a Celebrity secondary-user replacement preserves every unrelated provider/owner scope.
- The same test verifies successful, stale, and wrong-owner loyalty/profile readback; raw available rows, physical sailings, and offer-sailing relationships remain separately published; and Settings, the loyalty card, and Agent SEA subscribe to the live owner-scoped sources.
- Corrected the shared Crown & Anchor engine after the final owner clarification: shared 1/night, solo 2/night, plus 1/night for a suite. The Loyalty provider and Casino evidence now use the same engine as Booked.
- Build 444 provider sync acceptance, Build 337 transaction, Build 434 loyalty publication, Phase 1 critical sync repairs, ownership-race protection, Build 425 offer-option inventory, Build 438 sync history, Royal deliverable 2, Carnival deliverable 3, updated Build 444 Booked acceptance, and `npx tsc --noEmit` all pass.
- A fresh authenticated Royal, Celebrity, and Carnival website run, restart, and real-account discrepancy capture still require live provider sessions and native iOS execution; they are not claimed because item 2 was skipped and no credentials were supplied to this run.

### 10. [IMPLEMENTED — AUGUST 19 ICLOUD PLACEHOLDER NOT CLAIMED] Complete supplied-file fixture coverage

- Preserve a named offers fixture with its expected row/offer counts rather than relying on a missing `offers (15).csv`.
- Record the current `offers.csv` fixture separately; it presently parses as 391 sailing rows and five offers.
- Run the master crew workbook, completed-cruise CSV, both saved backups, and certificate fixtures through the real import path.
- Assert row-level guest/cabin fields, owner assignment, historical totals, duplicate handling, and post-import persistence.

Done when fixture expectations describe the files actually packaged or supplied and no optional test is skipped merely because its source file disappeared.

Implementation evidence (2026-08-31):

- Preserved the locally available `offers.csv` as `tests/fixtures/offers-current-2026-08-27.csv` with a checksum manifest. It parses through the production offers parser as 391 offer-sailing option rows and five exact offer codes; every row retains ship/date, cabin entitlement, and guest eligibility.
- Added `tests/build444_supplied_files_acceptance_runtime.js`. It runs the supplied master crew workbook through the production workbook converter/import parser and retains 776 owner-scoped registry rows.
- The supplied completed-cruise CSV is read through XLSX exactly as Settings reads CSV/XLSX files. It retains 33 cruise rows plus three totals, its raw GRAND TOTAL of 47,233 points and +$15,218.59 net cash remains file truth, and it is not silently rewritten to the separate confirmed 58,680 annual reconciliation.
- The locally materialized August 27 and August 24 backups both parse as large-catalog backups with all required top-level domains. The August 24 fixture contains one duplicate legacy profile id, which is explicitly routed to `ensureUniqueUserProfileIds` repair instead of being treated as a distinct owner.
- Uploaded Royal certificate fixtures pass with four PDFs/3,858 sailing rows; the production certificate suite passes six PDFs; cold-start certificate-document persistence passes; and `npx tsc --noEmit` passes.
- The specifically named August 19 iCloud backup exists only as a macOS `dataless` placeholder. A sandboxed `brctl` materialization attempt was rejected by macOS, so its bytes were not read and are not claimed. The gate names the two locally available saved backups it actually tested.

### 11. [IMPLEMENTED — NATIVE EXECUTION NOT CLAIMED] 147 MB-class backup and restore qualification

- Create or obtain a sanitized 147 MB-class backup containing all required domains.
- Test streaming/indexed save, cancellation, checkpoint/resume, encryption, recovery key, progress, and nonfreezing UI.
- Preview add/update/preserve/conflict/reject totals before restore.
- Apply transactionally and compare every domain count and representative record after restart.
- Test available-space failure and corrupted/truncated archives without damaging current data.

Done when the 147 MB-class archive restores exactly on iPhone without a frozen screen or blind replacement.

Implementation evidence (2026-08-31):

- Added bounded, per-record backup sizing with progress and UI yields before encryption. The device now checks real free storage twice—before encryption and again against the exact serialized archive size—and refuses insufficient-space work before publishing a file.
- Strengthened encrypted envelope/archive validation for manifest identity, AES-256-GCM metadata, exact record counts, required record fields, duplicate record identities, chain continuity, truncated JSON, and damaged ciphertext.
- Backup publication now updates visible chain/recovery state only after the local file is written and its size reads back successfully. Cancellation during preflight writes nothing; cancellation during encryption retains only a resumable unpublished checkpoint.
- Restore preview remains read-only and reports add/update/preserve/conflict/reject/delete totals. Owner mismatch is rejected before preview so one profile cannot restore another profile's private chain accidentally.
- Restore application now retains the full pre-restore bundle as a rollback checkpoint, imports the conflict-preserving merge, reads every dataset back, compares counts/identities/content, and automatically restores the checkpoint when import or readback fails.
- `tests/build444_147mb_backup_acceptance_runtime.js` creates a sanitized 148 MiB payload spanning cruises, booked trips, offers, calendar, casino, certificates/documents, both profiles, crew, machines, loyalty, preferences, and provenance without leaving a large disk artifact. It encrypted 171 records in 13.176 seconds, emitted 193 progress events and 367 event-loop yields, and restored every record exactly through the recovery key.
- The same acceptance test passes low-space refusal, cancellation/checkpoint/resume, indexed one-transaction publication, conflict preservation, exact readback, truncated archive rejection, manifest-count rejection, and authenticated damaged-ciphertext rejection.
- Build 439 encrypted round-trip, integrity/preview, 4,234-record representative large-backup regression, Build 444 Settings/file acceptance, and `npx tsc --noEmit` all pass.
- Native iPhone save/share/restart and post-restart restore timing are not claimed because item 2 was explicitly skipped by the user.

### 12. [IMPLEMENTED — NATIVE EXECUTION NOT CLAIMED] Database, provenance, integrity, and owner-scope device proof

- Confirm indexed repositories are the normal device runtime source for offers, sailings, certificates, calendar, sessions, crew, machines, and atlas.
- Exercise migration interruption, restart, checkpoint, rollback, owner/domain indexes, foreign keys, and diagnostics.
- Confirm provenance is visible and survives import, sync, Save/Load, migration, and encrypted backup.
- Exercise duplicate, broken-link, malformed-date, stale-loyalty, impossible-total, and owner-leak findings.
- Confirm ambiguous repairs require preview and repair history supports rollback.

Done when primary and secondary device profiles prove isolation and integrity findings reach Action Inbox.

Implementation evidence (2026-08-31):

- High-volume offers, booked cruises, calendar events, sessions, certificates, crew entries/sailings, machine encyclopedia, and slot atlas use indexed repository hydration/replacement on native; available cruise/offer-sailing options remain in their dedicated owner-scoped, generation-based SQLite repository.
- Upgraded the health/trust schema to v6 with foreign keys, WAL, owner/domain indexes, schema diagnostics, resumable domain checkpoints, and an auditable `migration_rollback_history` table.
- Domain migrations now write into a hash-specific staging generation. An interruption leaves the prior live generation untouched; resume continues from the last committed 250-row checkpoint; only a complete staged generation is promoted in one transaction.
- Every migration retains a rollback generation. Data Trust Center now lists source checkpoints and exposes an explicit confirmed rollback that restores prior rows, removes staging data, marks the checkpoint rolled back, and records the reason/counts in migration rollback history.
- Universal provenance refresh covers cruise, offer, certificate, casino, loyalty, finance, weather, crew, profile, and preference domains; shared facts remain null-owner while private facts remain profile-owned. Import/export and encrypted backup include provenance and user preferences, and Agent SEA filters/cites only current-owner plus shared links.
- Integrity scanning covers duplicate cruises, orphan links, malformed dates, stale loyalty, impossible totals, unlinked certificates, broken relationships, and owner leakage. Ambiguous findings remain blocked and never run automatically.
- Safe relationship repair is reversible: quarantine never deletes the source record, repair history now exposes “Restore quarantined relationship,” rollback reopens the issue, and a `rolled_back` audit row is retained.
- Action Inbox “All profiles” now loads and deduplicates findings for every profile the account owner manages; non-owner profiles still see only their own plus shared actions.
- `tests/build444_database_integrity_owner_acceptance_runtime.js` simulates interruption after 250 of 600 rows, verifies atomic resume, verifies audited migration rollback to the exact prior generation, exercises integrity quarantine/rollback, and verifies all-profile Action Inbox, indexed consumers, provenance domains, and owner-scoped cruise inventory contracts.
- Build 439 provenance/database, integrity runtime, integrity/backup, Agent SEA provenance isolation, Build 406/409 owner-isolated casino history, Build 440 content ownership, Build 439 encrypted backup, Build 337 migration, and `npx tsc --noEmit` all pass.
- Native iPhone interruption/restart, SQLite-file inspection, and primary/secondary tapping are not claimed because item 2 was explicitly skipped by the user.

### 13. [IMPLEMENTED — PHONE-SIZE WEB RENDERED; NATIVE/VOICEOVER NOT CLAIMED] Complete visual and accessibility acceptance

- Decide whether the product remains iPhone-only or supports iPad. If iPad support is required, enable and test it; do not claim tablet verification while `supportsTablet` is false.
- Capture phone and larger-phone layouts in light, dark, and high-contrast modes.
- Exercise Dynamic Type, VoiceOver order/labels, 44-point targets, reduced motion, simplified density, color-blind charts, keyboard, and modal behavior.
- Verify Signature points and every other known clipping/overlap case.
- Confirm photorealistic story cards, white dense-data cards, local fallbacks, responsive crops, and nonblocking image loading.
- Preserve the Easy Seas logo and signature exactly.
- Use the user-provided premium voyage screen as the app-wide visual acceptance reference: light oceanic background, prominent serif headings, photorealistic voyage imagery, clean white cards, restrained navy/teal/gold accents, generous spacing, and a clean seven-item bottom bar with immediately readable symbols and labels.

Done when rendered evidence—not source assertions—passes the visual/accessibility review.

Implementation evidence (2026-08-31):

- Kept the product intentionally iPhone-only (`supportsTablet: false`); no iPad support or tablet verification is claimed.
- Corrected the seven tab identity bands to render the bundled photorealistic artwork through `expo-image` with disk/memory caching, reduced-motion-aware transitions, high-contrast overlays, and a bundled-color fallback. The prior implementation rendered as an almost solid navy block in the running web app even though the artwork files existed.
- Rendered the Cruises tab at a 390×844 phone viewport after a clean Metro restart. The photorealistic ship, serif title, readable overlay, white/themed cards, and all seven preserved tab labels were visible.
- Rendered dark mode with extra-large text. Root surfaces for Offers, Cruises, Booked, Calendar, Casino, Slots, and Settings now consume the adaptive palette; the shared loyalty/player card also adapts its surfaces and text rather than remaining a light cream card.
- Rendered high-contrast appearance controls with extra-large text, larger controls, reduced motion, and color-blind-safe charts. Text remained legible and controls remained reachable at the phone viewport.
- Measured the rendered seven bottom-tab targets at about 55.7×61 points. The rendered Player alert/settings targets measured 54×54. The audit found a 40-point Cruises filter control; it now consumes the shared 44/54-point minimum.
- Added scalable title/subtitle line heights to shared themed section headers and retained wrapping/flex-shrink behavior for Signature/points progress labels so long values do not escape their card.
- Preserved the Easy Seas logo/signature assets and all tab routes/actions; no logo or signature file was replaced.
- Added `tests/build444_visual_accessibility_acceptance.js`. It validates the intentional iPhone scope, three theme modes, reduced motion, text/control scaling, color-blind palette, seven-tab order, cached/fallback story artwork, real font files, high-resolution image assets, adaptive root surfaces, progress-label wrapping, and accessible target contracts.
- Build 444 visual/accessibility acceptance, Build 440 accessibility/experience, photorealistic theme, consuming screens, themed sections, bottom navigation, and `npx tsc --noEmit` pass.
- Native VoiceOver focus order, iOS keyboard avoidance, native modal focus trapping, and real-device screenshots are not claimed because item 2 was explicitly skipped.

### 14. [IMPLEMENTED — PHONE-SIZE WEB MATRIX COMPLETE; NATIVE STATES NOT CLAIMED] Fresh screenshot and state matrix

- Capture all seven tabs, Agent SEA, offer filters/details, certificates, cruise detail, Day Agenda/weather, all Casino pages, Slots, Settings/Data Management, Integrity, and Restore Preview.
- Capture empty, partial, large-data, loading, success, failure, offline, and restored states.
- Record device/runtime, app build, fixture, owner, theme, text size, and network condition for every capture set.
- Log every discovered issue back into this list before release signoff.

Done when the complete screenshot matrix is reviewed and has no unresolved critical or high-severity defect.

Implementation evidence (2026-08-31):

- Captured all seven tab roots at 390×844 with the clean `local-default` profile. Every destination shows its distinct photorealistic identity band and the preserved seven-item bottom navigation.
- Captured Agent SEA, Certificates, Offer Details, the complete Offer Filters modal, missing-record Cruise Detail recovery, Day Agenda, all four Casino destinations, Settings Data & Backup, Settings export/restore controls, and Data Trust Center at the same phone viewport.
- The capture pass found a real Data Trust web-preview crash: a second Expo SQLite web access handle raised `NoModificationAllowedError`. Data Trust now skips native indexed trust storage on web, displays a truthful iOS-only compatibility notice, and disables its native database/backup/restore actions. Native iOS behavior is unchanged.
- Added `tests/build444_data_trust_web_compatibility_regression.js`; it, Build 444 visual/accessibility acceptance, Build 440 accessibility acceptance, and `npx tsc --noEmit` pass.
- Recorded complete context, screenshot inventory, executable nonvisual state coverage, the repaired defect, and explicit limitations in `BUILD444_EVIDENCE/SCREENSHOT_MATRIX.md`.
- Production-size, loading, progress, cancellation, success, warning, corruption, low-space, restore-conflict, owner-mismatch, migration interruption, and repair states remain covered by the focused runtime acceptance tests listed in that matrix. No populated screenshot was fabricated.
- No unresolved critical or high-severity defect remains in the captured web workflow. Native iPhone/simulator, VoiceOver, native keyboard, Files/iCloud, share-sheet, SecureStore, SQLite, live provider, and populated restore-preview evidence are not claimed because item 2 was skipped and no authenticated provider session was supplied.

### 15. [IMPLEMENTED — CLEAN SOURCE ZIP VERIFIED; SIGNED NATIVE BUILD NOT CLAIMED] Build 444 release gate and packaging

- Resolve all issues discovered in items 1–14.
- Run focused tests, all maintained regressions, supplied fixtures, live/device acceptance, TypeScript, Expo Doctor, version checks, native prebuild, and fresh iOS production bundle.
- Require zero failed maintained tests and explain every optional skip.
- Bump identifiers only after every gate passes.
- Preserve Build 439 and Build 443 baselines and record hashes.
- Create a fully local Build 444 source folder and ZIP with no dataless files, caches, `node_modules`, credentials, backups, or personal data.
- Test ZIP extraction and run the release checks from the extracted package.

Done when Build 444 is reproducible from its ZIP and ready for a signed TestFlight/App Store build.

Implementation evidence (2026-08-31):

- Resolved every critical/high issue discovered during items 1–14, including the Data Trust browser-preview SQLite access-handle crash and four obsolete maintained-test contracts.
- Bumped the coordinated local release identity to Easy Seas 13.0.74, iOS Build 444, and Android version code 130107. EAS production remains remote-versioned with automatic increment enabled.
- App Store identity verification passes; TypeScript passes; Expo Doctor passes 18/18 using an isolated temporary npm cache that avoids the user's legacy root-owned cache files.
- The complete maintained gate passes 173 tests with 48 explained historical/private-fixture skips and 0 failures across 221 discovered tests.
- The current supplied-file test ran against the real crew workbook, completed-cruise CSV, and two locally available backups and passed. The separate 13-offer/3,151-sailing production fixture and 148 MiB backup fixture pass.
- A fresh iOS production JavaScript export passes with 3,821 modules, 34 assets, and a 19.6 MB Hermes bundle. Source and production-export scans contain no key-shaped credential.
- Preserved the Build 439 rollback folder/hash and the Build 443 source baseline. No baseline was overwritten.
- Created `EASYSEAS_EXPO_V13.0.74_BUILD444_FINAL_SOURCE` without `node_modules`, caches, generated native folders, archives, IPA files, logs, personal backups, credentials, symlinks, zero-byte files, or macOS dataless placeholders.
- Created and integrity-tested `EASYSEAS_EXPO_V13.0.74_BUILD444_FINAL_SOURCE.zip` plus its SHA-256 sidecar and a per-file source manifest.
- Extracted that ZIP into a fresh temporary directory and reran the release identity gate, all maintained tests, TypeScript, Expo Doctor, a fresh iOS production export, and the exported-bundle secret scan successfully. The temporary extraction was then removed.
- A signed Xcode archive/IPA and TestFlight upload are not claimed because item 2 was explicitly skipped. This is the verified clean source package to submit to EAS or build with a restored native Apple toolchain.

## Current completion summary

- Preserved baseline checks: 5 complete.
- Sequential closure items: 15.
- Skipped by user: item 2.
- Implemented with remaining native/auth acceptance: items 1 and 3–15.
- In progress: none.
- Pending: none.
- Fully completed closure items under the original native done conditions: 0.
