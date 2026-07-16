# EasySeas Carnival Sync — Build 312 Deep QA Findings and Repair TODO

**Status:** Awaiting approval. **No source-code changes have been made.**

## Codebases examined

1. `EasySeas_V1242_AppStore_Version_HARDLOCK_FINAL_FULL_CODEBASE(1).zip` — Build 311
2. `EasySeas_V1242_AppStore_Version_HARDLOCK_FINAL_FULL_CODEBASE%281%29.zip` — Build 311 duplicate
3. `EasySeas_V1242_Build312_Carnival_Resumable_Sync_FULL_CODEBASE.zip` — Build 312

The two Build 311 archives are byte-for-byte identical. Build 312 adds the resumable-sync runtime and changes 28 existing files plus four new files.

## QA performed

- ZIP integrity testing: all three archives passed.
- Build 311 bundled scripts: **18 passed, 0 failed**.
- Build 312 bundled scripts: **19 passed, 0 failed**.
- TypeScript/TSX syntax transpilation:
  - Build 311: **408 files, 0 syntax errors**.
  - Build 312: **409 files, 0 syntax errors**.
- Source comparison and manual review of the complete Carnival path:
  - `app/carnival-sync.tsx`
  - `state/RoyalCaribbeanSyncProvider.tsx`
  - `lib/carnival/carnivalSafeSync.ts`
  - `lib/carnival/carnivalSyncRuntime.ts`
  - `lib/carnival/carnivalOffersExtraction.ts`
  - `lib/royalCaribbean/authDetection.ts`
  - `assets/easy-seas-extension/carnival-sync.js`
  - Carnival models, transformers, filters, header metrics, version configuration, and QA scripts.
- Fresh npm dependency resolution was attempted. It is not reproducible as packaged because the archive has no lockfile and npm reports a peer conflict between React 19.1.0 and `lucide-react-native@0.475.0`, whose declared React peer range ends at React 18. A legacy-peer install did not complete within the available test window.
- A live authenticated Carnival session, iOS native build, Android native build, and App Store/TestFlight installation cannot be executed in this environment.

## Overall conclusion

Build 312 is materially safer than Build 311: it adds run IDs, an abort controller, an exclusive lock, checkpoint/resume, API-first extraction, visible Carnival filtering, and explicit cancellation handling. It is **not ready to be treated as fully proven**, because the current tests mostly confirm that source-code markers exist rather than exercising the sync behavior. Several remaining defects can still cause wrong-account resume data, false zero-row completion, incomplete pagination, duplicate/misclassified bookings, partially applied data, and different results between the native app and the bundled browser extension.

---

# Proposed TODO list

## Priority 0 — Protect data integrity before any more live testing

- [ ] **Upgrade the checkpoint to version 2 and bind it to the actual Carnival account.** Store the VIFP number/account fingerprint, authenticated app profile, personalization/TGO hash, resident/locality/currency, catalog hash, and creation time. Reject a checkpoint when any identity or context value changes.
- [ ] **Store the exact offer context with every checkpointed code.** Save the code-specific Shop Now URL, TGO/context fingerprint, offer name, expiry, and extraction timestamp. Do not resume rows solely because the visible code list matches.
- [ ] **Replace the binary “completed code” flag with explicit states:** `success`, `authoritative_empty`, `incomplete`, `blocked`, `auth_lost`, `cancelled`, and `failed`. Only `success` and verified `authoritative_empty` may be skipped on resume.
- [ ] **Make Apply Sync transactional.** Stage offers, sailings, bookings, history, and loyalty; validate a consistency checksum; then commit all local collections together. Restore the prior snapshot if any required write fails.
- [ ] **Retain a recovery journal until the entire local apply and Carnival profile update succeed.** Do not clear the checkpoint after a partially successful apply.

## Priority 1 — Make Carnival result capture authoritative and request-specific

- [ ] **Stop identifying result APIs only by URL words** such as `cruise-search`, `search-results`, or `/api/search`. Add schema-based detection for inventory, sailing, pricing, facet, GraphQL, and other Carnival result payloads.
- [ ] **Correlate every captured response with its originating request.** Record HTTP method, request URL, query/body, response URL, status, content type, run ID, offer code, page/cursor, request ID, and timestamp.
- [ ] **Reject payloads that do not prove they belong to the requested offer.** A response without a matching rate code or request-body context must not be accepted merely because a global current context exists.
- [ ] **Replace recursive generic payload scanning with endpoint/schema-specific adapters.** Whitelist authoritative sailing arrays and pagination objects instead of taking the maximum value from arbitrary nested `total`, `page`, `limit`, or `next` properties.
- [ ] **Separate inventory payloads from pricing/facet/configuration payloads.** A facet response must never overwrite or inflate sailing totals.
- [ ] **Clear all request-scoped payloads when a page finishes.** Cap payload bytes as well as payload count to prevent WebView memory growth.

## Priority 2 — Correct zero-result and pagination behavior

