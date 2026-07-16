# Club Royale Value Population — Final QA Report

## Result

**PASS — ready for authenticated native testing.**

This build repairs the remaining loyalty-value population path exposed by the two latest Royal sync logs.

## Log-derived root cause

The prior build successfully captured and persisted Club Royale `Signature / 20,941`, but the dedicated Crown & Anchor request waited for JavaScript-readable authentication headers even though the Royal session was authenticated primarily through cookies. The C&A lane therefore timed out and preserved stale stored C&A values.

## Corrected behavior

### Club Royale
- Club Royale tier and points remain a separate authority lane.
- `individualPoints` from the casino loyalty payload continues to populate Club Royale points only.
- A verified `Signature / 20,941` result updates storage, selected-profile persistence, LoyaltyProvider state, and the primary Settings card.
- Club Royale points cannot populate C&A points.

### Crown & Anchor
- The before-content WebView interceptor captures Royal's real request headers from authenticated fetch/XHR traffic.
- The dedicated C&A request reuses those headers.
- Cookie-only authenticated attempts are allowed when no bearer token is readable.
- A hidden same-origin primer gives Royal's account page an opportunity to establish its normal loyalty request context.
- The sync tries bounded AWS and same-origin loyalty routes without navigating away.
- C&A is considered complete only when both tier and points are authoritative.
- When authoritative C&A data arrives, storage, profile persistence, LoyaltyProvider, and Settings update together.
- When Royal still withholds complete C&A data, existing C&A values are preserved instead of being replaced with casino points, blanks, or zeros.

### Immediate UI population
- The primary Settings card now reads the post-readback LoyaltyProvider values.
- This eliminates the one-render delay that could show stale pre-sync values after Apply Sync.
- Secondary profiles remain isolated and profile-scoped.

## Cruise and offer compatibility

The existing completed Club Royale build behavior remains intact:
- 12-upcoming/60-completed cruise completeness fixture passes.
- Same-date/different-reservation identity protection passes.
- Offer-to-sailing attachment completeness passes.
- Apply Sync rollback/readback protection passes.
- Carnival sync regression suites pass unchanged.

## Automated validation

- **29/29 regression scripts passed.**
- **413 TypeScript/TSX files passed syntax transpilation.**
- Protected configuration hashes passed byte-for-byte verification.
- No uploaded raw sync logs are included.
- No uploaded-only long account identifier found in the source tree.
- ZIP integrity and packaged-copy tests are required immediately after packaging and are recorded in the final test log/checksum.

## Live-test limitation

The build environment cannot authenticate to the user's Royal account. A native authenticated run remains necessary to verify Royal's current production response. After that run:
- Club Royale should display `Signature / 20,941` when the same authoritative casino payload is returned.
- C&A should replace the stale stored tier/points only when one of the authenticated C&A routes returns both current values.

## Packaged-copy verification

The first clean package was extracted to a new directory and independently passed:
- 29 regression scripts
- 413 TypeScript/TSX transpilation checks
- six protected-file hash checks

The final rebuilt archive was then checked again for ZIP integrity and checksum generation.
