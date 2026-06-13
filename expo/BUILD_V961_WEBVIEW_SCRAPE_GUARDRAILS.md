# v961 WebView Scrape Guardrails

This build is a narrow repair on top of v960.

## Fixes

- Removes successful logging for `ship pending / itinerary pending` blocks.
- Skips pending/placeholder blocks before row creation and before React Native handoff.
- Clicks each `View Details` element only once by marking clicked elements in the WebView DOM.
- Adds per-offer timeout guard of 90 seconds.
- Stops known offers as soon as the verified row target is reached.
- For 26BCP105, the scraper stops at the verified 54 unique rows instead of continuing to inflate/trim indefinitely.
- Replaces per-block live log spam with one per-offer summary.

## Verified counts

- 2605C03A — 898
- 26WCR403 — 57
- 26BCP105 — 54
- 26JUL104 — 39
- 26SUM203 — 25

## Expected log behavior

No successful line should say:

`Scraped detail block 26BCP105 | ship pending | itinerary pending`

Instead the log should show a summary like:

`26BCP105 detail scrape summary: valid rows 54/54, valid blocks X, pending blocks skipped Y...`
