# Carnival Build 314 — Stage 6 Checkpoint

## Apply-Sync safety completed

- Offer deletion/replacement remains blocked unless the full Carnival offer-code catalog reaches an authoritative terminal state.
- Available-sailing deletion/replacement remains blocked unless the same catalog is complete and authoritative sailing detail is present, or Carnival explicitly proves an empty catalog.
- Active booked/upcoming and completed/history authority are evaluated independently; an authoritative lane can update without permitting deletion in the other lane.
- Partial active or completed extraction re-merges the corresponding existing records before persistence.
- Carnival loyalty values now carry field-level authority evidence. Missing values no longer overwrite stored values with zero or blank strings.
- Inferred VIFP tiers can be shown during review but cannot replace a stored tier during Apply Sync unless Carnival supplies authoritative tier evidence.
- Authoritative zero-point values remain distinguishable from missing values and can be applied safely.
- Same-sailing offer rows remain keyed by offer context, so separate personalized offers are not collapsed into one record.
- Carnival Apply Sync remains journaled and transactional; failures before commit restore offers, sailings, bookings/history, and the selected profile snapshot.
- Cancellation before Apply Sync performs no persistence write, while partial extraction retains its account-bound resume checkpoint.
- Royal Caribbean and Celebrity apply paths remain brand-scoped and unchanged.

## Validation

- PASS — Build 314 Carnival Priority 1–3 regression test.
- PASS — Build 315 Carnival Priority 4–8 regression test.
- PASS — Field-level loyalty authority behavioral test, including authoritative zero values.
- PASS — Static authority-guard review for offers, sailings, active bookings, completed history, and inferred-tier preservation.
- PASS — Syntax transpilation of every modified TypeScript/TSX runtime file.
- NOT TESTABLE HERE — Device-level storage interruption and live authenticated Apply Sync require the app runtime and the user's account.

## Locked configuration

No package, lock, Expo, EAS, dependency-version, CI, or workflow file was changed.
