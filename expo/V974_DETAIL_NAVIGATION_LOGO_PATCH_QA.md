# Easy Seas v974 / 9.10.74 — Cruise Detail Navigation + Offers Logo Patch

Build: 9.10.74
Engine marker: v9.7.4-detail-navigation-logo
Base: v973 sync review completed UI fix

## Fixes included

1. Hardened appwide cruise-detail navigation.
   - Added `lib/navigation/cruiseDetails.ts`.
   - All major cruise-detail entry points now route to `/cruise-details` with fallback params instead of ID-only where possible.
   - Params include: `id`, `source`, `shipName`, `sailDate`, `returnDate`, `offerCode`, `bookingId`, and `brand`.

2. Updated cruise-detail entry points.
   - Cruises tab / Scheduling
   - Booked tab
   - Offers overview card/list press
   - Offer Details sailing press
   - Events cruise cards
   - Events passenger timeline items
   - Day Agenda cruise items
   - Passenger Calendar cruise items
   - Port History return-to-cruise button
   - Replacement Finder cruise candidates

3. Offers page logo fix.
   - The top Offers/Overview page logo now uses the local Easy Seas / Scott Astin artwork:
     `assets/images/easyseas-scott-astin-logo.jpeg`
   - This removes the old remote logo from the Offers page header.

4. Offer Details logo alignment.
   - The Offer Details header logo also uses the same local Easy Seas / Scott Astin artwork.

## QA performed

- TypeScript syntax parser check across 391 TS/TSX/JS/JSX files: 0 syntax diagnostics.
- Verified no remaining obvious ID-only route pushes in the main app screens for direct cruise-detail UI entry points, except string action routes from diagnostics/Ask My Data where only an ID is available.

## Runtime checks

After install, confirm Admin diagnostic reports:

```text
version: 9.10.74
```

Then test:

1. Cruises tab → tap a cruise → detail opens.
2. Booked tab → tap a booked cruise → detail opens.
3. Offer Details → tap an offer sailing → detail opens.
4. Calendar / Events / Agenda → tap a cruise → detail opens.
5. Port History → tap return-to-cruise button → detail opens.
6. Offers page top logo shows the new Easy Seas / Scott Astin artwork, not the old logo.
