# V1013 Certificate Hermes Date Parse Fix QA

## Problem found from `last 18.log`

The exported certificate scrape log showed that the app was successfully downloading and extracting text from all 22 June 2026 PDFs, for example:

- `textLength=178904`
- sample text containing `2606C05 Spectrum Of The Seas® Shanghai (Baoshan), China June 3, 2026`

However, every PDF returned `sailingsFound=0`.

## Root cause

The parser was still relying on JavaScript `new Date("June 13, 2026")` / `Date.parse()` after the ship/date regex found the text.

That can work in some JavaScript runtimes, but it is not reliable in React Native / Hermes. In Hermes, month-name date strings can parse as invalid. That meant the app found the text but rejected every row when converting the date.

## Fix

- Added manual parsing for Royal certificate date strings:
  - `June 13, 2026`
  - `July 24, 2026`
  - `August 28, 2026`
- Added support for abbreviated month forms.
- Kept ISO date support.
- Kept numeric date fallback.
- Left `Date.parse()` only as a final fallback, not the primary certificate path.
- Applied the fix in both:
  - `lib/royalCaribbean/localCertificateMonthList.ts`
  - `backend/trpc/routes/certificate-explorer.ts`

## Expected result

If the PDF text sample contains a known Royal ship and a month-name date, the device fallback parser should now produce sailing rows instead of zero rows.

The log parser label was updated to:

`device-manual-hermes-safe-date`

so the export log confirms the corrected parser is being used.
