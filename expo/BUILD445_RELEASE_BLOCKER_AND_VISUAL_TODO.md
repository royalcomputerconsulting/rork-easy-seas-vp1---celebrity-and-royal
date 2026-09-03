# Easy Seas Build 445 — Release blockers and full visual completion

Build 444 remains the untouched rollback baseline. Build 445 is the repair workspace.

## A. Functional release blockers

- [x] Replace non-exclusive cruise-inventory transactions with serialized exclusive iOS transactions, retaining a web/test fallback.
- [x] Remove duplicate booked-cruise persistence from reviewed booked and completed-history imports.
- [x] Preserve provider day-by-day itinerary rows through Royal sync transformation.
- [x] Enable Royal/Celebrity pricing and itinerary enrichment during every sync.
- [x] Expand provider cabin-entitlement extraction without fabricating absent cabin data.
- [x] Decode Royal marketing-code point suffixes while allowing explicit provider/certificate values to win.
- [x] Add canonical, provider, offer-option, and material fallback lookup for cruise details.
- [x] Calculate offer sailing retail ranges on a full-room basis.
- [x] Make offer cards resolve cabin variants, explicit point fields, decoded point fallback, and representative stateroom value.
- [x] Add Build 445 focused regression coverage for all fixes above.
- [ ] Re-run supplied completed-cruise and backup fixtures, owner isolation, persistence, and maintained regression suites.
- [ ] Verify Royal and Celebrity live-device sync, offer/certificate navigation, and exact readback after Xcode/simulator/device tooling is available.

## B. Seven-tab visual completion

Non-negotiable constraints: preserve the Easy Seas logo and signature; preserve all seven tab names, order, routes, and actions; preserve tab ownership boundaries; do not hide or remove existing functionality.

- [ ] Audit every visible section and nested sheet reachable from Offers.
- [ ] Audit every visible section and nested sheet reachable from Cruises.
- [ ] Audit every visible section and nested sheet reachable from Booked.
- [ ] Audit every visible section and nested sheet reachable from Calendar.
- [ ] Audit every visible section and nested sheet reachable from Casino.
- [ ] Audit every visible section and nested sheet reachable from Slots.
- [ ] Audit every visible section and nested sheet reachable from Settings.
- [ ] Apply Source Serif editorial headings, readable system body type, ocean-white surfaces, navy/teal/gold hierarchy, consistent radius/spacing, and themed cards.
- [ ] Use photorealistic voyage/ship/destination/casino/weather/loyalty artwork for story-level sections with cached nonblocking fallbacks.
- [ ] Retain useful emojis, icons, illustrations, charts, maps, and contextual backgrounds inside sections.
- [ ] Standardize loading, progress, empty, missing, estimated, error, offline, success, and provenance states.
- [ ] Verify Dynamic Type, VoiceOver, contrast, 44-point targets, keyboard avoidance, and reduced motion.
- [ ] Capture and inspect fresh iPhone screenshots for all seven tabs and every critical nested workflow.

## C. Final gates

- [ ] TypeScript and Expo Doctor clean.
- [ ] Maintained legacy, supplied-fixture, accessibility, owner-isolation, persistence, large-catalog, and iOS production-bundle gates pass.
- [ ] Native iPhone simulator/device interaction and accessibility audit pass.
- [ ] Increment Build 445, retain Build 444, package verified source ZIP, and publish checksums/evidence.
