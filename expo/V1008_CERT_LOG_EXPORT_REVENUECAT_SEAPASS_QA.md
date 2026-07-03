# V1008 — Certificate Log Export, RevenueCat Noise, SeaPass Date Alignment

## Scope
Targeted patch on top of v1007/v1008 worktree. No broad Easy Seas rewrite.

## Fixes

### Certificate scraping diagnostics/export
- The Certificate Month List modal now receives the Club Royale sync `addLog` function.
- Every certificate month scrape now writes to the same Royal Caribbean sync logger used by **Export Log**.
- Exported `last.log` now includes:
  - scrape start month/code,
  - backend PDF.js progress by certificate code,
  - device fallback progress by certificate code,
  - per-PDF status rows for every certificate code,
  - text length,
  - sailings found,
  - parser name,
  - error message,
  - a short extracted text sample for failed/no-sailing PDFs.
- The on-screen sync log also shows concise certificate scrape progress and summary lines.
- The certificate modal now displays **cert PDFs scraped** from `searchedCertificateCount`, not only certificates that produced sailings.

### Certificate parser observability
- `pdfScanLog` now carries optional `parser` and `sampleText` fields for backend and local/device parsers.
- This does not magically guarantee Royal's PDF text extraction succeeds on every PDF, but it makes failures actionable because the exported log now shows exactly what text the parser actually saw.

### RevenueCat diagnostic noise
- Automatic RevenueCat offerings fetch is now disabled unless `EXPO_PUBLIC_ENABLE_REVENUECAT_OFFERINGS=true`.
- CustomerInfo subscription checks still run, so existing entitlements/App Store code redemptions can still be detected.
- This avoids repeated RevenueCat dashboard configuration errors when offerings/products are not configured.

### SeaPass Generator
- Date overlay moved upward to better align under the boarding time.
- Port normalization now corrects `XANAVERAL` as well as `CANABERAL` to `CANAVERAL`.

## Version
- App/package: 9.11.08
- iOS build: 9.11.08
- Android versionCode: 91108

## Files Changed
- `components/CertificateMonthListModal.tsx`
- `app/royal-caribbean-sync.tsx`
- `lib/royalCaribbean/logger.ts`
- `backend/trpc/routes/certificate-explorer.ts`
- `lib/royalCaribbean/localCertificateMonthList.ts`
- `state/EntitlementProvider.tsx`
- `lib/seaPassWebPass.ts`
- `package.json`
- `app.json`
