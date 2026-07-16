# Carnival Build 314 Stage 3 Checkpoint

Completed pagination and rendered-results repair:

- API and verified rendered sailing rows are merged and deduplicated.
- Stable sailing identity no longer includes price, preventing API/DOM price variants from duplicating a sailing.
- Rendered results, displayed total, and Next-control state are observed twice across a settle interval.
- A one-page result may terminate without an API next token only when the offer context, row signature, displayed total, and absent/disabled Next state are stable.
- Active Next controls, unstable results, loading states, and totals larger than cumulative captured rows remain incomplete.
- Multi-page rendered totals use cumulative prior-row count.
- Pagination still has one bounded retry and a hard page safety limit.

Validation:
- Existing Build 314 Priority 1-3 test: PASS.
- Existing Build 315 Priority 4-8 test: PASS.
- Dedicated settled-rendered-page and deduplication checks: PASS.
