# Easy Seas v8.5.8 Critical Sync QA

## Root causes fixed

### 1. Club Royale offers parsed as zero even though page showed 3 offers
The log showed:
- `All Offers count: 3`
- `found 3 View Sailings button(s)`
- then `Step 1 completed with 0 items`

The actual parsing bug was that Royal renders offer codes joined directly to names, for example:
`Limitless Luck26BCP105Enjoy...`

The old parser required a word boundary before the code, so it failed when the code touched the offer name. v8.5.8 removes that bad boundary assumption and parses codes even when Royal removes spaces.

### 2. Unsafe All Offers click
The log showed the app clicking a giant page container beginning with `Hi, SCOTT...` instead of a real `All Offers (3)` tab. v8.5.8 only clicks a small exact `All Offers (#)` control and skips random coordinate/container clicks.

### 3. Completed cruises button not pulling past cruises
The standalone completed-cruise button previously clicked stale controls and relied only on the upcoming bookings payload. v8.5.8 now:
- opens My Account
- clicks View All / Show All cruises first
- then clicks Past / Completed / Cruise History
- captures expanded booking API payloads from new and old Royal endpoint shapes
- falls back to scraping visible completed cruise rows from the My Account page if Royal does not expose a clean API payload
- merges completed cruises without overwriting active offers, available cruises, or upcoming bookings

### 4. Subscription promo/free-use expiration
Permanent promo/free-use access remains persisted via `easyseas_promo_free_use_never_expires` and is not tied to paid subscription expiration. Paid IAP subscriptions can still expire normally.

### 5. Add Cruise modal accessibility
The Add Cruise modal remains centered, scrollable, keyboard-aware, and has a fixed footer so Save/Cancel stay reachable.

## QA checks performed in code review
- Confirmed offer sync logs now show `Offer sync engine v8.5.8 active`.
- Confirmed completed button logs now show `Completed cruise sync v8.5.8`.
- Confirmed offer code parser handles no-space format like `Limitless Luck26BCP105Enjoy`.
- Confirmed zero-offer overwrite protection remains intact.
- Confirmed completed sync merge uses `allowOfferRemoval: false`, `allowCruiseRemoval: false`, and `allowBookedCruiseRemoval: false`.
- Confirmed network monitor watches expanded Royal booking endpoint families, including profileBookings, profilemanagement profile cruises, profile bookings, booking cruises, pastCruises, and completedCruises.

## What to look for in next log
- `Offer sync engine v8.5.8 active`
- `DOM-first offer scan: expected 3 offer(s), parsed 3 card(s)`
- `Completed cruise sync v8.5.8: opening View All, then Past/Completed cruises...`
- Either API completed cruise rows or `DOM fallback captured X completed/past cruise row(s)`
