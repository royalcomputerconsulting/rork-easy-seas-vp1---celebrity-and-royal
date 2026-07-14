# EasySeas v12.3.2 — Royal Offer Zero-Row Preservation QA

Baseline: Archive(19).zip + v12.3.1 Casino section wiring fix.

## Problem proven by the latest log

Royal sync discovered 4 visible Club Royale offers:

- 2606C08 — June Instant Cruise Reward — 144 rows
- 26NPR503 — Limitless Luck — 66 rows
- 26RCL703 — July Monthly Mix — 0 rows from the detail scrape
- 26SEP103 — September Shuffle — 60 rows

The app then staged 3 offers / 270 rows and applied those rows, which caused the July Monthly Mix offer to disappear even though it was visible on the Royal page.

## Fix

1. Step 1 now uses runtime marker `v12.3.2-live-offer-retry-preserve-visible-offers`.
2. Royal continuation now returns to the live My Offers list and opens each remaining offer through the current View Sailings card instead of trusting stale saved detail URLs first.
3. Any Royal visible offer that returns 0 rows is retried once from the live My Offers View Sailings button.
4. `26RCL703` has a verified target of 197 rows so the scraper waits/crawls longer before giving up.
5. If one visible offer still returns 0 rows while other offers captured successfully, Step 1 continues with captured rows instead of discarding the whole sync.
6. Apply Sync now preserves unmatched existing Royal offer/catalog rows when the capture is useful but not a full authoritative replacement. This prevents a visible zero-row offer such as July Monthly Mix from being deleted from the app.

## Expected good result

If Royal shows 4 offers and one offer returns 0 rows, the app should not shrink the app to 3 offers. It should save the 3 freshly captured offers and preserve the existing rows for the zero-row visible offer.

## QA

Run:

```bash
node scripts/testV1232RoyalOfferZeroRowPreservation.js
```

Expected:

```txt
PASS testV1232RoyalOfferZeroRowPreservation
```
