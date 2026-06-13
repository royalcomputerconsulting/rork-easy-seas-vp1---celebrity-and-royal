# v962 Final Guardrail Build — 9.10.62

This build is based on the v961/v950 proven scraper branch and adds the missing hard guardrails shown by the latest crash log.

## Critical changes

1. Version is explicitly bumped to 9.10.62 so diagnostic exports prove the correct build is installed.
2. The offer crawler now distinguishes the exact My Offers list page from an offer detail page. `/club-royale/offers/26BCP105` no longer counts as the list page.
3. After returning from an offer, the crawler waits longer and forces the exact list URL before trying to rediscover/open the next offer.
4. If My Offers rediscovery temporarily returns zero but the previous saved offer list exists, the crawler continues from the saved list instead of failing safe immediately.
5. View Details clicks are throttled to small batches; the scraper no longer clicks 60+ buttons in one loop.
6. Placeholder/pending blocks are rejected before enrichment, row creation, logging, and React Native handoff.
7. The max DOM crawl rounds were reduced to prevent long lockups.

## Expected log shape

- Engine version: v9.6.2
- App version: 9.10.62
- 26BCP105 should finish at 54 rows.
- View Details clicks should be far lower than 855.
- Successful scrape logs should not include `ship pending | itinerary pending`.
- After 26BCP105, the crawler should return to the exact My Offers list and open the next saved offer instead of discovering zero and stopping.
