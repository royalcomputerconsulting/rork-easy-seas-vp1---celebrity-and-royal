# Easy Seas v942 / 9.10.42 — Clean Sync Now Rebuild from February–April Base

Base used: uploaded February–April working build (`rork-easy-seas-vp1---celebrity-and-royal-8475f83fb8c66d9bf7f9743da3b06efd44e8011d.zip`).

## Sync Now rebuild

Replaced the February–April Step 1 offer extractor with a clean POST/network-first Sync Now engine. This follows the same principle that made Completed Cruises Sync work: capture the authoritative Royal POST/network payload, parse the full payload into normalized rows, send `offers_batch` chunks to the app, and only then send `step_complete`.

Engine marker:

```text
Easy Seas Sync Now clean rebuild engine v9.4.1 active
```

Priority order:

1. Discover all visible Club Royale offer cards and View Sailings buttons.
2. Open each offer one by one from `/club-royale/offers`.
3. For each offer, POST to `/api/casino/v2/offers/merged` using discovered `offerCode` and `playerOfferId` when available.
4. Recursively parse Royal JSON/POST payloads for sailing-like objects.
5. Use Download List, full detail crawl, View Details, and ship/itinerary enrichment as fallback/enrichment, not as the source of truth.
6. Stage rows per offer, return to My Offers, and repeat.
7. Reject partial virtualized scrapes such as 9/9/9/9, 36 rows, 45 rows, or 0 rows for any visible offer.
8. Preserve existing app data if validation fails.

## SeaPass fix

Fixed the garbled-word issue by removing SVG text-mask erasing and negative SVG letter spacing from dynamic SeaPass overlays. Text now uses deterministic solid field masks and a safe Arial/Helvetica font stack for preview/PNG/PDF export.

## Build asset fix

Kept the original Expo asset paths under `assets/images/` and also copied icon/splash/adaptive/favicon files to the project root as an extra guard.

## Version

- App version: 9.10.42
- iOS buildNumber: 9.10.42
- Android versionCode: 9142
