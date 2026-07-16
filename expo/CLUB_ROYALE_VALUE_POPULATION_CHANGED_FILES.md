# Club Royale Value Population — Changed Files

Baseline: `EasySeas_V1242_Build314_CLUB_ROYALE_LOYALTY_CRUISES_COMPLETE_PROPER_FULL_CODEBASE.zip`

## Runtime files changed

### `lib/royalCaribbean/authDetection.ts`
- Captures reusable Royal authentication/request headers from real page `fetch` and XHR traffic before the requests execute.
- Supports `Headers`, header tuples, request objects, and plain objects.
- Restricts capture to an allow-list of Royal authentication and request-context headers.
- Keeps captured header values in WebView page memory only; they are not sent through native logs.

### `state/RoyalCaribbeanSyncProvider.tsx`
- Reworks the dedicated Crown & Anchor fallback to reuse captured authenticated Royal headers.
- Supports cookie-authenticated sessions when no JavaScript-readable bearer token exists.
- Reads compatible session state from localStorage/sessionStorage without requiring it.
- Adds a hidden same-origin Royal loyalty primer.
- Tries the AWS loyalty endpoint and bounded same-origin account/profile alternatives.
- Keeps `credentials: include` on every request.
- Requires both authoritative C&A tier and points before closing the C&A lane.
- Uses bounded retries without navigating away and destroying its own timer.

### `state/LoyaltyProvider.tsx`
- Prefers exact current API Club Royale tier, then persisted profile tier, then calculated tier.
- Prefers exact current API C&A tier, then persisted profile tier, then calculated tier.
- Retains transactional storage/profile readback behavior.

### `app/(tabs)/settings.tsx`
- Makes the primary profile render loyalty values from LoyaltyProvider after verified storage/profile readback.
- Prevents a one-render UserProvider lag from showing old pre-sync values.
- Keeps secondary profiles profile-scoped.
- Preserves authoritative zero values.

### `constants/confirmedBookedCruises.ts`
- Removes an unrelated hard-coded loyalty identity from a booked-cruise manifest row.
- Booked-cruise data can no longer inject a C&A identity into loyalty state.

### `lib/royalCaribbean/step4_loyalty.ts`
- Replaces an account-specific example in a runtime comment with a generic description.

## Regression files changed

### `scripts/testV1242Build314ClubRoyaleApplySafety.js`
- Updates the Settings assertions for verified primary LoyaltyProvider state and profile-scoped secondary state.

### `scripts/testV1242Build314ClubRoyaleEndToEndStateUI.js`
- Verifies immediate primary Club Royale and C&A rendering from verified LoyaltyProvider state.

## Regression file added

### `scripts/testV1242Build314RoyalLoyaltyHeaderReplayAndPopulation.js`
Verifies:
- WebView header-capture script compilation.
- Fetch and XHR header capture.
- Authentication header values are not bridged to native logs.
- Dedicated C&A injected-script compilation.
- Header replay and cookie-only fallback.
- Same-origin primer and alternate routes.
- C&A requires both tier and points.
- Club Royale/C&A field separation.
- Immediate Settings population.
- Exact API tier priority.
- Booked-cruise manifests cannot inject loyalty identity.

## Protected files unchanged

- `app.config.js`
- `app.json`
- `babel.config.js`
- `metro.config.js`
- `package.json`
- `tsconfig.json`

No protected file was changed.
