# EasySeas v886 — Royal/Celebrity Sync Capture Restore QA

## Royal QA baseline
The current Royal Caribbean QA baseline is `assets/qa/royal_offers_qa_baseline_2026_05_24.csv`.

Expected Royal Sync Now offer results from this file:

| Offer | Code | Expected sailing rows |
|---|---:|---:|
| May Instant Cruise Reward | 2605C03A | 886 |
| Variety Selection | 26VTY104 | 107 |
| Limitless Luck | 26BCP105 | 54 |
| Hot Hot July | 26JUL104 | 40 |
| **Total** | | **1,087** |

The old 201-row QA baseline is obsolete because it did not include May Instant Cruise Reward.

## Sync fixes included
- Forced re-installation of WebView fetch/XHR network capture on each major Royal/Celebrity navigation.
- Restored the working v8.6.2 behavior: capture real `/api/casino/v2/offers/merged` payloads emitted by the page instead of trusting broken direct 404 fallback calls.
- Empty card/summary rows are not allowed to overwrite valid stored offers or sailing rows.
- If Sync Now captures zero authoritative booking rows, existing booked/completed cruise storage is preserved.
- Completed-cruise sync remains additive and dedupes by normalized ship + sailing date + nights so 54 past cruises cannot inflate to 108.
- Completed-cruise sync must never classify future/upcoming cruises as completed.
- Celebrity remains on its own selected cruise-line path and uses the same hardened capture reinstall behavior.

## QA pass criteria
- Royal Sync Now should log 4 visible offer cards and then capture 4 active offers with 1,087 real ship/date rows when the Royal site exposes the same offers as the baseline.
- Royal Sync Now should capture upcoming bookings and loyalty data; if Royal times out and returns 0 rows, stored data must not be wiped.
- Royal Completed Cruises Sync should capture/dedupe past cruises only and preserve existing upcoming cruises and offers.
- Celebrity Sync Now should not use Royal offer codes or Royal QA counts; it should use Celebrity/Blue Chip data only when Celebrity is selected.