- [ ] **Require authoritative proof before declaring an offer empty.** Accept zero only from a matched result endpoint reporting zero, or from a verified offer-specific empty-state element. Do not use broad body-text matches that may come from hidden templates or unrelated widgets.
- [ ] **Do not checkpoint parser failures as zero-sailing offers.** A zero-row response with unknown/nonzero total, missing authoritative payload, unexpected page state, authentication loss, or parser ambiguity must remain `incomplete`.
- [ ] **Replace the one-no-growth-page stop rule.** A duplicate or temporarily empty page must not terminate a multi-page offer unless the authoritative API says there is no next page.
- [ ] **Use the server’s actual page/cursor contract.** Confirm Carnival’s current parameter names and whether it uses page numbers, offsets, cursors, or a mixture.
- [ ] **Add stable page signatures and duplicate-page detection.** Distinguish “same page loaded twice” from “end of results.”
- [ ] **Report truncation explicitly.** If a hard safety limit is reached before the authoritative total is captured, mark the offer incomplete and do not present it as fully synchronized.
- [ ] **Add a fixture for the prior 329-result case** and prove that all pages are visited and deduplicated correctly.

## Priority 3 — Make offer personalization code-specific

- [ ] **Create a context map keyed by rate code.** Each code must have its own Shop Now URL, TGO, VIFP, tier, resident/locality/currency, and expiry metadata. Do not rely on one merged global context for all offers.
- [ ] **Fix final booking-link precedence in `mergeCarnivalCatalogs()`.** The final parsed code-specific URL must override an older broad booking link; it must not be discarded because a prior link exists.
- [ ] **Make `noOffersConfirmed` authoritative only when the authenticated My Offers page has zero valid codes.** Do not OR a transient error/public-page empty flag into a catalog that already contains offers.
- [ ] **Open or otherwise resolve every offer card that lacks a verified code-specific URL, regardless of whether action-card and code counts happen to be equal.**
- [ ] **Before extracting a code, verify the generated URL, loaded page, intercepted request, and returned payload all identify the same code.**

## Priority 4 — Repair bookings, completed history, and loyalty classification

- [ ] **Replace timestamp-based fallback booking IDs with deterministic synthetic IDs.** Use normalized ship, start date, end date, itinerary, lead passenger/cabin where available, and a clear `carnival-synthetic-` prefix.
- [ ] **Treat every generated ID as synthetic during deduplication.** The current generic `carnival-<timestamp>-<index>` fallback is incorrectly treated as a real booking ID and can duplicate the same sailing.
- [ ] **Implement a robust Carnival date parser.** Support ISO dates, U.S. numeric dates, and textual dates such as “Sep 2, 2023,” then classify from the sailing end date whenever possible.
- [ ] **Remove the hard-coded Carnival ship-name regex from DOM bookings.** Extract ship identity from structured data or nearby labels so new and renamed ships are not silently missed.
- [ ] **Do not infer cruise nights from VIFP points.** Keep nights unknown unless the itinerary or booking source provides them.
- [ ] **Make lane authority page-specific.** Upcoming-empty text may authorize only the upcoming section; history-empty text may authorize only the history section, and only on the verified authenticated page/endpoint.
- [ ] **Merge profile snapshots field by field.** Do not select one “best profile” and discard a VIFP number, total-cruise count, or Players Club value that appeared on another valid profile page.
- [ ] **Use one canonical Carnival tier decoder across URL parsing, cookies, API data, profile DOM, and the extension.** Include Blue consistently.
- [ ] **Recognize both “Players Points” and “Players Pts,” plus structured API field variations.**
- [ ] **Keep Carnival loyalty exclusively in Carnival-specific fields.** Do not place Carnival VIFP or Players Club values into Crown & Anchor or Club Royale fields, even as temporary state.
- [ ] **Label locally inferred tiers as inferred.** An inference from cruise-day points must not look like an authoritative Carnival-provided tier.

## Priority 5 — Harden the run state machine, login, cancellation, and resume UX

- [ ] **Use one global Carnival sync coordinator whose lock remains held until the aborted/finished run promise fully settles.** Provider unmount must not immediately free the lock while the old asynchronous run is still unwinding.
- [ ] **Use `ownerId` to enforce ownership.** Only the owning provider may update state, logs, checkpoint, or release the lock.
- [ ] **Fail stale messages immediately.** A response with the wrong run/request ID should resolve the pending operation as cancelled/stale instead of waiting for timeout.
- [ ] **Make logging run-scoped and persist one terminal status:** complete, cancelled, auth lost, interrupted/resumable, or error.
- [ ] **Separate “Confirm Login” from “Start Sync.”** The current button can say “Start Sync” while only setting a manual logged-in flag.
- [ ] **Immediately verify the authenticated Carnival profile/API before acquiring the long-running sync lock.** A manual flag alone is not sufficient.
- [ ] **Detect session expiry during every navigation.** Save a checkpoint and move to `auth_lost`, not zero results or a generic timeout.
- [ ] **Fix resumed-run ETA.** Calculate speed from codes processed during the current run, not from restored checkpoint codes.
- [ ] **Show a per-code result ledger in the review UI:** successful, verified empty, incomplete, failed, or pending.

