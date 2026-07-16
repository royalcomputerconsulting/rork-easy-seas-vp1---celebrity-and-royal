# EasySeas v12.4.2 Build 314 — Carnival Sync Full TODO Audit

## Scope and preservation rule

This build starts from `EasySeas_V1242_Build314_Carnival_Priority1_3_FULL_CODEBASE(4).zip` and applies only Carnival sync runtime, persistence, Carnival UI/state, manifest/counting, extension-isolation, and Carnival behavioral-test changes.

The following original project files are byte-for-byte unchanged:

- `package.json`
- `node-version`
- `app.json`
- `app.config.js`
- `plugins/withForcedIOSVersion.js`
- `scripts/verifyAppStoreVersion.js`

No lockfile, `.npmrc`, React/dependency change, or CI/workflow file was introduced.

---

## Priority 0 — Data integrity

- [x] Checkpoint schema upgraded to version 2.
- [x] Checkpoints bind to EasySeas app profile, hashed authenticated email, verified Carnival VIFP number, TGO/personalization fingerprint, resident/locality/currency, catalog hash, and timestamps.
- [x] Checkpoints without a verified VIFP number cannot auto-resume.
- [x] Each rate code stores its exact Shop Now URL, TGO hash, context fingerprint, offer name, expiry, and extraction timestamp.
- [x] Code outcomes use `success`, `authoritative_empty`, `incomplete`, `blocked`, `auth_lost`, `cancelled`, and `failed`.
- [x] Only `success` and `authoritative_empty` are skipped during resume.
- [x] Apply Sync stages offers, sailings, bookings/history, and Carnival profile changes using before/after checksums.
- [x] Failed writes roll back all journaled local collections and the Carnival profile snapshot.
- [x] The recovery journal remains until all required local and profile writes commit; an unfinished journal is restored before the next Apply Sync.

## Priority 1 — Authoritative request-specific result capture

- [x] Carnival inventory detection uses whitelisted sailing/cruise/voyage/departure and GraphQL connection adapters rather than URL keywords alone.
- [x] Every accepted payload carries request method, request URL/body, response URL, HTTP status, content type, run ID, request ID, offer code, page/offset/cursor analysis, code-context fingerprint, and capture timestamp.
- [x] Payloads without exact run/request/code/page/context proof are rejected.
- [x] Generic recursive maximum-total scanning is not used for inventory authority.
- [x] The latest matched inventory schema supplies pagination totals; arbitrary nested/facet/analytics totals are ignored.
- [x] Inventory, authoritative-empty inventory, pricing, facets, catalog, analytics, configuration, and unknown payloads are classified separately.
- [x] Pricing/facet/configuration payloads cannot authorize zero inventory or inflate sailing totals.
- [x] Request-scoped payloads are deleted after each page; payload count and byte limits protect WebView memory.

## Priority 2 — Zero-result and pagination correctness

- [x] API zero requires a matched inventory adapter, exact code/page proof, and authoritative total zero.
- [x] DOM zero requires a visible offer-specific empty element on the correct code-specific page and a second stable observation.
- [x] Hidden templates and broad body text cannot authorize zero.
- [x] Parser errors, missing API proof, unknown totals, auth loss, unexpected page state, and truncation remain incomplete/resumable.
- [x] One no-growth page does not terminate pagination.
- [x] Repeated page signatures are logged but do not terminate while Carnival reports a next page.
- [x] Page-number, offset, cursor, and explicit next-link contracts are supported.
- [x] Stable page signatures distinguish a repeated page from authoritative end-of-results.
- [x] Hard safety-limit termination is marked incomplete/truncated, never complete.
- [x] The 329-result fixture captures and deduplicates all 329 sailings across seven pages.

## Priority 3 — Code-specific personalization

- [x] A context map is maintained by normalized rate code.
- [x] Every context contains code-specific URL, TGO fingerprint, VIFP/tier/resident/locality/currency context, and expiry metadata.
- [x] A later verified code-specific link overrides an older broad link.
- [x] A transient/public-page empty flag cannot override a catalog containing valid codes.
- [x] Every offer card lacking its own verified code-specific URL is opened, regardless of whether card and code counts happen to match.
- [x] Generated code-specific contexts are accepted only when they can be verified for the individual rate code.
- [x] Loaded URL, selected code, captured request, returned payload, run/request IDs, and cryptographic context fingerprint must all agree before rows are accepted.

## Priority 4 — Bookings, completed history, and loyalty

- [x] Missing/unstable booking IDs are replaced with deterministic `carnival-synthetic-*` IDs.
- [x] Old timestamp/index IDs and all generated Carnival IDs are treated as synthetic during deduplication.
- [x] Synthetic identity uses normalized ship, start/end dates, itinerary, lead passenger, and cabin where available.
- [x] ISO, U.S. numeric, month-first textual, and day-first textual Carnival dates are supported.
- [x] Completed/upcoming classification uses sailing end date whenever available.
- [x] Ship extraction uses structured fields and nearby DOM labels rather than a fixed Carnival ship-name list.
- [x] VIFP/cruise-day/Players Club points are never used as cruise nights.
- [x] Upcoming-empty authority applies only to the authenticated My Cruises upcoming lane.
- [x] History-empty authority applies only to the authenticated history lane.
- [x] Parser/auth failures preserve existing upcoming and completed data.
- [x] Profile snapshots merge field by field rather than selecting a single “best” page.
- [x] One canonical VIFP decoder is used for URL/cookie/API/profile evidence and includes Blue.
- [x] `Players Points`, `Players Pts`, and structured field variants are recognized.
- [x] Carnival VIFP and Players Club data remain only in Carnival-specific profile/state fields.
- [x] Locally inferred tiers are explicitly labeled `(inferred)`.
- [x] The September 2023 Panorama API/DOM/history fixture deduplicates to exactly one completed cruise.

