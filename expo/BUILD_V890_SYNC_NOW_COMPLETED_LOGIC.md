# BUILD V890 — Sync Now Repaired with Completed-Sync-Style Logic

This build starts from the full v889 codebase and preserves the Easy Seas Gauguin-style logo/header changes.

## Fixed

- Did not change the separate Sync Completed Cruises flow.
- Sync Now Step 1 now follows the same working principle as completed-cruise sync:
  - wait for Royal's hydrated page/network payloads,
  - reject placeholder/empty rows,
  - merge additively,
  - preserve existing good rows if Royal exposes no authoritative ship/date rows.
- Added broad sailing-shaped payload detection to the WebView network monitor, not just old offer-shaped endpoints.
- Added per-offer capture of network/hydrated payloads immediately after each View Sailings click.
- Added loose Royal sailing record parsing for payloads that contain ship/date arrays without the old offer wrapper.
- Left the completed-history parser and completed-cruise button untouched.
- Restored Royal /myaccount upcoming-cruise extraction during normal Sync Now by injecting the dedicated Step 2 extractor on the hydrated My Account page.
- Skipped obsolete Royal loyalty direct page fallback during Sync Now to avoid the post-sync timeout loop. Loyalty/completed history remains handled by the separate working completed-cruise flow.

## Key log markers

- `Offer sync engine v8.9.0 active: completed-sync-style hydrated payload capture for Sync Now; completed-history path unchanged`
- `Hydrated/network payload captured ... real sailing row(s)`
- `Injecting Royal My Account upcoming-cruise extractor on hydrated page`
- `Royal loyalty direct fallback skipped during Sync Now`
