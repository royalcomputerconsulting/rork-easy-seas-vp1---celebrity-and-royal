# Build v950 — Live Offer Payload Handoff + Cruise Card Detail Routing

Version: 9.10.50

## Confirmed preserved
- SeaPass Generator text rendering fix remains in place.
- v949 large-import performance changes remain in place.
- Royal/Celebrity brand separation remains in place.
- Bookings and loyalty sync behavior remains intact.

## Sync Now correction
This build stops relying only on the visible Royal/Celebrity DOM and closes the missing handoff gap exposed by the parser proof.

The working terminal parser proved the normalized offer schema can ingest 1,073 rows from the supplied offers CSV:
- 2605C03A: 898
- 26WCR403: 57
- 26BCP105: 54
- 26JUL104: 39
- 26SUM203: 25

The mobile fix now makes the WebView capture the live `/api/casino/v2/offers/merged` response bodies the same way Completed Cruises Sync captures booking POST/XHR payloads.

Changes:
- Network monitor now stores casino offer response bodies in:
  - `window.capturedOfferPayloads`
  - `window.capturedPayloads.offerPayloads`
  - `window.capturedPayloads.offers`
- Network monitor now posts `network_capture` endpoint `casinoOffersV2` to React Native.
- React Native sync provider now treats `casinoOffersV2` as a casino offers payload and runs it through `parseCasinoOffersPayload`.
- Step 1 now explicitly reads `window.capturedPayloads.offers`, which was the missing handoff path.
- Existing offers/available cruises are preserved if no authoritative payload rows are captured; the app no longer writes empty offer/cruise arrays over valid data.

## Cruise card detail routing fix
- Booked/completed cruise cards now pass route fallback params: `shipName`, `sailDate`, and `bookingId`.
- Cruises tab cards now pass `shipName`, `sailDate`, and `offerCode`.
- Cruise detail page now resolves by:
  1. id
  2. bookingId/reservationNumber
  3. shipName + sailDate
  4. offerCode + shipName + sailDate

This fixes cases where booked/completed cards did not open details because their stored ID did not match the detail page source list.
