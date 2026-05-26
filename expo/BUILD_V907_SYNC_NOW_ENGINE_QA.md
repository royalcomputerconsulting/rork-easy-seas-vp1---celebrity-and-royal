# Easy Seas v907 / 9.10.13 Sync Now Engine QA

This build fixes the broken injected Sync Now script syntax that prevented the offer engine from starting after the offers page loaded.

## Key fixes

- Fixed `step1_offers.ts` JavaScript injection syntax (`parts.join('\n')`) so the WebView extraction script actually runs.
- Keeps the v861 live button-driven offer engine as the primary source.
- Keeps provider-side verified row fill only as a fallback when Royal exposes cards/buttons but hides virtualized sailing rows.
- Regenerated provider-side verified rows from the latest uploaded `offers (7).csv`.
- Baseline rows included: 1033 individual cruise rows.
- Counts by offer code: {'26WCR403': 56, '26BCP105': 54, '26JUL104': 40, '2605C03A': 883}.
- Final Sync Now logs per-offer counts before the user confirms sync.
- Step 2 performance refetch now includes `aws-prd.api.rccl.com` / `api.rccl.com` URLs such as `profileBookings/enriched`.
- Completed-cruise sync was not changed.

## Expected marker

`Offer sync engine v9.0.7 active`
