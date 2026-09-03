# Certificate Intelligence + Agent SEA: Three-Stage Execution Plan

## Non-negotiable data rules

1. Downloaded certificate sailings remain certificate inventory and are never inserted into Available Cruises.
2. `eligible option rows` and `physical sailings` are different totals and must always be labeled separately.
3. A different certificate code, cabin entitlement, guest count, GTY status, or material benefit creates a separate eligible option.
4. Exact repeated parser rows do not create additional options.
5. Summary figures and their drill-down lists are produced by the same query predicates.
6. Existing valid certificate data survives a failed retry.
7. Deterministic application code calculates totals; Agent SEA explains those verified totals.

## Stage 1 — Canonical truth and summary foundation

### Scope

- Extend the local certificate level model with ship class, duration, start/end day, weekend classification, Florida classification, guest count, GTY, trade-in, NextCruise bonus, and parser provenance.
- Strengthen material row identity so meaningful entitlement variants cannot collapse.
- Retain original certificate evidence while adding normalized searchable facts.
- Implement a pure certificate-summary engine that:
  - flattens locally parsed certificate options;
  - reports eligible options separately from physical sailings;
  - groups by certificate code and point level;
  - calculates one-guest, two-guest, unknown-guest, weekend, Florida, shortest, and longest metrics;
  - exposes reusable drill-down predicates for every metric;
  - accepts compound filters for certificate, month, guest count, ship, class, cabin, port, dates, nights, weekend, Florida, and GTY.
- Add the Cert Summary button immediately below Download All.
- Add the dedicated `/certificate-summary` route with a first working matrix and exact metric drill-down preview.
- Add fixtures proving guest/cabin variants survive while exact duplicate PDF rows do not.
- Preserve the existing downloader, Certificate Lookup, portfolio matrix, and navigation.

### Exit criteria

- The new route opens from Certificate Codes.
- One-guest and two-guest variants survive actual index ingestion.
- Every Stage 1 metric returns the same number of records shown by its figure.
- Existing certificate portfolio and Agent SEA certificate regressions still pass.
- TypeScript/TSX syntax scan passes.

## Stage 2 — Complete Cert Summary mobile experience

### Scope

- Replace the Stage 1 preview limit with a virtualized, paginated result list.
- Add four screen sections: Summary, Ships & Classes, Eligible Sailings, and Data Quality.
- Build a full filter sheet with draft/apply/cancel/clear behavior.
- Add active filter counts and removable filter chips.
- Add matrix dimension switching for class, ship, cabin, departure port, region, month, duration, and departure day.
- Make every matrix cell and summary figure open the exact complete result set.
- Add sorting for date, points, duration, ship, class, cabin, port, guests, FreePlay, and OBC.
- Add complete sailing cards with certificate code, points, ship/class, date, duration, port, itinerary, cabin, guests, GTY, FreePlay, OBC, trade-in, NextCruise bonus, PDF/page provenance, and confidence.
- Add actions for PDF, lookup detail, comparison, planning shortlist, Agent SEA, copy, and export.
- Preserve month, filters, sorting, search, selected matrix dimension, and scroll position across navigation.
- Add data-quality drill-downs for missing or quarantined fields.

### Exit criteria

- Every visible count opens the exact full list behind it.
- Combined filters are deterministic and Clear All restores the unfiltered month.
- Large certificate catalogs remain responsive.
- Back navigation returns to the same state.
- No certificate rows leak into Available Cruises.

## Stage 3 — Agent SEA, persistence, incremental updates, and release

### Scope

- Add an Agent SEA source registry with record type, ID, owner, program, status, provenance, freshness, confidence, and shared/private scope.
- Add a deterministic question planner that selects available offers, certificates, booked cruises, completed cruises, casino data, crew data, calendar, itinerary, weather, or explicit cross-source comparisons.
- Add typed Agent SEA tools for certificate summary and certificate sailing searches.
- Make Agent SEA cite local evidence, state included/excluded sources, and open the exact Cert Summary result set.
- Ensure structured code—not the model—calculates counts, totals, dates, points, ROI, and ranges.
- Make Save All portable for certificate metadata, parsed rows, archived PDFs, summary/index versions, and Agent SEA source metadata.
- Make Load All validate, restore, rebuild, read back, and publish indexes without overwriting valid data.
- Rebuild affected indexes after sync, import, manual edit, certificate parse, restore, profile change, or Clear All.
- Connect Download All progress incrementally without resetting Cert Summary filters.
- Add bounded background queues, transactional batches, cancellation, yielding, memory limits, cached aggregates, and targeted invalidation.
- Run certificate, Agent SEA, backup, offline, secondary-user, navigation, performance, and protected-feature regressions.
- Increment version/build numbers and create the clean EAS-ready release archive.

### Exit criteria

- Agent SEA cannot answer an available-certificate question from booked or completed cruises unless comparison was requested.
- Save All/Load All reproduces certificate summary totals exactly.
- A failed download cannot erase a valid local certificate/index.
- Background parsing/indexing never blocks tab navigation.
- All protected regression suites and release gates pass.
