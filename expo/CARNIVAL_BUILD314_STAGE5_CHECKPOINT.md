# Carnival Build 314 — Stage 5 Checkpoint

## Completed

- Captures protected Carnival profile, loyalty, booking, and history JSON payloads in a bounded in-memory ledger.
- Reads authoritative VIFP number, tier/code, points, cruise-day points, total-cruise count, Players Club tier, and Players Club points when Carnival exposes them.
- Retains tier evidence (`authoritative`, `inferred`, or `unknown`) instead of presenting an inferred value as authoritative.
- Expands Cruise History / Past Cruises / Show More controls with a bounded 14-round loop.
- Discovers and visits up to eight same-origin Carnival profile, booking, reservation, loyalty, and history pages while excluding offers/deals/search routes.
- Walks protected profile payloads recursively for active bookings and completed history instead of relying only on the profile summary object.
- Derives cruise nights from start and return dates whenever Carnival supplies zero/missing nights.
- Classifies rows from dates and statuses so future bookings remain active and past cruises become completed.
- Reconciles completed history against the profile-reported total and keeps the lane non-authoritative when it remains short.
- Preserves existing booked/upcoming and completed records whenever their respective lanes are incomplete.

## Validation

- PASS — Build 314 Carnival Priority 1–3 regression test.
- PASS — Build 315 Carnival Priority 4–8 regression test, including browser-script evaluation.
- PASS — TypeScript syntax transpilation for modified provider, safe-sync, and interceptor files.
- PASS — Static checks for protected-payload capture, bounded page discovery, history authority, and date-derived nights.
- NOT TESTABLE HERE — Live authenticated Carnival account extraction and seven-cruise reconciliation require the user's WebView session.

## Locked configuration

No package, lock, Expo, EAS, dependency-version, or workflow file was changed.
