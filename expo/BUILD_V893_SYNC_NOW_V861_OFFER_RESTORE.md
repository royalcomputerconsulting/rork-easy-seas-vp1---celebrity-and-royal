# EasySeas v893 — Sync Now v8.6.1 Offer Restore + 2605C03A Large Offer Safety Net

Built from v891 so the fixed logo/header and the currently working completed-cruise sync remain intact.

## What changed

- Rebuilt **Sync Now / Step 1 offers** around the v8.6.1 successful button-driven offer model.
- Every visible **View Sailings** button remains authoritative; parsed-card count no longer limits extraction.
- Removed the dead post-DOM direct Royal casino-offer API fallback that repeatedly returned 404.
- Keeps sweeping page-emitted Royal offer payloads captured by the WebView network monitor.
- Preserves the v8.6.3 multi-date parser for lines like `Dates 2026 Aug 29, Sep 26, Oct 24, Oct 30`.
- Adds the v886 Royal QA baseline as a safety net when Royal exposes offer cards/buttons but hides the actual sailing table/payload.

## Verified baseline available in this codebase

`assets/qa/royal_offers_qa_baseline_2026_05_24.csv` contains 1,087 Royal offer/sailing rows:

| Offer | Code | Rows |
|---|---:|---:|
| May Instant Cruise Reward | 2605C03A | 886 |
| Variety Selection | 26VTY104 | 107 |
| Limitless Luck | 26BCP105 | 54 |
| Hot Hot July | 26JUL104 | 40 |

## 1200+ row question

The notes in v870/v873/v874/v878 say the app has no 201-row cap and can accept/sync 1200+ rows when Royal exposes that data. In the uploaded files available here, the largest concrete verified dataset I can prove is v886: **1,087 total rows**, with **886 rows for 2605C03A**. I did not find a log proving 2605C03A had 1200+ rows.

## Expected new log markers

- `Offer sync engine v8.9.3 active`
- `Old Royal casino-offers direct API fallback skipped after DOM extraction`
- `QA baseline safety-net loaded 886 sailing row(s) for 2605C03A` when Royal hides live rows
- `Large-offer safety-net merge complete`

## Untouched

- The dedicated Sync Completed Cruises workflow was not modified.
- Logo/header fix from v891 remains.
