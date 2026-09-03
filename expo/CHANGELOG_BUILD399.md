# Easy Seas 13.0.33 (Build 399)

## Casino truth and usability release

- Replaces the mounted Casino screen with four responsive sections: Overview, Trips, Sessions, and Tools.
- Adds a canonical, evidence-labeled per-cruise casino calculation path.
- Adds cruise-level play summaries: starting cash, ending cash, total hours, actual points, optional coin-in/handpays, and certificate earned.
- Separates actual, provider-reported, user-entered, estimated, generated, and missing evidence.
- Excludes generated historical sessions from actual analytics by default.
- Calculates net gaming result as cash-out plus separate handpays minus cash-in; cruise fare is excluded.
- Uses explicit coin-in first. The Club Royale points × $5 conversion is only a labeled slot estimate and is never applied to Blue Chip, Carnival, table games, or unknown play.
- Calculates theoretical loss from recorded theoretical or coin-in × weighted hold, and ADT from theoretical divided by rated gaming days.
- Reconciles synced earning-year points to cruise-attributed points and exposes unallocated/over-attributed amounts.
- Applies Club Royale's April 1 reset and Celebrity Blue Chip Club's August 1 reset.
- Links certificates to earning cruises by cruise/reservation identity first and refuses ambiguous same-code matches.
- Adds per-cruise casino facts, theoretical, actual/estimated hours, itinerary opportunity, and certificate evidence to Ask My Data.
- Makes provider sync authoritative unless the user explicitly saved a manual loyalty override.
- Adds responsive reconciliation, cruise-points, and session-performance charts; charts defer until navigation settles.
- Virtualizes long casino trip and session histories so tab switching stays responsive.
- Adds a multi-ship, multi-sailing crew-recognition importer for CSV and text files with quoted-cell support, alternate headers, deterministic deduplication, and merge-without-overwrite behavior.
- Validated the supplied master crew registry: 776 source rows, 925 sailing-specific recognition records, 25 sailing records, and 14 ships.
- Hardens Node release verification for the statically bundled pako PDF inflater without changing the Metro/Hermes runtime path.

## Verification

- Full TypeScript check passed in an isolated dependency sandbox.
- Full TypeScript/TSX syntax scan passed.
- Build 398 intelligence/voyage/casino regression passed.
- Legacy casino engine and post-cruise closeout regressions passed.
- Build 399 program-season, calculation, certificate-linkage, closeout, and Ask My Data regression passed.
- Build 399 multi-ship CSV/text crew-registry regression passed.
- Six production certificate PDF fixtures, two monthly-index PDFs, and the 544-row on-device certificate fallback fixture passed.