## Priority 5 — Run state, login, cancellation, and resume UX

- [x] A single module-level Carnival coordinator owns the exclusive run lock.
- [x] The lock remains held after unmount/abort until the asynchronous run reaches its `finally` block.
- [x] `ownerId` gates Carnival state, logs, bridge messages, checkpoint changes, and lock release.
- [x] Wrong-run and wrong-request catalog, auth, search, and profile messages fail immediately as stale.
- [x] Terminal manifest statuses are persisted as complete, partial/resumable, cancelled, auth lost, interrupted/resumable, or error.
- [x] `VERIFY CARNIVAL LOGIN` is separate from `START SYNC`.
- [x] Carnival profile/API authentication is verified before the long-running sync lock is acquired.
- [x] Every navigation runs a session-expiry probe; login/security redirects abort to `auth_lost` and preserve resume state.
- [x] iOS WebView termination and Android render-process exit cancel the owning run with explicit reasons.
- [x] ETA uses only codes processed during the current run, excluding restored checkpoint work.
- [x] Review UI displays a per-code ledger with success, verified empty, incomplete, failed, and pending-style states.

## Priority 6 — Manifest and explainable metrics

- [x] A persisted, profile-scoped Carnival manifest contains run/account/catalog fingerprints and all requested counts/status lists.
- [x] Dashboard Carnival offer and eligible-sailing metrics use the manifest when it matches the active app profile.
- [x] Eligible Sailings uses a canonical unique sailing key rather than raw row count.
- [x] Any failed, incomplete, or truncated visible code prevents a complete terminal label.
- [x] Partial data remains resumable and cannot delete unresolved inventory.
- [x] Existing global brand filters keep Carnival-only and All Brands views scoped separately across overview, booked, calendar, analytics, and scheduling surfaces.

## Priority 7 — Native/extension divergence and legacy paths

- [x] The divergent desktop Carnival scraper is formally disabled/deprecated.
- [x] Carnival CSV import remains available.
- [x] Native Carnival parsing/normalization uses shared runtime helpers and fixtures.
- [x] The pre-Build-312 provider branch is compile-time isolated; all Carnival runs return through the safe ingestion engine.
- [x] Deprecated extension behavior no longer has its own page-size, pagination, or global-context engine.

## Priority 8 — Carnival behavioral QA

- [x] Build 312 QA invokes the executable Build 313–315 behavior suites; marker checks are supplemental rather than the sole proof.
- [x] Fixtures cover catalog pages, offer cards, inventory, pricing, facets, authoritative zero, 329 results, bookings/history, profile/loyalty, unknown redesigns, WebView events, checkpoint migration, and manifests.
- [x] Tests cover request/response scope, stale messages, login redirects, auth loss, cancellation hooks, timeouts, process termination markers, and pagination.
- [x] Tests reject other-account checkpoints, changed TGO/context, changed app profile/catalog context, stale checkpoints, and version-1 checkpoints.
- [x] Persistence tests simulate failure after the first and second collection writes and verify full recovery.
- [x] Duplicate/misclassification tests cover the September 2023 Panorama record and API/DOM/history overlap.
- [x] Extension parity is not required because the divergent extension path is formally disabled.
- [x] Mutation guards prove that changed ship/date/context/manifest/journal integrity causes test failure.
- [x] A native authenticated live-test protocol is included.

### Explicitly preserved at the user’s request

These build-system TODOs were deliberately **not** applied because the user instructed that original React dependencies, package/lock files, and CI/workflows must remain unchanged:

- React 19 / `lucide-react-native` dependency changes.
- Adding or enforcing a lockfile.
- Adding CI workflow files or changing toolchain/package-manager configuration.
- Changing clean-install/lint/typecheck workflow configuration.

This is intentional scope preservation, not an unreported omission.

---

## Acceptance-criteria status

1. Other-account/personalization checkpoint rejection — **covered by executable tests**.
2. Explicit per-code terminal states and resumable ambiguity — **implemented and tested**.
3. Cryptographic run/code/page/request/context linkage — **implemented and tested**.
4. 329-result capture — **implemented and tested with fixture**.
5. Cancellation/background/unmount/process termination safety — **implemented; bridge/runtime portions tested; final native device behavior requires live validation**.
6. September 2023 Panorama exactly once/completed — **tested**.
7. Empty/parser/auth failure cannot erase valid stored lanes — **implemented and tested by authority rules/preservation paths**.
8. Apply Sync all-or-nothing/recovery — **implemented and tested with checksum and simulated failures**.
9. Native/extension divergence — **extension formally disabled**.
10. Lockfile-based clean install/CI — **intentionally not changed per user instruction**; source syntax and all bundled QA scripts pass.
11. Live authenticated Carnival run — **protocol included; cannot be truthfully marked passed without the user’s authenticated Carnival session and installed-device run**.
12. Carnival-only versus All Brands scoped counts — **implemented in persisted manifest and existing brand-filter architecture**.

## Validation performed

- 21 bundled QA scripts: **21 passed, 0 failed**.
- TypeScript/TSX syntax transpilation: **412 files, 0 errors**.
- Modified extension JavaScript syntax: **passed**.
- Original project/package/configuration files: **unchanged**.
