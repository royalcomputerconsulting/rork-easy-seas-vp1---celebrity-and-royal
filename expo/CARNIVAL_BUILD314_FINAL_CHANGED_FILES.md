# EasySeas V12.4.2 Build 314 — Carnival Sync Changed-Files Manifest

## Source files changed

| File | Change size | Purpose |
|---|---:|---|
| `app/carnival-sync.tsx` | +2 / -0 | Wires the WebView `onLoadStart` event into the sync provider so navigation attempts and forced retries have a real load-start signal. |
| `lib/carnival/carnivalDataRuntime.ts` | +18 / -9 | Adds field-level authority evidence to merged Carnival loyalty snapshots, preserving authoritative zero values while preventing missing values from overwriting stored data. |
| `lib/carnival/carnivalInventoryRuntime.ts` | +77 / -11 | Adds immutable request/page context correlation, approved-endpoint validation, navigation-sequence checks, proof-source diagnostics, and rendered terminal pagination proof. |
| `lib/carnival/carnivalSafeSync.ts` | +153 / -38 | Expands protected profile/history payload capture, visible-result fallback, profile/history page discovery, bounded history expansion, loyalty evidence, booking/history extraction, and missing-night derivation. |
| `lib/carnival/carnivalSyncRuntime.ts` | +23 / -6 | Extends account-bound checkpoints with resumable page state and same-account compatibility needed to preserve the full initial offer catalog across later partial discoveries. |
| `lib/royalCaribbean/authDetection.ts` | +58 / -9 | Captures Carnival request start/context metadata and a bounded protected profile/booking/history payload ledger; behavior is gated to Carnival hosts and endpoints. |
| `state/RoyalCaribbeanSyncProvider.tsx` | +245 / -60 | Implements forced same-URL reloads, stale-timeout rejection, page-level checkpoints, full catalog union/reconciliation, bounded profile/history route traversal, date-derived nights, independent lane authority, and field-authoritative transactional Apply Sync. |
| `scripts/testV1242Build313CarnivalIntegrityStage1.js` | +3 / -3 | Replaces the real VIFP identifier embedded in the inherited fixture with a non-account synthetic test identifier; test behavior is unchanged. |
| `scripts/testV1242Build314CarnivalPriority1To3.js` | +2 / -2 | Replaces the real VIFP identifier embedded in the inherited fixture with a non-account synthetic test identifier; test behavior is unchanged. |

## Checkpoint and QA files added

- `CARNIVAL_BUILD314_STAGE1_CHECKPOINT.md`
- `CARNIVAL_BUILD314_STAGE2_CHECKPOINT.md`
- `CARNIVAL_BUILD314_STAGE3_CHECKPOINT.md`
- `CARNIVAL_BUILD314_STAGE4_CHECKPOINT.md`
- `CARNIVAL_BUILD314_STAGE5_CHECKPOINT.md`
- `CARNIVAL_BUILD314_STAGE6_CHECKPOINT.md`
- `CARNIVAL_BUILD314_STAGE7_CHECKPOINT.md`
- `CARNIVAL_BUILD314_FINAL_CHANGED_FILES.md`
- `CARNIVAL_BUILD314_FINAL_QA_REPORT.md`
- `CARNIVAL_BUILD314_FINAL_TEST_LOG.txt`
- `CARNIVAL_BUILD314_TIMEOUT_SAFE_FIX_TODO_COMPLETED.md`

## Explicitly unchanged

The following remain byte-identical to the supplied original archive:

- `package.json`
- `app.json`
- `app.config.js`
- `babel.config.js`
- `metro.config.js`
- `tsconfig.json`
- `eslint.config.js`
- Dependency versions and package-manager configuration
- Lock files (none were added, removed, or regenerated)
- EAS configuration and CI/workflow files

No Royal Caribbean or Celebrity source module was replaced. The shared request interceptor changes are restricted to Carnival domains and Carnival profile/inventory endpoints.
