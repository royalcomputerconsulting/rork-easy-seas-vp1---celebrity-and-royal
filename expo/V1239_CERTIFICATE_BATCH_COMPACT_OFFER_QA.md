# v12.3.9 Certificate Batch Download + Compact Offer Header QA

## Runtime markers
- `v12.3.9-batched-certificate-download`

## Changes
- Certificate A/C scans are divided into three-code requests instead of one long request.
- Failed three-code groups retry one certificate at a time.
- Partial results remain visible and one failed certificate does not cancel the full bank.
- Certificate Lookup displays per-code progress and preserves downloaded results.
- Offer Details opens with a compact header so eligible cruises are immediately visible.
- Full value, intelligence, stacking, and status controls remain under Show offer summary.

## Acceptance
- Download All A/C can scan all current-month or next-month A and C codes without a single global abort.
- A failed code is listed as failed while other downloaded certificates and sailings remain available.
- Certificate Lookup no longer displays a fatal `Aborted` alert for a partially completed bank.
- Offer Details initially shows the offer identity and cruise list, not a full-screen intelligence header.
