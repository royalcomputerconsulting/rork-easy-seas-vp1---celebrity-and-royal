# Easy Seas v8.5.7 Critical Fixes

## Offer sync
- Step 1 is now DOM-first because Royal currently renders `All Offers (3)` and visible offer cards, while the guessed `/api/casino/casino-offers/v1` endpoint returns 404.
- The app no longer wastes the primary path on the broken 404 endpoint.
- Log marker: `Offer sync engine v8.5.7 active`.
- Expected healthy log: `DOM-first offer scan: expected 3 offer(s), parsed 3 card(s), found 3 View Sailings button(s)`.
- If Royal hides sailing rows, the sync still saves one real row per offer so the offer tiles do not disappear.
- Zero-offer overwrite protection remains in place.

## Add Cruise UI
- Modal is centered, 96% max height, keyboard-aware, scrollable, and the footer buttons remain accessible.
- Fixed invalid nested Text closing tag in cabin-type buttons.

## Promo / free-use subscription access
- Whitelist / promo-code free-use access is persisted as permanent free-use and never expires.
- Paid IAP subscriptions can expire normally.
- Free-use accounts always show `free_use` and keep Pro access even if RevenueCat has no active subscription.
