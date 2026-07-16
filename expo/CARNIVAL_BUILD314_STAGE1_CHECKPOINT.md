# Carnival Build 314 Stage 1 Checkpoint

Completed WebView navigation and retry repair:

- Added monotonic navigation sequence logging.
- Added load-start and load-end correlation.
- Same-URL retries now issue a real WebView reload.
- Navigation timeout logs include a non-empty code/page label.
- Abort handling clears page and settle timers.
- Stale navigation callbacks cannot settle a newer request.

Validation: `scripts/testV1242Build314CarnivalPriority1To3.js` passed.
