# V12.3.7 Certificate A/C Bank Robust Download QA

## Purpose
Fix the certificate code/download flow that could fail with:

```txt
JSON Parse error: Unexpected end of input
```

The failure was caused by long A/C certificate bank scans returning an empty/truncated tRPC response to mobile before all public Royal Caribbean PDFs were scanned.

## Version

```txt
Version: 12.3.7
iOS buildNumber: 12.3.7
Android versionCode: 120307
Runtime marker: v12.3.7-certificate-ac-bank-robust-download
```

## Fixes

1. Certificate A and C banks use a default point ladder so all code buttons can display even before every PDF is successfully parsed.
2. Certificate PDF scans now use a longer mobile-safe tRPC timeout.
3. Empty/non-JSON certificate backend responses are detected before they surface as a raw JSON.parse alert.
4. PDF text is cached for 30 minutes to avoid re-downloading the same A/C bank repeatedly.
5. Both 404/unavailable and successful PDF reads are handled as data states, not fatal download failures.
6. The backend returns catalog metadata for every A/C code, even when a code has no rows or no matching ship/date sailings.
7. Scanning uses safe concurrency so 20+ A/C detail PDFs can finish without timing out.
8. Parsed PDF points are preferred, but default ladder points are preserved if the PDF text cannot expose the point label.

## Expected behavior

- A Certificates and C Certificates both display their code ladders.
- Download All / certificate examination should not fail with raw `JSON Parse error: Unexpected end of input`.
- A/C detail PDFs that are unavailable should show as unavailable/empty rather than crashing the whole download.
- Available certificates should still parse and show eligible sailings.
- One bad/missing certificate code should not block the rest of the bank.

## QA

```bash
node scripts/testV1237CertificateBankRobustDownload.js
```
