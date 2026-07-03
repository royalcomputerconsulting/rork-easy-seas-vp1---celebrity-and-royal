# V999 Certificate Full Download + Row Scrape QA

## Build
- Version: 9.10.99
- Focus: This Month / Next Month certificate list behavior.

## User correction addressed
The certificate-list buttons must not merely show PDF links or require a Royal Caribbean login. They must use the public Royal Caribbean certificate PDF URL formula, download the actual monthly A/C certificate PDFs and detail PDFs, scrape the sailing rows from the downloaded PDFs, and evaluate the resulting rows.

## Public URL formula
Base URL:

```text
https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/
```

Examples:

```text
2606A.pdf
2606C.pdf
2607A.pdf
2607C.pdf
2607C03A.pdf
```

## Behavior
- Downloads the public monthly A bank and C bank for the selected month.
- Discovers official detail certificate codes from those monthly index PDFs.
- Always includes the primary 01-10 fallback bank for A and C, so at least 20 detail certificate PDFs are attempted for each month.
- Includes official discovered sub-levels such as VIP2, 02A, or 03A when the monthly index exposes them.
- Downloads every detail PDF in the resolved bank.
- Scrapes every parsed PDF row instead of only deduping to unique ship/date pairs.
- Keeps unique-sailing counts as summary only.
- Removes PDF-link browsing UI from the certificate month modal; the modal now presents downloaded/evaluated certificate rows.

## UI changes
- Removed A Index / C Index link buttons.
- Removed Open PDF buttons from row cards.
- Renamed the certificate summary area to "Downloaded certificate PDFs".
- Reload now says "Reload and rescrape all certificates".
- Status pill now says the data was downloaded and evaluated by the direct public Royal Caribbean PDF URL formula.

## Acceptance test
1. Open Settings.
2. Open Royal/Celebrity Casino sync area.
3. Tap THIS MONTH CERTIFICATE LIST.
4. Confirm it scans without asking for a Royal login.
5. Confirm it reports downloaded/scraped certificate PDFs and shows sailing rows.
6. Tap NEXT MONTH CERTIFICATE LIST.
7. Confirm it uses next month YYMM code and repeats the same full download/scrape/evaluate workflow.
