# Offer Sync v8.5.6 QA Notes

## Log failure addressed
The failing logs showed:
- Royal page rendered `All Offers (3)` and three `View Sailings` buttons.
- The app then called a now-broken `/api/casino/casino-offers/v1` endpoint and received 404.
- DOM fallback refused to create structured rows, so Step 1 completed with 0 offers.

## Permanent changes
- Step 1 now logs `Offer sync engine v8.5.6 active` so the running build is verifiable from the app log.
- The offer parser now reads the rendered Royal page directly and extracts real offer name, code, expiration, cabin, guest type, and perks from the visible offer cards.
- It no longer depends on the failed `/api/casino/casino-offers/v1` endpoint.
- It no longer clicks the full page container as the All Offers control.
- It maps parsed offers to the visible `View Sailings` buttons by order.
- It attempts to open each `View Sailings` button and parse sailing rows when Royal exposes them.
- If Royal hides sailing rows from readable DOM, it still syncs the real offer tile instead of reporting zero.
- It refuses to overwrite existing offers when no real offer code can be parsed.

## Expected smoke-test log
A correct run should include:
- `Offer sync engine v8.5.6 active`
- `Offer page expanded: expected 3 offer(s), found 3 View Sailings button(s)`
- `Found 3 View Sailings button(s) and parsed 3 visible offer card(s)`
- `DOM fallback captured 3 offer(s)`

