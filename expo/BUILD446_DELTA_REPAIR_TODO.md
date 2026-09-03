# Easy Seas Build 446 — Delta repair checklist

This checklist covers the defects reported after Build 445. Existing app behavior, the seven tabs and their order, the Easy Seas logo, the Scott Astin signature, owner isolation, and all existing data actions remain non-negotiable.

## 1. Saved certificate results take too long to appear

- [x] Stop hydrating retained certificate PDFs during unrelated app startup.
- [x] Paint the Certificate Codes screen before starting its large document read.
- [x] Seed a durable parsed-sailing projection after the first document read so later visits use indexed rows.
- [x] Update the projection incrementally after each download/reprocess instead of rereading the complete document library.
- [x] Show restoring, ready, error, and retry states.
- [x] Preserve force hydration for Settings certificate export, Save All, and backup callers that never opened the Certificates screen.

Evidence: `tests/build446_certificate_hydration_readiness_regression.js`, `tests/build436_certificate_export_hydration_progress_regression.js`, TypeScript.

## 2. Agent SEA answers the wrong domain or invents a total

- [x] Route personal past-cruise questions to completed cruises rather than certificate inventory.
- [x] Answer last-cruise points from the newest matching completed cruise and prefer saved raw points.
- [x] Add deterministic casino overview, ROI, ADT, and loyalty answers before broad catalog search or cloud AI.
- [x] Search all matching certificate rows before limiting the visible evidence list, so ships after row 24 are not falsely reported missing.
- [x] Await retained certificate hydration only when a certificate question has no cached parsed rows.
- [x] Keep coin-in labeled as gaming volume, never profit or cash loss.
- [x] Return an explicit missing-evidence explanation instead of zero when ADT/theoretical evidence is absent.
- [x] Give crew, weather, offer, certificate, cruise, calendar, machine, and system fallbacks domain-specific language.
- [x] Display the real calculation/AI/local-evidence path below every answer.

Evidence: `tests/build446_agent_sea_accuracy_regression.ts`, retained Build 440/445 ADT and Agent SEA runtime tests, and a fresh 393×852 first-tap browser interaction.

## 3. Agent SEA interaction is not a reliable iOS chat

- [x] Keep AI automatic when a proxy or personal key is configured; remove any prerequisite “use AI” launch action.
- [x] Keep conversation actions at the top, share/export at the bottom, and the composer pinned above the keyboard.
- [x] Read the synchronous TextInput mirror and keep Send touchable during the final iOS input-state commit.
- [x] Prevent duplicate rapid submissions.
- [x] Tear down the large Agent SEA data scope before the back transition.
- [x] Preserve conversation history, save, print, share, diagnostic export, filters, and owner isolation.

Evidence: `tests/build446_visual_system_regression.js`, retained `tests/build445_agent_sea_polish_diagnostics_runtime.ts`, and one unique prompt producing one visible user message on the first click.

## 4. The app is consistent but too flat and generic

- [x] Give all seven tabs distinct complementary SeaPass-derived identities instead of one repeated gradient.
- [x] Keep Source Serif editorial headings and readable system-font supporting copy.
- [x] Give shared section headers restrained information, success, warning, casino, weather, and tab-specific surfaces.
- [x] Add photo-led certificate and Agent SEA context while retaining readable fact cards.
- [x] Replace the plain Offers logo strip with a premium photo-led offers/certificates hero that preserves the exact logo at the top.
- [x] Retain useful icons, emoji, progress bars, maps, charts, and semantic tier colors.
- [x] Preserve the existing photo-led Cruises, Booked, Calendar, Casino, Slots, and Settings identities.

Evidence: `tests/build446_visual_system_regression.js` and fresh 393×852 rendered inspection of all seven tabs plus Agent SEA, Certificate Codes, Day Agenda, and Data Trust Center.

## 5. Previously reported trust, restore, agenda, and card requirements

- [x] Data Trust totals open filtered issue lists and CSV/JSON export remains visible.
- [x] Encrypted restore says **Load Encrypted Backup** and recovery-key copy/paste/load controls remain present.
- [x] Day Agenda has previous/next-day arrows and a visible OpenStreetMap tile map when a voyage supplies a route position.
- [x] Weather remains confined to Day Agenda and the upcoming-voyage area of Booked.
- [x] Occupancy loyalty math remains one point per occupant-night in double occupancy, two points per night solo, plus one extra point per night in a suite or higher.
- [x] Offers, Cruises, Booked, certificate results, and Casino continue to use canonical cruise/offer truth and bounded virtualized lists.

Evidence: retained Build 440/445 trust, agenda, map, weather, occupancy, card, persistence, and large-list gates.

## 6. Final verification

- [x] Pass the full maintained source-release suite with zero failures.
- [x] Pass Expo Doctor and production iOS Metro export.
- [x] Record the native-device boundary accurately; do not claim the intentionally deferred full simulator/device acceptance.

Evidence recorded September 2, 2026: TypeScript passed; the maintained suite completed with **231 passed, 48 declared optional-fixture skips, and 0 failures**; Expo Doctor completed **18/18**; and the iOS production export bundled all 3,839 modules and 37 assets into a 19.9 MB Hermes bundle. Native TestFlight/device acceptance remains intentionally deferred and is not represented as completed.
