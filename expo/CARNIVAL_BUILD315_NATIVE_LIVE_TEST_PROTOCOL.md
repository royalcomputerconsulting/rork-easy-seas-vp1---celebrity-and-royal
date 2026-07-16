# Easy Seas v12.4.2 Build 316 — Carnival Native Live-Test Protocol

This protocol is mandatory before App Store/TestFlight promotion. Redact names, email addresses, VIFP numbers, cookies, authorization headers, and payment data from retained evidence.

## 1. Environment record

Run `node scripts/recordToolchain.js` and retain `toolchain-runtime.json` with the EAS build record. Record the Easy Seas version/build, device model, OS version, network type, Carnival account fingerprint, selected Easy Seas profile, and whether the run is fresh or resumed.

## 2. Authentication and account binding

1. Open Carnival Sync and sign in through the embedded browser.
2. Press **VERIFY CARNIVAL LOGIN**. Confirm the UI does not enable the run from a manual flag alone.
3. Record the redacted VIFP/account fingerprint from the sync manifest.
4. Start a run, cancel after at least one successful code, sign into a different Carnival account, and attempt resume. The checkpoint must be rejected.
5. Return to the original account but alter resident/locality/currency or personalization context. The checkpoint must be rejected unless the exact context matches.

## 3. Personalized catalog and request manifest

Retain a redacted request/payload manifest for every visible code containing: run ID, request ID, offer code, method, request URL/query/body fingerprint, response URL, HTTP status, content type, page/cursor, schema adapter, accepted/rejected decision, result count, and timestamp.

Every visible code must end as `success` or API-verified `authoritative_empty`. `incomplete`, `blocked`, `auth_lost`, `cancelled`, `failed`, or truncated codes must leave the run partial/resumable.

## 4. Pagination and 329-result validation

Use an account/fixture with a large result set. Confirm the server’s page/cursor contract is followed until its authoritative terminal condition. Record each page signature, duplicate-page decision, unique count after each page, server total, and final count. A safety limit before the server terminal state must produce `partial_resumable`, never complete.

## 5. Cancellation, backgrounding, and WebView termination

Test cancellation during catalog discovery, during a page request, and during profile/history extraction. Also background/foreground the app, unmount/reopen the sync screen, terminate the iOS content process, and terminate the Android render process. Confirm the old run cannot continue writing state, logs, checkpoints, or local data after its owner/run ID becomes stale. Resume must use only successfully checkpointed or verified-empty codes.

## 6. Booking, history, and loyalty truth

Confirm the September 2023 Carnival Panorama sailing appears once and only in completed history. Verify deterministic `carnival-synthetic-*` IDs remain stable across repeated runs and date formats. Verify textual, ISO, and U.S. dates; renamed/new ship names; upcoming-only and history-only empty lanes; “Players Points” and “Players Pts”; Blue tier; field-by-field profile merge; and visibly labeled inferred tiers. Cruise nights must never be derived from VIFP points.

## 7. Transactional Apply Sync

Capture pre-apply counts/checksums. Inject a failure after the first and second local collection writes and confirm automatic rollback/recovery from the journal. Confirm the journal remains until offers, sailings, booked/history rows, profile updates, and the final manifest all succeed. Successful Apply Sync must be all-or-nothing and must preserve other brands.

## 8. Manifest and scoped UI counts

Compare the persisted manifest to the final UI: catalog count, completed-code count, verified-empty codes, failed/incomplete codes, row-bearing codes, unique sailing count, raw rows, upcoming bookings, completed history, and terminal status. Verify Carnival-only filters and All Brands views remain logically separate across Dashboard, Offers, Cruises, Booked, and Calendar.

## 9. Desktop extension policy

Confirm the legacy Carnival desktop scraper displays its retirement notice and cannot execute a Carnival extraction. Royal Caribbean/Celebrity extension behavior may continue independently. Existing Carnival CSV files must remain importable.

## 10. Promotion gate

Promotion requires: clean locked install, version hardlock, lint, full typecheck, all behavioral tests, archive integrity, native iOS and Android runs, complete redacted evidence, no unexplained terminal-status reversal, and a final manifest whose counts reconcile to the applied data.
