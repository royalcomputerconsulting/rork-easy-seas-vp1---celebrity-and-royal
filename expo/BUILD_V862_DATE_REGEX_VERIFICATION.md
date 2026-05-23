# Build v862 Date Regex Verification Patch

This package adds a hardened sailing-date parser for Club Royale offer section extraction.

Verified issue in prior build:
- Visible sailing DOM fallback only matched a narrow set of dates: `May 9, 2026`, `5/9/2026`, and `20260509`.
- It could miss `May 9 2026`, ordinal dates like `May 9th, 2026`, ISO/dash dates like `2026-05-09`, and day-first dates like `9 May 2026`.
- It could also accidentally choose the offer expiration date when text such as `Redeem by May 31, 2026` appeared near a ship name.

Patched files:
- `lib/royalCaribbean/step1_offers.ts`
- `lib/royalCaribbean/offerPayloadParser.ts`

Date formats now supported:
- `May 9, 2026`
- `May 9 2026`
- `May 9th, 2026`
- `September 4, 2026`
- `Sept 4 2026`
- `9 May 2026`
- `05/09/2026`
- `5-9-2026`
- `2026-05-09`
- `20260509`
- `2026/05/09`

Additional guard:
- Sailing-date extraction now deprioritizes/removes date matches preceded by `Redeem`, `Reserve`, `Book`, `Expires`, `Expiration`, `Valid`, or `Use`, so the parser does not confuse an offer expiration date with a sailing date.

Validation performed:
- Extracted the injected Step 1 script and ran a JavaScript syntax check.
- Ran targeted date parser tests confirming all listed formats normalize to `MM/DD/YYYY`.
- Confirmed a mixed text sample containing both `Redeem by May 31, 2026` and `Departing September 4, 2026` selects the sailing date, not the expiration date.
