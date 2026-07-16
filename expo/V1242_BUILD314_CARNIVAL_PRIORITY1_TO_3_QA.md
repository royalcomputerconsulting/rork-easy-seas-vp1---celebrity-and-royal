# Easy Seas v12.4.2 Build 314
## Carnival Priority 1–3 Completion and QA

**Build:** 314  
**Android versionCode:** 120405  
**Scope completed:** Carnival Deep-QA Priorities 1, 2, and 3 only  
**Priority 4 status:** Not started in this build

## Purpose

Build 314 continues the Stage 1 Carnival repair after Build 313 completed Priority 0. This build replaces broad URL-pattern capture and fragile visible-card pagination with request-scoped inventory classification, explicit pagination adapters, and rate-code-specific personalization isolation.

## Priority 1 — API capture and result validation

Completed:

- Added `lib/carnival/carnivalInventoryRuntime.ts` as the shared native/browser inventory classification and pagination runtime.
- Carnival JSON responses are classified by payload schema as well as URL.
- Only `inventory` and `inventory_empty` payloads may enter sailing extraction.
- Pricing, facets, offer catalogs, analytics, and configuration payloads are explicitly excluded.
- Every retained network payload records:
  - HTTP method
  - request URL
  - request body
  - response URL
  - status
  - content type
  - rate code
  - logical page
  - request ID
  - run ID
  - capture timestamp
  - schema analysis
- Exact offer-code proof is required. A broad multi-code response cannot be assigned to the selected offer merely because the expected code appears somewhere in the payload.
- Numeric page, offset, cursor, or exact expected-URL proof is required for the current page.
- Payloads are stored by `runId|offerCode|pageNumber|requestId`.
- The prior context is cleared before each request and released after each request, including exceptions.
- A single retained payload is capped at 2.5 MB.
- A request envelope is capped at 6 MB and eight payloads.
- Broad `__NEXT_DATA__` and application/json hydration blobs are no longer walked as sailing inventory because they can contain multiple offers.
- When a verified API envelope exists, DOM rows are not mixed into the API result.
- Pagination totals skip sailing-row, facet, pricing, analytics, and configuration subtrees so unrelated nested counts cannot overwrite the voyage total.

## Priority 2 — Zero results and pagination

Completed:

- Zero eligible sailings are accepted only from:
  - a matched, clean inventory response reporting `totalResults=0` with an empty sailing collection; or
  - a stable offer-specific DOM empty state observed twice while the exact rate-code URL remains loaded.
- Facet or pricing responses reporting zero can never become authoritative empty results.
- One no-growth page no longer ends extraction.
- Two consecutive no-growth pages produce an explicit incomplete/truncated result.
- A repeated page signature produces an explicit incomplete result instead of looping.
- Maximum pagination safety limit increased to 50 logical pages.
- Supports page-number, offset, cursor, and next-link pagination.
- API/GraphQL next links are never opened as WebView pages. Their page/offset/cursor values are copied to the rendered Carnival cruise-search URL.
- DOM-only totals can guide fallback pagination but cannot mark an offer complete.
- An authoritative payload ending before the reported total is recorded as incomplete.
- Added a behavioral 329-sailing fixture covering seven pages (50 + 50 + 50 + 50 + 50 + 50 + 29). All 329 rows must be captured and deduplicated before success.

## Priority 3 — Rate-code personalization isolation

Completed:

- Every visible Carnival rate code must have a verified code-specific Shop Now/search URL before extraction starts.
- Links are tracked with verification state and source:
  - explicit
  - clicked
  - catalog
  - generated
  - observed
- A later verified code-specific link wins over a broad prior link.
- A broad URL can never displace an already verified code-specific link.
- A one-code TGO value discovered after clicking an offer cannot overwrite a richer multi-code authenticated TGO catalog.
- Transient no-offers shells cannot erase already discovered rate codes.
- Cards without a verified direct link receive a generated, authenticated code-specific search URL using the preserved VIFP/TGO/resident/locality/currency context.
- Before accepting data, the provider verifies that:
  - the browser URL still contains the selected rate code;
  - the request belongs to the selected rate code;
  - the response belongs to the same request/run/page;
  - any matched payload has both request and page proof.

## Behavioral QA added

`scripts/testV1242Build314CarnivalPriority1To3.js` verifies:

- schema-first inventory detection on a non-search endpoint;
- exact request code matching;
- rejection of multi-code broad payloads;
- rejection of wrong-page payloads;
- cursor-page proof;
- facet/pricing separation;
- authoritative clean-empty inventory;
- unrelated nested count rejection;
- all 329 fixture sailings captured;
- one no-growth page continues;
- two no-growth pages become incomplete;
- repeated signatures become incomplete;
- DOM-only totals cannot complete an offer;
- page, offset, cursor, HTML next-link, and API next-link adapters;
- API next links remain on `/cruise-search`;
- isolated links generated for every rate code;
- richer TGO catalog preservation;
- latest verified code-specific link precedence;
- transient no-offers protection;
- JavaScript parsing of the generated WebView interception and scraper scripts.

## Regression results

### Build 313 baseline

- 19/19 bundled QA scripts passed.
- 410 TypeScript/TSX files syntax-transpiled.
- 0 syntax diagnostics.

### Build 314

- 20/20 bundled QA scripts passed.
- 411 TypeScript/TSX files syntax-transpiled.
- 0 syntax diagnostics.
- App Store hardlock validation passed for 12.4.2 (314).
- Android version validation passed for 120405.
- Generated WebView JavaScript parse tests passed.
- ZIP archive integrity test passed.

## Full TypeScript project check limitation

`npx tsc --noEmit` cannot perform a clean project typecheck in the supplied archive because dependencies are not installed and `expo/tsconfig.base` is unavailable. The command reports missing Expo/React modules and library configuration before it can provide a meaningful whole-project result. This is an existing repository/dependency-environment limitation, not represented as a pass.

All changed `.ts` and `.tsx` files, and all 411 TypeScript/TSX files in the archive, were independently transpiled with TypeScript 5.9 syntax diagnostics enabled.

## Files directly changed for Priority 1–3

- `lib/carnival/carnivalInventoryRuntime.ts` — new
- `lib/carnival/carnivalSafeSync.ts`
- `lib/carnival/carnivalSyncRuntime.ts`
- `lib/royalCaribbean/authDetection.ts`
- `state/RoyalCaribbeanSyncProvider.tsx`
- `scripts/testV1242Build314CarnivalPriority1To3.js` — new
- App Store/Android build hardlock files and carried-forward QA version assertions

## Deferred by user instruction

Priority 4 remains for the next continuation of Stage 1 and includes booking/history/loyalty normalization work. Priorities 5–6 will form the user's actual Stage 2. Remaining priorities will form Stage 3.

## On-device validation still required

This environment cannot authenticate to the user's live Carnival account or execute the native iOS WebView. Final production confirmation requires an installed Build 314 live run. The log should show each rate code ending in `success`, `authoritative_empty`, or an explicit resumable incomplete/error status; no uncertain zero may be applied as complete.