## Priority 6 — Establish one canonical persisted Carnival manifest and accurate UI metrics

- [ ] **Persist a Carnival sync manifest** containing run ID, account/VIFP fingerprint, catalog count, completed-code count, verified-empty codes, failed/incomplete codes, row-bearing codes, unique sailing count, booking/history counts, and sync timestamp.
- [ ] **Drive dashboard counts from the manifest rather than re-deriving them from loosely grouped offer and cruise rows.**
- [ ] **Define “Eligible Sailings” as unique sailing records** using a canonical sailing key; raw row count must not inflate the number.
- [ ] **Prevent a sync from being labeled complete when any visible code is incomplete or truncated.** Present “partial/resumable” instead.
- [ ] **Keep All Brands and Carnival-only totals visually and logically separate across every Offers, Cruises, Booked, Calendar, and dashboard view.**

## Priority 7 — Eliminate native/extension divergence and dead Carnival paths

- [ ] **Bring `assets/easy-seas-extension/carnival-sync.js` to parity or deprecate it.** It still uses page size 8, up to 100 pages, no run ID, no checkpoint/resume, no cancellation, global context, and simplistic top-level total parsing.
- [ ] **Extract shared Carnival parsing and normalization fixtures/core logic** so native and extension paths cannot silently produce different data.
- [ ] **Remove or isolate the legacy `carnivalOffersExtraction.ts` route and unreachable Carnival branches in the provider after parity tests pass.** The new safe path returns before these branches, but legacy imports and code remain and can be accidentally reactivated.
- [ ] **Remove unused or misleading Carnival state fields and imports** after migration to the shared engine.

## Priority 8 — Replace marker-based QA with behavioral tests and make builds reproducible

- [ ] **Convert Build 312 QA from source-string checks to executable behavior tests.** The current test can pass even when runtime behavior is wrong.
- [ ] **Add parser fixtures** for representative catalog pages, offer cards, API inventory payloads, pricing/facet payloads, zero results, 329 results, bookings, completed history, loyalty, and redesigned/unknown pages.
- [ ] **Add mocked WebView bridge integration tests** for request/response correlation, stale payload rejection, navigation redirects, auth loss, timeouts, process termination, and cancellation.
- [ ] **Add checkpoint tests** for app-profile switch, Carnival-account switch, changed TGO/personalization, stale metadata, same code list/different account, resume, and checkpoint migration.
- [ ] **Add persistence failure tests** that fail after the first or second collection write and verify rollback/recovery.
- [ ] **Add duplicate/misclassification tests** for the September 2023 Panorama record and for the same booking arriving from API, DOM, and history table.
- [ ] **Add native-versus-extension parity tests** using the same fixtures.
- [ ] **Add mutation tests** so the suite proves it fails when context validation, cancellation, dedupe, or zero-result rules are intentionally broken.
- [ ] **Resolve the React 19 / lucide peer-dependency conflict.** Upgrade to a compatible icon package/version or pin a verified compatible dependency graph.
- [ ] **Include and enforce a lockfile.** Record Node, npm/Bun, Expo, EAS CLI, Xcode, Android Gradle, and Java versions.
- [ ] **Add clean-install, lint, typecheck, unit, integration, archive-integrity, and version-hardlock jobs to CI.**
- [ ] **Create a native live-test protocol** that records a redacted endpoint/payload manifest, all discovered codes, every per-code outcome, elapsed time, resumability, final counts, and data comparison before/after Apply Sync.

---

# Approval acceptance criteria

The next build should not be considered complete until all of the following are proven:

1. A checkpoint from another Carnival account or personalization context is rejected.
2. Every visible rate code ends in `success` or API-verified `authoritative_empty`; ambiguous codes remain partial/resumable.
3. Each accepted payload is cryptographically/request-context linked to the correct run, code, and page/cursor.
4. A 329-result fixture captures all unique sailings without relying on visible card count.
5. A cancelled, backgrounded, unmounted, or WebView-terminated run cannot continue writing data or logs and resumes safely.
6. The 2023 Panorama sailing appears exactly once and only as completed.
7. Upcoming/history empty authority cannot erase valid stored data after a parser or authentication failure.
8. Apply Sync is all-or-nothing locally or can automatically restore the prior snapshot.
9. Native and extension fixture results match exactly, or the extension is formally disabled.
10. A clean dependency install, lint, full typecheck, behavioral test suite, and archive validation all pass from a lockfile.
11. A live authenticated Carnival QA run processes the complete personalized catalog and exports a terminal completion/partial/error record with no unexplained status reversal.
12. Carnival-only screens and All Brands screens show correctly scoped, explainable, unique counts.

## Approval instruction

Approve this plan with **APPROVE CARNIVAL DEEP QA TODO**, or specify the items to add, remove, or reprioritize. No code changes will begin before approval.
