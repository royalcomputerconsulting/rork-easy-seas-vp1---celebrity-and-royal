# V1023 Cruise Itinerary Booklet QA

## Feature name
Cruise Itinerary Booklet

## Completed implementation
- Added a structured CruiseItineraryBookletData model to BookedCruise.
- Added reusable CruiseItineraryBooklet UI component.
- Embedded the booklet at the top of booked cruise detail pages.
- Added editable fields for all visible booklet template sections:
  - Source/Gmail match status
  - Cruise Summary
  - Casino / Offer / Value Details
  - Flights / Hotels / Transfers
  - Important Notes
  - Needs Review flags
  - Current Cruise notes
- Added field persistence through CoreDataProvider/updateBookedCruise.
- Added sync protection so saved itineraryBooklet data is preserved when booked cruise sync updates the same reservation.
- Added current-cruise detection and CURRENT CRUISE badge.
- Added BOOKLET NEEDS REVIEW / BOOKLET READY badges.
- Added PNG export with meaningful filename from ship/date.
- Added booked-list sort priority for in-progress cruises.
- Added small ITINERARY BOOKLET badge to booked cruise cards.

## Implementation notes
- The initial booklet auto-fills from existing BookedCruise + linked CasinoOffer fields.
- Unknown fields are intentionally displayed as "Not found / not entered" instead of guessed.
- Manual edits are saved inside `cruise.itineraryBooklet`.
- Field-level source tracking types were added for future Gmail/document source matching expansion.
- Export uses `react-native-view-shot`, `expo-file-system`, and `expo-sharing`, all already present in package.json.

## Still future work
- Direct in-app Gmail search/matching is not implemented because Easy Seas itself does not currently include Gmail OAuth/API plumbing.
- Bulk booklet PDF export from inside the app is not yet implemented; single-cruise PNG export is implemented.
- Automatic parser mapping from uploaded Royal/Celebrity PDFs into the booklet can be added next using the new model.

## Files changed
- `types/models.ts`
- `components/booklet/CruiseItineraryBooklet.tsx`
- `app/(tabs)/(overview)/cruise-details.tsx`
- `app/(tabs)/booked.tsx`
- `components/CruiseCard.tsx`
- `state/CoreDataProvider.tsx`
