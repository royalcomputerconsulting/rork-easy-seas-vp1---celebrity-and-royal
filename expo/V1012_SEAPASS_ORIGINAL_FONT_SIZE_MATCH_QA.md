# V1012 SeaPass Original Font / Size Match QA

Targeted SeaPass typography patch only.

## Changes

- Updated SeaPass SVG font stack to prefer iOS/System font first before SF Pro / Helvetica fallbacks.
- Adjusted top-right date overlay to better match the approved Royal SeaPass card:
  - keeps `Jul 5` rather than forcing `Jul 05`;
  - slightly reduced date font size;
  - lighter system weight;
  - baseline moved to sit under the time without colliding.
- Adjusted ship-code value overlay (`ST`, `QN`, etc.) to optically match the size of the other editable field values.
- Did not touch weather itinerary marine changes.
- Did not touch certificate row parser rewrite.

## QA Notes

- The app uses the approved SeaPass shell image as the background and only masks/replaces editable fields.
- Native SVG font substitution can differ between iOS preview and exported PNG; this patch makes the stack system-first to reduce mismatch.
