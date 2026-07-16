# OPT-2 Personal Certificate Value Model — QA Report

**Checkpoint:** `OPT2_PERSONAL_CERTIFICATE_VALUE_MODEL.zip`  
**Starting checkpoint:** `OPT1_CANONICAL_PERSONAL_CASINO_HISTORY.zip`  
**Status:** PASS  
**Date:** July 15, 2026

## Scope completed

- Added versioned `CertificateThresholdDefinition` and `CertificateValueSnapshot` contracts.
- Kept A/C and other certificate families distinct by definition, code, effective period, and cruise-length scope.
- Added sailing-level valuation for cruise fare, covered taxes/fees, FreePlay, OBC, internet, drinks, dining, spa, suite upgrade, itinerary, and other verified value.
- Added mandatory user-paid-cost subtraction.
- Added benefit-key deduplication so Signature, OBC, internet, NextCruise, and similar non-stackable benefits cannot be counted twice.
- Added low/median/mean/high/best-realistic/maximum-raw distributions.
- Added personal redemption probability using observed history, Bayesian smoothing, available sailings, booking conflicts, expiration, restrictions, and explicit likely-use weighting.
- Preserved gross replacement value separately from probability-adjusted expected realized value.
- Added alternative trade-in value treatment.
- Added historical value backfill that preserves actual realized value separately and warns when only later-period evidence exists.
- Added source document/version/page evidence, completeness, confidence, assumptions, and warnings.
- Kept all production recommendation flags disabled.

## Focused functional coverage

- Duplicate non-stackable benefits are suppressed.
- User-paid taxes and mandatory costs reduce net replacement value.
- Ineligible sailings cannot inflate distributions.
- Redemption conflicts, short expiration windows, and restrictions reduce likely use.
- A and C threshold definitions cannot collapse into one record.
- Empty or fallback-only Certificate Library data produces missing confidence and explicit warnings.
- Historical actual value is never overwritten by an estimate.
- Later-period historical estimation is explicitly marked.

## Test results

- Executable regression scripts: **36 passed, 0 failed**.
- TypeScript/TSX syntax transpilation: **434 files passed**.
- Strict standalone typecheck for executable OPT-2 modules: **passed**.
- App Store version verification: **passed**.
- Protected-file hash comparison: **passed**.

A full Expo/React Native project typecheck remains unavailable because the uploaded archive does not include `node_modules`. No dependency, package, lock, Expo, React Native, Metro, Babel, TypeScript, native, server, workflow, or deployment configuration was changed.

## Production behavior and release gate

OPT-2 is a non-UI, rollback-safe value foundation. It does not authorize production recommendations. Certificate values remain non-authoritative until durable Certificate Library evidence is available, OPT-3 probability/loss models pass, and the OPT-4 marginal-EV safety engine passes.
