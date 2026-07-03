# V1014 SeaPass Typography + Certificate Search/Contrast QA

## Scope
Targeted patch on top of v1013. No weather itinerary marine logic or certificate row parser logic was changed.

## Fixes

### SeaPass typography
- Reduced the dynamic SHIP code value size so `ST` matches the other field values such as deck, stateroom, muster, and reservation.
- Reduced and reweighted the dynamic date overlay so `Jul 5` is less visually pronounced and closer to the original SeaPass screenshot.
- Switched the SeaPass SVG font stack to `Helvetica Neue`, Helvetica, Arial to better match the Royal-style pass rendering and avoid oversized iOS System glyph behavior.

### Certificate list search/filter
- Added an explicit `Search & filter unique sailings` panel after PDF summary cards.
- The search explains that it searches the unique ship/date sailings and all certificate rows.
- Added quick filters: All rows, Booked matches, A certificates, C certificates, Suites, Balconies.
- Filters apply before the existing pinned booked-match sorting.

### Certificate PDF summary contrast
- Changed the light certificate summary chips to dark text on light backgrounds.
- Certificate code, points/rows, and best cabin labels are now readable on the white/light chip backgrounds.

## Version
- App/package: 9.11.14
- iOS build: 9.11.14
- Android versionCode: 91114
