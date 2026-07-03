# V1007 Certificate PDF Parser Hardening QA

Targeted fix only. Preserves v1006 SeaPass and profile fixes.

## Problem addressed
The certificate month list could download the public monthly banks and detail PDFs but still show 0 sailing rows. The likely failure was that the parser depended on one text shape: repeated offer-code segments. Royal certificate PDFs can extract as line-based rows, flat repeated-code text, or ship/date fragments depending on the PDF engine.

## Changes
- Backend certificate scraping now treats PDF.js as the authoritative parser and uses the manual stream scanner only as a fallback.
- Added a PDF.js import fallback for bundlers that resolve `pdfjs-dist/legacy/build/pdf` differently from `pdfjs-dist/legacy/build/pdf.mjs`.
- Increased PDF.js line grouping tolerance from 2 to 4 points.
- Removed the negative lookbehind from the sailing date regex for broader JS compatibility.
- Added three independent structured-row strategies:
  1. line rows beginning with the exact certificate code, e.g. `2606C05 Spectrum Of The Seas ...`
  2. flat repeated-code rows split on `2606C05`
  3. ship/date boundary rows when the extractor returns rows without repeating the certificate code
- Added detailed row candidate counts in the log for each certificate code.

## Expected behavior
For a valid public certificate PDF such as `2606C05.pdf`, the parser should reconstruct actual sailing rows containing:
- Offer Code
- Ship
- Departure Port
- Sail Date
- Itinerary
- Stateroom Type
- Offer Type
- Next Cruise Bonus / OBC

The certificate screen should no longer silently accept a 0-row extraction as a successful scrape.
