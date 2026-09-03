# Easy Seas 13.0.74 — Build 443

## Functional repairs

- Bounded offer-planning analysis to a deterministic representative sample while retaining all 13 offers, all 3,151 sailing rows, and full financial/count calculations.
- Restored the missing Settings search icon import that could crash the Settings screen at runtime.
- Normalized unknown cruise guest eligibility to `null` for the discovery filter contract.

## Verified release gates

- Expo Doctor: 18/18 checks passed.
- TypeScript: `tsc --noEmit` passed with zero errors.
- Maintained regressions: 160 passed, 48 optional/historical fixtures skipped, 0 failed.
- Large Offers interaction: 13 offers / 3,151 sailings analyzed within the interaction budget.
- iOS production export: 3,814 modules bundled successfully into a 19.6 MB Hermes bundle.
- iOS native prebuild completed successfully.

The source package intentionally excludes `node_modules`, generated `.expo` state, credentials, and build caches. Install dependencies from the locked package manifest before local building.
