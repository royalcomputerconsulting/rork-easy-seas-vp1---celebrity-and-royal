# V990 First-Run Sync Retry Stabilizer QA

Purpose: fix the first Royal Sync Now run where large offer detail pages can briefly return 0 rows until the authenticated session/detail payload warms up.

Expected results:
- Version 9.10.90 / engine v9.9.0-first-run-offer-retry-stabilizer.
- A current large offer such as 2606C05 must not be accepted with 0 rows on first run; it retries the same offer before continuing.
- A stale visible prior-month card such as 2605C03A may be skipped only after retries and only when the remaining current catalog is complete.
- Review must not show 0 offers / 0 sailings when current catalog rows were actually captured.
- Friendly user log still hides raw URLs and displays 3 lines.
- Christie remains a separate app user; no Scott known-profile fallback for non-Scott emails.
