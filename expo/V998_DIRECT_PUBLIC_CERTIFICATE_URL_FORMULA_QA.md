# V998 — Direct Public Certificate URL Formula QA

## User correction applied

The This Month / Next Month certificate buttons must **not** rely on a logged-in Royal Caribbean WebView and must **not** depend on a backend-only parser before showing usable certificate links.

The source of truth is the public Royal Caribbean PDF path:

`https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/<PDF_NAME>.pdf`

Only the PDF file name changes.

Examples:

- `2606A.pdf` = 2026 June A certificate index PDF.
- `2606C.pdf` = 2026 June C certificate index PDF.
- `2607C.pdf` = 2026 July C certificate index PDF.
- `2607C03A.pdf` = 2026 July C certificate, 03A level.

## Code changes

- App bumped to `9.10.98`.
- Certificate month modal now loads using the direct public Royal URL formula first and only.
- Removed the backend-first dependency from the certificate month buttons.
- The modal now always builds direct A and C certificate bank links for the requested month:
  - `<YYMM>A.pdf`
  - `<YYMM>C.pdf`
  - `<YYMM>AVIP2.pdf`, `<YYMM>A01.pdf`, `<YYMM>A02.pdf`, `<YYMM>A02A.pdf`, `<YYMM>A03.pdf`, `<YYMM>A03A.pdf`, `<YYMM>A04.pdf` … `<YYMM>A10.pdf`
  - `<YYMM>CVIP2.pdf`, `<YYMM>C01.pdf`, `<YYMM>C02.pdf`, `<YYMM>C02A.pdf`, `<YYMM>C03.pdf`, `<YYMM>C03A.pdf`, `<YYMM>C04.pdf` … `<YYMM>C10.pdf`
- Added known point labels from the Royal monthly certificate bank index:
  - VIP2 = 40,000
  - 01 = 25,000
  - 02 = 15,000
  - 02A = 9,000
  - 03 = 6,500
  - 03A = 4,000
  - 04 = 3,000
  - 05 = 2,000
  - 06 = 1,500
  - 07 = 1,200
  - 08 = 800
  - 09 = 600
  - 10 = 400
- Certificate summary chips now show all generated public PDF links even if sailing text extraction fails.
- The old “backend/local fallback” status wording was replaced with “Loaded by direct Royal Caribbean public PDF URL formula.”
- Error language now explains that no Royal login is required and that links are still usable even when sailing rows cannot be text-parsed.
- Both A Index and C Index buttons are shown.

## QA steps

1. Open Royal / Celebrity Casino Sync.
2. Tap **THIS MONTH CERTIFICATE LIST**.
3. Confirm the modal says the correct month code, for example `2606`.
4. Confirm A and C index buttons open:
   - `https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2606A.pdf`
   - `https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2606C.pdf`
5. Confirm certificate chips include links such as:
   - `2606CVIP2`
   - `2606C01`
   - `2606C02A`
   - `2606C03A`
   - `2606C10`
6. Tap **NEXT MONTH CERTIFICATE LIST**.
7. Confirm the next month code is used, for example `2607`.
8. Confirm certificate chips open direct URLs like:
   - `https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2607C03A.pdf`
9. Confirm no Royal login is required for these certificate PDFs.
